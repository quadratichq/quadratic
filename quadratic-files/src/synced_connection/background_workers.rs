use std::sync::Arc;
use std::time::Duration;
use tokio::task::JoinHandle;
use tokio::time;
use tokio_util::sync::CancellationToken;

use crate::error::Result;
use crate::state::State;
use crate::synced_connection::SyncKind;
use crate::synced_connection::process::process_all_synced_connections;

const DAILY_SYNC_INTERVAL_M: u64 = 60; // 1 hour
const FULL_SYNC_INTERVAL_M: u64 = 1; // 1 minute

/// Initialize the sync workers in separate threads.
///
/// Returns JoinHandles for all spawned workers so they can be awaited during
/// graceful shutdown.
pub(crate) async fn init_sync_workers(
    state: Arc<State>,
    cancellation_token: CancellationToken,
) -> Result<Vec<JoinHandle<()>>> {
    let mut handles = Vec::new();

    // sync full connections in a separate thread
    let full_sync_state = Arc::clone(&state);
    let full_sync_token = cancellation_token.clone();
    let full_sync_handle =
        tokio::spawn(async move { full_sync_worker(full_sync_state, full_sync_token).await });
    handles.push(full_sync_handle);

    // wait 10 seconds before syncing daily connections
    tokio::time::sleep(Duration::from_secs(10)).await;

    // sync daily connections in a separate thread
    let daily_sync_state = Arc::clone(&state);
    let daily_sync_token = cancellation_token.clone();
    let daily_sync_handle =
        tokio::spawn(async move { daily_sync_worker(daily_sync_state, daily_sync_token).await });
    handles.push(daily_sync_handle);

    Ok(handles)
}

/// Update all Mixpanel connections every DAILY_SYNC_INTERVAL_M minutes.
pub(crate) async fn daily_sync_worker(state: Arc<State>, cancellation_token: CancellationToken) {
    let mut interval = time::interval(Duration::from_secs(DAILY_SYNC_INTERVAL_M * 60));

    loop {
        tokio::select! {
            _ = cancellation_token.cancelled() => {
                tracing::info!("Daily sync worker received shutdown signal");
                break;
            }
            _ = interval.tick() => {
                if let Err(e) = process_all_synced_connections(state.clone(), SyncKind::Daily).await {
                    tracing::error!("Error daily syncing all connections: {e}");
                }
            }
        }
    }
}

/// Update all Mixpanel connections every FULL_SYNC_INTERVAL_M minutes.
pub(crate) async fn full_sync_worker(state: Arc<State>, cancellation_token: CancellationToken) {
    let mut interval = time::interval(Duration::from_secs(FULL_SYNC_INTERVAL_M * 60));

    loop {
        tokio::select! {
            _ = cancellation_token.cancelled() => {
                tracing::info!("Full sync worker received shutdown signal");
                break;
            }
            _ = interval.tick() => {
                if let Err(e) = process_all_synced_connections(state.clone(), SyncKind::Full).await {
                    tracing::error!("Error full syncing all connections: {e}");
                }
            }
        }
    }
}
