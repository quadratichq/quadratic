use anyhow::Result;
use axum::{
    Extension, Router,
    routing::{get, post},
};
use chrono::Timelike;
use quadratic_rust_shared::{
    quadratic_api::get_scheduled_tasks,
    quadratic_cloud::{ACK_TASKS_ROUTE, GET_LAST_CHECKPOINT_DATA_URL_ROUTE, GET_TASKS_ROUTE},
};
use std::{sync::Arc, time::Duration};
use tokio::time::{MissedTickBehavior, interval, sleep};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing::{error, info};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::Config,
    controller::Controller,
    error::ControllerError,
    health::{full_healthcheck, healthcheck},
    state::State,
    worker::{ack_tasks_for_worker, get_last_checkpoint_data_url, get_tasks_for_worker},
};

async fn start_pubsub_listener(state: Arc<State>) -> Result<()> {
    info!("Starting pubsub listener");

    let controller = match Controller::new(state).await {
        Ok(controller) => controller,
        Err(e) => {
            error!("Error creating controller: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

    controller.listen_for_worker_task_events().await
}

async fn start_ensure_workers(state: Arc<State>) -> Result<()> {
    info!("Starting ensure workers");

    let heartbeat_check_s = state.settings.heartbeat_check_s;
    let controller = match Controller::new(state).await {
        Ok(controller) => controller,
        Err(e) => {
            error!("Error creating controller: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

    let mut interval = interval(Duration::from_secs(heartbeat_check_s));
    loop {
        interval.tick().await;

        // scan for files with pending tasks and ensure workers exist
        if let Err(e) = controller.scan_and_ensure_all_workers().await {
            error!("Error scanning and ensuring all file workers exist: {e}");
        }

        let active_count = controller.count_active_workers().await.unwrap_or(0);

        info!("Worker Controller alive - {active_count} active file workers");
    }
}

async fn start_scheduled_task_watcher(state: Arc<State>) -> Result<()> {
    info!("Starting scheduled task watcher");

    // Wait until the next minute
    let wait_seconds = 60 - chrono::Utc::now().second() as u64;
    info!("Waiting until next minute {} seconds", wait_seconds);
    sleep(Duration::from_secs(wait_seconds)).await;

    // Run exactly at 0 seconds of each minute
    let mut interval = interval(Duration::from_secs(60));
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);
    loop {
        interval.tick().await;

        info!("Fetching scheduled tasks from API");

        // Fetch scheduled tasks from API
        let scheduled_tasks = match get_scheduled_tasks(
            &state.settings.quadratic_api_uri,
            &state.settings.m2m_auth_token,
        )
        .await
        {
            Ok(scheduled_tasks) => {
                info!("Got {} scheduled tasks from API", scheduled_tasks.len());
                scheduled_tasks
            }
            Err(e) => {
                error!("Error fetching scheduled tasks: {e}");
                continue;
            }
        };

        match state.add_tasks(scheduled_tasks).await {
            Ok(()) => (),
            Err(e) => {
                error!("Error adding scheduled tasks to pubsub: {e}");
            }
        }
    }
}

pub(crate) fn app(state: Arc<State>) -> Result<Router> {
    info!("Building app");

    let app = Router::new()
        // .route("/worker/heartbeat", post(worker_heartbeat))
        // .route("/worker/status", get(worker_status))
        //
        // Acknowledge tasks after they have been processed by the worker
        .route(ACK_TASKS_ROUTE, post(ack_tasks_for_worker))
        //
        // Get tasks for a file by worker
        .route(GET_TASKS_ROUTE, get(get_tasks_for_worker))
        //
        // Get a last checkpoint data URL for a file
        .route(
            GET_LAST_CHECKPOINT_DATA_URL_ROUTE,
            get(get_last_checkpoint_data_url),
        )
        // Worker API routes
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

    Ok(app)
}

async fn start_server(state: Arc<State>) -> Result<()> {
    let environment = state.settings.environment.clone();

    let listener = match tokio::net::TcpListener::bind(format!(
        "{}:{}",
        state.settings.host, state.settings.port
    ))
    .await
    {
        Ok(listener) => listener,
        Err(e) => {
            error!(
                "Error binding to {}: {}, error: {e}",
                state.settings.host, state.settings.port
            );
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

    let local_addr = match listener.local_addr() {
        Ok(local_addr) => local_addr,
        Err(e) => {
            error!("Error getting local address, error: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

    // Serve the application with ConnectInfo for IP extraction
    let app = match app(state) {
        Ok(app) => app,
        Err(e) => {
            error!("Error building app: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

    tracing::info!("listening on {local_addr}, environment={environment}");
    match axum::serve(listener, app).await {
        Ok(_) => {
            info!("Server stopped");
        }
        Err(e) => {
            error!("Error serving application: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    }

    Ok(())
}

async fn start_with_backoff<F, Fut>(name: &str, state: Arc<State>, mut f: F) -> Result<()>
where
    F: FnMut(Arc<State>) -> Fut,
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

    let config = match Config::new() {
        Ok(config) => config,
        Err(e) => {
            error!("Error creating config: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

    let state = match State::new(&config).await {
        Ok(state) => Arc::new(state),
        Err(e) => {
            error!("Error creating state: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

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

    // Start pubsub listener
    let pubsub_state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ =
            start_with_backoff("Pubsub listener", pubsub_state_clone, start_pubsub_listener).await;
    });

    // Start ensure workers
    let ensure_workers_state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ = start_with_backoff(
            "Ensure workers",
            ensure_workers_state_clone,
            start_ensure_workers,
        )
        .await;
    });

    // Start scheduled task watcher
    let scheduled_task_watcher_state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ = start_with_backoff(
            "Scheduled task watcher",
            scheduled_task_watcher_state_clone,
            start_scheduled_task_watcher,
        )
        .await;
    });

    // Start server
    let server_state_clone = Arc::clone(&state);
    start_with_backoff("Server", server_state_clone, start_server).await
}
