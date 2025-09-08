mod state;
mod worker;

use anyhow::Result;
use tracing::error;

use self::worker::Worker;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    match Worker::new().await {
        Ok(worker) => worker.run().await,
        Err(e) => {
            error!("Error creating worker, error: {e}");
            Err(e)
        }
    }
}
