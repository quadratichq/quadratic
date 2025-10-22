//! Synced Connection
//!
//! Synced connections are connections that are synced to the object store on
//! behalf of the user.  Data is downloaded from the source, grouped by day,
//! converted to parquet, and uploaded to the object store.
//!
//! We currently only support Mixpanel, but plan to add more in the future.

use std::sync::Arc;

use chrono::NaiveDate;
use quadratic_rust_shared::{
    quadratic_api::get_connections_by_type,
    synced::{
        get_last_date_processed,
        mixpanel::{MixpanelConnection, client::MixpanelClient, events::ExportParams},
        upload,
    },
};
use uuid::Uuid;

use crate::{
    error::{FilesError, Result},
    state::State,
    synced_connection::{DateRange, SyncedConnectionKind, SyncedConnectionStatus},
};

const MAX_DAYS_TO_EXPORT: i64 = 365 * 2; // 2 years
const CHUNK_SIZE: u32 = 30; // 30 days

/// Process all Mixpanel connections.
pub(crate) async fn process_mixpanel_connections(
    state: Arc<State>,
    date_range: Option<DateRange>,
) -> Result<()> {
    let connections = get_connections_by_type::<MixpanelConnection>(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        "MIXPANEL",
    )
    .await?;

    tracing::info!("Found {} Mixpanel connections", connections.len());

    // process each connection in a separate thread
    for connection in connections {
        let state = Arc::clone(&state);
        let date_range = date_range.clone();

        tokio::spawn(async move {
            if let Err(e) = process_mixpanel_connection(
                state,
                connection.type_details,
                connection.uuid,
                date_range,
            )
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
    date_range: Option<DateRange>,
) -> Result<()> {
    if !can_process_connection(state.clone(), connection_id).await? {
        tracing::info!("Skipping Mixpanel connection {}", connection_id);
        return Ok(());
    }

    // add the connection to the cache
    state.clone().stats.lock().await.num_connections_processing += 1;
    start_connection_status(state.clone(), connection_id, SyncedConnectionKind::Mixpanel).await;

    let object_store = state.settings.object_store.clone();
    let prefix = object_store_path(connection_id, "events");

    let MixpanelConnection {
        ref api_secret,
        ref project_id,
        ref start_date,
    } = connection;
    let client = MixpanelClient::new(api_secret, project_id);
    let start_collection_data = NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().date_naive());

    let (start_date, end_date) = match date_range {
        Some(date_range) => (date_range.start_date, start_collection_data),
        None => dates(state.clone(), connection_id, "events").await,
    };
    let start_time = std::time::Instant::now();

    // split the date range into chunks
    let chunks = chunk_date_range(start_date, end_date, CHUNK_SIZE);
    let total_chunks = chunks.len();

    tracing::info!(
        "Exporting Mixpanel events from {} to {} in {} {}-day chunks...",
        start_date,
        end_date,
        total_chunks,
        CHUNK_SIZE
    );

    let mut total_files_processed = 0;

    // Process each chunk in reverse order (most recent first)
    for (chunk_index, (chunk_start, chunk_end)) in chunks.into_iter().rev().enumerate() {
        tracing::info!(
            "Processing chunk {}/{}: {} to {}",
            chunk_index + 1,
            total_chunks,
            chunk_start,
            chunk_end
        );

        update_connection_status(
            state.clone(),
            connection_id,
            SyncedConnectionKind::Mixpanel,
            SyncedConnectionStatus::ApiRequest,
        )
        .await;

        let params = ExportParams::new(chunk_start, chunk_end);
        let parquet_data = client.export_events_streaming(params).await.map_err(|e| {
            FilesError::SyncedConnection(format!(
                "Failed to export events for chunk {}: {}",
                chunk_index + 1,
                e
            ))
        })?;

        update_connection_status(
            state.clone(),
            connection_id,
            SyncedConnectionKind::Mixpanel,
            SyncedConnectionStatus::Upload,
        )
        .await;

        let num_files = upload(&object_store, &prefix, parquet_data)
            .await
            .map_err(|e| {
                FilesError::SyncedConnection(format!(
                    "Failed to upload events for chunk {}: {}",
                    chunk_index + 1,
                    e
                ))
            })?;

        total_files_processed += num_files;

        tracing::info!(
            "Completed chunk {}/{}: processed {} files",
            chunk_index + 1,
            total_chunks,
            num_files
        );
    }

    complete_connection_status(state.clone(), connection_id).await;

    tracing::info!(
        "Processed {} Mixpanel files across {} chunks in {:?}",
        total_files_processed,
        total_chunks,
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
    let mut start_date = today - chrono::Duration::days(MAX_DAYS_TO_EXPORT - 1);

    tracing::info!("Start date 1: {}, End date 1: {}", start_date, end_date);

    // if we have any objects, use the last date processed
    if let Ok(Some(new_start_date)) = get_last_date_processed(&object_store, Some(&prefix)).await {
        start_date = new_start_date;
    };

    tracing::info!("Start date: {}, End date: {}", start_date, end_date);

    (start_date, end_date)
}

/// Split a date range into weekly chunks.
fn chunk_date_range(
    start_date: NaiveDate,
    end_date: NaiveDate,
    chunk_size: u32,
) -> Vec<(NaiveDate, NaiveDate)> {
    let mut chunks = Vec::new();
    let mut current_start = start_date;

    while current_start <= end_date {
        let current_end = std::cmp::min(
            current_start + chrono::Duration::days(chunk_size as i64 - 1),
            end_date,
        );
        chunks.push((current_start, current_end));
        current_start = current_end + chrono::Duration::days(1);
    }

    chunks
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
    use super::*;
    use crate::synced_connection::{SyncedConnectionKind, SyncedConnectionStatus};
    use crate::test_util::new_arc_state;
    use uuid::Uuid;

    #[tokio::test]
    #[ignore]
    async fn test_process_mixpanel() {
        let state = new_arc_state().await;
        process_mixpanel_connections(state, None).await.unwrap();
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
        let expected_start = today - chrono::Duration::days(MAX_DAYS_TO_EXPORT - 1);

        assert_eq!(end_date, today);
        assert_eq!(start_date, expected_start);
    }

    #[test]
    fn test_split_date_range_into_weeks() {
        use chrono::NaiveDate;

        // Test a simple 2-week range
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 14).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);
        println!("chunks: {:?}", chunks);
        assert_eq!(chunks.len(), 2);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 7).unwrap()
            )
        );
        assert_eq!(
            chunks[1],
            (
                NaiveDate::from_ymd_opt(2024, 1, 8).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 14).unwrap()
            )
        );

        // Test a partial week
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 3).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);

        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 3).unwrap()
            )
        );

        // Test single day
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);

        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()
            )
        );

        // Test exactly 7 days
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 7).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);

        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 7).unwrap()
            )
        );
    }
}
