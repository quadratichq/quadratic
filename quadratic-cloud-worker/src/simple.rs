use anyhow::Result;
use quadratic_core_cloud::worker::Worker;
use quadratic_rust_shared::quadratic_api::{get_file_init_data, get_scheduled_tasks};
use rustls::crypto::ring::default_provider;
use tokio::signal;
use tokio::task::LocalSet;
use tokio::time::{Duration, interval};
use tracing::info;

const INTERVAL_MS: u64 = 20000; // every 20 seconds
const API_URL: &str = "http://localhost:8000";
const JWT: &str = "JWT";
const MULTIPLAYER_URL: &str = "ws://localhost:3001/ws";
const CONNECTION_URL: &str = "http://localhost:3003";

#[tokio::main]
async fn main() -> Result<()> {
    // Install default crypto provider for rustls if not already installed
    // Ignore error if already installed (happens in tests when multiple connections are created)
    let _ = default_provider().install_default();

    tracing_subscriber::fmt::init();

    let mut interval = interval(Duration::from_millis(INTERVAL_MS));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                let tasks = get_scheduled_tasks(API_URL, JWT).await?;

                // run non-Send futures concurrently on the same thread
                let local = LocalSet::new();

                for task in tasks.into_iter() {
                    local.spawn_local(async move {
                        let file_id = task.file_id;
                        let operations = task.operations;

                        info!("Processing task for file: {file_id}");

                        let result: Result<()> = async {
                            let file_init_data =
                                get_file_init_data(API_URL, JWT, file_id).await?;

                            let mut worker = Worker::new(
                                file_id,
                                file_init_data.sequence_number as u64,
                                &file_init_data.presigned_url,
                                JWT.to_string(),
                                MULTIPLAYER_URL.to_string(),
                                CONNECTION_URL.to_string(),
                            )
                            .await?;

                            worker
                                .process_operations(
                                    operations,
                                    file_init_data.team_id.to_string(),
                                    JWT.to_string(),
                                )
                                .await?;

                            while !worker.status.lock().await.is_complete() {
                                info!("waiting for operations to be complete for file: {file_id}");
                                tokio::time::sleep(Duration::from_millis(5000)).await;
                            }

                            tracing::info!("received transaction ack, leaving room for file: {file_id}");

                            // Always attempt to leave the room, even if there were errors
                            let leave_result = worker.leave_room().await;

                            if let Err(e) = &leave_result {
                                tracing::error!("Error leaving room for file {file_id}, error: {e}");
                            }

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
