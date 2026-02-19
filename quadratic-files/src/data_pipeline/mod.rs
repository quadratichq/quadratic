//! Data Pipeline Module
//!
//! This module contains data pipelines that run as background workers,
//! downloading external data, converting it to Parquet, and uploading to S3.

pub(crate) mod background_workers;
pub(crate) mod intrinio;
