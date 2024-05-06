//! HTTP Server
//!
//! Handle bootstrapping and starting the HTTP server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::http::header::{ACCEPT, AUTHORIZATION, ORIGIN};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use axum::{
    http::{header::CONTENT_TYPE, Method},
    routing::{get, post},
    Extension, Router,
};
use quadratic_rust_shared::sql::Connection;
use std::time::Duration;
use std::{net::SocketAddr, sync::Arc};
use tokio::time;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::{DefaultMakeSpan, TraceLayer},
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::sql::postgres::{query as query_postgres, test as test_postgres};
use crate::{
    config::config,
    error::{ConnectorError, Result},
    state::State,
};

const HEALTHCHECK_INTERVAL_S: u64 = 5;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub(crate) struct SqlQuery {
    pub(crate) statement: String,
}

#[derive(Serialize)]
pub(crate) struct TestResponse {
    connected: bool,
    message: Option<String>,
}

impl TestResponse {
    pub(crate) fn new(connected: bool, message: Option<String>) -> Self {
        TestResponse { connected, message }
    }
}

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app(state: Arc<State>) -> Router {
    let cors = CorsLayer::new()
        // allow requests from any origin
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any)
        .allow_headers([CONTENT_TYPE, AUTHORIZATION, ACCEPT, ORIGIN]);

    Router::new()
        // routes
        .route("/health", get(healthcheck))
        .route("/postgres/test", post(test_postgres))
        .route("/postgres/query", post(query_postgres))
        // state
        .layer(Extension(state))
        // cors
        .layer(cors)
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
}

/// Start the websocket server.  This is the entrypoint for the application.
#[tracing::instrument(level = "trace")]
pub(crate) async fn serve() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_connector=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config()?;
    let state = Arc::new(State::new(&config));
    let app = app(Arc::clone(&state));

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.host, config.port))
        .await
        .map_err(|e| ConnectorError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| ConnectorError::InternalServer(e.to_string()))?;

    tracing::info!(
        "listening on {local_addr}, environment={}",
        config.environment
    );

    // in a separate thread, log stats
    tokio::spawn({
        async move {
            let mut interval = time::interval(Duration::from_secs(HEALTHCHECK_INTERVAL_S));

            loop {
                interval.tick().await;

                let stats = state.stats.lock().await;

                // push stats to the logs if there are files to process
                if stats.last_query_time.is_some() {
                    tracing::info!("Stats: {}", stats);
                }
            }
        }
    });

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .map_err(|e| {
        tracing::warn!("{e}");
        ConnectorError::InternalServer(e.to_string())
    })?;

    Ok(())
}

pub(crate) async fn healthcheck() -> impl IntoResponse {
    StatusCode::OK
}

pub(crate) async fn test_connection(connection: impl Connection) -> Json<TestResponse> {
    let message = match connection.connect().await {
        Ok(_) => None,
        Err(e) => Some(e.to_string()),
    };

    TestResponse::new(message.is_none(), message).into()
}

#[cfg(test)]
pub(crate) mod tests {
    use crate::test_util::new_arc_state;
    use axum::{
        body::Body,
        http::{self, Request},
    };
    use tower::ServiceExt;

    use super::*;

    #[tokio::test]
    async fn responds_with_a_200_ok_for_a_healthcheck() {
        let state = new_arc_state().await;
        let app = app(state);

        let response = app
            .oneshot(
                Request::builder()
                    .method(http::Method::GET)
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
