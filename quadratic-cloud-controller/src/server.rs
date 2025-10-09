use axum::{
    Extension, Router,
    routing::{get, post},
};
use chrono::Timelike;
use futures::StreamExt;
use quadratic_rust_shared::quadratic_cloud::{
    WORKER_ACK_TASKS_ROUTE, WORKER_GET_TASKS_ROUTE, WORKER_GET_WORKER_ACCESS_TOKEN_ROUTE,
    WORKER_GET_WORKER_INIT_DATA_ROUTE, WORKER_SHUTDOWN_ROUTE,
};
use std::{sync::Arc, time::Duration};
use tokio::time::{MissedTickBehavior, interval, sleep};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing::{error, info, trace};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use crate::{
    config::Config,
    controller::Controller,
    controller_docker::IMAGE_NAME,
    error::{ControllerError, Result, log_error_only},
    health::{full_healthcheck, healthcheck},
    quadratic_api::{insert_pending_logs, scheduled_tasks},
    state::{State, jwt::handle_jwks},
    worker::{
        handle_ack_tasks_for_worker, handle_get_file_init_data, handle_get_tasks_for_worker,
        handle_get_worker_access_token, handle_worker_shutdown,
    },
};

// const SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS: u64 = 60;
const SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS: u64 = 10;
const MAX_BACKOFF_SECONDS: u64 = 60;

async fn start_scheduled_task_watcher(state: Arc<State>) -> Result<()> {
    info!("Starting scheduled task watcher");

    let controller = Controller::new(Arc::clone(&state))
        .await
        .map_err(|e| ControllerError::ScheduledTaskWatcher(e.to_string()))?;

    // Wait until the next interval
    let current_second = chrono::Utc::now().second() as u64;
    let wait_seconds = SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS
        - (current_second % SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS);

    info!("Waiting until next interval {} seconds", wait_seconds);

    sleep(Duration::from_secs(wait_seconds)).await;

    // Run exactly at 0 seconds of each minute
    let mut interval = interval(Duration::from_secs(SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS));
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        interval.tick().await;

        trace!("Fetching scheduled tasks from API");

        // Fetch scheduled tasks from API
        let scheduled_tasks = log_error_only(scheduled_tasks(&state).await)?;
        let len = scheduled_tasks.len();
        trace!("Got {len} scheduled tasks from API");

        if len == 0 {
            continue;
        }

        let scheduled_task_ids = scheduled_tasks
            .iter()
            .flat_map(|task| Uuid::parse_str(&task.task_id))
            .collect::<Vec<_>>();

        // Add tasks to PubSub
        log_error_only(state.add_tasks(scheduled_tasks).await)?;
        trace!("Adding {len} tasks to PubSub");

        // ACK tasks with Quadratic API
        log_error_only(insert_pending_logs(&state, scheduled_task_ids).await)?;

        // Scan and ensure all workers exist
        log_error_only(controller.scan_and_ensure_all_workers().await)?;
        let active_count = controller.count_active_workers().await.unwrap_or(0);
        trace!("Worker Controller alive - {active_count} active file workers");
    }
}

pub(crate) fn worker_only_app(state: Arc<State>) -> Router {
    trace!("Building worker-only app");

    Router::new()
        // Shutdown a worker
        .route(WORKER_SHUTDOWN_ROUTE, get(handle_worker_shutdown))
        //
        // Acknowledge tasks after they have been processed by the worker
        .route(WORKER_ACK_TASKS_ROUTE, post(handle_ack_tasks_for_worker))
        //
        // Get tasks for a file by worker
        .route(WORKER_GET_TASKS_ROUTE, get(handle_get_tasks_for_worker))
        //
        // Get a last checkpoint data URL for a file
        .route(
            WORKER_GET_WORKER_INIT_DATA_ROUTE,
            get(handle_get_file_init_data),
        )
        //
        // Get a worker access token
        .route(
            WORKER_GET_WORKER_ACCESS_TOKEN_ROUTE,
            get(handle_get_worker_access_token),
        )
        //
        // Worker API routes
        //
        // state
        .layer(Extension(state))
        //
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
}

pub(crate) fn public_app(state: Arc<State>) -> Router {
    trace!("Building public app");

    let app = Router::new()
        // JWKS for worker jwt validation
        .route("/.well-known/jwks.json", get(handle_jwks))
        //
        // healthcheck
        .route("/health", get(healthcheck))
        //
        // full healthcheck of dependencies
        .route("/health/full", get(full_healthcheck))
        //
        // state
        .layer(Extension(state))
        //
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        );

    app
}

async fn start_server(
    name: &str,
    host: String,
    port: String,
    state: Arc<State>,
    app: fn(Arc<State>) -> Router,
) -> Result<()> {
    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}"))
        .await
        .map_err(|e| ControllerError::StartServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| ControllerError::StartServer(e.to_string()))?;

    tracing::info!(
        "listening on {local_addr} for {name}, environment={}",
        state.settings.environment
    );

    // Serve the application with ConnectInfo for IP extraction
    if let Err(e) = axum::serve(listener, app(state)).await {
        error!("Error serving {name} application: {e}");
        return Err(ControllerError::StartServer(e.to_string()).into());
    }

    info!("{name} stopped");

    Ok(())
}

