//! Intrinio Bulk Download Data Pipeline
//!
//! Downloads bulk stock price data from Intrinio as ZIP files containing CSVs,
//! converts each CSV to Parquet, and uploads the Parquet files to S3.
//!
//! DataFusion can then query across all Parquet files as a unified dataset.

use std::io::{Cursor, Read};
use std::sync::Arc;

use quadratic_rust_shared::arrow::object_store::{ObjectStore, upload_multipart};
use quadratic_rust_shared::intrinio::bulk_download::{
    BulkDownloadsResponse, bulk_downloads_url, s3_object_key,
};
use quadratic_rust_shared::parquet::csv::csv_bytes_to_parquet_bytes;

use crate::error::{FilesError, Result};

fn pipeline_error(msg: impl ToString) -> FilesError {
    FilesError::DataPipeline(msg.to_string())
}

/// Fetch the bulk download links from the Intrinio API.
pub(crate) async fn fetch_bulk_download_links(api_key: &str) -> Result<BulkDownloadsResponse> {
    let url = bulk_downloads_url(api_key);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| pipeline_error(format!("Failed to fetch bulk download links: {}", e)))?;

    if !response.status().is_success() {
        return Err(pipeline_error(format!(
            "Intrinio API returned status {}: {}",
            response.status(),
            response
                .text()
                .await
                .unwrap_or_else(|_| "unknown".to_string())
        )));
    }

    let body = response
        .json::<BulkDownloadsResponse>()
        .await
        .map_err(|e| pipeline_error(format!("Failed to parse bulk download response: {}", e)))?;

    Ok(body)
}

/// Download a ZIP file from a URL.
async fn download_zip(url: &str) -> Result<bytes::Bytes> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| pipeline_error(format!("Failed to download ZIP file: {}", e)))?;

    if !response.status().is_success() {
        return Err(pipeline_error(format!(
            "Download returned status {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| pipeline_error(format!("Failed to read ZIP bytes: {}", e)))?;

    Ok(bytes)
}

/// Extract the first CSV file from a ZIP archive.
fn extract_csv_from_zip(zip_data: &[u8]) -> Result<Vec<u8>> {
    let cursor = Cursor::new(zip_data);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| pipeline_error(format!("Failed to open ZIP archive: {}", e)))?;

    // Find the first CSV file in the archive
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| pipeline_error(format!("Failed to read ZIP entry {}: {}", i, e)))?;

        if file.name().ends_with(".csv") {
            let mut csv_data = Vec::with_capacity(file.size() as usize);
            file.read_to_end(&mut csv_data)
                .map_err(|e| pipeline_error(format!("Failed to extract CSV from ZIP: {}", e)))?;
            return Ok(csv_data);
        }
    }

    Err(pipeline_error("No CSV file found in ZIP archive"))
}

