pub mod checkpoint;
pub mod error;

// re-exports
pub use sqlx::PgPool;

use sqlx::postgres::PgPoolOptions;

use crate::{error::Result, quadratic_database::error::QuadraticDatabase};

static DEFAULT_MAX_CONNECTIONS: u32 = 20;

/// Connect to a PostgreSQL database
///
/// # Arguments
///
/// * `url` - The URL of the PostgreSQL database
///
/// # Returns
///
/// A `Result` containing the PostgreSQL pool
pub async fn connect(url: &str, max_connections: Option<u32>) -> Result<PgPool> {
    let max_connections = max_connections.unwrap_or(DEFAULT_MAX_CONNECTIONS);

    PgPoolOptions::new()
        .max_connections(max_connections)
        .connect(url)
        .await
        .map_err(|e| QuadraticDatabase::Connect(e.to_string()).into())
}

// For testing, we need to connect to a test database
pub async fn connect_test() -> Result<PgPool> {
    let _ = dotenv::from_filename(".env.test").ok();
    let url = std::env::var("DATABASE_DSN").expect("DATABASE_DSN is not set");
    connect(&url, None).await
}
