//! Intrinio Bulk Downloads API Types
//!
//! Types for the bulk downloads endpoint response.
//! See: https://docs.intrinio.com/documentation/web_api/get_bulk_download_links_v2

use serde::{Deserialize, Serialize};

#[cfg(feature = "reqwest")]
use crate::error::{Result, SharedError};
#[cfg(feature = "reqwest")]
use crate::intrinio::error::Intrinio as IntrinioError;

/// Response from the Intrinio bulk downloads links endpoint.
///
/// `GET https://api-v2.intrinio.com/bulk_downloads/links?api_key=API_KEY`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDownloadsResponse {
    pub bulk_downloads: Vec<BulkDownload>,
    pub next_page: Option<String>,
}

/// A single bulk download dataset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDownload {
    pub id: String,
    pub name: String,
    pub format: Option<String>,
    pub data_length_bytes: Option<u64>,
    pub update_frequency: Option<String>,
    pub last_updated: Option<String>,
    pub links: Vec<BulkDownloadLink>,
}

/// A download link for a bulk download file (typically a ZIP containing CSV).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDownloadLink {
    pub name: String,
    pub url: String,
}

/// The S3 prefix used to store Intrinio bulk download parquet files.
pub const INTRINIO_S3_PREFIX: &str = "intrinio/us_stock_prices";

/// Construct the URL for the Intrinio bulk downloads links endpoint.
pub fn bulk_downloads_url(api_key: &str) -> String {
    format!(
        "https://api-v2.intrinio.com/bulk_downloads/links?api_key={}",
        api_key
    )
}

/// Derive a Parquet filename from a ZIP link name.
///
/// Example: `stock_prices_uscomp_all_file-1.zip` -> `stock_prices_uscomp_all_file-1.parquet`
pub fn parquet_filename_from_link(link_name: &str) -> String {
    link_name.replace(".zip", ".parquet")
}

/// Build the full S3 object key for a parquet file.
///
/// Example: `intrinio/us_stock_prices/stock_prices_uscomp_all_file-1.parquet`
pub fn s3_object_key(link_name: &str) -> String {
    format!(
        "{}/{}",
        INTRINIO_S3_PREFIX,
        parquet_filename_from_link(link_name)
    )
}

/// Redact the API key from error messages to prevent leaking secrets in logs.
#[cfg(feature = "reqwest")]
fn sanitize_error(message: &str, api_key: &str) -> String {
    message.replace(api_key, "[REDACTED]")
}

/// Fetch the bulk download links from the Intrinio API.
///
/// Note: pagination (`next_page`) is not followed because the current
/// Intrinio bulk downloads endpoint returns all links in a single page.
#[cfg(feature = "reqwest")]
pub async fn fetch_bulk_download_links(api_key: &str) -> Result<BulkDownloadsResponse> {
    let url = bulk_downloads_url(api_key);

    let response = reqwest::get(&url).await.map_err(|e| {
        SharedError::Intrinio(IntrinioError::Endpoint(
            "bulk_downloads".to_string(),
            sanitize_error(
                &format!("Failed to fetch bulk download links: {}", e),
                api_key,
            ),
        ))
    })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown".to_string());
        return Err(SharedError::Intrinio(IntrinioError::Endpoint(
            "bulk_downloads".to_string(),
            format!("API returned status {}: {}", status, body),
        )));
    }

    let body = response
        .json::<BulkDownloadsResponse>()
        .await
        .map_err(|e| {
            SharedError::Intrinio(IntrinioError::Endpoint(
                "bulk_downloads".to_string(),
                sanitize_error(
                    &format!("Failed to parse bulk download response: {}", e),
                    api_key,
                ),
            ))
        })?;

    Ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bulk_downloads_url() {
        let url = bulk_downloads_url("test_key_123");
        assert_eq!(
            url,
            "https://api-v2.intrinio.com/bulk_downloads/links?api_key=test_key_123"
        );
    }

    #[test]
    fn test_parquet_filename_from_link() {
        assert_eq!(
            parquet_filename_from_link("stock_prices_uscomp_all_file-1.zip"),
            "stock_prices_uscomp_all_file-1.parquet"
        );
    }

    #[test]
    fn test_s3_object_key() {
        assert_eq!(
            s3_object_key("stock_prices_uscomp_all_file-1.zip"),
            "intrinio/us_stock_prices/stock_prices_uscomp_all_file-1.parquet"
        );
    }

    #[test]
    fn test_deserialize_bulk_downloads_response() {
        let json = r#"{
            "bulk_downloads": [
                {
                    "id": "bdt_test",
                    "name": "US Stock Prices, 50+ years",
                    "format": "csv",
                    "data_length_bytes": 1653822332,
                    "update_frequency": "daily",
                    "last_updated": "2026-02-11T20:20:51.206Z",
                    "links": [
                        {
                            "name": "stock_prices_uscomp_all_file-1.zip",
                            "url": "https://example.com/file-1.zip"
                        }
                    ]
                }
            ],
            "next_page": null
        }"#;

        let response: BulkDownloadsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.bulk_downloads.len(), 1);
        assert_eq!(
            response.bulk_downloads[0].name,
            "US Stock Prices, 50+ years"
        );
        assert_eq!(response.bulk_downloads[0].format.as_deref(), Some("csv"));
        assert_eq!(response.bulk_downloads[0].links.len(), 1);
        assert_eq!(
            response.bulk_downloads[0].links[0].name,
            "stock_prices_uscomp_all_file-1.zip"
        );
        assert!(response.next_page.is_none());
    }

    #[test]
    fn test_deserialize_bulk_downloads_response_with_nulls() {
        let json = r#"{
            "bulk_downloads": [
                {
                    "id": "bdt_test",
                    "name": "US Stock Prices",
                    "format": null,
                    "data_length_bytes": null,
                    "update_frequency": null,
                    "last_updated": null,
                    "links": []
                }
            ],
            "next_page": null
        }"#;

        let response: BulkDownloadsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.bulk_downloads.len(), 1);
        assert_eq!(response.bulk_downloads[0].name, "US Stock Prices");
        assert!(response.bulk_downloads[0].format.is_none());
        assert!(response.bulk_downloads[0].data_length_bytes.is_none());
        assert!(response.bulk_downloads[0].update_frequency.is_none());
        assert!(response.bulk_downloads[0].last_updated.is_none());
    }
}
