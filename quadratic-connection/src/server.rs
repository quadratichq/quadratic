//! HTTP Server
//!
//! Handle bootstrapping and starting the HTTP server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::{
    Extension, Json, Router,
    http::{Method, header::AUTHORIZATION},
    middleware::map_response,
    response::Response,
    routing::{any, get, post},
};
use http::{
    HeaderName, HeaderValue,
    header::{CACHE_CONTROL, PRAGMA},
};
use quadratic_rust_shared::sql::Connection;
use quadratic_rust_shared::{
    auth::jwt::{get_jwks, merge_jwks, parse_jwks},
    cache::memory::MemoryCache,
};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Duration};
use tokio::time;
use tower_http::{
    classify::{ServerErrorsAsFailures, SharedClassifier},
    cors::{Any, CorsLayer},
    sensitive_headers::SetSensitiveHeadersLayer,
    trace::{DefaultMakeSpan, TraceLayer},
};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use crate::{
    auth::get_middleware,
    config::config,
    error::{ConnectionError, Result},
    financial::stock_prices::stock_prices,
    health::{full_healthcheck, healthcheck},
    proxy::proxy,
    sql::{
        bigquery::{query as query_bigquery, schema as schema_bigquery, test as test_bigquery},
        datafusion::{
            query as query_datafusion, query_generic_datafusion, schema as schema_datafusion,
            schema_generic_datafusion, test_google_analytics, test_mixpanel, test_plaid,
        },
        mssql::{query as query_mssql, schema as schema_mssql, test as test_mssql},
        mysql::{query as query_mysql, schema as schema_mysql, test as test_mysql},
        postgres::{query as query_postgres, schema as schema_postgres, test as test_postgres},
        snowflake::{query as query_snowflake, schema as schema_snowflake, test as test_snowflake},
    },
    state::State,
};

const STATS_INTERVAL_S: u64 = 60;
pub(crate) const SCHEMA_CACHE_DURATION_S: Duration = Duration::from_secs(60 * 30); // 30 minutes

#[derive(Serialize, Deserialize)]
pub(crate) struct SqlQuery {
    pub(crate) query: String,
    pub(crate) connection_id: Uuid,
}

