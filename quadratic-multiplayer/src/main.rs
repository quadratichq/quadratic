//! Quadratic Multiplayer
//!

mod message;
mod server;
mod state;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
