//! Reconnecting database pool
//!
//! A database pool wrapper that supports automatic reconnection when the
//! connection is lost or was never established.

use tokio::sync::RwLock;

use super::{ConnectionOptions, PgPool, connect, error::QuadraticDatabase};
use crate::error::Result;

/// A database pool wrapper that supports automatic reconnection.
///
/// This pool will attempt to reconnect to the database if the connection
/// is lost or was never established. It uses double-checked locking to
/// minimize contention when the pool is healthy.
///
/// # Concurrency
///
/// This implementation is optimized for high concurrency (1000+ simultaneous tasks):
/// - Locks are held only briefly to clone the pool reference
/// - The returned `PgPool` is `Arc`-based internally, so cloning is cheap
/// - Multiple tasks can use the pool concurrently without blocking each other
#[derive(Debug)]
pub struct ReconnectingPool {
    pool: RwLock<Option<PgPool>>,
    database_url: String,
    connection_options: ConnectionOptions,
}

impl ReconnectingPool {
    /// Create a new reconnecting pool, attempting an initial connection.
    ///
    /// If the initial connection fails, the pool will be created in a
    /// disconnected state and will attempt to reconnect on first use.
    pub async fn new(
        database_url: impl Into<String>,
        connection_options: ConnectionOptions,
    ) -> Self {
        let database_url = database_url.into();

        let pool = connect(&database_url, connection_options.clone())
            .await
            .map_err(|e| tracing::error!("Failed to connect to database pool: {e}"))
            .ok();

        Self {
            pool: RwLock::new(pool),
            database_url,
            connection_options,
        }
    }

    /// Get the database pool, attempting to reconnect if not connected.
    ///
    /// This method uses double-checked locking:
    /// - Fast path: Clone pool with a read lock (released immediately)
    /// - Slow path: Attempts reconnection with a write lock
    ///
    /// The returned `PgPool` is cloned (cheap, internally `Arc`-based), so the
    /// lock is not held across database operations. This allows maximum concurrency.
    ///
    /// # Health Checking
    ///
    /// The pool is considered unhealthy and will trigger reconnection if:
    /// - No pool exists (never connected or previously cleared)
    /// - The pool has been explicitly closed via `is_closed()`
    ///
    /// Additionally, SQLx's `test_before_acquire` is enabled in the connect
    /// function, which validates connections before returning them from the pool.
    pub async fn get(&self) -> Result<PgPool> {
        // Fast path: check if pool exists and is healthy with read lock
        {
            let pool = self.pool.read().await;
            if let Some(p) = pool.as_ref() {
                if !p.is_closed() {
                    return Ok(p.clone());
                }
                // Pool is closed, fall through to reconnection
                tracing::warn!("Database pool is closed, will attempt reconnection");
            }
        }

        // Slow path: try to reconnect with write lock
        let mut pool = self.pool.write().await;

        // Double-check after acquiring write lock (another task may have reconnected)
        if let Some(p) = pool.as_ref() {
            if !p.is_closed() {
                return Ok(p.clone());
            }
            // Pool is closed, clear it and reconnect
            tracing::info!("Clearing closed database pool before reconnection");
        }

        tracing::info!("Attempting to reconnect to database pool...");

        match connect(&self.database_url, self.connection_options.clone()).await {
            Ok(new_pool) => {
                tracing::info!("Successfully reconnected to database pool");

                // Cheap clone
                let cloned = new_pool.clone();
                *pool = Some(new_pool);

                Ok(cloned)
            }
            Err(e) => {
                tracing::error!("Failed to reconnect to database pool: {e}");

                // Clear the closed pool so next attempt starts fresh
                *pool = None;

                Err(QuadraticDatabase::Connect(format!(
                    "Database pool is not available and reconnection failed: {e}"
                ))
                .into())
            }
        }
    }

    /// Check if the pool is currently connected and healthy.
    ///
    /// Returns `true` only if a pool exists and has not been closed.
    pub async fn is_connected(&self) -> bool {
        self.pool
            .read()
            .await
            .as_ref()
            .map(|p| !p.is_closed())
            .unwrap_or(false)
    }

    /// Manually invalidate the pool, forcing reconnection on next `get()` call.
    ///
    /// This can be useful when you detect connection issues at the application
    /// level and want to force a fresh connection.
    pub async fn invalidate(&self) {
        let mut pool = self.pool.write().await;
        if let Some(p) = pool.take() {
            p.close().await;
            tracing::info!("Database pool manually invalidated");
        }
    }
}
