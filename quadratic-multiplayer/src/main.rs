//! Quadratic Multiplayer
//!
//! A multiplayer server for Quadratic.  Supports user presence and mouse
//! tracking for a shared file.

mod auth;
mod background_worker;
mod config;
mod error;
mod message;
mod permissions;
mod server;
mod state;
#[cfg(test)]
mod test_util;

use error::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
