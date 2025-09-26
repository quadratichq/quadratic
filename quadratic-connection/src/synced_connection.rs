use std::sync::Arc;

use chrono::NaiveDate;
use quadratic_rust_shared::{
    quadratic_api::get_connections_by_type,
    synced::{
        get_last_date_processed,
        mixpanel::{client::MixpanelClient, events::ExportParams},
        upload,
    },
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{ConnectionError, Result},
    state::{
        State,
        synced_connection_cache::{SyncedConnectionKind, SyncedConnectionStatus},
    },
};

const MAX_DAYS_TO_EXPORT: i64 = 180;

#[derive(Debug, Deserialize, Serialize)]
pub struct MixpanelConnection {
    pub api_secret: String,
    pub project_id: String,
}

/// Process all Mixpanel connections.
pub(crate) async fn process_mixpanel_connections(state: Arc<State>) -> Result<()> {
    let connections = get_connections_by_type::<MixpanelConnection>(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        "MIXPANEL",
    )
    .await?;

    tracing::info!("Found {} Mixpanel connections", connections.len());

    // process each connection in a separate thread
    for connection in connections {
        let cloned_state = Arc::clone(&state);
        tokio::spawn(async move {
            if let Err(e) =
                process_mixpanel_connection(cloned_state, connection.type_details, connection.uuid)
                    .await
            {
                tracing::error!(
                    "Error processing Mixpanel connection {}: {}",
                    connection.uuid,
                    e
                );
            }
        });
    }

    Ok(())
}

/// Process a Mixpanel connection.
pub(crate) async fn process_mixpanel_connection(
    state: Arc<State>,
    connection: MixpanelConnection,
    connection_id: Uuid,
) -> Result<()> {
    if !can_process_connection(state.clone(), connection_id).await? {
        tracing::info!("Skipping Mixpanel connection {}d", connection_id);
        return Ok(());
    }

    // add the connection to the cache
    state.clone().stats.lock().await.num_connections_processing += 1;
    start_connection_status(state.clone(), connection_id, SyncedConnectionKind::Mixpanel).await;

    let object_store = state.settings.object_store.clone();
    let prefix = object_store_path(connection_id, "events");
    let (start_date, end_date) = dates(state.clone(), connection_id, "events").await;
    let start_time = std::time::Instant::now();

    let MixpanelConnection {
        ref api_secret,
        ref project_id,
    } = connection;
    let client = MixpanelClient::new(api_secret, project_id);

    tracing::info!(
        "Exporting Mixpanel events from {} to {}...",
        start_date,
        end_date
    );

    update_connection_status(
        state.clone(),
        connection_id,
        SyncedConnectionKind::Mixpanel,
        SyncedConnectionStatus::ApiRequest,
    )
    .await;

    let params = ExportParams::new(start_date, end_date);
    let parquet_data = client
        .export_events(params)
        .await
        .map_err(|e| ConnectionError::Synced(format!("Failed to export events: {}", e)))?;

    update_connection_status(
        state.clone(),
        connection_id,
        SyncedConnectionKind::Mixpanel,
        SyncedConnectionStatus::Upload,
    )
    .await;

    let num_files = upload(&object_store, &prefix, parquet_data)
        .await
        .map_err(|e| ConnectionError::Synced(format!("Failed to upload events: {}", e)))?;

    complete_connection_status(state.clone(), connection_id).await;

    tracing::info!(
        "Processed {} Mixpanel files in {:?}",
        num_files,
        start_time.elapsed()
    );

    state.clone().stats.lock().await.num_connections_processing -= 1;

    Ok(())
}

/// Get the start and end dates for a connection from the object store.
async fn dates(state: Arc<State>, connection_id: Uuid, table_name: &str) -> (NaiveDate, NaiveDate) {
    let object_store = state.settings.object_store.clone();
    let today = chrono::Utc::now().date_naive();
    let prefix = object_store_path(connection_id, table_name);
    let end_date = today;
    let mut start_date = today - chrono::Duration::days(MAX_DAYS_TO_EXPORT);

    // if we have any objects, use the last date processed
    if let Ok(Some(object_store_start_date)) =
        get_last_date_processed(&object_store, Some(&prefix)).await
    {
        start_date = object_store_start_date;
    };

    (start_date, end_date)
}

/// Get the object store path for a table
fn object_store_path(connection_id: Uuid, table_name: &str) -> String {
    format!("{}/{}", connection_id, table_name)
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
async fn complete_connection_status(state: Arc<State>, connection_id: Uuid) {
    state.synced_connection_cache.delete(connection_id).await;
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::state::synced_connection_cache::{SyncedConnectionKind, SyncedConnectionStatus};
    use crate::test_util::new_arc_state;

    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_process_mixpanel() {
        let state = new_arc_state().await;
        process_mixpanel_connections(state).await.unwrap();
    }

    #[tokio::test]
    async fn test_object_store_path() {
        let connection_id = Uuid::new_v4();
        let table_name = "events";
        let path = object_store_path(connection_id, table_name);
        let expected = format!("{}/{}", connection_id, table_name);

        assert_eq!(path, expected);
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

        complete_connection_status(state.clone(), connection_id).await;

        let status = state.synced_connection_cache.get(connection_id).await;
        assert!(status.is_none());
    }

    #[tokio::test]
    async fn test_dates_returns_correct_range() {
        let state = new_arc_state().await;
        let connection_id = Uuid::new_v4();
        let table_name = "events";
        let (start_date, end_date) = dates(state, connection_id, table_name).await;
        let today = chrono::Utc::now().date_naive();
        let expected_start = today - chrono::Duration::days(MAX_DAYS_TO_EXPORT);

        assert_eq!(end_date, today);
        assert_eq!(start_date, expected_start);
    }
}
