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

    info!("Starting worker for file: {}", config.file_id);

    let mut worker = Worker::new(config)
        .await
        .map_err(|e| WorkerError::CreateWorker(e.to_string()))?;

    worker.run().await?;
    worker.shutdown().await?;

    Ok(())
}
