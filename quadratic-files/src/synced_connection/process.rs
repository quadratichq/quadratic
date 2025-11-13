//! Process Synced Connections
//!
//! This module contains the logic for syncing synced connections.
//! Synced connections are synced daily and full.
//! Daily sync is done every 1 hour and full sync is done every 1 minute.
//! The sync is done in a separate thread.

use std::sync::Arc;

use quadratic_rust_shared::{
    quadratic_api::get_synced_connections_by_type,
    synced::{
        SyncedConnection, chunk_date_range, dates_to_sync,
        google_analytics::client::GoogleAnalyticsConnection, mixpanel::MixpanelConnection,
        object_store_path, upload,
    },
};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::to_string;
use uuid::Uuid;

use crate::{
    error::{FilesError, Result},
    state::State,
    synced_connection::{
        SyncKind, SyncedConnectionStatus, can_process_connection, complete_connection_status,
        start_connection_status, update_connection_status,
    },
};

const CHUNK_SIZE: u32 = 30; // 30 days

/// Process all connections.
/// TODO(ddimaria): make this more dynamic
pub(crate) async fn process_all_synced_connections(
    state: Arc<State>,
    sync_kind: SyncKind,
) -> Result<()> {
    process_synced_connections::<MixpanelConnection>(state.clone(), sync_kind.clone()).await?;
    process_synced_connections::<GoogleAnalyticsConnection>(state.clone(), sync_kind.clone())
        .await?;
    Ok(())
}

/// Process all synced connections.
pub(crate) async fn process_synced_connections<
    T: SyncedConnection + Serialize + DeserializeOwned + 'static,
>(
    state: Arc<State>,
    sync_kind: SyncKind,
) -> Result<()> {
    let connection_name = to_string(&sync_kind)?;
    let connections = get_synced_connections_by_type::<T>(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        &connection_name.to_uppercase(),
    )
    .await?;

    tracing::info!("Found {} {connection_name} connections", connections.len());

    // process each connection in a separate thread
    for connection in connections {
        let state = Arc::clone(&state);
        let sync_kind = sync_kind.clone();

        // process the connection in a separate thread
        let connection_name_clone = connection_name.clone();
        tokio::spawn(async move {
            if let Err(e) = process_synced_connection(
                Arc::clone(&state),
                connection.type_details,
                connection.uuid,
                connection.id,
                sync_kind,
            )
            .await
            {
                state.clone().stats.lock().await.num_connections_processing -= 1;
                state
                    .clone()
                    .synced_connection_cache
                    .delete(connection.uuid)
                    .await;

                tracing::error!(
                    "Error processing {connection_name_clone} connection {}: {}",
                    connection.uuid,
                    e
                );
            }
        });
    }

    Ok(())
}

/// Process a synced connection.
pub(crate) async fn process_synced_connection<
    T: SyncedConnection + Serialize + DeserializeOwned,
>(
    state: Arc<State>,
    connection: T,
    connection_id: Uuid,
    synced_connection_id: u64,
    sync_kind: SyncKind,
) -> Result<()> {
    let connection_name = to_string(&sync_kind)?;

    if !can_process_connection(state.clone(), connection_id).await? {
        tracing::info!(
            "Skipping {connection_name} connection {}, kind: {:?}",
            connection_id,
            sync_kind
        );
        return Ok(());
    }

    let object_store = state.settings.object_store.clone();
    let prefix = object_store_path(connection_id, "events");
    let today = chrono::Utc::now().date_naive();
    let run_id = Uuid::new_v4();

    let client = connection.to_client().await?;
    let sync_start_date = connection.start_date();
    let dates_to_exclude = state.synced_connection_cache.get_dates(connection_id).await;
    let mut date_ranges = dates_to_sync(
        &object_store,
        connection_id,
        "events",
        sync_start_date,
        dates_to_exclude,
    )
    .await?;

    if sync_kind == SyncKind::Full && date_ranges.is_empty() {
        return Ok(());
    }

    if sync_kind == SyncKind::Daily {
        date_ranges = vec![(today, today)];
    }

    tracing::info!(
        "Processing {connection_name} connection {}, kind: {:?}, dates: {:?}",
        connection_id,
        sync_kind,
        date_ranges
    );

    let start_time = std::time::Instant::now();
    let mut total_files_processed = 0;
    let mut dates_processed = Vec::new();

    // add the connection to the cache
    state.clone().stats.lock().await.num_connections_processing += 1;
    start_connection_status(
        state.clone(),
        connection_id,
        synced_connection_id,
        run_id,
        connection.kind(),
    )
    .await?;

    for (start_date, end_date) in date_ranges {
        // split the date range into chunks
        let chunks = chunk_date_range(start_date, end_date, CHUNK_SIZE);
        let total_chunks = chunks.len();

        tracing::info!(
            "Exporting {connection_name} events from {} to {} in {} {}-day chunks...",
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
                connection.kind(),
                SyncedConnectionStatus::ApiRequest,
            )
            .await?;

            let results = client.process_all(chunk_start, chunk_end).await?;

            update_connection_status(
                state.clone(),
                connection_id,
                connection.kind(),
                SyncedConnectionStatus::Upload,
            )
            .await?;

            for (stream, parquet_data) in results {
                let stream_prefix = format!("{}/{}", prefix, stream);
                let num_files = upload(&object_store, &stream_prefix, parquet_data)
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

            // add the dates to the cache
            let mut current_date = chunk_start;

            while current_date <= chunk_end {
                state
                    .synced_connection_cache
                    .add_date(connection_id, current_date)
                    .await;
                dates_processed.push(current_date);
                current_date += chrono::Duration::days(1);
            }
        }
    }

    complete_connection_status(
        state.clone(),
        connection_id,
        synced_connection_id,
        run_id,
        dates_processed,
    )
    .await?;

    tracing::info!(
        "Processed {} {connection_name} files in {:?} for connection {}",
        total_files_processed,
        start_time.elapsed(),
        connection_id
    );

    state.clone().stats.lock().await.num_connections_processing -= 1;

    Ok(())
}
