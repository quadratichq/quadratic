use chrono::NaiveDate;
use quadratic_rust_shared::synced::get_missing_date_ranges;
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
