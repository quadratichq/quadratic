mod config;
mod error;
mod worker;

use tracing::info;

use crate::config::Config;
use crate::error::{Result, WorkerError};
use crate::worker::Worker;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let config = Config::new().map_err(|e| WorkerError::Config(e.to_string()))?;

    info!("🚀 Starting worker for file: {}", config.file_id);

    let mut worker = Worker::new(config)
        .await
        .map_err(|e| WorkerError::CreateWorker(e.to_string()))?;

    // Always shutdown, even if run() fails
    let run_result = worker.run().await;

    info!("🔄 Worker run completed, initiating shutdown...");
    let shutdown_result = worker.shutdown().await;

    // Log the results
    match (&run_result, &shutdown_result) {
        (Ok(_), Ok(_)) => info!("✅ Worker completed successfully"),
        (Err(e), Ok(_)) => info!("⚠️  Worker run failed but shutdown succeeded: {}", e),
        (Ok(_), Err(e)) => info!("⚠️  Worker run succeeded but shutdown failed: {}", e),
        (Err(e1), Err(e2)) => info!(
            "❌ Both worker run and shutdown failed: run={}, shutdown={}",
            e1, e2
        ),
    }

    // Return the first error if either failed
    run_result?;
    shutdown_result?;

    Ok(())
}
