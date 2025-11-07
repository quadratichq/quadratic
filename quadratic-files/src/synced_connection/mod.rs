use chrono::NaiveDate;
use quadratic_rust_shared::quadratic_api::{
    SyncedConnectionLogStatus, create_synced_connection_log,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{FilesError, Result};
use crate::state::State;

pub(crate) mod background_workers;
pub(crate) mod cache;
pub(crate) mod mixpanel;

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub(crate) enum SyncedConnectionKind {
    Mixpanel,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum SyncedConnectionStatus {
    Setup,
    ApiRequest,
    Upload,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum SyncKind {
    Daily,
    Full,
}

/// Check if a connection can be processed.  A connection can be processed if it is not already being processed.
async fn can_process_connection(state: Arc<State>, connection_id: Uuid) -> Result<bool> {
    let status = state.synced_connection_cache.get(connection_id).await;
    Ok(status.is_none())
}

/// Start a connection status.
async fn start_connection_status(
    state: Arc<State>,
    connection_id: Uuid,
    synced_connection_id: u64,
    run_id: Uuid,
    kind: SyncedConnectionKind,
) -> Result<()> {
    state
        .synced_connection_cache
        .add(connection_id, kind, SyncedConnectionStatus::Setup)
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
    status: SyncedConnectionStatus,
) -> Result<()> {
    state
        .synced_connection_cache
        .update(connection_id, kind, status.clone())
        .await;

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
    use uuid::Uuid;

    fn handle_quadratic_api_response(result: Result<()>) {
        match result {
            // local tests have quadratic api running locally, so we expect a success
            Ok(_) => {}
            // CI tests don't have quadratic api running locally, so we expect a QuadraticApi error
            Err(FilesError::QuadraticApi(e)) => {
                assert!(e.contains("Error communicating with the Quadratic API"));
            }
            Err(e) => panic!("Expected QuadraticApi error, got {}", e),
        }
    }

    #[tokio::test]
    async fn test_can_process_connection() {
        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();
        let can_process = can_process_connection(state.clone(), connection_id)
            .await
            .unwrap();

        assert!(can_process);

        update_connection_status(
            state.clone(),
            connection_id,
            SyncedConnectionKind::Mixpanel,
            SyncedConnectionStatus::Setup,
        )
        .await
        .unwrap();
        let can_process = can_process_connection(state, connection_id).await.unwrap();

        assert!(!can_process);
    }

    #[tokio::test]
    async fn test_start_connection_status() {
        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();
        let synced_connection_id = 1;
        let run_id = Uuid::new_v4();

        let result = start_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            SyncedConnectionKind::Mixpanel,
        )
        .await;

        handle_quadratic_api_response(result);

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_some());

        let (kind, status) = status.unwrap();
        assert!(matches!(kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(status, SyncedConnectionStatus::Setup));
    }

    #[tokio::test]
    async fn test_update_connection_status() {
        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();
        let synced_connection_id = 1;
        let run_id = Uuid::new_v4();

        let result = start_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            SyncedConnectionKind::Mixpanel,
        )
        .await;

        handle_quadratic_api_response(result);

        update_connection_status(
            state.clone(),
            connection_id,
            SyncedConnectionKind::Mixpanel,
            SyncedConnectionStatus::ApiRequest,
        )
        .await
        .unwrap();

        let cached_status = state.synced_connection_cache.get(connection_id).await;
        assert!(cached_status.is_some());

        let (kind, status) = cached_status.unwrap();
        assert!(matches!(kind, SyncedConnectionKind::Mixpanel));
        assert!(matches!(status, SyncedConnectionStatus::ApiRequest));
    }

    #[tokio::test]
    async fn test_complete_connection_status() {
        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();
        let synced_connection_id = 1;
        let run_id = Uuid::new_v4();

        let result = start_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            SyncedConnectionKind::Mixpanel,
        )
        .await;

        handle_quadratic_api_response(result);

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_some(), "Connection should be in cache");

        let dates_processed = vec![NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()];
        complete_connection_status(
            state.clone(),
            connection_id,
            synced_connection_id,
            run_id,
            dates_processed,
        )
        .await
        .unwrap();

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_none());
    }
}
