use std::sync::Arc;
use std::time::Duration;
use tokio::time;

use crate::error::Result;
use crate::state::State;
use crate::synced_connection::{DateRange, mixpanel::process_mixpanel_connections};

const DAILY_SYNC_INTERVAL_M: u64 = 60; // 1 hour
const FULL_SYNC_INTERVAL_M: u64 = 1; // 1 minute

pub(crate) async fn init_sync_workers(state: Arc<State>) -> Result<()> {
    // sync daily connections in a separate thread
    // let daily_sync_state = Arc::clone(&state);
    // tokio::spawn(async move { daily_sync_worker(daily_sync_state).await });

    // sync full connections in a separate thread
    let full_sync_state = Arc::clone(&state);
    tokio::spawn(async move { full_sync_worker(full_sync_state).await });

    Ok(())
}

/// Update all Mixpanel connections every DAILY_SYNC_INTERVAL_M minutes.
pub(crate) async fn daily_sync_worker(state: Arc<State>) {
    let mut interval = time::interval(Duration::from_secs(DAILY_SYNC_INTERVAL_M * 60));
    let today = chrono::Utc::now().date_naive();
    let date_range = DateRange::new(today, today);

    loop {
        interval.tick().await;

        if let Err(e) = process_mixpanel_connections(state.clone(), Some(date_range.clone())).await
        {
            tracing::error!("Error daily syncing Mixpanel connections: {e}");
        }
    }
}

/// Update all Mixpanel connections every FULL_SYNC_INTERVAL_M minutes.
pub(crate) async fn full_sync_worker(state: Arc<State>) {
    let mut interval = time::interval(Duration::from_secs(FULL_SYNC_INTERVAL_M * 60));

    loop {
        interval.tick().await;

        if let Err(e) = process_mixpanel_connections(state.clone(), None).await {
            tracing::error!("Error full syncing Mixpanel connections: {e}");
        }
    }
}
