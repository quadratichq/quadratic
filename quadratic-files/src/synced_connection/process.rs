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
        SyncedConnection, SyncedConnectionKind, chunk_date_range, dates_to_sync,
        google_analytics::client::GoogleAnalyticsConnection, mixpanel::MixpanelConnection,
        object_store_path, plaid::PlaidConnection, upload, write_synced_markers,
    },
};
use serde::{Serialize, de::DeserializeOwned};
use uuid::Uuid;

use crate::{
    error::{FilesError, Result},
    state::State,
    synced_connection::{
        SyncKind, SyncedConnectionStatus, can_process_connection, complete_connection_status,
        failed_connection_status, start_connection_status, update_connection_status,
    },
};

const CHUNK_SIZE: u32 = 30; // 30 days

/// Process all connections.
/// Each connection type is processed independently; failures in one type do not
/// prevent processing of others. Errors are logged but do not abort the sync.
/// TODO(ddimaria): make this more dynamic
pub(crate) async fn process_all_synced_connections(
    state: Arc<State>,
    sync_kind: SyncKind,
) -> Result<()> {
    if let Err(e) = process_synced_connections::<MixpanelConnection>(
        state.clone(),
        sync_kind.clone(),
        "MIXPANEL",
    )
    .await
    {
        tracing::error!("Error syncing MIXPANEL connections (continuing with other types): {e}");
    }

    if let Err(e) = process_synced_connections::<GoogleAnalyticsConnection>(
        state.clone(),
        sync_kind.clone(),
        "GOOGLE_ANALYTICS",
    )
    .await
    {
        tracing::error!(
            "Error syncing GOOGLE_ANALYTICS connections (continuing with other types): {e}"
        );
    }

    if let Err(e) =
        process_synced_connections::<PlaidConnection>(state.clone(), sync_kind.clone(), "PLAID")
            .await
    {
        tracing::error!("Error syncing PLAID connections (continuing with other types): {e}");
    }

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

    tracing::trace!("Found {} {connection_type} connections", connections.len());

    // process each connection in a separate thread
    for connection in connections {
        let state = Arc::clone(&state);
        let sync_kind = sync_kind.clone();

        // process the connection in a separate thread
        tokio::spawn(async move {
            let connection_name = connection.type_details.name().to_owned();
            let run_id = Uuid::new_v4();

            if let Err(e) = process_synced_connection(
                Arc::clone(&state),
                connection.type_details,
                connection.uuid,
                connection.id,
                run_id,
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

                let error_message = format!(
                    "Error processing {} connection {}: {}",
                    connection_name, connection.uuid, e
                );

                tracing::warn!("{}", error_message);

                // Send a failure log with the error message using the same run_id
                if let Err(log_err) = failed_connection_status(
                    state,
                    connection.uuid,
                    connection.id,
                    run_id,
                    Vec::new(),
                    error_message,
                )
                .await
                {
                    tracing::error!(
                        "Failed to send failure log for {} connection {}: {}",
                        connection_name,
                        connection.uuid,
                        log_err
                    );
                }
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
    run_id: Uuid,
    sync_kind: SyncKind,
) -> Result<()> {
    let connection_name = connection.name();

    if !can_process_connection(state.clone(), connection_id, sync_kind.clone()).await? {
        tracing::trace!(
            "Skipping {connection_name} connection {}, kind: {:?}",
            connection_id,
            sync_kind
        );
        return Ok(());
    }

    let object_store = state.settings.object_store.clone();
    let today = chrono::Utc::now().date_naive();
    let sync_start_date = connection.start_date();
    let start_time = std::time::Instant::now();
    let mut total_files_processed = 0;

    let streams = connection.streams();
    let streams_len = streams.len();
    let mut connection_started = false;

    let client = match connection.kind() {
        // we need to manually assemble the PlaidClient b/c API doesn't store the client_id or secret
        SyncedConnectionKind::Plaid => state.settings.new_plaid_client(&connection)?,

        // for other connections, we can use the to_client method
        _ => connection.to_client(state.settings.environment).await?,
    };

    // Process each stream/table
    for stream in streams {
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
            tracing::trace!(
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

        // Only start the connection status when we have confirmed work to do
        if !connection_started {
            connection_started = true;

            tracing::info!(
                "Processing {connection_name} connection {} with {} stream(s): {:?}",
                connection_id,
                streams_len,
                connection.streams()
            );

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

            tracing::trace!(
                "Exporting {connection_name} stream '{}' from {} to {} in {} {}-day chunks...",
                stream,
                start_date,
                end_date,
                total_chunks,
                CHUNK_SIZE
            );

            // Process each chunk in reverse order (most recent first)
            for (chunk_index, (chunk_start, chunk_end)) in chunks.into_iter().rev().enumerate() {
                tracing::trace!(
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

                let parquet_data = match client.process(stream, chunk_start, chunk_end).await? {
                    Some(data) => data,
                    // Stream not supported (e.g., PRODUCTS_NOT_SUPPORTED) - skip entirely without markers
                    None => break,
                };

                update_connection_status(
                    state.clone(),
                    connection_id,
                    connection.kind(),
                    sync_kind.clone(),
                    SyncedConnectionStatus::Upload,
                )
                .await?;

                let num_files = upload(&object_store, &prefix, parquet_data).await.map_err(
                    |e| {
                        FilesError::SyncedConnection(format!(
                            "Failed to upload stream '{}' for chunk {} for connection {} ({}): {}",
                            stream,
                            chunk_index + 1,
                            connection_name,
                            connection_id,
                            e
                        ))
                    },
                )?;

                // If no files were uploaded, write marker files so we don't re-sync these dates
                if num_files == 0 {
                    write_synced_markers(&object_store, &prefix, chunk_start, chunk_end)
                        .await
                        .map_err(|e| {
                            FilesError::SyncedConnection(format!(
                                "Failed to write synced markers for stream '{}' chunk {} for connection {} ({}): {}",
                                stream,
                                chunk_index + 1,
                                connection_name,
                                connection_id,
                                e
                            ))
                        })?;
                }

                total_files_processed += num_files;

                tracing::trace!(
                    "Completed stream '{}' chunk {}/{} for connection {} ({}): processed {} files",
                    stream,
                    chunk_index + 1,
                    total_chunks,
                    connection_name,
                    connection_id,
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

    // Only log and decrement if we actually started processing
    if connection_started {
        tracing::info!(
            "Finished processing {} streams with {} files for {connection_name} connection {}, kind: {:?}, elapsed: {:?}",
            streams_len,
            total_files_processed,
            connection_id,
            sync_kind,
            start_time.elapsed()
        );

        state
            .clone()
            .stats
            .lock()
            .await
            .decrement_num_connections_processing();
    }

    Ok(())
}
