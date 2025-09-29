mod config;
mod error;
mod state;
mod worker;

use anyhow::Result;
use tracing::{error, info};

use self::config::Config;
use self::worker::Worker;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let config = match Config::new() {
        Ok(config) => config,
        Err(e) => {
            error!("Error creating config, error: {e}");
            return Err(e);
        }
    };

    let file_id = config.file_id;

    match Worker::new(config).await {
        Ok(mut worker) => match worker.run().await {
            Ok(_) => {
                info!("No more tasks available for file: {file_id}, shutting down");
                worker.shutdown().await;
                Ok(())
            }
            Err(e) => {
                error!("Error running worker for file: {file_id}, error: {e}");
                worker.shutdown().await;
                Err(e)
            }
        },
        Err(e) => {
            error!("Error creating worker for file: {file_id}, error: {e}");
            Err(e)
        }
    }
}
