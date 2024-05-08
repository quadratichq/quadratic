//! HTTP Server
//!
//! Handle bootstrapping and starting the HTTP server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, ORIGIN},
        request::Parts,
        Method, StatusCode,
    },
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, RequestPartsExt, Router,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use quadratic_rust_shared::auth::jwt::{authorize, get_jwks};
use quadratic_rust_shared::sql::Connection;
use serde::{Deserialize, Serialize};
use std::time::Duration;
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    sub: String,
    exp: usize,
}

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
pub(crate) fn app(state: State) -> Router {
    let cors = CorsLayer::new()
        // allow requests from any origin
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any)
        .allow_headers([CONTENT_TYPE, AUTHORIZATION, ACCEPT, ORIGIN]);

    let auth = middleware::from_extractor_with_state::<Claims, State>(state.clone());

    Router::new()
        // protected routes
        .route("/postgres/test", post(test_postgres))
        .route("/postgres/query", post(query_postgres))
        .layer(auth)
        // state
        .layer(Extension(state))
        // unprotected routes
        .route("/health", get(healthcheck))
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
    let jwks = get_jwks(&config.auth0_jwks_uri).await?;
    let state = State::new(&config, Some(jwks));
    let app = app(state.clone());

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

    axum::serve(listener, app).await.map_err(|e| {
        tracing::warn!("{e}");
        ConnectorError::InternalServer(e.to_string())
    })?;

    Ok(())
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    State: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ConnectorError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        let state = State::from_ref(state);
        let jwks = state
            .settings
            .jwks
            .as_ref()
            .ok_or(ConnectorError::InternalServer(
                "JWKS not found in state".to_string(),
            ))?;

        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|e| ConnectorError::InvalidToken(e.to_string()))?;

        let token_data = authorize(jwks, bearer.token(), false, true)?;

        Ok(token_data.claims)
    }
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
