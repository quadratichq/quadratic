pub mod checkpoint;
pub mod error;

// re-exports
pub use sqlx::PgPool;

use std::time::Duration;

use sqlx::postgres::PgPoolOptions;

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

/// Connect to a PostgreSQL database (blocking until connected)
///
/// # Arguments
///
/// * `url` - The URL of the PostgreSQL database
/// * `options` - Connection pool options (max_connections, acquire_timeout)
///
/// # Returns
///
/// A `Result` containing the PostgreSQL pool
pub async fn connect(url: &str, options: ConnectionOptions) -> Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(options.max_connections)
        .acquire_timeout(options.acquire_timeout)
        // Test connections before returning them from the pool.
        // This ensures stale connections (e.g., after database restart or
        // network partition) are detected and replaced automatically.
        .test_before_acquire(true)
        .connect(url)
        .await
        .map_err(|e| QuadraticDatabase::Connect(e.to_string()).into())
}

/// Create a lazy PostgreSQL connection pool
///
/// This creates a pool that doesn't connect immediately - connections are
/// established on first use. This allows the application to start even if
/// the database is temporarily unavailable.
///
/// # Arguments
///
/// * `url` - The URL of the PostgreSQL database
/// * `options` - Connection pool options (max_connections, acquire_timeout)
///
/// # Returns
///
/// A `Result` containing the PostgreSQL pool (only fails on URL parse errors)
pub fn connect_lazy(url: &str, options: ConnectionOptions) -> Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(options.max_connections)
        .acquire_timeout(options.acquire_timeout)
        // Test connections before returning them from the pool.
        // This ensures stale connections (e.g., after database restart or
        // network partition) are detected and replaced automatically.
        .test_before_acquire(true)
        .connect_lazy(url)
        .map_err(|e| QuadraticDatabase::Connect(e.to_string()).into())
}

// For testing, we need to connect to a test database
pub async fn connect_test() -> Result<PgPool> {
    let _ = dotenv::from_filename(".env.test").ok();
    let url = std::env::var("DATABASE_DSN").expect("DATABASE_DSN is not set");
    connect(&url, ConnectionOptions::default()).await
}
