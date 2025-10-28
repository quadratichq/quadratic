//! Mixpanel Synced Connection
//!
//! This module contains the logic for syncing Mixpanel connections.
//! Mixpanel connections are synced daily and full.
//! Daily sync is done every 1 hour and full sync is done every 1 minute.
//! The sync is done in a separate thread.

use std::sync::Arc;

use chrono::NaiveDate;
use quadratic_rust_shared::{
    quadratic_api::get_connections_by_type,
    synced::{
        mixpanel::{MixpanelConnection, client::MixpanelClient, events::ExportParams},
        upload,
    },
};
use uuid::Uuid;

use crate::{
    error::{FilesError, Result},
    state::State,
    synced_connection::{
        SyncKind, SyncedConnectionKind, SyncedConnectionStatus, can_process_connection,
        chunk_date_range, complete_connection_status, dates_to_sync, object_store_path,
        start_connection_status, update_connection_status,
    },
};

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

    tracing::trace!("Found {} Mixpanel connections", connections.len());

    // process each connection in a separate thread
    for connection in connections {
        let state = Arc::clone(&state);
        let sync_kind = sync_kind.clone();

        tokio::spawn(async move {
            if let Err(e) = process_mixpanel_connection(
                Arc::clone(&state),
                connection.type_details,
                connection.uuid,
                sync_kind,
            )
            .await
            {
                state.clone().stats.lock().await.num_connections_processing -= 1;

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

        tracing::trace!(
            "Exporting Mixpanel events from {} to {} in {} {}-day chunks...",
            start_date,
            end_date,
            total_chunks,
            CHUNK_SIZE
        );

        // Process each chunk in reverse order (most recent first)
        for (chunk_index, (chunk_start, chunk_end)) in chunks.into_iter().rev().enumerate() {
            tracing::trace!(
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

            tracing::trace!(
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
        "Processed {} Mixpanel files in {:?} for connection {}",
        total_files_processed,
        start_time.elapsed(),
        connection_id
    );

    state.clone().stats.lock().await.num_connections_processing -= 1;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::new_arc_state;

    #[tokio::test]
    #[ignore]
    async fn test_process_mixpanel() {
        let state = new_arc_state().await;
        process_mixpanel_connections(state, SyncKind::Daily)
            .await
            .unwrap();
    }
}
