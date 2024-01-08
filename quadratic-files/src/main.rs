//! Quadratic Multiplayer
//!
//! A multiplayer server for Quadratic.  Supports user presence and mouse
//! tracking for a shared file.

mod config;
mod error;
mod file;
mod server;
mod state;
#[cfg(test)]
mod test_util;

use error::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
