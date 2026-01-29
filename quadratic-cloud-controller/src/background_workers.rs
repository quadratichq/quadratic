use chrono::Timelike;
use futures::StreamExt;
use std::{sync::Arc, time::Duration};
use tokio::time::{MissedTickBehavior, interval, sleep};
use tracing::{error, info, trace};
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
        trace!("Fetching scheduled tasks from API");

        // Fetch scheduled tasks from API
        let scheduled_tasks = log_error_only(scheduled_tasks(&state).await)?;
        let len = scheduled_tasks.len();

        if len > 0 {
            info!("Got {len} scheduled tasks from API");

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

    let mut interval = interval(Duration::from_secs(PUBSUB_WATCHER_INTERVAL_SECONDS));
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    let controller = Controller::new(Arc::clone(&state))
        .await
        .map_err(|e| ControllerError::ScheduledTaskWatcher(e.to_string()))?;

    loop {
        let file_ids = state.get_file_ids_to_process().await?;

        if !file_ids.is_empty() {
            info!("Got {} file ids to process from pubsub", file_ids.len());

            // Spawn Docker/K8s workers
            controller.create_workers(file_ids).await?;
        }

        interval.tick().await;
    }
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
                        println!("[CloudWorker] {}", log_line);
                    }
                }
            }
        }

        interval.tick().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    async fn create_test_state() -> Arc<State> {
        let config = Config::new().expect("Failed to create config");
        Arc::new(State::new(&config).await.expect("Failed to create state"))
    }

    #[tokio::test]
    async fn test_init_background_workers() {
        let state = create_test_state().await;
        let result = init_background_workers(state);
        assert!(result.is_ok());

        sleep(Duration::from_millis(100)).await;
    }
}
