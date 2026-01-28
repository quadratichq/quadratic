use chrono::NaiveDate;
use quadratic_rust_shared::quadratic_api::{
    SyncedConnectionLogStatus, create_synced_connection_log,
};
use quadratic_rust_shared::synced::SyncedConnectionKind;
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{FilesError, Result};
use crate::state::State;

pub(crate) mod background_workers;
pub(crate) mod cache;
pub(crate) mod process;

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum SyncedConnectionStatus {
    Setup,
    ApiRequest,
    Upload,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub(crate) enum SyncKind {
    Daily,
    Full,
}

/// Check if a connection can be processed.
/// - If no sync is running: allow
/// - If FULL is running: block all syncs
/// - If DAILY is running: block DAILY, allow FULL
async fn can_process_connection(
    state: Arc<State>,
    connection_id: Uuid,
    sync_kind: SyncKind,
) -> Result<bool> {
    let status = state.synced_connection_cache.get(connection_id).await;

    match status {
        None => Ok(true), // No sync running, allow
        Some((_, running_sync_kind, _)) => {
            match (running_sync_kind, sync_kind) {
                (SyncKind::Full, _) => Ok(false), // FULL running: block everything
                (SyncKind::Daily, SyncKind::Daily) => Ok(false), // DAILY running: block DAILY
                (SyncKind::Daily, SyncKind::Full) => Ok(true), // DAILY running: allow FULL
            }
        }
    }
}

/// Start a connection status.
async fn start_connection_status(
    state: Arc<State>,
    connection_id: Uuid,
    synced_connection_id: u64,
    run_id: Uuid,
    kind: SyncedConnectionKind,
    sync_kind: SyncKind,
) -> Result<()> {
    state
        .synced_connection_cache
        .add(
            connection_id,
            kind,
            sync_kind,
            SyncedConnectionStatus::Setup,
        )
        .await;

    send_synced_connection_log(
        state.clone(),
        synced_connection_id,
        run_id,
        Vec::new(),
        SyncedConnectionLogStatus::PENDING,
        None,
    )
    .await?;

    // currently, we're sending a RUNNING log immediately after a PENDING log,
    // but this will change once this is handled by pubsub
    send_synced_connection_log(
        state,
        synced_connection_id,
        run_id,
        Vec::new(),
        SyncedConnectionLogStatus::RUNNING,
        None,
    )
    .await?;

    Ok(())
}

/// Update a connection status.
async fn update_connection_status(
    state: Arc<State>,
    connection_id: Uuid,
    kind: SyncedConnectionKind,
    sync_kind: SyncKind,
    status: SyncedConnectionStatus,
) -> Result<()> {
    state
        .synced_connection_cache
        .update(connection_id, kind, sync_kind, status.clone())
        .await;

    Ok(())
}

async fn failed_connection_status(
    state: Arc<State>,
    connection_id: Uuid,
    synced_connection_id: u64,
    run_id: Uuid,
    dates_processed: Vec<NaiveDate>,
    error: String,
) -> Result<()> {
    state.synced_connection_cache.delete(connection_id).await;

    send_synced_connection_log(
        state,
        synced_connection_id,
        run_id,
        dates_processed,
        SyncedConnectionLogStatus::FAILED,
        Some(error),
    )
    .await?;
    Ok(())
}

/// Complete a connection status, which deletes the connection from the cache.
async fn complete_connection_status(
    state: Arc<State>,
    connection_id: Uuid,
    synced_connection_id: u64,
    run_id: Uuid,
    dates_processed: Vec<NaiveDate>,
) -> Result<()> {
    state.synced_connection_cache.delete(connection_id).await;

    send_synced_connection_log(
        state,
        synced_connection_id,
        run_id,
        dates_processed,
        SyncedConnectionLogStatus::COMPLETED,
        None,
    )
    .await?;

    Ok(())
}

/// Send a synced connection log.
pub async fn send_synced_connection_log(
    state: Arc<State>,
    synced_connection_id: u64,
    run_id: Uuid,
    dates_processed: Vec<NaiveDate>,
    status: SyncedConnectionLogStatus,
    error: Option<String>,
) -> Result<()> {
    let url = state.settings.quadratic_api_uri.clone();
    let jwt = state.settings.m2m_auth_token.clone();

    create_synced_connection_log(
        &url,
        &jwt,
        run_id,
        synced_connection_id,
        dates_processed,
        status,
        error,
    )
    .await
    .map_err(|e| FilesError::QuadraticApi(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::synced_connection::{SyncedConnectionKind, SyncedConnectionStatus};
    use crate::test_util::new_arc_state;
    use chrono::Utc;
    use httpmock::prelude::*;
    use serial_test::serial;
    use uuid::Uuid;

    fn mock_log_response(
        synced_connection_id: u64,
        run_id: Uuid,
        status: &str,
    ) -> serde_json::Value {
        serde_json::json!({
            "id": 1,
            "syncedConnectionId": synced_connection_id,
            "runId": run_id,
            "syncedDates": [],
            "status": status,
            "error": null,
            "createdDate": Utc::now().to_rfc3339()
        })
    }

    fn mock_server() -> MockServer {
        let server = MockServer::start();

        // TODO: Audit that the environment access only happens in single-threaded code.
        unsafe {
            // Set both prefixed and unprefixed versions to ensure the mock URL is used
            std::env::set_var("FILES__QUADRATIC_API_URI", server.base_url());
            std::env::set_var("QUADRATIC_API_URI", server.base_url());
        }

        server
    }

    #[tokio::test]
    async fn test_can_process_connection() {
        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();
        let can_process = can_process_connection(state.clone(), connection_id, SyncKind::Full)
            .await
            .unwrap();

        assert!(can_process);

        update_connection_status(
            state.clone(),
            connection_id,
            SyncedConnectionKind::Mixpanel,
            SyncKind::Full,
            SyncedConnectionStatus::Setup,
        )
        .await
        .unwrap();
        let can_process = can_process_connection(state, connection_id, SyncKind::Full)
            .await
            .unwrap();

        assert!(!can_process);
    }

    #[tokio::test]
    #[serial]
    async fn test_start_connection_status() {
        let server = mock_server();
        let synced_connection_id = 1u64;
        let run_id = Uuid::new_v4();

        // Mock log calls (PENDING and RUNNING)
        let mock = server.mock(|when, then| {
            when.method(POST).path(format!(
                "/v0/internal/synced-connection/{}/log",
                synced_connection_id
            ));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(mock_log_response(synced_connection_id, run_id, "PENDING"));
        });

        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();

        let result = start_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            SyncedConnectionKind::Mixpanel,
            SyncKind::Full,
        )
        .await;

        mock.assert_calls(2); // PENDING and RUNNING
        assert!(result.is_ok());

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_some());

        let (kind, sync_kind, status) = status.unwrap();
        assert!(matches!(kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(sync_kind, SyncKind::Full));
        assert!(matches!(status, SyncedConnectionStatus::Setup));
    }

    #[tokio::test]
    #[serial]
    async fn test_update_connection_status() {
        let server = mock_server();
        let synced_connection_id = 1u64;
        let run_id = Uuid::new_v4();

        // Mock log calls for start_connection_status
        let mock = server.mock(|when, then| {
            when.method(POST).path(format!(
                "/v0/internal/synced-connection/{}/log",
                synced_connection_id
            ));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(mock_log_response(synced_connection_id, run_id, "PENDING"));
        });

        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();

        let result = start_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            SyncedConnectionKind::Mixpanel,
            SyncKind::Full,
        )
        .await;
        mock.assert_calls(2);
        assert!(result.is_ok());

        update_connection_status(
            state.clone(),
            connection_id,
            SyncedConnectionKind::Mixpanel,
            SyncKind::Full,
            SyncedConnectionStatus::ApiRequest,
        )
        .await
        .unwrap();

        let cached_status = state.synced_connection_cache.get(connection_id).await;
        assert!(cached_status.is_some());

        let (kind, sync_kind, status) = cached_status.unwrap();
        assert!(matches!(kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(sync_kind, SyncKind::Full));
        assert!(matches!(status, SyncedConnectionStatus::ApiRequest));
    }

    #[tokio::test]
    #[serial]
    async fn test_complete_connection_status() {
        let server = mock_server();
        let synced_connection_id = 1u64;
        let run_id = Uuid::new_v4();

        // Mock log calls (PENDING, RUNNING, and COMPLETED)
        let mock = server.mock(|when, then| {
            when.method(POST).path(format!(
                "/v0/internal/synced-connection/{}/log",
                synced_connection_id
            ));
            then.status(200)
                .header("content-type", "application/json")
                .json_body(mock_log_response(synced_connection_id, run_id, "PENDING"));
        });

        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();

        let result = start_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            SyncedConnectionKind::Mixpanel,
            SyncKind::Full,
        )
        .await;
        assert!(result.is_ok());

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_some(), "Connection should be in cache");

        let dates_processed = vec![NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()];
        let result = complete_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            dates_processed,
        )
        .await;

        mock.assert_calls(3); // PENDING, RUNNING, and COMPLETED
        assert!(result.is_ok());

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_none());
    }
}
