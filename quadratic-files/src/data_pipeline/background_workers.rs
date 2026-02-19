//! Data Pipeline Background Workers
//!
//! Background workers that run data pipelines on a schedule.

use std::sync::Arc;
use std::time::Duration;

use tokio::task::JoinHandle;
use tokio::time;
use tokio_util::sync::CancellationToken;

use crate::data_pipeline::intrinio::run_intrinio_pipeline;
use crate::state::State;

const DATA_PIPELINE_INTERVAL_H: u64 = 24;

/// Initialize the data pipeline workers.
///
/// Returns JoinHandles for all spawned workers so they can be awaited during
/// graceful shutdown.
pub(crate) fn init_data_pipeline_workers(
    state: Arc<State>,
    cancellation_token: CancellationToken,
) -> Vec<JoinHandle<()>> {
    let mut handles = Vec::new();

    // Only start the Intrinio pipeline worker if an API key is configured
    if !state.settings.intrinio_api_key.is_empty() {
        let handle = tokio::spawn({
            let state = Arc::clone(&state);
            let token = cancellation_token.clone();
            async move {
                intrinio_pipeline_worker(state, token).await;
            }
        });
        handles.push(handle);

        tracing::info!(
            "Intrinio data pipeline worker started (runs every {DATA_PIPELINE_INTERVAL_H}h)"
        );
    } else {
        tracing::info!("Intrinio data pipeline worker skipped: no INTRINIO_API_KEY configured");
    }

    handles
}

/// Worker that runs the Intrinio data pipeline daily.
///
/// Starts with a 30-second delay to allow the server to finish initializing,
/// then runs every `DATA_PIPELINE_INTERVAL_H` hours.
async fn intrinio_pipeline_worker(state: Arc<State>, cancellation_token: CancellationToken) {
    // Initial delay to stagger startup load
    tokio::select! {
        _ = cancellation_token.cancelled() => {
            tracing::info!("Intrinio pipeline worker received shutdown signal during startup delay");
            return;
        }
        _ = tokio::time::sleep(Duration::from_secs(30)) => {}
    }

    // The first tick fires immediately (tokio::time::interval behavior), which
    // is intentional — we want an initial data load after the startup delay.
    let mut interval = time::interval(Duration::from_secs(DATA_PIPELINE_INTERVAL_H * 60 * 60));

    loop {
        tokio::select! {
            _ = cancellation_token.cancelled() => {
                tracing::info!("Intrinio pipeline worker received shutdown signal");
                break;
            }
            _ = interval.tick() => {
                tracing::info!("Intrinio pipeline worker triggered");

                if let Err(e) = run_intrinio_pipeline(
                    &state.settings.object_store,
                    &state.settings.intrinio_api_key,
                ).await {
                    tracing::error!("Intrinio data pipeline error: {e}");
                }
            }
        }
    }
}
