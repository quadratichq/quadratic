#[cfg(feature = "arrow")]
pub mod arrow;

#[cfg(feature = "auth")]
pub mod auth;

#[cfg(feature = "aws")]
pub mod aws;

#[cfg(feature = "cache")]
pub mod cache;

#[cfg(feature = "crypto")]
pub mod crypto;

#[cfg(feature = "docker")]
pub mod docker;

#[cfg(feature = "environment")]
pub mod environment;

pub mod error;

#[cfg(feature = "intrinio")]
pub mod intrinio;

#[cfg(feature = "multiplayer")]
pub mod multiplayer;

#[cfg(feature = "net")]
pub mod net;

#[cfg(feature = "arrow")]
pub mod parquet;

#[cfg(feature = "protobuf")]
pub mod protobuf;

#[cfg(feature = "pubsub")]
pub mod pubsub;

#[cfg(feature = "quadratic-api")]
pub mod quadratic_api;

#[cfg(feature = "quadratic-cloud")]
pub mod quadratic_cloud;

#[cfg(feature = "quadratic-database")]
pub mod quadratic_database;

#[cfg(feature = "sql")]
pub mod sql;

#[cfg(feature = "storage")]
pub mod storage;

#[cfg(feature = "synced")]
pub mod synced;

pub mod utils;

#[cfg(any(test, feature = "test", feature = "benchmark"))]
pub mod test;

// pub use aws::*;
pub use error::*;
