//! CSV utilities to parse CSV files.
//! Based on https://www.ietf.org/rfc/rfc4180.txt

use std::{collections::HashMap, io::Read};

use anyhow::{Result, anyhow};
use encoding_rs_io::DecodeReaderBytes;

// possible CSV delimiters
const CSV_POSSIBLE_DELIMITERS: [u8; 5] = [b',', b';', b'\t', b'|', b' '];
const CSV_SAMPLE_LINES: usize = 10;

/// Converts a CSV file to utf8 using encoding_rs_io.
pub(crate) fn clean_csv_file(file: &[u8]) -> Result<Vec<u8>> {
    let mut decoder = DecodeReaderBytes::new(file);
    let mut converted_file = vec![];
    if decoder.read_to_end(&mut converted_file).is_err() {
        return Err(anyhow!("error converting file to utf8"));
    }
    // Only keep valid UTF-8 sequences
    let filtered: Vec<u8> = String::from_utf8_lossy(&converted_file)
        .into_owned()
        .into_bytes();
    Ok(filtered)
}

#[derive(Debug)]
struct DelimiterStats {
    delimiter: char,
    max_width: u32,
    column_counts: HashMap<usize, usize>,
}

/// Computes the score for a delimiter based on the column counts and sample size.
/// The score is a combination of consistency and coverage.
/// Consistency is a measure of how consistent the column counts are, and coverage is a measure of how many lines are covered by the delimiter.
/// The score is a value between 0 and 1, where 1 is the best score.
/// The max width is the maximum number of columns in a line.
/// The score is computed as the product of consistency and coverage.
fn compute_score(column_counts: &HashMap<usize, usize>, sample_size: usize) -> (f32, u32) {
    if sample_size == 0 {
        return (0.0, 1);
    }
    let mut total_lines = 0;
    let mut sum = 0.0;
    let mut sum_sq = 0.0;
    let mut max_width = 1;

    for (&count, &freq) in column_counts {
        if count != 1 {
            total_lines += freq;
            let f = count as f32;
            sum += f * freq as f32;
            sum_sq += f * f * freq as f32;
            if count as u32 > max_width {
                max_width = count as u32;
            }
        }
    }

    if total_lines == 0 {
        return (0.0, max_width);
    }

    let mean = sum / total_lines as f32;
    let variance = (sum_sq / total_lines as f32) - (mean * mean);
    let std_dev = variance.sqrt();
    let consistency = 1.0 / (1.0 + std_dev);
    let coverage = total_lines as f32 / sample_size as f32;
    (consistency * coverage, max_width)
}

/// Finds the likely delimiter of a CSV file and the likely width and height.
/// The delimiter and width is determined by reading the first lines and counting
/// potential delimiters, along with how many columns they split the line into.
///
/// Returns (delimiter, width, height, is_table)
pub(crate) fn find_csv_info(text: &[u8]) -> (u8, u32, u32, bool) {
    let mut is_table = true;

    let mut delimiter_stats: Vec<DelimiterStats> = CSV_POSSIBLE_DELIMITERS
        .iter()
        .map(|&delim| DelimiterStats {
            delimiter: delim as char,
            max_width: 0,
            column_counts: HashMap::new(),
        })
        .collect();

    let create_reader = |delim: u8| {
        csv::ReaderBuilder::new()
            .delimiter(delim)
            .has_headers(false)
            .flexible(true)
            .from_reader(text)
    };

    let mut sample_size = 0;
    for stats in delimiter_stats.iter_mut() {
        sample_size = 0;
        let mut reader = create_reader(stats.delimiter as u8);
        for (i, result) in reader.records().enumerate() {
            if i >= CSV_SAMPLE_LINES {
                break;
            }

            if let Ok(record) = result {
                let len = record.len();
                *stats.column_counts.entry(len).or_insert(0) += 1;
                stats.max_width = (len as u32).max(stats.max_width);
            }
            sample_size += 1;
        }
    }

    let mut best_delimiter = b',';
    let mut best_score = 0.0;
    let mut best_width = 1;
    let mut best_column_counts = 0;
    let mut comma_width = 1;

    for stats in &delimiter_stats {
        if stats.column_counts.is_empty() {
            continue;
        }

        let (consistency, width) = compute_score(&stats.column_counts, sample_size);

        if stats.delimiter == ',' {
            comma_width = width;
        }

        if consistency > best_score {
            best_score = consistency;
            best_delimiter = stats.delimiter as u8;
            best_width = width;
            best_column_counts = stats.column_counts.len();
        }
    }

    if best_width <= 1 || best_column_counts != 1 || best_score < 0.4 {
        is_table = false;
        best_delimiter = b',';
        best_width = comma_width;
    }

    // calculate height of the CSV file
    let reader = |flexible| {
        csv::ReaderBuilder::new()
            .delimiter(b',') // delimiter doesn't matter here, we just need to count the lines
            .has_headers(false)
            .flexible(flexible)
            .from_reader(text)
    };
    let height = reader(true).records().filter(|r| r.is_ok()).count();

    (
        best_delimiter,
        best_width,
        height as u32,
        best_width > 1 && is_table,
    )
}

