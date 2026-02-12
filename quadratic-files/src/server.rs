//! HTTP Server
//!
//! Handle bootstrapping and starting the HTTP server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::Json;
use axum::http::Method;
use axum::middleware::map_response;
use axum::response::{IntoResponse, Response};
use axum::{Extension, Router, routing::get};
use http::{HeaderValue, header::HeaderName};
use quadratic_rust_shared::auth::jwt::get_jwks;
use quadratic_rust_shared::storage::Storage;
use std::time::Duration;
use std::{net::SocketAddr, sync::Arc};
use tokio::task::JoinHandle;
use tokio::time;
use tokio_util::sync::CancellationToken;
use tokio_util::task::TaskTracker;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing_subscriber::Layer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::data_pipeline::background_workers::init_data_pipeline_workers;
use crate::file::{get_files_to_process, process};
use crate::health::{full_healthcheck, healthcheck};
use crate::state::stats::StatsResponse;
use crate::storage::{get_presigned_storage, get_storage};
use crate::synced_connection::background_workers::init_sync_workers;
use crate::truncate::truncate_processed_transactions;
use crate::{
    auth::get_middleware,
    config::config,
    error::{FilesError, Result},
    state::State,
    storage::upload_storage,
};

const HEALTHCHECK_INTERVAL_S: u64 = 30;
const SHUTDOWN_TIMEOUT_S: u64 = 60;

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app(state: Arc<State>) -> Router {
    // get the auth middleware
    let jwks = state
        .settings
        .jwks
        .as_ref()
        .expect("JWKS not found in state")
        .to_owned();
    let auth = get_middleware(jwks);
    let path = state.settings.storage.path().to_owned();

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any)
        .allow_headers(Any)
        .expose_headers(Any);

    tracing::info!("Serving files from {path}");

    Router::new()
        // PROTECTED ROUTES (via JWT)
        //
        // get a file from storage
        .route(
            "/storage/{key}",
            get(get_storage)
                //
                // upload a file
                .post(upload_storage),
        )
        //
        // auth middleware
        .route_layer(auth)
        //
        // UNPROTECTED ROUTES
        //
        // healthcheck
        .route("/health", get(healthcheck))
        //
        // full healthcheck
        .route("/health/full", get(full_healthcheck))
        //
        // stats
        .route("/stats", get(stats))
        //
        // presigned urls
        .route("/storage/presigned/{key}", get(get_presigned_storage))
        //
        // state
        .layer(Extension(state))
        //
        // add Cross-Origin-Resource-Policy header for COEP compatibility
        .layer(map_response(|mut response: Response| async move {
            let headers = response.headers_mut();
            headers.insert(
                HeaderName::from_static("cross-origin-resource-policy"),
                HeaderValue::from_static("cross-origin"),
            );
            response
        }))
        //
        // cors
        .layer(cors)
        //
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
}

/// Wait for a shutdown signal (SIGINT or SIGTERM).
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install SIGINT handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => tracing::info!("Received SIGINT, initiating graceful shutdown"),
        _ = terminate => tracing::info!("Received SIGTERM, initiating graceful shutdown"),
    }
}

