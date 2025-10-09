mod config;

#[cfg(feature = "docker")]
mod controller_docker;
#[cfg(feature = "docker")]
use controller_docker as controller;

// #[cfg(feature = "kubernetes")]
// mod controller_kubernetes;
// #[cfg(feature = "kubernetes")]
// use controller_kubernetes as controller;

mod error;
mod health;
mod quadratic_api;
mod server;
mod state;
#[cfg(test)]
mod test_util;
mod worker;

use crate::error::Result;

#[tokio::main]
async fn main() -> Result<()> {
    server::serve().await
}