#[derive(Serialize, PartialEq, Debug)]
pub(crate) struct TestResponse {
    pub(crate) connected: bool,
    pub(crate) message: Option<String>,
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
pub(crate) fn app(state: Arc<State>) -> Result<Router> {
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
        //     HeaderName::from_static("x-team-id"),
        // ])
        //
        // required for the proxy
        .allow_headers(Any)
        .expose_headers(Any);

    // get the auth middleware
    let auth = get_middleware(state.clone());

    // sensitive headers, that are excluded from tracing logs
    let sensitive_headers = [
        AUTHORIZATION,
        HeaderName::from_static("x-proxy-authorization"),
    ];

    // Routes apply in reverse order, so placing a route before the middleware
    // usurps the middleware.
    let app = Router::new()
        // protected routes
        //
        // postgres and derivitives
        .route("/postgres/test", post(test_postgres))
        .route("/postgres/query", post(query_postgres))
        .route("/postgres/schema/:id", get(schema_postgres))
        .route("/cockroachdb/test", post(test_postgres))
        .route("/cockroachdb/query", post(query_postgres))
        .route("/cockroachdb/schema/:id", get(schema_postgres))
        .route("/supabase/test", post(test_postgres))
        .route("/supabase/query", post(query_postgres))
        .route("/supabase/schema/:id", get(schema_postgres))
        .route("/neon/test", post(test_postgres))
        .route("/neon/query", post(query_postgres))
        .route("/neon/schema/:id", get(schema_postgres))
        //
        // mysql and derivitives
        .route("/mysql/test", post(test_mysql))
        .route("/mysql/query", post(query_mysql))
        .route("/mysql/schema/:id", get(schema_mysql))
        .route("/mariadb/test", post(test_mysql))
        .route("/mariadb/query", post(query_mysql))
        .route("/mariadb/schema/:id", get(schema_mysql))
        //
        // mssql
        .route("/mssql/test", post(test_mssql))
        .route("/mssql/query", post(query_mssql))
        .route("/mssql/schema/:id", get(schema_mssql))
        //
        // snowflake
        .route("/snowflake/test", post(test_snowflake))
        .route("/snowflake/query", post(query_snowflake))
        .route("/snowflake/schema/:id", get(schema_snowflake))
        //
        // bigquery
        .route("/bigquery/test", post(test_bigquery))
        .route("/bigquery/query", post(query_bigquery))
        .route("/bigquery/schema/:id", get(schema_bigquery))
        //
        // synced connections
        .route("/mixpanel/test", post(test_mixpanel))
        .route("/mixpanel/query", post(query_datafusion))
        .route("/mixpanel/schema/:id", get(schema_datafusion))
        .route("/google-analytics/test", post(test_google_analytics))
        .route("/google-analytics/query", post(query_datafusion))
        .route("/google-analytics/schema/:id", get(schema_datafusion))
        .route("/plaid/test", post(test_plaid))
        .route("/plaid/query", post(query_datafusion))
        .route("/plaid/schema/:id", get(schema_datafusion))
        //
        // generic datafusion (reads streams/prefix from connection typeDetails)
        .route("/datafusion/query", post(query_generic_datafusion))
        .route("/datafusion/schema/:id", get(schema_generic_datafusion))
        //
        // financial
        .route("/financial/stock-prices", post(stock_prices))
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
        // unprotected routes without state
        //
        // healthcheck
        .route("/health", get(healthcheck))
        //
        // full healthcheck of dependencies
        .route("/health/full", get(full_healthcheck))
        //
        // state, required
        .with_state(state.clone())
        //
        // state, repeated, but required
        .layer(Extension(state))
        //
        // cache control - disable client side caching
        .layer(map_response(|mut response: Response| async move {
            let headers = response.headers_mut();
            headers.insert(
                CACHE_CONTROL,
                HeaderValue::from_static("no-cache, no-store, must-revalidate"),
            );
            headers.insert(PRAGMA, HeaderValue::from_static("no-cache"));
            response
        }))
        //
        // cors
        .layer(cors)
        //
        // logger - classify only 5xx as failures
        .layer(
            TraceLayer::new(SharedClassifier::new(ServerErrorsAsFailures::new()))
                .make_span_with(DefaultMakeSpan::default().include_headers(true))
                .on_failure(()) // disable default on_failure logging (handled in on_response)
                .on_response(
                    |response: &Response, latency: Duration, _span: &tracing::Span| {
                        let status = response.status();
                        if status.is_server_error() {
                            tracing::error!(
                                status = status.as_u16(),
                                latency_ms = latency.as_millis(),
                                "response failed"
                            );
                        } else if status.is_client_error() {
                            tracing::warn!(
                                status = status.as_u16(),
                                latency_ms = latency.as_millis(),
                                "client error"
                            );
                        }
                    },
                ),
        )
        //
        // don't show authorization header in logs
        .layer(SetSensitiveHeadersLayer::new(
            sensitive_headers.iter().cloned(),
        ));

    Ok(app)
}

/// Start the server.  This is the entrypoint for the application.
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
                .unwrap_or_else(|_| "quadratic_connection=debug,tower_http=debug".into()),
        )
        .with(tracing_layer)
        .init();

    let config = config()?;

    // Fetch JWKS from the remote URI (e.g., WorkOS)
    let mut jwks = get_jwks(&config.jwks_uri).await?;

    // Merge the local JWKS with the remote JWKS
    let local_jwks = parse_jwks(&config.quadratic_jwks)?;
    jwks = merge_jwks(jwks, local_jwks);

    let state = Arc::new(State::new(&config, Some(jwks.clone())).await?);
    let app = app(state.clone())?;

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.host, config.port))
        .await
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| ConnectionError::InternalServer(e.to_string()))?;

    // start the cache executor
    let cache = Arc::clone(&state.schema_cache.schema);
    let executor = MemoryCache::start_executor(cache, Duration::from_secs(30)).await;

    tracing::info!("started cache executor: {executor:?}");

    // log stats in a separate thread
    let stats_state = state.clone();
    tokio::spawn({
        async move {
            let mut interval = time::interval(Duration::from_secs(STATS_INTERVAL_S));

            loop {
                interval.tick().await;

                let stats = stats_state.stats.lock().await;

                // push stats to the logs if there are files to process or connections are processing
                if stats.last_query_time.is_some() {
                    tracing::info!("{}", stats);
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

pub(crate) async fn static_ips() -> Result<Json<StaticIpsResponse>> {
    let static_ips = config()?.static_ips.to_vec();
    let response = StaticIpsResponse { static_ips };

    Ok(response.into())
}

pub(crate) async fn test_connection<'a, T: Connection<'a>>(connection: T) -> Json<TestResponse> {
    let message = match connection.connect().await {
        Ok(_) => None,
        Err(e) => Some(e.to_string()),
    };

    TestResponse::new(message.is_none(), message).into()
}

#[cfg(test)]
pub(crate) mod tests {
    use crate::test_util::{process_route, response_json};
    use axum::body::Body;
    use http::StatusCode;

    use super::*;

    #[tokio::test]
    async fn gets_static_ips() {
        let response = process_route("/static-ips", http::Method::GET, Body::empty()).await;

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_json(response).await;
        let expected = StaticIpsResponse {
            static_ips: vec!["0.0.0.0".into(), "127.0.0.1".into()],
        };

        assert_eq!(expected, body);
    }
}