/// Start the websocket server.  This is the entrypoint for the application.
#[tracing::instrument(level = "trace")]
pub(crate) async fn serve() -> Result<()> {
    let tracing_layer = if config()?.environment.is_production() {
        tracing_subscriber::fmt::layer().json().boxed()
    } else {
        tracing_subscriber::fmt::layer().boxed()
    };

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_files=debug,tower_http=debug".into()),
        )
        .with(tracing_layer)
        .init();

    let config = config()?;
    let jwks = get_jwks(&config.jwks_uri).await?;
    let state = Arc::new(State::new(&config, Some(jwks)).await?);
    let app = app(Arc::clone(&state));
    let active_channels = config.pubsub_active_channels.to_owned();

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.host, config.port))
        .await
        .map_err(|e| FilesError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| FilesError::InternalServer(e.to_string()))?;

    tracing::info!(
        "listening on {local_addr}, environment={}",
        config.environment
    );

    // Create a cancellation token for graceful shutdown
    let cancellation_token = CancellationToken::new();

    // TaskTracker to track file processing tasks spawned by process()
    let task_tracker = TaskTracker::new();

    // Collect handles for all background worker tasks
    let mut background_handles: Vec<JoinHandle<()>> = Vec::new();

    // in a separate thread, process all files in the queue
    let file_process_handle = tokio::spawn({
        let state = Arc::clone(&state);
        let token = cancellation_token.clone();
        let tracker = task_tracker.clone();

        async move {
            let mut interval = time::interval(Duration::from_secs(config.file_check_s as u64));

            loop {
                tokio::select! {
                    _ = token.cancelled() => {
                        tracing::info!("File processing worker received shutdown signal");
                        break;
                    }
                    _ = interval.tick() => {
                        if let Err(error) = process(&state, &config.pubsub_active_channels, &tracker).await {
                            tracing::error!("Error processing files: {error}");
                        }
                    }
                }
            }

            // Wait for all in-flight file processing tasks to complete
            tracing::info!("Waiting for in-flight file processing tasks to complete");
            tracker.close();
            tracker.wait().await;
            tracing::info!("All file processing tasks completed");
        }
    });

    background_handles.push(file_process_handle);

    // in a separate thread, truncate streams/channels
    let truncate_handle = tokio::spawn({
        let state = Arc::clone(&state);
        let token = cancellation_token.clone();

        async move {
            let mut interval =
                time::interval(Duration::from_secs(config.truncate_file_check_s as u64));

            loop {
                tokio::select! {
                    _ = token.cancelled() => {
                        tracing::info!("Truncation worker received shutdown signal");
                        break;
                    }
                    _ = interval.tick() => {
                        if let Err(error) = truncate_processed_transactions(
                            &state,
                            &config.pubsub_processed_transactions_channel,
                            config.truncate_transaction_age_days as u64,
                        )
                        .await
                        {
                            tracing::error!("Error truncating streams: {error}");
                        }
                    }
                }
            }
        }
    });
    background_handles.push(truncate_handle);

    // in a separate thread, log stats
    let stats_handle = tokio::spawn({
        let state = Arc::clone(&state);
        let token = cancellation_token.clone();

        async move {
            let mut interval = time::interval(Duration::from_secs(HEALTHCHECK_INTERVAL_S));

            loop {
                tokio::select! {
                    _ = token.cancelled() => {
                        tracing::info!("Stats worker received shutdown signal");
                        break;
                    }
                    _ = interval.tick() => {
                        // reconnect to pubsub if the connection becomes unhealthy
                        state.pubsub.lock().await.reconnect_if_unhealthy().await;

                        if let Ok(files) = get_files_to_process(&state, &active_channels).await {
                            state.stats.lock().await.files_to_process_in_pubsub = files.len() as u64;
                        }

                        let stats = state.stats.lock().await;

                        // push stats to the logs if there are files to process
                        if stats.files_to_process_in_pubsub > 0 {
                            tracing::info!(
                                r#"{{ "files_to_process_in_pubsub": "{:#?}", "last_processed_file_time": "{:#?}" }}"#,
                                stats.files_to_process_in_pubsub,
                                stats.last_processed_file_time.unwrap_or_default(),
                            );
                        }
                    }
                }
            }
        }
    });
    background_handles.push(stats_handle);

    // in a separate thread, sync connections
    let sync_handles = init_sync_workers(state.clone(), cancellation_token.clone())?;
    background_handles.extend(sync_handles);

    // in a separate thread, run data pipelines
    let data_pipeline_handles =
        init_data_pipeline_workers(state.clone(), cancellation_token.clone());
    background_handles.extend(data_pipeline_handles);

    // Start the HTTP server with graceful shutdown
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .map_err(|e| {
        tracing::warn!("{e}");
        FilesError::InternalServer(e.to_string())
    })?;

    tracing::info!("HTTP server stopped, signaling background tasks to shutdown");

    // Signal all background tasks to stop
    cancellation_token.cancel();

    tracing::info!("Waiting for background tasks to complete (timeout: {SHUTDOWN_TIMEOUT_S}s)");

    // Wait for all background tasks to complete with a timeout
    let shutdown_result = tokio::time::timeout(
        Duration::from_secs(SHUTDOWN_TIMEOUT_S),
        futures::future::join_all(background_handles),
    )
    .await;

    match shutdown_result {
        Ok(results) => {
            for (i, result) in results.into_iter().enumerate() {
                if let Err(e) = result {
                    tracing::warn!("Background task {i} failed to join: {e}");
                }
            }
            tracing::info!("All background tasks completed gracefully");
        }
        Err(_) => {
            tracing::warn!(
                "Shutdown timeout ({SHUTDOWN_TIMEOUT_S}s) reached, some tasks may not have completed"
            );
        }
    }

    tracing::info!("Graceful shutdown complete");

    Ok(())
}

/// Get the stats for the files to process in the pubsub
pub(crate) async fn stats(state: Extension<Arc<State>>) -> impl IntoResponse {
    let stats = state.stats.lock().await.to_owned();
    let response = StatsResponse::from(&stats);

    Json(response)
}

#[cfg(test)]
pub(crate) mod tests {
    use crate::test_util::{new_arc_state, response};
    use axum::http::{Method, StatusCode};

    use super::*;

    #[tokio::test]
    async fn responds_with_a_200_ok_for_stats() {
        let state = new_arc_state().await;
        let app = app(state);
        let response = response(app, Method::GET, "/stats").await;
        assert_eq!(response.status(), StatusCode::OK);
    }
}
