//! Quadratic Multiplayer
//!
//! A multiplayer server for Quadratic.  Supports user presence and mouse
//! tracking for a shared file.

mod auth;
mod config;
mod file;
mod message;
mod server;
mod state;
#[cfg(test)]
mod test_util;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