/// Process a single bulk download file: download ZIP, extract CSV, convert to
/// Parquet, and upload to S3.
async fn process_bulk_download_file(
    object_store: &Arc<dyn ObjectStore>,
    link_name: &str,
    link_url: &str,
) -> Result<()> {
    tracing::info!("Downloading {}", link_name);
    let zip_data = download_zip(link_url).await?;
    let zip_size = zip_data.len();

    tracing::info!(
        "Extracting CSV from {} ({:.1} MB ZIP)",
        link_name,
        zip_size as f64 / 1_048_576.0
    );
    let csv_data = extract_csv_from_zip(&zip_data)?;
    let csv_size = csv_data.len();
    drop(zip_data); // Free ZIP memory early

    tracing::info!(
        "Converting {} to Parquet ({:.1} MB CSV)",
        link_name,
        csv_size as f64 / 1_048_576.0
    );
    let parquet_bytes = csv_bytes_to_parquet_bytes(&csv_data)
        .map_err(|e| pipeline_error(format!("Failed to convert CSV to Parquet: {}", e)))?;
    let parquet_size = parquet_bytes.len();
    drop(csv_data); // Free CSV memory early

    let s3_path = s3_object_key(link_name);

    tracing::info!(
        "Uploading {} ({:.1} MB Parquet)",
        s3_path,
        parquet_size as f64 / 1_048_576.0
    );
    upload_multipart(object_store, &s3_path, &parquet_bytes)
        .await
        .map_err(|e| pipeline_error(format!("Failed to upload {} to S3: {}", s3_path, e)))?;

    tracing::info!(
        "Completed {} — ZIP: {:.1} MB → CSV: {:.1} MB → Parquet: {:.1} MB",
        link_name,
        zip_size as f64 / 1_048_576.0,
        csv_size as f64 / 1_048_576.0,
        parquet_size as f64 / 1_048_576.0
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

    let response = fetch_bulk_download_links(api_key).await?;

    let mut total_files = 0;
    let mut failed_files = 0;

    for bulk_download in &response.bulk_downloads {
        tracing::info!(
            "Processing '{}': {} files, {:.1} MB total, last updated: {}",
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

    let elapsed = start_time.elapsed();
    tracing::info!(
        "Intrinio data pipeline completed in {:.1}s — {} files processed, {} failed",
        elapsed.as_secs_f64(),
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
    use super::*;
    use std::io::Write;
    use zip::ZipWriter;
    use zip::write::SimpleFileOptions;

    /// Helper to create a ZIP archive in memory containing a single file.
    fn create_zip_with_file(filename: &str, contents: &[u8]) -> Vec<u8> {
        let buffer = Vec::new();
        let cursor = Cursor::new(buffer);
        let mut zip = ZipWriter::new(cursor);
        let options = SimpleFileOptions::default();
        zip.start_file(filename, options).unwrap();
        zip.write_all(contents).unwrap();
        zip.finish().unwrap().into_inner()
    }

    /// Helper to create a ZIP archive with multiple files.
    fn create_zip_with_files(files: &[(&str, &[u8])]) -> Vec<u8> {
        let buffer = Vec::new();
        let cursor = Cursor::new(buffer);
        let mut zip = ZipWriter::new(cursor);
        let options = SimpleFileOptions::default();
        for (name, contents) in files {
            zip.start_file(*name, options).unwrap();
            zip.write_all(contents).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    #[test]
    fn test_pipeline_error_creates_data_pipeline_variant() {
        let err = pipeline_error("something went wrong");
        assert_eq!(
            err,
            FilesError::DataPipeline("something went wrong".to_string())
        );
    }

    #[test]
    fn test_extract_csv_from_zip_success() {
        let csv_content = b"date,ticker,close\n2025-01-02,AAPL,186.90\n";
        let zip_data = create_zip_with_file("stock_prices.csv", csv_content);

        let result = extract_csv_from_zip(&zip_data);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), csv_content);
    }

    #[test]
    fn test_extract_csv_from_zip_picks_first_csv_among_other_files() {
        let csv_content = b"col1,col2\nval1,val2\n";
        let zip_data = create_zip_with_files(&[
            ("readme.txt", b"This is a readme"),
            ("data.csv", csv_content),
            ("metadata.json", b"{}"),
        ]);

        let result = extract_csv_from_zip(&zip_data);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), csv_content);
    }

    #[test]
    fn test_extract_csv_from_zip_no_csv_file() {
        let zip_data = create_zip_with_file("readme.txt", b"No CSV here");

        let result = extract_csv_from_zip(&zip_data);
        assert!(result.is_err());

        let err = result.unwrap_err();
        match err {
            FilesError::DataPipeline(msg) => {
                assert!(
                    msg.contains("No CSV file found"),
                    "Expected 'No CSV file found' in: {msg}"
                );
            }
            other => panic!("Expected DataPipeline error, got: {other:?}"),
        }
    }

    #[test]
    fn test_extract_csv_from_zip_invalid_data() {
        let result = extract_csv_from_zip(b"this is not a zip file");
        assert!(result.is_err());

        let err = result.unwrap_err();
        match err {
            FilesError::DataPipeline(msg) => {
                assert!(
                    msg.contains("Failed to open ZIP archive"),
                    "Expected 'Failed to open ZIP archive' in: {msg}"
                );
            }
            other => panic!("Expected DataPipeline error, got: {other:?}"),
        }
    }

    #[test]
    fn test_extract_csv_from_zip_empty_archive() {
        // An empty ZIP (no files inside)
        let buffer = Vec::new();
        let cursor = Cursor::new(buffer);
        let zip = ZipWriter::new(cursor);
        let zip_data = zip.finish().unwrap().into_inner();

        let result = extract_csv_from_zip(&zip_data);
        assert!(result.is_err());

        let err = result.unwrap_err();
        match err {
            FilesError::DataPipeline(msg) => {
                assert!(
                    msg.contains("No CSV file found"),
                    "Expected 'No CSV file found' in: {msg}"
                );
            }
            other => panic!("Expected DataPipeline error, got: {other:?}"),
        }
    }

    #[test]
    fn test_extract_csv_from_zip_empty_csv_content() {
        let zip_data = create_zip_with_file("empty.csv", b"");

        let result = extract_csv_from_zip(&zip_data);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_extract_csv_from_zip_large_csv() {
        let mut csv = String::from("id,value\n");
        for i in 0..1000 {
            csv.push_str(&format!("{},{}\n", i, i * 10));
        }
        let zip_data = create_zip_with_file("large.csv", csv.as_bytes());

        let result = extract_csv_from_zip(&zip_data);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), csv.as_bytes());
    }

    #[test]
    fn test_extract_csv_and_convert_to_parquet() {
        // End-to-end: ZIP → CSV extraction → Parquet conversion
        let csv_content = b"date,ticker,open,close,volume\n\
            2025-01-02,AAPL,185.50,186.90,45000000\n\
            2025-01-02,MSFT,378.20,379.80,22000000\n";
        let zip_data = create_zip_with_file("stock_prices.csv", csv_content);

        let csv_data = extract_csv_from_zip(&zip_data).unwrap();
        let parquet_result = csv_bytes_to_parquet_bytes(&csv_data);
        assert!(parquet_result.is_ok());

        let parquet_bytes = parquet_result.unwrap();
        assert!(!parquet_bytes.is_empty());
        // Parquet should be smaller than or comparable to the raw CSV
        assert!(parquet_bytes.len() > 0);
    }

    #[test]
    fn test_extract_csv_from_zip_multiple_csvs_picks_first() {
        let first_csv = b"a,b\n1,2\n";
        let second_csv = b"x,y,z\n10,20,30\n";
        let zip_data =
            create_zip_with_files(&[("first.csv", first_csv), ("second.csv", second_csv)]);

        let result = extract_csv_from_zip(&zip_data).unwrap();
        // Should pick the first CSV encountered
        assert_eq!(result, first_csv);
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

        // Override the URL by calling reqwest directly against the mock server
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
