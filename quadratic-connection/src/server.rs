//! HTTP Server
//!
//! Handle bootstrapping and starting the HTTP server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::{
    http::{header::AUTHORIZATION, Method},
    routing::{any, get, post},
    Extension, Json, Router,
};
use quadratic_rust_shared::auth::jwt::get_jwks;
use quadratic_rust_shared::sql::Connection;
use serde::{Deserialize, Serialize};
use std::{iter::once, time::Duration};
use tokio::time;
use tower_http::{
    cors::{Any, CorsLayer},
    sensitive_headers::SetSensitiveHeadersLayer,
    trace::{DefaultMakeSpan, TraceLayer},
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use crate::{
    auth::get_middleware,
    config::config,
    error::{ConnectionError, Result},
    proxy::proxy,
    sql::{
        mssql::{query as query_mssql, schema as schema_mssql, test as test_mssql},
        mysql::{query as query_mysql, schema as schema_mysql, test as test_mysql},
        postgres::{query as query_postgres, schema as schema_postgres, test as test_postgres},
    },
    state::State,
};

const HEALTHCHECK_INTERVAL_S: u64 = 5;

#[derive(Serialize, Deserialize)]
pub(crate) struct SqlQuery {
    pub(crate) query: String,
    pub(crate) connection_id: Uuid,
}

#[derive(Serialize, PartialEq, Debug)]
pub(crate) struct TestResponse {
    connected: bool,
    message: Option<String>,
}

impl TestResponse {
    pub(crate) fn new(connected: bool, message: Option<String>) -> Self {
        TestResponse { connected, message }
    }
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub(crate) struct StaticIpsResponse {
    static_ips: Vec<String>,
}

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app(state: State) -> Result<Router> {
    let cors = CorsLayer::new()
        // allow requests from any origin
        .allow_methods([Method::GET, Method::POST, Method::CONNECT])
        .allow_origin(Any)
        //
        // TODO(ddimaria): uncomment when we move proxy to a separate service
        //
        // .allow_headers([
        //     CONTENT_TYPE,
        //     AUTHORIZATION,
        //     ACCEPT,
        //     ORIGIN,
        //     HeaderName::from_static("proxy"),
        // ])
        //
        // required for the proxy
        .allow_headers(Any)
        .expose_headers(Any);

    // get the auth middleware
    let auth = get_middleware(state.clone());

    // Routes apply in reverse order, so placing a route before the middleware
    // usurps the middleware.
    let app = Router::new()
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
        // mssql
        .route("/mssql/test", post(test_mssql))
        .route("/mssql/query", post(query_mssql))
        .route("/mssql/schema/:id", get(schema_mssql))
        //
        // proxy
        .route("/proxy", any(proxy))
        //
        // static ips
        .route("/static-ips", get(static_ips))
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
        // don't show authorization header in logs
        .layer(SetSensitiveHeadersLayer::new(once(AUTHORIZATION)))
        //
        // cors
        .layer(cors)
        //
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        );

    Ok(app)
}

/// Start the server.  This is the entrypoint for the application.
#[tracing::instrument(level = "trace")]
pub(crate) async fn serve() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_connection=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config()?;
    let jwks = get_jwks(&config.auth0_jwks_uri).await?;
    let state = State::new(&config, Some(jwks.clone()))?;
    let app = app(state.clone())?;

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

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct HealthResponse {
    pub version: String,
}

pub(crate) async fn healthcheck() -> Json<HealthResponse> {
    HealthResponse {
        version: env!("CARGO_PKG_VERSION").into(),
    }
    .into()
}

pub(crate) async fn static_ips() -> Result<Json<StaticIpsResponse>> {
    let static_ips = config()?.static_ips.to_vec();
    let response = StaticIpsResponse { static_ips };

    Ok(response.into())
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
    use crate::test_util::{new_state, response_json};
    use axum::{
        body::Body,
        http::{self, Request},
    };
    use http::StatusCode;
    use tower::ServiceExt;

    use super::*;

    #[tokio::test]
    async fn responds_with_a_200_ok_for_a_healthcheck() {
        let state = new_state().await;
        let app = app(state).unwrap();

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

    #[tokio::test]
    async fn gets_static_ips() {
        let state = new_state().await;
        let app = app(state).unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .method(http::Method::GET)
                    .uri("/static-ips")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_json(response).await;
        let expected = StaticIpsResponse {
            static_ips: vec!["0.0.0.0".into(), "127.0.0.1".into()],
        };

        assert_eq!(expected, body);
    }
}
