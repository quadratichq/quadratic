//! Quadratic File Service
//!
//! A file servic for that consumes transactions from a queue, applies them to
//! a grid and writes them to S3.

mod auth;
mod config;
mod connection;
mod error;
mod financial;
mod header;
mod health;
mod proxy;
mod server;
mod sql;
mod ssh;
mod state;

#[cfg(test)]
mod test_util;

use error::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
