//! Quadratic File Service
//!
//! A file servic for that consumes transactions from a queue, applies them to
//! a grid and writes them to S3.

mod auth;
mod config;
mod core;
mod error;
mod file;
mod health;
mod javascript;
mod message;
mod multiplayer;
mod python;
mod scheduled_tasks;
mod server;
mod state;
#[cfg(test)]
mod test_util;
mod worker;

use error::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
