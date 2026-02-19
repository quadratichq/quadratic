//! HTTP utilities

use std::time::Duration;

use crate::error::{Result, SharedError};

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_DOWNLOAD_SIZE: u64 = 500 * 1024 * 1024; // 500 MB

/// Download a file from a URL as raw bytes.
///
/// Applies a 5-minute timeout and rejects responses larger than
/// `MAX_DOWNLOAD_SIZE` based on the Content-Length header.
pub async fn download_file(url: &str) -> Result<bytes::Bytes> {
    let client = reqwest::Client::builder()
        .timeout(DOWNLOAD_TIMEOUT)
        .build()
        .map_err(|e| SharedError::Request(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| SharedError::Request(format!("Failed to download file: {}", e)))?;

    if !response.status().is_success() {
        return Err(SharedError::Request(format!(
            "Download returned status {}",
            response.status()
        )));
    }

    if let Some(content_length) = response.content_length() {
        if content_length > MAX_DOWNLOAD_SIZE {
            return Err(SharedError::Request(format!(
                "File size {} bytes exceeds maximum allowed size of {} bytes",
                content_length, MAX_DOWNLOAD_SIZE
            )));
        }
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| SharedError::Request(format!("Failed to read response bytes: {}", e)))?;

    Ok(bytes)
}
