use axum::{
    Extension, Router,
    routing::{get, post},
};
use chrono::Timelike;
use quadratic_rust_shared::{
    quadratic_api::get_scheduled_tasks,
    quadratic_cloud::{
        WORKER_ACK_TASKS_ROUTE, WORKER_GET_TASKS_ROUTE, WORKER_GET_WORKER_ACCESS_TOKEN_ROUTE,
        WORKER_GET_WORKER_INIT_DATA_ROUTE, WORKER_SHUTDOWN_ROUTE,
    },
};
use std::{sync::Arc, time::Duration};
use tokio::time::{MissedTickBehavior, interval, sleep};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing::{error, info, trace};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::Config,
    controller::Controller,
    controller_docker::IMAGE_NAME,
    error::{ControllerError, Result},
    health::{full_healthcheck, healthcheck},
    state::{State, jwt::handle_jwks},
    worker::{
        handle_ack_tasks_for_worker, handle_get_file_init_data, handle_get_tasks_for_worker,
        handle_get_worker_access_token, handle_worker_shutdown,
    },
};

// const SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS: u64 = 60;
const SCHEDULED_TASK_WATCHER_INTERVAL_SECONDS: u64 = 10;

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
        let scheduled_tasks = match get_scheduled_tasks(
            &state.settings.quadratic_api_uri,
            &state.settings.m2m_auth_token,
        )
        .await
        {
            Ok(scheduled_tasks) => {
                trace!("Got {} scheduled tasks from API", scheduled_tasks.len());
                scheduled_tasks
            }
            Err(e) => {
                error!("Error fetching scheduled tasks: {e}");
                continue;
            }
        };

        let len = scheduled_tasks.len();

        match state.add_tasks(scheduled_tasks).await {
            Ok(()) => {
                trace!("Added {} scheduled tasks to pubsub", len);
            }
            Err(e) => {
                error!("Error adding scheduled tasks to pubsub: {e}");
            }
        }

        if let Err(e) = controller.scan_and_ensure_all_workers().await {
            error!("Error scanning and ensuring all file workers exist: {e}");
        }

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
    let environment = state.settings.environment;

    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}"))
        .await
        .map_err(|e| ControllerError::StartServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| ControllerError::StartServer(e.to_string()))?;

    tracing::info!("listening on {local_addr} for {name}, environment={environment}");

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
        let max_delay = 300;
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

    // Remove any that didn't stop properly
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
            "Scheduled task watcher",
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
    start_with_backoff("public server", public_server_state_clone, |state| async {
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
        let containe_ids = state
            .client
            .lock()
            .await
            .list_ids()
            .await
            .map_err(|e| ControllerError::StartServer(e.to_string()))?;

        for container_id in containe_ids {
            let mut client = state.client.lock().await;
            let docker = client.docker.clone();
            let container = client
                .get_container_mut(&container_id)
                .await
                .map_err(|e| ControllerError::StartServer(e.to_string()))?;

            // record the resource usage
            let _ = container.record_resource_usage(docker.clone()).await;

            // get the logs
            let logs = container
                .logs(docker.clone())
                .await
                .map_err(|e| ControllerError::StartServer(e.to_string()))?;

            if !logs.is_empty() {
                tracing::error!("Logs: {}", logs);
            }

            // let container_guard = container.lock().await;
            // let logs = container_guard
            //     .logs_stream()
            //     .await
            //     .map_err(|e| ControllerError::StartServer(e.to_string()))?;

            // let mut log_lines = Vec::new();
            // let mut logs_stream = logs;
            // while let Some(log_result) = logs_stream.next().await {
            //     match log_result {
            //         Ok(log_output) => log_lines.push(log_output.to_string()),
            //         Err(e) => tracing::warn!("Error reading log: {}", e),
            //     }
            // }

            // for log_line in log_lines {
            //     tracing::error!("Logs: {}", log_line.trim());
            // }
        }

        interval.tick().await;
    }
}
