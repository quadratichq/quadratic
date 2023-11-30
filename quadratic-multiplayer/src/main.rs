//! Quadratic Multiplayer
//!

mod message;
mod server;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
