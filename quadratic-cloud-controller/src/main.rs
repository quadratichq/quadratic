mod config;
mod controller;
mod error;
mod health;
mod server;
mod state;
mod test_util;
mod worker;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
