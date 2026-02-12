//! Arrow CSV to Parquet conversion utilities
//!
//! This module provides utilities to convert CSV data to Parquet format
//! using Arrow's built-in CSV reader, with streaming batch writes for
//! memory efficiency on large files.

use arrow_csv::ReaderBuilder;
use bytes::Bytes;
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use std::io::Cursor;
use std::sync::Arc;

use crate::parquet::error::Parquet as ParquetError;
use crate::{SharedError, error::Result};

const INFER_SCHEMA_SAMPLE_SIZE: usize = 2000;
const BATCH_SIZE: usize = 65536;

fn error(e: impl ToString) -> SharedError {
    SharedError::Parquet(ParquetError::Csv(e.to_string()))
}

/// Infer an Arrow schema from CSV data.
///
/// Reads up to `INFER_SCHEMA_SAMPLE_SIZE` rows to determine column types.
pub fn infer_csv_schema(csv_data: &[u8]) -> Result<Arc<arrow::datatypes::Schema>> {
    let cursor = Cursor::new(csv_data);
    let (schema, _) = arrow_csv::reader::Format::default()
        .with_header(true)
        .infer_schema(cursor, Some(INFER_SCHEMA_SAMPLE_SIZE))
        .map_err(|e| error(format!("Failed to infer CSV schema: {}", e)))?;

    Ok(Arc::new(schema))
}

/// Convert CSV bytes to Parquet bytes.
///
/// Uses streaming batch writes to avoid loading the entire dataset into memory.
/// Each batch of `BATCH_SIZE` rows is written to the Parquet file incrementally.
pub fn csv_bytes_to_parquet_bytes(csv_data: &[u8]) -> Result<Bytes> {
    let schema = infer_csv_schema(csv_data)?;

    let cursor = Cursor::new(csv_data);
    let reader = ReaderBuilder::new(schema.clone())
        .with_header(true)
        .with_batch_size(BATCH_SIZE)
        .build(cursor)
        .map_err(|e| error(format!("Failed to build CSV reader: {}", e)))?;

    let props = WriterProperties::builder()
        .set_compression(Compression::SNAPPY)
        .build();

    let buffer = Vec::new();
    let mut writer = ArrowWriter::try_new(buffer, schema, Some(props))
        .map_err(|e| error(format!("Failed to create Parquet writer: {}", e)))?;

    let mut has_data = false;

    for batch_result in reader {
        let batch = batch_result.map_err(|e| error(format!("Failed to read CSV batch: {}", e)))?;
        writer
            .write(&batch)
            .map_err(|e| error(format!("Failed to write Parquet batch: {}", e)))?;
        has_data = true;
    }

    if !has_data {
        return Err(error("No data batches produced from CSV"));
    }

    let buffer = writer
        .into_inner()
        .map_err(|e| error(format!("Failed to finalize Parquet writer: {}", e)))?;

    Ok(Bytes::from(buffer))
}

#[cfg(test)]
mod tests {
    use super::*;
    use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

    #[test]
    fn test_csv_to_parquet_simple() {
        let csv = b"name,age,score\nAlice,30,95.5\nBob,25,87.2\nCharlie,,92.0\n";

        let result = csv_bytes_to_parquet_bytes(csv);
        assert!(result.is_ok());

        let parquet_bytes = result.unwrap();
        assert!(!parquet_bytes.is_empty());

        // Verify we can read the Parquet back
        let builder = ParquetRecordBatchReaderBuilder::try_new(parquet_bytes).unwrap();
        let reader = builder.build().unwrap();
        let batches: std::result::Result<Vec<_>, _> = reader.collect();
        let batches = batches.unwrap();
        assert_eq!(batches.len(), 1);
        assert_eq!(batches[0].num_rows(), 3);
        assert_eq!(batches[0].num_columns(), 3);
    }

    #[test]
    fn test_csv_to_parquet_stock_prices() {
        let csv = b"date,ticker,open,high,low,close,volume\n\
            2025-01-02,AAPL,185.50,187.25,184.80,186.90,45000000\n\
            2025-01-02,MSFT,378.20,380.50,377.10,379.80,22000000\n\
            2025-01-03,AAPL,187.00,188.50,186.25,187.75,38000000\n";

        let result = csv_bytes_to_parquet_bytes(csv);
        assert!(result.is_ok());

        let parquet_bytes = result.unwrap();
        let builder = ParquetRecordBatchReaderBuilder::try_new(parquet_bytes).unwrap();
        let reader = builder.build().unwrap();
        let batches: std::result::Result<Vec<_>, _> = reader.collect();
        let batches = batches.unwrap();
        assert_eq!(batches[0].num_rows(), 3);
        assert_eq!(batches[0].num_columns(), 7);
    }

    #[test]
    fn test_csv_to_parquet_empty() {
        let csv = b"name,age\n";

        let result = csv_bytes_to_parquet_bytes(csv);
        // Empty CSV (header only) should fail
        assert!(result.is_err());
    }

    #[test]
    fn test_csv_schema_inference() {
        let csv = b"id,name,value,active\n1,Alice,29.99,true\n2,Bob,0,false\n";

        let schema = infer_csv_schema(csv).unwrap();
        assert_eq!(schema.fields().len(), 4);
        assert!(schema.field_with_name("id").is_ok());
        assert!(schema.field_with_name("name").is_ok());
        assert!(schema.field_with_name("value").is_ok());
        assert!(schema.field_with_name("active").is_ok());
    }
}
