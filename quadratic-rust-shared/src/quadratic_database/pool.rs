//! Simple reconnecting database pool
//!
//! A wrapper around PgPool that attempts reconnection if the initial
//! connection failed or if the pool becomes unavailable.

use tokio::sync::RwLock;

use super::{connect, ConnectionOptions, PgPool};
use crate::error::Result;
use crate::quadratic_database::error::QuadraticDatabase;

/// A database pool that can reconnect if needed.
///
/// - Attempts connection on creation, but doesn't fail if unavailable
/// - On `get()`, returns existing pool or attempts reconnection
/// - Uses RwLock to allow concurrent reads with minimal contention
#[derive(Debug)]
pub struct Pool {
    pool: RwLock<Option<PgPool>>,
    database_url: String,
    options: ConnectionOptions,
}

impl Pool {
    /// Create a new pool, attempting initial connection.
    ///
    /// If connection fails, the pool is created in disconnected state
    /// and will attempt reconnection on first `get()` call.
    pub async fn new(database_url: impl Into<String>, options: ConnectionOptions) -> Self {
        let database_url = database_url.into();

        let pool = match connect(&database_url, options.clone()).await {
            Ok(p) => {
                tracing::info!("Database pool connected, size: {}", p.size());
                Some(p)
            }
            Err(e) => {
                tracing::warn!("Initial database connection failed (will retry on use): {e}");
                None
            }
        };

        Self {
            pool: RwLock::new(pool),
            database_url,
            options,
        }
    }

    /// Get the database pool, attempting reconnection if needed.
    pub async fn get(&self) -> Result<PgPool> {
        // Fast path: return existing pool
        {
            let guard = self.pool.read().await;
            if let Some(p) = guard.as_ref() {
                if !p.is_closed() {
                    return Ok(p.clone());
                }
            }
        }

        // Slow path: try to reconnect
        let mut guard = self.pool.write().await;

        // Double-check after acquiring write lock
        if let Some(p) = guard.as_ref() {
            if !p.is_closed() {
                return Ok(p.clone());
            }
        }

        tracing::info!("Attempting database reconnection...");

        match connect(&self.database_url, self.options.clone()).await {
            Ok(new_pool) => {
                tracing::info!("Database reconnected, size: {}", new_pool.size());
                let cloned = new_pool.clone();
                *guard = Some(new_pool);
                Ok(cloned)
            }
            Err(e) => {
                tracing::error!("Database reconnection failed: {e}");
                *guard = None;
                Err(QuadraticDatabase::Connect(format!(
                    "Database unavailable: {e}"
                ))
                .into())
            }
        }
    }

    /// Check if currently connected.
    pub async fn is_connected(&self) -> bool {
        self.pool
            .read()
            .await
            .as_ref()
            .map(|p| !p.is_closed())
            .unwrap_or(false)
    }

    /// Get current pool size, or 0 if not connected.
    pub async fn size(&self) -> u32 {
        self.pool
            .read()
            .await
            .as_ref()
            .map(|p| p.size())
            .unwrap_or(0)
    }
}

