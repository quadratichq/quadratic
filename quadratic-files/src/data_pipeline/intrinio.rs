//! Intrinio Bulk Download Data Pipeline
//!
//! Downloads bulk stock price data from Intrinio as ZIP files containing CSVs,
//! converts each CSV to Parquet, and uploads the Parquet files to S3.
//!
//! DataFusion can then query across all Parquet files as a unified dataset.

use std::io::{Cursor, Read};
use std::sync::Arc;

use quadratic_rust_shared::arrow::object_store::{upload_multipart, ObjectStore};
use quadratic_rust_shared::intrinio::bulk_download::{
    bulk_downloads_url, s3_object_key, BulkDownloadsResponse,
};
use quadratic_rust_shared::parquet::csv::csv_bytes_to_parquet_bytes;

use crate::error::{FilesError, Result};

fn pipeline_error(msg: impl ToString) -> FilesError {
    FilesError::DataPipeline(msg.to_string())
}

/// Fetch the bulk download links from the Intrinio API.
pub(crate) async fn fetch_bulk_download_links(
    api_key: &str,
) -> Result<BulkDownloadsResponse> {
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

    let body = response.json::<BulkDownloadsResponse>().await.map_err(|e| {
        pipeline_error(format!(
            "Failed to parse bulk download response: {}",
            e
        ))
    })?;

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
            bulk_download.data_length_bytes as f64 / 1_048_576.0,
            bulk_download.last_updated
        );

        for link in &bulk_download.links {
            total_files += 1;

            if let Err(e) =
                process_bulk_download_file(object_store, &link.name, &link.url).await
            {
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
