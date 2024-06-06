//! HTTP Server
//!
//! Handle bootstrapping and starting the HTTP server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::{
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, ORIGIN},
        Method, StatusCode,
    },
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::auth::jwt::get_jwks;
use quadratic_rust_shared::sql::Connection;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::{sync::OnceCell, time};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::{DefaultMakeSpan, TraceLayer},
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use crate::{
    auth::get_middleware,
    config::config,
    error::{ConnectionError, Result},
    proxy::server::serve as serve_proxy,
    sql::{
        mysql::{query as query_mysql, schema as schema_mysql, test as test_mysql},
        postgres::{query as query_postgres, schema as schema_postgres, test as test_postgres},
    },
    state::State,
};

const HEALTHCHECK_INTERVAL_S: u64 = 5;

static JWKS: OnceCell<JwkSet> = OnceCell::const_new();

/// Get the constant JWKS for use throughout the application
/// The panics are intentional and will happen at startup
pub(crate) async fn get_const_jwks() -> &'static JwkSet {
    JWKS.get_or_init(|| async {
        let config = config().expect("Invalid config");

        get_jwks(&config.auth0_jwks_uri)
            .await
            .expect("Unable to get JWKS")
    })
    .await
}

#[derive(Serialize, Deserialize)]
pub(crate) struct SqlQuery {
    pub(crate) query: String,
    pub(crate) connection_id: Uuid,
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
pub(crate) fn app(state: State) -> Router {
    let cors = CorsLayer::new()
        // allow requests from any origin
        .allow_methods([Method::GET, Method::POST, Method::CONNECT])
        .allow_origin(Any)
        .allow_headers([CONTENT_TYPE, AUTHORIZATION, ACCEPT, ORIGIN])
        .expose_headers(Any);

    let auth = get_middleware(state.clone());

    // Routes apply in reverse order, so placing a route before the middleware
    // usurps the middleware.
    Router::new()
        // protected routes
        //
        // postgres
        .route("/postgres/test", post(test_postgres))
        .route("/postgres/query", post(query_postgres))
        .route("/postgres/schema/:id", get(schema_postgres))
        // mysql
        .route("/mysql/test", post(test_mysql))
        .route("/mysql/query", post(query_mysql))
        .route("/mysql/schema/:id", get(schema_mysql))
        // proxy
        // .route("/proxy", any(proxy))
        //
        // auth middleware
        .route_layer(auth)
        //
        // state, required
        .with_state(state.clone())
        //
        // state, repeated, but required
        .layer(Extension(state))
        //
        // unprotected routes without state
        .route("/health", get(healthcheck))
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

/// Start the server.  This is the entrypoint for the application.
#[tracing::instrument(level = "trace")]
pub(crate) async fn serve() -> Result<()> {
    std::env::set_var("RUST_LOG", "quadratic_connection=debug,reqwest=trace");
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_connection=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config()?;
    let jwks = get_const_jwks().await;
    let state = State::new(&config, Some(jwks.clone()));
    let app = app(state.clone());

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.host, config.port))
        .await
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    // log stats in a separate thread
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

    // start the proxy server in a separate thread
    tokio::task::spawn(async move {
        if let Err(error) = serve_proxy(&config.host, 3004).await {
            tracing::error!("Error starting proxy: {:?}", error);
        }
    });

    tracing::info!(
        "listening on {local_addr}, environment={}",
        config.environment
    );

    // serve the application
    axum::serve(listener, app).await.map_err(|e| {
        tracing::warn!("{e}");
        ConnectionError::InternalServer(e.to_string())
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
    use crate::test_util::new_state;
    use axum::{
        body::Body,
        http::{self, Request},
    };
    use tower::ServiceExt;

    use super::*;

    #[tokio::test]
    async fn responds_with_a_200_ok_for_a_healthcheck() {
        let state = new_state().await;
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
