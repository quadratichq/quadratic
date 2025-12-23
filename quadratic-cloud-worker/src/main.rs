mod config;
mod error;
mod worker;

use tracing::{error, info};

use crate::config::Config;
use crate::error::{Result, WorkerError};
use crate::worker::Worker;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    info!("Parsing config from environment...");

    let config = match Config::new() {
        Ok(config) => config,
        Err(e) => {
            error!("Failed to parse config: {}", e);
            return Err(WorkerError::Config(e.to_string()));
        }
    };
    let file_id = config.file_id;

    info!("Starting worker for file: {}", file_id);

    let mut worker = Worker::new(config)
        .await
        .map_err(|e| WorkerError::CreateWorker(e.to_string()))?;

    // TODO(ddimaria): remove this
    info!("Worker created for file: {file_id}");

    // Always shutdown, even if run() fails
    let run_result = worker.run().await;

    info!("Worker run completed for file: {file_id}, initiating shutdown...");

    let shutdown_result = worker.shutdown().await;

    // Log the results
    match (&run_result, &shutdown_result) {
        (Ok(_), Ok(_)) => info!("Worker completed successfully for file: {file_id}"),
        (Err(e), Ok(_)) => {
            info!("Worker run failed but shutdown succeeded: {e} for file: {file_id}")
        }
        (Ok(_), Err(e)) => {
            info!("Worker run succeeded but shutdown failed: {e} for file: {file_id}")
        }
        (Err(e1), Err(e2)) => info!(
            "Both worker run and shutdown failed: run={e1}, shutdown={e2} for file: {file_id}"
        ),
    }

    // Return the first error if either failed
    run_result?;
    shutdown_result?;

    Ok(())
}
