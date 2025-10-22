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
        get_missing_date_ranges,
        mixpanel::{MixpanelConnection, client::MixpanelClient, events::ExportParams},
        upload,
    },
};
use uuid::Uuid;

use crate::{
    error::{FilesError, Result},
    state::State,
    synced_connection::{SyncKind, SyncedConnectionKind, SyncedConnectionStatus},
};

const MAX_DAYS_TO_EXPORT: i64 = 365 * 2; // 2 years
const CHUNK_SIZE: u32 = 30; // 30 days

/// Process all Mixpanel connections.
pub(crate) async fn process_mixpanel_connections(
    state: Arc<State>,
    sync_kind: SyncKind,
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
        let sync_kind = sync_kind.clone();

        tokio::spawn(async move {
            if let Err(e) = process_mixpanel_connection(
                state,
                connection.type_details,
                connection.uuid,
                sync_kind,
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
    sync_kind: SyncKind,
) -> Result<()> {
    if !can_process_connection(state.clone(), connection_id).await? {
        tracing::trace!("Skipping Mixpanel connection {}", connection_id);
        return Ok(());
    }

    // add the connection to the cache
    state.clone().stats.lock().await.num_connections_processing += 1;
    start_connection_status(state.clone(), connection_id, SyncedConnectionKind::Mixpanel).await;

    let object_store = state.settings.object_store.clone();
    let prefix = object_store_path(connection_id, "events");
    let today = chrono::Utc::now().date_naive();

    let MixpanelConnection {
        ref api_secret,
        ref project_id,
        ref start_date,
    } = connection;
    let client = MixpanelClient::new(api_secret, project_id);
    let sync_start_date = NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().date_naive());
    let mut date_ranges =
        dates_to_sync(state.clone(), connection_id, "events", sync_start_date).await?;

    if date_ranges.is_empty() {
        return Ok(());
    }

    if sync_kind == SyncKind::Daily {
        date_ranges = vec![(today, today)];
    }

    let start_time = std::time::Instant::now();
    let mut total_files_processed = 0;

    for (start_date, end_date) in date_ranges {
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

            // add the dates to the cache
            let mut current_date = chunk_start;

            while current_date <= chunk_end {
                state
                    .synced_connection_cache
                    .add_date(connection_id, current_date)
                    .await;
                current_date += chrono::Duration::days(1);
            }
        }
    }

    complete_connection_status(state.clone(), connection_id).await;

    tracing::info!(
        "Processed {} Mixpanel files in {:?}",
        total_files_processed,
        start_time.elapsed()
    );

    state.clone().stats.lock().await.num_connections_processing -= 1;

    Ok(())
}

/// Get the start and end dates for a connection from the object store.
async fn dates_to_sync(
    state: Arc<State>,
    connection_id: Uuid,
    table_name: &str,
    sync_start_date: NaiveDate,
) -> Result<Vec<(NaiveDate, NaiveDate)>> {
    let object_store = state.settings.object_store.clone();
    let today = chrono::Utc::now().date_naive();
    let prefix = object_store_path(connection_id, table_name);
    let end_date = today;
    let dates_to_exclude = state.synced_connection_cache.get_dates(connection_id).await;

    let missing_date_ranges = get_missing_date_ranges(
        &object_store,
        Some(&prefix),
        sync_start_date,
        end_date,
        dates_to_exclude,
    )
    .await?;

    Ok(missing_date_ranges)
}

/// Split a date range into `chunk_size` chunks.
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
        process_mixpanel_connections(state, SyncKind::Daily)
            .await
            .unwrap();
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
        let sync_start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let chunks = dates_to_sync(state, connection_id, table_name, sync_start_date)
            .await
            .unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 14).unwrap()
            )
        );
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
