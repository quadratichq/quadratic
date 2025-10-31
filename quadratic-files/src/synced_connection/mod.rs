use chrono::NaiveDate;
use quadratic_rust_shared::quadratic_api::create_synced_connection_log;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::Result;
use crate::state::State;

pub(crate) mod background_workers;
pub(crate) mod cache;
pub(crate) mod mixpanel;

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub(crate) enum SyncedConnectionKind {
    Mixpanel,
}

#[derive(Debug, Clone)]
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
    kind: SyncedConnectionKind,
) {
    state
        .synced_connection_cache
        .add(connection_id, kind, SyncedConnectionStatus::Setup)
        .await;
}

/// Update a connection status.
async fn update_connection_status(
    state: Arc<State>,
    connection_id: Uuid,
    kind: SyncedConnectionKind,
    status: SyncedConnectionStatus,
) {
    state
        .synced_connection_cache
        .update(connection_id, kind, status)
        .await;
}

/// Complete a connection status, which deletes the connection from the cache.
async fn complete_connection_status(
    state: Arc<State>,
    connection_id: Uuid,
    dates_processed: Vec<NaiveDate>,
) {
    state.synced_connection_cache.delete(connection_id).await;

    send_synced_connection_logs(state, connection_id, dates_processed).await;
}

pub async fn send_synced_connection_logs(
    state: Arc<State>,
    connection_id: Uuid,
    dates_processed: Vec<NaiveDate>,
) {
    let url = state.settings.quadratic_api_uri.clone();
    let jwt = state.settings.m2m_auth_token.clone();
    let error_message = format!(
        "Failed to send synced connection logs for connection {}",
        connection_id
    );
    create_synced_connection_log(&url, jwt, &error_message).await?;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::synced_connection::{SyncedConnectionKind, SyncedConnectionStatus};
    use crate::test_util::new_arc_state;
    use uuid::Uuid;

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
        .await;
        let can_process = can_process_connection(state, connection_id).await.unwrap();

        assert!(!can_process);
    }

    #[tokio::test]
    async fn test_start_connection_status() {
        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();

        start_connection_status(state.clone(), connection_id, SyncedConnectionKind::Mixpanel).await;

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

        start_connection_status(state.clone(), connection_id, SyncedConnectionKind::Mixpanel).await;
        update_connection_status(
            state.clone(),
            connection_id,
            SyncedConnectionKind::Mixpanel,
            SyncedConnectionStatus::ApiRequest,
        )
        .await;

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

        start_connection_status(state.clone(), connection_id, SyncedConnectionKind::Mixpanel).await;

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_some(), "Connection should be in cache");

        let dates_processed = vec![NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()];
        complete_connection_status(state.clone(), connection_id, dates_processed).await;

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_none());
    }
}
