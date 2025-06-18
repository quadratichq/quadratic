//! CSV utilities to parse CSV files.
//! Based on https://www.ietf.org/rfc/rfc4180.txt

// possible CSV delimiters
const CSV_POSSIBLE_DELIMITERS: [u8; 5] = [b',', b';', b'\t', b'|', b' '];

// number of lines to sample to find the delimiter
const CSV_SAMPLE_LINES: usize = 10;

use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Read},
};

use anyhow::{Result, anyhow};
use encoding_rs_io::DecodeReaderBytes;

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

struct DelimiterStats {
    delimiter: char,
    width: u32,
    column_counts: HashMap<usize, usize>,
}

/// Finds the likely delimiter of a CSV file and the likely width and height.
/// The delimiter and width is determined by reading the first lines and counting
/// potential delimiters, along with how many columns they split the line into.
///
/// Returns (delimiter, width, height)
pub(crate) fn find_csv_info(text: &[u8]) -> (u8, u32, u32) {
    let mut reader = BufReader::new(text);
    let mut line = String::new();

    // For each delimiter, track column counts
    let mut delimiter_stats: Vec<DelimiterStats> = CSV_POSSIBLE_DELIMITERS
        .iter()
        .map(|&delim| DelimiterStats {
            delimiter: delim as char,
            width: 0,
            column_counts: HashMap::new(),
        })
        .collect();
    let mut line_count = 0;

    // Sample the lines to count the frequency of delimiters, and the number
    // of columns they create
    while line_count <= CSV_SAMPLE_LINES {
        line.clear();
        if reader.read_line(&mut line).unwrap_or(0) == 0 {
            break;
        }

        // Skip empty lines
        if line.trim().is_empty() {
            continue;
        }

        // For each delimiter, count the number of columns in this line
        for stats in delimiter_stats.iter_mut() {
            let mut columns = 0;

            // allow for parsing of quoted fields
            let mut in_quotes = None;
            let mut last_char = ' ';

            for c in line.chars() {
                if c == '"' || c == '\'' {
                    if in_quotes.is_none() {
                        in_quotes = Some(c);
                    } else if in_quotes.is_some_and(|q| q == c) {
                        in_quotes = None;
                    }
                } else if c == stats.delimiter && in_quotes.is_none() {
                    columns += 1;
                }
                last_char = c;
            }
            // Add one for the last column
            if last_char != stats.delimiter {
                columns += 1;
            }

            if columns > 1 {
                // Only consider if it actually splits the line
                *stats.column_counts.entry(columns).or_insert(0) += 1;
                stats.width = columns as u32;
            }
        }
        line_count += 1;
    }

    // Find the delimiter with the most consistent column count
    let mut best_delimiter = b',';
    let mut best_consistency = 0.0;
    let mut best_width = 1;

    for stats in delimiter_stats.iter() {
        if stats.column_counts.is_empty() {
            continue;
        }

        // Counts the number of lines with the same column count
        let (_, frequency) = stats
            .column_counts
            .iter()
            .fold(
                (0, 0),
                |acc, (count, freq)| {
                    if freq > &acc.1 { (*count, *freq) } else { acc }
                },
            );

        let total_lines: usize = stats.column_counts.values().sum();
        let consistency = frequency as f32 / total_lines as f32;

        if consistency > best_consistency {
            best_consistency = consistency;
            best_delimiter = stats.delimiter as u8;
            best_width = stats.width;
        }
    }

    // read the file to get the height
    let mut height = 0;
    let reader = BufReader::new(text);
    for _ in reader.lines() {
        height += 1;
    }

    (best_delimiter, best_width, height)
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    fn read_test_csv_file(file_name: &str) -> Vec<u8> {
        let dir = "../quadratic-rust-shared/data/csv/";
        std::fs::read(Path::new(dir).join(file_name)).unwrap()
    }

    #[test]
    fn test_find_delimiter() {
        let info = |filename: &str| -> (u8, u32, u32) {
            let file = read_test_csv_file(filename);
            let converted_file = clean_csv_file(&file).unwrap();
            find_csv_info(&converted_file)
        };

        assert_eq!(info("encoding_issue.csv"), (b',', 3, 4));
        assert_eq!(info("kaggle_top_100_dataset.csv"), (b';', 9, 100));
        assert_eq!(info("simple_space_separator.csv"), (b' ', 4, 3));
        assert_eq!(info("simple.csv"), (b',', 4, 11));
        assert_eq!(info("title_row_empty_first.csv"), (b',', 3, 7));
        assert_eq!(info("title_row.csv"), (b',', 3, 6));
    }

    #[test]
    fn test_bad_line() {
        let csv = "980E92207901934";
        let info = find_csv_info(csv.as_bytes());
        assert_eq!(info, (b',', 1, 1));
    }
}
