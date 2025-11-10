use chrono::Timelike;
use futures::StreamExt;
use std::{sync::Arc, time::Duration};
use tokio::time::{MissedTickBehavior, interval, sleep};
use tracing::{error, info, trace, warn};
use uuid::Uuid;

use crate::{
    controller::Controller,
    error::{ControllerError, Result, log_error_only},
    quadratic_api::{insert_pending_logs, scheduled_tasks},
    server::start_with_backoff,
    state::State,
};

const SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS: u64 = 10;
const PUBSUB_WATCHER_INTERVAL_SECONDS: u64 = 10;

pub(crate) fn init_background_workers(state: Arc<State>) -> Result<()> {
    // listen for scheduled tasks from API
    let state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ = start_with_backoff("scheduled-task-watcher", state_clone, |state| async {
            scheduled_task_watcher(state)
                .await
                .map_err(|e| ControllerError::StartServer(e.to_string()))
        })
        .await;
    });

    // listen for pubsub messages
    let state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ = start_with_backoff("pubsub-watcher", state_clone, |state| async {
            pubsub_watcher(state)
                .await
                .map_err(|e| ControllerError::StartServer(e.to_string()))
        })
        .await;
    });

    // print container logs
    let state_clone = Arc::clone(&state);
    tokio::spawn(async {
        if let Err(e) = print_container_logs(state_clone).await {
            error!("Error printing container logs: {e}");
        }
    });

    Ok(())
}

async fn scheduled_task_watcher(state: Arc<State>) -> Result<()> {
    info!("Starting scheduled task watcher");

    // Wait until the next interval
    let _current_second = chrono::Utc::now().second() as u64;
    // TODO(ddimari): Change this back to the original logic
    // let wait_seconds = SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS
    //     - (current_second % SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS);
    let wait_seconds = 0;

    info!("Waiting until next interval {} seconds", wait_seconds);

    sleep(Duration::from_secs(wait_seconds)).await;

    // Run exactly at 0 seconds of each minute
    let mut interval = interval(Duration::from_secs(SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS));
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        info!("Fetching scheduled tasks from API");

        // Fetch scheduled tasks from API
        let scheduled_tasks = log_error_only(scheduled_tasks(&state).await)?;
        let len = scheduled_tasks.len();
        info!("Got {len} scheduled tasks from API");

        if len > 0 {
            let ids = scheduled_tasks
                .iter()
                .map(|task| (task.run_id, task.task_id))
                .collect::<Vec<(Uuid, Uuid)>>();

            // Add tasks to PubSub
            log_error_only(state.add_tasks(scheduled_tasks).await)?;
            trace!("Adding {len} tasks to PubSub");

            // ACK tasks with Quadratic API
            log_error_only(insert_pending_logs(&state, ids).await)?;
        }

        interval.tick().await;
    }
}

/// Listen for pubsub active channels (file ids).
///
/// We don't get scheduled tasks to process here, just file ids in order to
/// create workers that will poll this service for scheduled tasks.
async fn pubsub_watcher(state: Arc<State>) -> Result<()> {
    info!("Starting pubsub watcher");

    // Check if we should run workers locally based on ENVIRONMENT variable
    let run_local =
        state.settings.environment == quadratic_rust_shared::environment::Environment::Local;
    if run_local {
        warn!("🔧 ENVIRONMENT=local - running workers in-process (no Docker/K8s)");
    }

    let mut interval = interval(Duration::from_secs(PUBSUB_WATCHER_INTERVAL_SECONDS));
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    let controller = if !run_local {
        Some(
            Controller::new(Arc::clone(&state))
                .await
                .map_err(|e| ControllerError::ScheduledTaskWatcher(e.to_string()))?,
        )
    } else {
        None
    };

    loop {
        let file_ids = state.get_file_ids_to_process().await?;

        info!("Got {} file ids to process from pubsub", file_ids.len());

        if run_local {
            // Run workers locally in-process
            process_files_locally(Arc::clone(&state), file_ids).await?;
        } else {
            // Spawn Docker/K8s workers
            if let Some(ref controller) = controller {
                controller.create_workers(file_ids).await?;
            }
        }

        interval.tick().await;
    }
}

