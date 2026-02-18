//! Intrinio Bulk Download Data Pipeline
//!
//! Downloads bulk stock price data from Intrinio as ZIP files containing CSVs,
//! converts each CSV to Parquet, and uploads the Parquet files to S3.
//!
//! DataFusion can then query across all Parquet files as a unified dataset.

use std::sync::Arc;

use quadratic_rust_shared::arrow::object_store::{ObjectStore, upload_multipart};
use quadratic_rust_shared::intrinio::bulk_download::{fetch_bulk_download_links, s3_object_key};
use quadratic_rust_shared::parquet::csv::csv_bytes_to_parquet_bytes;
use quadratic_rust_shared::utils::http::download_file;
use quadratic_rust_shared::utils::zip::extract_csv_from_zip;

use crate::error::{FilesError, Result};

fn pipeline_error(msg: impl ToString) -> FilesError {
    FilesError::DataPipeline(msg.to_string())
}

fn to_mb(bytes: usize) -> f64 {
    bytes as f64 / 1_048_576.0
}

/// Process a single bulk download file: download ZIP, extract CSV, convert to
/// Parquet, and upload to S3.
async fn process_bulk_download_file(
    object_store: &Arc<dyn ObjectStore>,
    link_name: &str,
    link_url: &str,
) -> Result<()> {
    tracing::trace!("Downloading Intrinio bulk download file: {}", link_name);

    let zip_data = download_file(link_url)
        .await
        .map_err(pipeline_error)?;
    let zip_size = zip_data.len();

    tracing::trace!(
        "Extracting CSV from Intrinio bulk download file: {link_name} ({:.1} MB ZIP)",
        to_mb(zip_size)
    );

    let csv_data = extract_csv_from_zip(&zip_data).map_err(pipeline_error)?;
    let csv_size = csv_data.len();

    drop(zip_data); // Free ZIP memory early

    tracing::trace!(
        "Converting Intrinio bulk download file: {link_name} to Parquet ({:.1} MB CSV)",
        to_mb(csv_size)
    );

    let parquet_bytes = csv_bytes_to_parquet_bytes(&csv_data)
        .map_err(|e| pipeline_error(format!("Failed to convert CSV to Parquet: {}", e)))?;
    let parquet_size = parquet_bytes.len();

    drop(csv_data); // Free CSV memory early

    let s3_path = s3_object_key(link_name);

    tracing::trace!(
        "Uploading Intrinio bulk download file to S3: {s3_path} ({:.1} MB Parquet)",
        to_mb(parquet_size)
    );

    upload_multipart(object_store, &s3_path, &parquet_bytes)
        .await
        .map_err(|e| pipeline_error(format!("Failed to upload {} to S3: {}", s3_path, e)))?;

    tracing::trace!(
        "Completed Intrinio bulk download file: {link_name} — ZIP: {:.1} MB → CSV: {:.1} MB → Parquet: {:.1} MB",
        to_mb(zip_size),
        to_mb(csv_size),
        to_mb(parquet_size)
    );

    Ok(())
}

/// Run the full Intrinio bulk download data pipeline.
///
/// 1. Fetches bulk download links from the Intrinio API
/// 2. For each download, downloads the ZIP, extracts the CSV, converts to
///    Parquet, and uploads to S3
/// 3. Each file is processed sequentially to limit memory usage
///
/// Files are uploaded to S3 under the prefix `intrinio/us_stock_prices/`.
/// DataFusion will merge all Parquet files for queries.
pub(crate) async fn run_intrinio_pipeline(
    object_store: &Arc<dyn ObjectStore>,
    api_key: &str,
) -> Result<()> {
    tracing::info!("Starting Intrinio bulk download data pipeline");

    let start_time = std::time::Instant::now();
    let response = fetch_bulk_download_links(api_key)
        .await
        .map_err(pipeline_error)?;
    let mut total_files = 0;
    let mut failed_files = 0;

    for bulk_download in &response.bulk_downloads {
        tracing::trace!(
            "Processing Intrinio bulk download file: {}: {} files, {:.1} MB total, last updated: {}",
            bulk_download.name,
            bulk_download.links.len(),
            bulk_download.data_length_bytes.unwrap_or(0) as f64 / 1_048_576.0,
            bulk_download.last_updated.as_deref().unwrap_or("unknown")
        );

        for link in &bulk_download.links {
            total_files += 1;

            if let Err(e) = process_bulk_download_file(object_store, &link.name, &link.url).await {
                tracing::error!("Error processing {}: {}", link.name, e);
                failed_files += 1;
                // Continue with other files even if one fails
            }
        }
    }

    tracing::info!(
        "Intrinio data pipeline completed in {:.1}s — {} files processed, {} failed",
        start_time.elapsed().as_secs_f64(),
        total_files,
        failed_files
    );

    if failed_files > 0 {
        Err(pipeline_error(format!(
            "{} of {} files failed to process",
            failed_files, total_files
        )))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::io::{Cursor, Write};

    use quadratic_rust_shared::intrinio::bulk_download::BulkDownloadsResponse;
    use zip::ZipWriter;
    use zip::write::SimpleFileOptions;

    use super::*;

    fn create_zip_with_file(filename: &str, contents: &[u8]) -> Vec<u8> {
        let buffer = Vec::new();
        let cursor = Cursor::new(buffer);
        let mut zip = ZipWriter::new(cursor);
        let options = SimpleFileOptions::default();
        zip.start_file(filename, options).unwrap();
        zip.write_all(contents).unwrap();
        zip.finish().unwrap().into_inner()
    }

    #[test]
    fn test_extract_csv_and_convert_to_parquet() {
        let csv_content = b"date,ticker,open,close,volume\n\
            2025-01-02,AAPL,185.50,186.90,45000000\n\
            2025-01-02,MSFT,378.20,379.80,22000000\n";
        let zip_data = create_zip_with_file("stock_prices.csv", csv_content);

        let csv_data = extract_csv_from_zip(&zip_data).unwrap();
        let parquet_result = csv_bytes_to_parquet_bytes(&csv_data);
        assert!(parquet_result.is_ok());

        let parquet_bytes = parquet_result.unwrap();
        assert!(!parquet_bytes.is_empty());
    }

    #[tokio::test]
    async fn test_fetch_bulk_download_links_success() {
        let server = httpmock::MockServer::start();

        let body = serde_json::json!({
            "bulk_downloads": [
                {
                    "id": "bdt_test",
                    "name": "US Stock Prices",
                    "format": "csv",
                    "data_length_bytes": 1000000,
                    "update_frequency": "daily",
                    "last_updated": "2026-02-11T20:20:51.206Z",
                    "links": [
                        {
                            "name": "stock_prices_file-1.zip",
                            "url": "https://example.com/file-1.zip"
                        }
                    ]
                }
            ],
            "next_page": null
        });

        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::GET)
                .path("/bulk_downloads/links");
            then.status(200)
                .header("content-type", "application/json")
                .json_body(body);
        });

        let url = format!("{}/bulk_downloads/links?api_key=test", server.base_url());
        let response = reqwest::get(&url).await.unwrap();
        let result: BulkDownloadsResponse = response.json().await.unwrap();

        assert_eq!(result.bulk_downloads.len(), 1);
        assert_eq!(result.bulk_downloads[0].name, "US Stock Prices");
        assert_eq!(result.bulk_downloads[0].links.len(), 1);
        assert_eq!(
            result.bulk_downloads[0].links[0].name,
            "stock_prices_file-1.zip"
        );
        assert!(result.next_page.is_none());
        mock.assert();
    }
}
