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
    process_synced_connections::<MixpanelConnection>(state.clone(), sync_kind.clone(), "MIXPANEL")
        .await?;
    process_synced_connections::<GoogleAnalyticsConnection>(
        state.clone(),
        sync_kind.clone(),
        "GOOGLE_ANALYTICS",
    )
    .await?;
    Ok(())
}

/// Process all synced connections.
pub(crate) async fn process_synced_connections<
    T: SyncedConnection + Serialize + DeserializeOwned + 'static,
>(
    state: Arc<State>,
    sync_kind: SyncKind,
    connection_type: &str,
) -> Result<()> {
    let connections = get_synced_connections_by_type::<T>(
        &state.settings.quadratic_api_uri,
        &state.settings.m2m_auth_token,
        &connection_type.to_uppercase(),
    )
    .await?;

    tracing::info!("Found {} {connection_type} connections", connections.len());

    // process each connection in a separate thread
    for connection in connections {
        let state = Arc::clone(&state);
        let sync_kind = sync_kind.clone();

        // process the connection in a separate thread
        tokio::spawn(async move {
            let connection_name = connection.type_details.name().to_owned();

            if let Err(e) = process_synced_connection(
                Arc::clone(&state),
                connection.type_details,
                connection.uuid,
                connection.id,
                sync_kind,
            )
            .await
            {
                state
                    .clone()
                    .stats
                    .lock()
                    .await
                    .decrement_num_connections_processing();
                state
                    .clone()
                    .synced_connection_cache
                    .delete(connection.uuid)
                    .await;

                tracing::error!(
                    "Error processing {} connection {}: {}",
                    connection_name,
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
    let connection_name = connection.name();

    if !can_process_connection(state.clone(), connection_id, sync_kind.clone()).await? {
        tracing::info!(
            "Skipping {connection_name} connection {}, kind: {:?}",
            connection_id,
            sync_kind
        );
        return Ok(());
    }

    let object_store = state.settings.object_store.clone();
    let today = chrono::Utc::now().date_naive();
    let run_id = Uuid::new_v4();

    let sync_start_date = connection.start_date();
    let streams = connection.streams();
    let client = connection.to_client().await?;

    tracing::info!(
        "Processing {connection_name} connection {} with {} stream(s): {:?}",
        connection_id,
        streams.len(),
        streams
    );

    let start_time = std::time::Instant::now();
    let mut total_files_processed = 0;

    // add the connection to the cache
    state
        .clone()
        .stats
        .lock()
        .await
        .increment_num_connections_processing();
    start_connection_status(
        state.clone(),
        connection_id,
        synced_connection_id,
        run_id,
        connection.kind(),
        sync_kind.clone(),
    )
    .await?;

    // Process each stream/table
    for stream in streams {
        tracing::info!(
            "Processing stream '{}' for {connection_name} connection {}",
            stream,
            connection_id
        );

        let dates_to_exclude = state
            .synced_connection_cache
            .get_dates(connection_id, stream)
            .await;
        let mut date_ranges = dates_to_sync(
            &object_store,
            connection_id,
            stream,
            sync_start_date,
            dates_to_exclude,
        )
        .await?;

        if sync_kind == SyncKind::Full && date_ranges.is_empty() {
            tracing::info!(
                "Skipping stream '{}' for {connection_name} connection {}, kind: {:?}, no dates to sync",
                stream,
                connection_id,
                sync_kind
            );
            continue;
        }

        if sync_kind == SyncKind::Daily {
            date_ranges = vec![(today, today)];
        }

        tracing::info!(
            "Processing stream '{}' for {connection_name} connection {}, kind: {:?}, dates: {:?}",
            stream,
            connection_id,
            sync_kind,
            date_ranges
        );

        let mut dates_processed = Vec::new();
        let prefix = object_store_path(connection_id, stream);

        for (start_date, end_date) in date_ranges {
            // split the date range into chunks
            let chunks = chunk_date_range(start_date, end_date, CHUNK_SIZE);
            let total_chunks = chunks.len();

            tracing::info!(
                "Exporting {connection_name} stream '{}' from {} to {} in {} {}-day chunks...",
                stream,
                start_date,
                end_date,
                total_chunks,
                CHUNK_SIZE
            );

            // Process each chunk in reverse order (most recent first)
            for (chunk_index, (chunk_start, chunk_end)) in chunks.into_iter().rev().enumerate() {
                tracing::info!(
                    "Processing stream '{}' chunk {}/{}: {} to {}",
                    stream,
                    chunk_index + 1,
                    total_chunks,
                    chunk_start,
                    chunk_end
                );

                update_connection_status(
                    state.clone(),
                    connection_id,
                    connection.kind(),
                    sync_kind.clone(),
                    SyncedConnectionStatus::ApiRequest,
                )
                .await?;

                let parquet_data = client.process(stream, chunk_start, chunk_end).await?;

                update_connection_status(
                    state.clone(),
                    connection_id,
                    connection.kind(),
                    sync_kind.clone(),
                    SyncedConnectionStatus::Upload,
                )
                .await?;

                let num_files =
                    upload(&object_store, &prefix, parquet_data)
                        .await
                        .map_err(|e| {
                            FilesError::SyncedConnection(format!(
                                "Failed to upload stream '{}' for chunk {}: {}",
                                stream,
                                chunk_index + 1,
                                e
                            ))
                        })?;

                total_files_processed += num_files;

                tracing::info!(
                    "Completed stream '{}' chunk {}/{}: processed {} files",
                    stream,
                    chunk_index + 1,
                    total_chunks,
                    num_files
                );

                // add the dates to the cache
                let mut current_date = chunk_start;

                while current_date <= chunk_end {
                    state
                        .synced_connection_cache
                        .add_date(connection_id, stream, current_date)
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
    }

    tracing::info!(
        "Processed {} {connection_name} files in {:?} for connection {}",
        total_files_processed,
        start_time.elapsed(),
        connection_id
    );

    state
        .clone()
        .stats
        .lock()
        .await
        .decrement_num_connections_processing();

    Ok(())
}