#[cfg(test)]
mod tests {
    use crate::test_util::*;
    use std::path::Path;

    use super::*;

    fn read_test_csv_file(file_name: &str) -> Vec<u8> {
        let dir = "../quadratic-rust-shared/data/csv/";
        std::fs::read(Path::new(dir).join(file_name)).unwrap()
    }

    #[test]
    fn test_simple_csv() {
        let file = read_test_csv_file("simple.csv");
        let converted_file = clean_csv_file(&file).unwrap();
        let info = find_csv_info(&converted_file);
        assert_eq!(info, (b',', 4, 11, true));
    }

    #[test]
    fn test_kaggle_csv() {
        let file = read_test_csv_file("kaggle_top_100_dataset.csv");
        let converted_file = clean_csv_file(&file).unwrap();
        let info = find_csv_info(&converted_file);
        assert_eq!(info, (b';', 9, 100, true));
    }

    #[test]
    fn test_find_delimiter() {
        let info = |filename: &str| -> (u8, u32, u32, bool) {
            let file = read_test_csv_file(filename);
            let converted_file = clean_csv_file(&file).unwrap();
            find_csv_info(&converted_file)
        };

        assert_eq!(info("encoding_issue.csv"), (b',', 3, 4, true));
        assert_eq!(info("kaggle_top_100_dataset.csv"), (b';', 9, 100, true));
        assert_eq!(info("simple_space_separator.csv"), (b' ', 4, 3, true));
        assert_eq!(info("simple.csv"), (b',', 4, 11, true));
        assert_eq!(info("title_row_empty_first.csv"), (b',', 3, 6, false));
        assert_eq!(info("title_row.csv"), (b',', 3, 6, false));
    }

    #[test]
    fn test_bad_line() {
        let csv = "980E92207901934";
        let info = find_csv_info(csv.as_bytes());
        assert_eq!(info, (b',', 1, 1, false));
    }

    #[test]
    fn test_csv_error_1() {
        let file = read_test_csv_file("csv-error-1.csv");
        let converted_file = clean_csv_file(&file).unwrap();
        let info = find_csv_info(&converted_file);
        assert_eq!(info, (b',', 18, 5, true));
    }

    #[test]
    fn test_csv_error_2() {
        let file = read_test_csv_file("csv-error-2.csv");
        let converted_file = clean_csv_file(&file).unwrap();
        let info = find_csv_info(&converted_file);
        assert_eq!(info, (b',', 18, 7, true));
    }

    #[test]
    fn test_first_row_as_header() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let file = read_test_csv_file("csv-error-1.csv");
        gc.import_csv(sheet_id, &file, "file_name", pos![A1], None, None, None)
            .unwrap();

        assert_display_cell_value(&gc, sheet_id, 1, 2, "Database");
    }
}
