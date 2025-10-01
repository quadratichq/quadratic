use anyhow::Result;
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
use tracing::{error, info};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::Config,
    controller::Controller,
    error::ControllerError,
    health::{full_healthcheck, healthcheck},
    state::{State, jwt::handle_jwks},
    worker::{
        handle_ack_tasks_for_worker, handle_get_file_init_data, handle_get_tasks_for_worker,
        handle_get_worker_access_token, handle_worker_shutdown,
    },
};

async fn start_scheduled_task_watcher(state: Arc<State>) -> Result<()> {
    info!("Starting scheduled task watcher");

    let controller = match Controller::new(Arc::clone(&state)).await {
        Ok(controller) => controller,
        Err(e) => {
            error!("Error creating controller: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

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
            Ok(()) => {
                info!("Added scheduled tasks to pubsub");
            }
            Err(e) => {
                error!("Error adding scheduled tasks to pubsub: {e}");
            }
        }

        if let Err(e) = controller.scan_and_ensure_all_workers().await {
            error!("Error scanning and ensuring all file workers exist: {e}");
        }

        let active_count = controller.count_active_workers().await.unwrap_or(0);

        info!("Worker Controller alive - {active_count} active file workers");
    }
}

pub(crate) fn worker_only_app(state: Arc<State>) -> Result<Router> {
    info!("Building worker-only app");

    let app = Router::new()
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
        );

    Ok(app)
}

pub(crate) fn public_app(state: Arc<State>) -> Result<Router> {
    info!("Building public app");

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

    Ok(app)
}

async fn start_server(
    name: &str,
    host: String,
    port: String,
    state: Arc<State>,
    app: fn(Arc<State>) -> Result<Router>,
) -> Result<()> {
    let environment = state.settings.environment;

    let listener = match tokio::net::TcpListener::bind(format!("{host}:{port}")).await {
        Ok(listener) => listener,
        Err(e) => {
            error!("Error binding to {host}:{port}, error: {e}",);
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
            error!("Error building {name} app: {e}");
            return Err(ControllerError::InternalServer(e.to_string()).into());
        }
    };

    tracing::info!("listening on {local_addr}, environment={environment}");
    match axum::serve(listener, app).await {
        Ok(_) => {
            info!("{name} stopped");
        }
        Err(e) => {
            error!("Error serving {name} application: {e}");
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

    // Start worker-only server
    let worker_only_server_state_clone = Arc::clone(&state);
    tokio::spawn(async {
        let _ = start_with_backoff(
            "worker-only server",
            worker_only_server_state_clone,
            |state| {
                start_server(
                    "worker-only",
                    state.settings.worker_only_host.clone(),
                    state.settings.worker_only_port.clone(),
                    state,
                    worker_only_app,
                )
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
            start_scheduled_task_watcher,
        )
        .await;
    });

    // Start public server
    let public_server_state_clone = Arc::clone(&state);
    start_with_backoff("public server", public_server_state_clone, |state| {
        start_server(
            "public",
            state.settings.public_host.clone(),
            state.settings.public_port.clone(),
            state,
            public_app,
        )
    })
    .await
}
