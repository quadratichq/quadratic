//! ZIP archive utilities

use std::io::{Cursor, Read};

use crate::error::{Result, SharedError};

/// Extract the first CSV file from a ZIP archive.
pub fn extract_csv_from_zip(zip_data: &[u8]) -> Result<Vec<u8>> {
    let cursor = Cursor::new(zip_data);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| SharedError::Generic(format!("Failed to open ZIP archive: {}", e)))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| SharedError::Generic(format!("Failed to read ZIP entry {}: {}", i, e)))?;

        if file.name().ends_with(".csv") {
            let mut csv_data = Vec::with_capacity(file.size() as usize);
            file.read_to_end(&mut csv_data).map_err(|e| {
                SharedError::Generic(format!("Failed to extract CSV from ZIP: {}", e))
            })?;

            return Ok(csv_data);
        }
    }

    Err(SharedError::Generic(
        "No CSV file found in ZIP archive".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use std::io::{Cursor, Write};

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

        match result.unwrap_err() {
            SharedError::Generic(msg) => {
                assert!(
                    msg.contains("No CSV file found"),
                    "Expected 'No CSV file found' in: {msg}"
                );
            }
            other => panic!("Expected Generic error, got: {other:?}"),
        }
    }

    #[test]
    fn test_extract_csv_from_zip_invalid_data() {
        let result = extract_csv_from_zip(b"this is not a zip file");
        assert!(result.is_err());

        match result.unwrap_err() {
            SharedError::Generic(msg) => {
                assert!(
                    msg.contains("Failed to open ZIP archive"),
                    "Expected 'Failed to open ZIP archive' in: {msg}"
                );
            }
            other => panic!("Expected Generic error, got: {other:?}"),
        }
    }

    #[test]
    fn test_extract_csv_from_zip_empty_archive() {
        let buffer = Vec::new();
        let cursor = Cursor::new(buffer);
        let zip = ZipWriter::new(cursor);
        let zip_data = zip.finish().unwrap().into_inner();

        let result = extract_csv_from_zip(&zip_data);
        assert!(result.is_err());

        match result.unwrap_err() {
            SharedError::Generic(msg) => {
                assert!(
                    msg.contains("No CSV file found"),
                    "Expected 'No CSV file found' in: {msg}"
                );
            }
            other => panic!("Expected Generic error, got: {other:?}"),
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
    fn test_extract_csv_from_zip_multiple_csvs_picks_first() {
        let first_csv = b"a,b\n1,2\n";
        let second_csv = b"x,y,z\n10,20,30\n";
        let zip_data =
            create_zip_with_files(&[("first.csv", first_csv), ("second.csv", second_csv)]);

        let result = extract_csv_from_zip(&zip_data).unwrap();
        assert_eq!(result, first_csv);
    }
}
