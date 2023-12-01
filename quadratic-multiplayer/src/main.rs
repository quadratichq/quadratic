//! Quadratic Multiplayer
//!
//! A multiplayer server for Quadratic.  Supports user presence and mouse
//! tracking for a shared file.

mod config;
mod message;
mod server;
mod state;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
