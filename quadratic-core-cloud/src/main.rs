//! Quadratic Core Cloud Service
//!
//! A core cloud service

mod auth;
mod config;
mod connection;
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
