//! Parquet Utilities
//!
//! Functions to interact with Parquet files

use bytes::Bytes;
use parquet::file::reader::{ChunkReader, FileReader, SerializedFileReader};
use parquet::record::Row;

use crate::SharedError;
use crate::error::Result;

/// Convert a Parquet reader to a vector of rows
pub fn reader_to_vec<T: ChunkReader + 'static>(
    reader: SerializedFileReader<T>,
) -> Result<Vec<Row>> {
    let rows = reader
        .get_row_iter(None)
        .map_err(|e| SharedError::Generic(format!("Could not convert to rows: {e}")))?
        .flatten()
        .collect::<Vec<_>>();

    Ok(rows)
}

/// Convert a Parquet file to a vector of rows
pub fn file_to_rows(file: &str) -> Result<Vec<Row>> {
    let file = std::fs::File::open(file)
        .map_err(|e| SharedError::Generic(format!("Could not open file: {e}")))?;
    let reader = SerializedFileReader::new(file)?;

    reader_to_vec(reader)
}

/// Convert a Parquet bytes to a vector of rows
pub fn bytes_to_rows(bytes: Bytes) -> Result<Vec<Row>> {
    let reader = SerializedFileReader::new(bytes).unwrap();

    reader_to_vec(reader)
}

/// Compare a Parquet file with a vector of bytes
pub fn compare_parquet_file_with_bytes(file: &str, bytes: Bytes) -> bool {
    let file_rows = file_to_rows(file);
    let bytes_rows = bytes_to_rows(bytes);

    file_rows == bytes_rows
}
