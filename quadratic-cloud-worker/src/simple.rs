// every minute, print the current time in a separate thread
use anyhow::Result;
use quadratic_core_cloud::worker::Worker;
use quadratic_rust_shared::quadratic_api::{get_file_init_data, get_scheduled_tasks};
use tokio::signal;
use tokio::task::LocalSet;
use tokio::time::{Duration, interval};
use tracing::info;

// const INTERVAL_MS: u64 = 60000; // every minute
const INTERVAL_MS: u64 = 20000; // every 20 seconds
const API_URL: &str = "http://localhost:8000";
const M2M_AUTH_TOKEN: &str = "M2M_AUTH_TOKEN";

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let mut interval = interval(Duration::from_millis(INTERVAL_MS));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                let tasks = get_scheduled_tasks(API_URL, M2M_AUTH_TOKEN).await?;

                // run non-Send futures concurrently on the same thread
                let local = LocalSet::new();

                for task in tasks.into_iter() {
                    local.spawn_local(async move {
                        let file_id = task.file_id;
                        let operations = task.operations;

                        info!("Processing task for file: {file_id}");

                        let result: Result<()> = async {
                            let file_init_data =
                                get_file_init_data(API_URL, M2M_AUTH_TOKEN, file_id).await?;

                            let mut worker = Worker::new(
                                file_id,
                                file_init_data.sequence_number as u64,
                                &file_init_data.presigned_url,
                                M2M_AUTH_TOKEN.to_string(),
                            )
                            .await?;

                            worker
                                .process_operations(
                                    operations,
                                    file_init_data.team_id.to_string(),
                                    M2M_AUTH_TOKEN.to_string(),
                                )
                                .await?;

                            while !worker.status.lock().await.is_complete() {
                                info!("waiting for operations to be complete for file: {file_id}");
                                tokio::time::sleep(Duration::from_millis(5000)).await;
                            }

                            tracing::info!("received transactio ack, leaving room for file: {file_id}");

                            worker.leave_room().await?;

                            Ok(())
                        }
                        .await;

                        if let Err(e) = result {
                            tracing::error!("Error processing task for file {file_id}, error: {e}");
                        }
                    });
                }

                // Run tasks with a timeout to allow shutdown
                tokio::select! {
                    _ = local => {},
                    _ = tokio::time::sleep(Duration::from_secs(30)) => {
                        info!("Task batch timeout reached, continuing to next interval");
                    }
                }
            }
            _ = signal::ctrl_c() => {
                info!("Received Ctrl+C, shutting down gracefully...");
                break;
            }
        }
    }

    Ok(())
}
