mod config;
mod error;
mod thumbnail;
mod worker;

use rustls::crypto::ring::default_provider;
use tracing::{error, info};

use crate::config::Config;
use crate::error::{Result, WorkerError};
use crate::worker::Worker;

#[tokio::main]
async fn main() -> Result<()> {
    // Install default crypto provider for rustls if not already installed
    // Ignore error if already installed (happens in tests when multiple connections are created)
    let _ = default_provider().install_default();

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

    let mut worker = Worker::new(config).await?;
    let mut errors = Vec::new();

    // Always shutdown, even if run() fails
    let run_result = worker.run().await;

    // An error occurred, just log it so we can still shutdown the worker
    if let Err(e) = &run_result {
        errors.push(WorkerError::RunWorker(e.to_string()));
    }

    info!("Worker run completed for file: {file_id}, initiating shutdown...");

    let shutdown_result = worker.shutdown().await;

    // An error occurred, just log it so we can still shutdown the worker
    if let Err(e) = &shutdown_result {
        errors.push(WorkerError::ShutdownWorker(e.to_string()));
    }

    // Return the first error if any failed
    if let Some(error) = errors.first().cloned() {
        error!(
            "Worker failed to complete for file: {file_id}: {:?}",
            errors
        );
        return Err(error);
    }

    info!("Worker completed successfully for file: {file_id}");

    Ok(())
}
