pub mod checkpoint;
pub mod error;

// re-exports
pub use sqlx::PgPool;

use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

use crate::{error::Result, quadratic_database::error::QuadraticDatabase};

static DEFAULT_MAX_CONNECTIONS: u32 = 20;
static DEFAULT_ACQUIRE_TIMEOUT_SECS: u64 = 30;

/// Options for configuring the database connection pool.
#[derive(Debug, Clone)]
pub struct ConnectionOptions {
    pub max_connections: u32,
    pub acquire_timeout: Duration,
}

impl Default for ConnectionOptions {
    fn default() -> Self {
        Self {
            max_connections: DEFAULT_MAX_CONNECTIONS,
            acquire_timeout: Duration::from_secs(DEFAULT_ACQUIRE_TIMEOUT_SECS),
        }
    }
}

impl ConnectionOptions {
    pub fn new(max_connections: Option<u32>, acquire_timeout: Option<Duration>) -> Self {
        Self {
            max_connections: max_connections.unwrap_or(DEFAULT_MAX_CONNECTIONS),
            acquire_timeout: acquire_timeout
                .unwrap_or(Duration::from_secs(DEFAULT_ACQUIRE_TIMEOUT_SECS)),
        }
    }
}

/// Connect to a PostgreSQL database (lazy - connections established on first use)
///
/// # Arguments
///
/// * `url` - The URL of the PostgreSQL database
/// * `options` - Connection pool options (max_connections, acquire_timeout)
///
/// # Returns
///
/// A `Result` containing the PostgreSQL pool (only fails on URL parse errors)
pub fn connect(url: &str, options: ConnectionOptions) -> Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(options.max_connections)
        .acquire_timeout(options.acquire_timeout)
        .connect_lazy(url)
        .map_err(|e| QuadraticDatabase::Connect(e.to_string()).into())
}

/// Database settings retrieved from PostgreSQL
#[derive(Debug)]
pub struct DatabaseSettings {
    pub max_connections: i32,
    pub current_connections: i64,
}

/// Query database settings from PostgreSQL.
///
/// Returns max_connections and current active connections count.
pub async fn get_database_settings(pool: &PgPool) -> Result<DatabaseSettings> {
    let max_connections: String = sqlx::query_scalar("SHOW max_connections")
        .fetch_one(pool)
        .await
        .map_err(|e| QuadraticDatabase::Query(format!("Failed to get max_connections: {e}")))?;

    let current_connections: i64 =
        sqlx::query_scalar("SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL")
            .fetch_one(pool)
            .await
            .map_err(|e| {
                QuadraticDatabase::Query(format!("Failed to get current connections: {e}"))
            })?;

    let max_connections = max_connections
        .parse::<i32>()
        .map_err(|e| QuadraticDatabase::Query(format!("Failed to parse max_connections: {e}")))?;

    Ok(DatabaseSettings {
        max_connections,
        current_connections,
    })
}

/// Check if the database is healthy by executing a simple query.
pub async fn is_healthy(pool: &PgPool) -> bool {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok()
}

// For testing, we need to connect to a test database
pub fn connect_test() -> Result<PgPool> {
    let _ = dotenv::from_filename(".env.test").ok();
    let url = std::env::var("DATABASE_DSN").expect("DATABASE_DSN is not set");
    connect(&url, ConnectionOptions::default())
}