/// Process files locally without spawning containers (for development)
#[cfg(feature = "local")]
async fn process_files_locally(
    state: Arc<State>,
    file_ids: std::collections::HashSet<Uuid>,
) -> Result<()> {
    use quadratic_core_cloud::worker::Worker;
    use quadratic_rust_shared::quadratic_api::get_file_init_data;

    if file_ids.is_empty() {
        return Ok(());
    }

    let multiplayer_url = state.settings.multiplayer_url();
    let mut critical_error_occurred = false;

    // Process each file (sequentially for simplicity)
    for file_id in file_ids {
        info!("🔧 [Local Worker] Processing file: {}", file_id);

        let multiplayer_url = multiplayer_url.clone();

        // Process file inline
        let result: anyhow::Result<()> = async {
            // Get tasks for this file from Redis (same as Docker worker)
            info!(
                "📡 [Local Worker] Fetching tasks from Redis for file {}",
                file_id
            );
            let file_tasks = state
                .get_tasks_for_file(file_id)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to get tasks from Redis: {}", e))?;

            if file_tasks.is_empty() {
                info!("⚠️  [Local Worker] No tasks found for file {}", file_id);
                return Ok(());
            }

            let total_tasks = file_tasks.len();
            info!(
                "📝 [Local Worker] Found {} task(s) for file {}",
                total_tasks, file_id
            );

            // Get file data
            info!("📥 [Local Worker] Getting file init data for {}", file_id);
            let file_init_data = get_file_init_data(
                &state.settings.quadratic_api_uri,
                &state.settings.m2m_auth_token,
                file_id,
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get file init data: {}", e))?;

            info!(
                "📊 [Local Worker] File init data - sequence: {}, team: {}",
                file_init_data.sequence_number, file_init_data.team_id
            );

            // Process each task
            let mut successful_tasks = Vec::new();
            let mut failed_tasks = Vec::new();

            for (task_idx, (key, task)) in file_tasks.into_iter().enumerate() {
                let operations = task.operations;
                let task_id = task.task_id;
                let run_id = task.run_id;

                // Clone what we need since we're iterating
                let presigned_url = file_init_data.presigned_url.clone();
                let sequence_number = file_init_data.sequence_number;
                let team_id = file_init_data.team_id;
                let task_m2m_token = state.settings.m2m_auth_token.clone();
                let task_multiplayer_url = multiplayer_url.clone();

                info!(
                    "🚀 [Local Worker] Executing task {}/{} for file {} (run_id: {}, task_id: {})",
                    task_idx + 1,
                    total_tasks,
                    file_id,
                    run_id,
                    task_id
                );

                let task_result: anyhow::Result<()> = async {
                    info!(
                        "🔌 [Local Worker] Creating worker - connecting to multiplayer: {}",
                        task_multiplayer_url
                    );

                    let mut worker = match Worker::new(
                        file_id,
                        sequence_number as u64,
                        &presigned_url,
                        task_m2m_token.clone(),
                        task_multiplayer_url.clone(),
                    )
                    .await
                    {
                        Ok(w) => {
                            info!("✅ [Local Worker] Worker created successfully");
                            w
                        }
                        Err(e) => {
                            error!("❌ [Local Worker] Failed to create worker: {:#}", e);
                            return Err(anyhow::anyhow!(
                                "Failed to create worker. This may indicate:\n\
                                 - Multiplayer service not running (expected at: {})\n\
                                 - Missing dependencies (deno/python)\n\
                                 - Network connectivity issues\n\
                                 Original error: {:#}",
                                task_multiplayer_url,
                                e
                            ));
                        }
                    };

                    info!(
                        "⚙️  [Local Worker] Worker created, processing {} operations",
                        operations.len()
                    );

                    // Use a closure to ensure cleanup happens
                    let result: anyhow::Result<()> = async {
                        worker
                            .process_operations(operations, team_id.to_string(), task_m2m_token)
                            .await?;

                        info!("⏳ [Local Worker] Operations sent, waiting for completion...");

                        // Wait for completion with timeout
                        let mut iterations = 0;
                        let max_iterations = 60; // 2 minutes max
                        while !worker.status.lock().await.is_complete() {
                            iterations += 1;
                            if iterations > max_iterations {
                                return Err(anyhow::anyhow!(
                                    "Timeout waiting for completion after {} seconds",
                                    iterations * 2
                                ));
                            }

                            trace!(
                                "⏳ [Local Worker] Waiting for task completion (iteration {})",
                                iterations
                            );

                            tokio::time::sleep(Duration::from_secs(2)).await;
                        }

                        info!(
                            "✅ [Local Worker] Task {}/{} completed for file {}",
                            task_idx + 1,
                            total_tasks,
                            file_id
                        );

                        Ok(())
                    }
                    .await;

                    // Always try to leave room, even on error
                    info!("👋 [Local Worker] Leaving room for file {}", file_id);
                    if let Err(e) = worker.leave_room().await {
                        warn!("⚠️  [Local Worker] Error leaving room (non-fatal): {}", e);
                    }
                    info!("🏁 [Local Worker] Task cleanup complete");

                    result
                }
                .await;

                match task_result {
                    Ok(_) => {
                        info!(
                            "✅ [Local Worker] Task succeeded: run_id={}, task_id={}",
                            run_id, task_id
                        );
                        successful_tasks.push((key, run_id, task_id));
                    }
                    Err(e) => {
                        error!(
                            "❌ [Local Worker] Task failed: run_id={}, task_id={}, error: {}",
                            run_id, task_id, e
                        );
                        failed_tasks.push((key, run_id, task_id, e.to_string()));
                    }
                }
            }

            // Acknowledge tasks with the state
            if !successful_tasks.is_empty() || !failed_tasks.is_empty() {
                info!(
                    "📝 [Local Worker] Acknowledging {} successful, {} failed tasks",
                    successful_tasks.len(),
                    failed_tasks.len()
                );

                // Combine keys to ack
                let keys: Vec<String> = successful_tasks
                    .iter()
                    .map(|(key, _, _)| key.clone())
                    .chain(failed_tasks.iter().map(|(key, _, _, _)| key.clone()))
                    .collect();

                // Remove from Redis
                if let Err(e) = state.ack_tasks(file_id, keys).await {
                    error!("❌ [Local Worker] Failed to ack tasks in Redis: {}", e);
                }

                // Insert completed logs
                use crate::quadratic_api::{insert_completed_logs, insert_failed_logs};

                if !successful_tasks.is_empty() {
                    if let Err(e) = insert_completed_logs(&state, successful_tasks).await {
                        error!("❌ [Local Worker] Failed to insert completed logs: {}", e);
                    } else {
                        info!("✅ [Local Worker] Completed logs inserted");
                    }
                }

                if !failed_tasks.is_empty() {
                    if let Err(e) = insert_failed_logs(&state, failed_tasks).await {
                        error!("❌ [Local Worker] Failed to insert failed logs: {}", e);
                    } else {
                        info!("✅ [Local Worker] Failed logs inserted");
                    }
                }
            }

            Ok(())
        }
        .await;

        match result {
            Ok(_) => {
                info!("✅ [Local Worker] Successfully processed file {}", file_id);
            }
            Err(e) => {
                // Check if this is a critical error that should stop the worker
                let error_string = e.to_string().to_lowercase();
                let is_critical = error_string.contains("failed to get file init data")
                    || error_string.contains("failed to get tasks from redis")
                    || error_string.contains("failed to create worker")
                    || error_string.contains("deno")
                    || error_string.contains("python")
                    || error_string.contains("connection refused")
                    || error_string.contains("failed to connect to multiplayer");

                if is_critical {
                    critical_error_occurred = true;
                    error!(
                        "❌ [Local Worker] CRITICAL ERROR processing file {}: {:#}\n\
                         This may indicate missing dependencies (deno/python) or service unavailability.",
                        file_id, e
                    );
                } else {
                    error!(
                        "❌ [Local Worker] Error processing file {}: {:#}",
                        file_id, e
                    );
                }
            }
        }
    }

    // If we encountered critical errors, return error to exit the loop
    if critical_error_occurred {
        return Err(ControllerError::ScheduledTaskWatcher(
            "Critical errors occurred during local task execution. \
             Check logs above for details. Common causes:\n\
             - Missing deno (install: curl -fsSL https://deno.land/install.sh | sh)\n\
             - Missing python3 (install: brew install python3 or apt-get install python3)\n\
             - Multiplayer service not running (check docker-compose or multiplayer service)\n\
             Exiting to prevent infinite error loop."
                .to_string(),
        ));
    }

    Ok(())
}

/// Process files locally - stub when feature is disabled
#[cfg(not(feature = "local"))]
async fn process_files_locally(
    _state: Arc<State>,
    _file_ids: std::collections::HashSet<Uuid>,
) -> Result<()> {
    error!(
        "ENVIRONMENT=local but controller was built without 'local' feature. \
        Rebuild with: cargo build --features local"
    );
    Ok(())
}

/// In a separate thread, print the logs of all containers every second
async fn print_container_logs(state: Arc<State>) -> Result<()> {
    let mut interval = interval(Duration::from_millis(100));
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        let container_ids = state
            .client
            .lock()
            .await
            .list_ids(true)
            .await
            .map_err(|e| ControllerError::StartServer(e.to_string()))?;

        for container_id in container_ids {
            // Record resource usage while holding the lock briefly
            {
                let mut client = state.client.lock().await;
                let docker = client.docker.clone();
                if let Ok(container) = client.get_container_mut(&container_id).await {
                    let _ = container
                        .lock()
                        .await
                        .record_resource_usage(docker.clone())
                        .await;
                }
            } // Lock is released here

            // Get the logs stream without holding any locks
            // This method handles locking internally and releases before returning
            if let Ok(mut logs) = {
                let client = state.client.lock().await;
                client.container_logs_stream(&container_id).await
            } {
                // Lock is released here
                while let Some(Ok(log_result)) = logs.next().await {
                    let log_line = log_result.to_string().trim().to_string();
                    if !log_line.is_empty() {
                        eprintln!("[CloudWorker] {}", log_line);
                    }
                }
            }
        }

        interval.tick().await;
    }
}
