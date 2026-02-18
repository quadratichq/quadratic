//! HTTP utilities

use crate::error::{Result, SharedError};

/// Download a file from a URL as raw bytes.
pub async fn download_file(url: &str) -> Result<bytes::Bytes> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| SharedError::Request(format!("Failed to download file: {}", e)))?;

    if !response.status().is_success() {
        return Err(SharedError::Request(format!(
            "Download returned status {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| SharedError::Request(format!("Failed to read response bytes: {}", e)))?;

    Ok(bytes)
}
