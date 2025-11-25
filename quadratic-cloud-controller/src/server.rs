use axum::{
    Extension, Router,
    routing::{get, post},
};
use quadratic_rust_shared::quadratic_cloud::{
    WORKER_ACK_TASKS_ROUTE, WORKER_GET_TASKS_ROUTE, WORKER_SHUTDOWN_ROUTE,
};
use std::{sync::Arc, time::Duration};
use tokio::time::sleep;
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing::{error, info, trace};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    background_workers::init_background_workers,
    config::Config,
    controller_docker::IMAGE_NAME,
    error::{ControllerError, Result},
    handle::{ack_tasks_for_worker, get_tasks_for_worker, jwks, shutdown_worker},
    health::{full_healthcheck, healthcheck},
    state::State,
};

const MAX_BACKOFF_SECONDS: u64 = 60;

pub(crate) fn worker_only_app(state: Arc<State>) -> Router {
    trace!("Building worker-only app");

    Router::new()
        //
        // Worker API routes
        //
        // Get tasks for a worker
        .route(WORKER_GET_TASKS_ROUTE, get(get_tasks_for_worker))
        //
        // Shutdown a worker
        .route(WORKER_SHUTDOWN_ROUTE, post(shutdown_worker))
        //
        // Acknowledge tasks after they have been processed by the worker
        .route(WORKER_ACK_TASKS_ROUTE, post(ack_tasks_for_worker))
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

    Router::new()
        // JWKS for worker jwt validation
        .route("/.well-known/jwks.json", get(jwks))
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
        )
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
        return Err(ControllerError::StartServer(e.to_string()));
    }

    info!("{name} stopped");

    Ok(())
}

pub(crate) async fn start_with_backoff<F, Fut>(name: &str, state: Arc<State>, f: F) -> Result<()>
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
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "quadratic_cloud_controller=debug,quadratic_core_cloud=debug,tower_http=debug"
                    .into()
            }),
        )
        .with(tracing_layer)
        .init();

    // Remove any cloud worker containers that didn't stop properly.
    if let Err(e) = remove_containers_by_image_name(Arc::clone(&state)).await {
        error!("Error removing containers by image name: {e}");
    }

    // init background workers
    init_background_workers(Arc::clone(&state))?;

    // start worker-only server in a separate thread
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

// Remove any cloud worker containers that didn't stop properly.
async fn remove_containers_by_image_name(state: Arc<State>) -> Result<()> {
    let number_removed = state
        .client
        .lock()
        .await
        .remove_containers_by_image_name(IMAGE_NAME)
        .await
        .map_err(|e| ControllerError::StartServer(e.to_string()))?;

    if number_removed > 0 {
        info!(
            "Removed {} containers by image name {}",
            number_removed, IMAGE_NAME
        );
    }

    Ok(())
}
