//! Quadratic File Service
//!
//! A file servic for that consumes transactions from a queue, applies them to
//! a grid and writes them to S3.

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