async fn start_with_backoff<F, Fut>(name: &str, state: Arc<State>, f: F) -> Result<()>
where
    F: Fn(Arc<State>) -> Fut,
    Fut: std::future::Future<Output = Result<()>>,
{
    let mut attempt = 0;

    loop {
        attempt += 1;

        match f(Arc::clone(&state)).await {
            Ok(()) => {
                error!("{name} stopped");
            }
            Err(e) => {
                error!("{name} stopped: {e}");
            }
        }

        let base_delay = 1;
        let max_delay = MAX_BACKOFF_SECONDS;
        let delay = (base_delay * 2_u64.pow(attempt)).min(max_delay);

        info!("Backing off for {delay} seconds (attempt {attempt})");
        sleep(Duration::from_secs(delay)).await;
    }
}

/// Start the server.  This is the entrypoint for the application.
#[tracing::instrument(level = "trace")]
pub(crate) async fn serve() -> Result<()> {
    info!("Starting Worker Controller");

    let config = Config::new().map_err(|e| ControllerError::StartServer(e.to_string()))?;
    let state = State::new(&config)
        .await
        .map_err(|e| ControllerError::StartServer(e.to_string()))?;
    let state = Arc::new(state);

    let tracing_layer = if state.settings.environment.is_production() {
        tracing_subscriber::fmt::layer().json().boxed()
    } else {
        tracing_subscriber::fmt::layer().boxed()
    };
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_cloud_controller=debug,tower_http=debug".into()),
        )
        .with(tracing_layer)
        .init();

    // Remove any docker containersthat didn't stop properly.
    // This is most relevant in development, but could cleanup errored
    // containers in production.
    let summaries = state
        .client
        .lock()
        .await
        .list_all()
        .await
        .map_err(|e| ControllerError::StartServer(e.to_string()))?;

    for summary in summaries {
        if summary.image == Some(IMAGE_NAME.to_string()) {
            if let Some(container_id) = &summary.id {
                if let Err(e) = state
                    .client
                    .lock()
                    .await
                    .remove_container_by_docker_id(container_id)
                    .await
                {
                    tracing::error!("Failed to remove container {}: {}", container_id, e);
                }
            }
        }
    }

    // Start worker-only server
    let worker_only_server_state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ = start_with_backoff(
            "worker-only server",
            worker_only_server_state_clone,
            |state| async {
                start_server(
                    "worker-only",
                    state.settings.worker_only_host.clone(),
                    state.settings.worker_only_port.clone(),
                    state,
                    worker_only_app,
                )
                .await
                .map_err(|e| ControllerError::StartServer(e.to_string()))
            },
        )
        .await;
    });

    // Start scheduled task watcher
    let scheduled_task_watcher_state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ = start_with_backoff(
            "scheduled-task-watcher",
            scheduled_task_watcher_state_clone,
            |state| async {
                start_scheduled_task_watcher(state)
                    .await
                    .map_err(|e| ControllerError::StartServer(e.to_string()))
            },
        )
        .await;
    });

    // In a separate thread, print the logs of all containers every second
    let container_logs_state_clone = Arc::clone(&state);
    tokio::spawn(async {
        if let Err(e) = print_container_logs(container_logs_state_clone).await {
            error!("Error printing container logs: {e}");
        }
    });

    // Start public server
    let public_server_state_clone = Arc::clone(&state);
    start_with_backoff("public-server", public_server_state_clone, |state| async {
        start_server(
            "public",
            state.settings.public_host.clone(),
            state.settings.public_port.clone(),
            state,
            public_app,
        )
        .await
        .map_err(|e| ControllerError::StartServer(e.to_string()))
    })
    .await
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
            .list_ids()
            .await
            .map_err(|e| ControllerError::StartServer(e.to_string()))?;

        for container_id in container_ids {
            let mut client = state.client.lock().await;
            let docker = client.docker.clone();
            let container = client
                .get_container_mut(&container_id)
                .await
                .map_err(|e| ControllerError::StartServer(e.to_string()))?;

            // record the resource usage
            let _ = container.record_resource_usage(docker.clone()).await;

            // get the logs
            // let logs = container
            //     .logs(docker.clone())
            //     .await
            //     .map_err(|e| ControllerError::StartServer(e.to_string()))?;

            // if !logs.is_empty() {
            //     tracing::error!("Logs: {}", logs);
            // }

            let mut logs = container
                .logs_stream(docker.clone())
                .await
                .map_err(|e| ControllerError::StartServer(e.to_string()))?;

            while let Some(log_result) = logs.next().await {
                match log_result {
                    Ok(log_output) => {
                        let log_line = log_output.to_string().trim().to_string();
                        if !log_line.is_empty() {
                            eprintln!("[CloudWorker] {}", log_line);
                        }
                    }
                    Err(e) => tracing::warn!("Error reading log: {}", e),
                }
            }
        }

        interval.tick().await;
    }
}
