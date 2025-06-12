//! CSV utilities to parse CSV files.
//! Based on https://www.ietf.org/rfc/rfc4180.txt

// possible CSV delimiters
const CSV_POSSIBLE_DELIMITERS: [u8; 5] = [b',', b';', b'\t', b'|', b' '];

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

/// Parses a CSV line and returns a vector of strings. Deals with basic quoting.
pub(crate) fn parse_csv_line(line: &str, delimiter: char) -> Vec<String> {
    let mut fields = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '"' => {
                if in_quotes {
                    if chars.peek() == Some(&'"') {
                        // Escaped quote
                        field.push('"');
                        chars.next();
                    } else {
                        // Closing quote
                        in_quotes = false;
                    }
                } else {
                    in_quotes = true;
                }
            }
            c if c == delimiter && !in_quotes => {
                fields.push(field);
                field = String::new();
            }
            _ => {
                field.push(c);
            }
        }
    }
    fields.push(field);
    fields
}

#[derive(Debug)]
struct DelimiterStats {
    delimiter: char,
    width: u32,
    column_counts: HashMap<usize, usize>,
}

/// Finds the likely delimiter of a CSV file and the likely width and height.
/// The delimiter and width is determined by reading the first lines and counting
/// potential delimiters, along with how many columns they split the line into.
///
/// Returns (delimiter, width, height, is_table)
pub(crate) fn find_csv_info(text: &[u8]) -> (u8, u32, u32, bool) {
    let mut reader = BufReader::new(text);
    let mut line = String::new();
    let mut height = 0;
    let mut is_table = true;

    let mut delimiter_stats: Vec<DelimiterStats> = CSV_POSSIBLE_DELIMITERS
        .iter()
        .map(|&delim| DelimiterStats {
            delimiter: delim as char,
            width: 0,
            column_counts: HashMap::new(),
        })
        .collect();

    while reader.read_line(&mut line).unwrap_or(0) > 0 {
        height += 1;

        for stats in delimiter_stats.iter_mut() {
            let mut columns = 0;
            let mut in_quotes = None;
            let mut last_char = ' ';

            for c in line.chars() {
                if c == '"' || c == '\'' {
                    if in_quotes.is_none() {
                        in_quotes = Some(c);
                    } else if in_quotes == Some(c) {
                        in_quotes = None;
                    }
                } else if c == stats.delimiter && in_quotes.is_none() {
                    columns += 1;
                }
                last_char = c;
            }

            if last_char != stats.delimiter {
                columns += 1;
            }

            if columns > 1 {
                // Only consider if it actually splits the line
                *stats.column_counts.entry(columns).or_insert(0) += 1;
                stats.width = (columns as u32).max(stats.width);
            }
        }

        line.clear();
    }

    let mut best_delimiter = b',';
    let mut best_score = 0.0;
    let mut best_width = 1;
    let mut comma_width = 1;

    for stats in &delimiter_stats {
        if stats.column_counts.is_empty() {
            continue;
        }

        let mut total_lines = 0;
        let mut sum = 0.0;
        let mut sum_sq = 0.0;

        for (&count, &freq) in &stats.column_counts {
            total_lines += freq;
            let f = count as f32;
            sum += f * freq as f32;
            sum_sq += f * f * freq as f32;
        }

        if total_lines == 0 {
            continue;
        }

        // Calculate the standard deviation of the column counts
        let mean = sum / total_lines as f32;
        let variance = (sum_sq / total_lines as f32) - (mean * mean);
        let std_dev = variance.sqrt();

        let consistency = 1.0 / (1.0 + std_dev); // lower stddev = higher score
        let coverage = total_lines as f32 / height.max(1) as f32;

        // Combine the consistency and coverage scores
        let combined_score = consistency * coverage;

        // The comma is the fallback if we don't have a table; we need to track
        // this separately
        if stats.delimiter == ',' {
            comma_width = stats.width;
        }

        if combined_score > best_score {
            best_score = combined_score;
            best_delimiter = stats.delimiter as u8;
            best_width = stats.width;
        }
    }

    if best_score < 0.4 || best_width <= 1 {
        is_table = false;
        best_delimiter = b',';
        best_width = comma_width;
    }

    (
        best_delimiter,
        best_width,
        height,
        best_width > 1 && is_table,
    )
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

        assert_eq!(info("encoding_issue.csv"), (b',', 3, 3, true));
        assert_eq!(info("simple_space_separator.csv"), (b' ', 4, 3, true));
        assert_eq!(info("simple.csv"), (b',', 4, 11, true));
        assert_eq!(info("title_row_empty_first.csv"), (b',', 3, 7, true));
        assert_eq!(info("title_row.csv"), (b',', 3, 6, true));
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
        assert_eq!(info, (b',', 18, 32, false));
    }

    #[test]
    fn test_csv_error_2() {
        let file = read_test_csv_file("csv-error-2.csv");
        let converted_file = clean_csv_file(&file).unwrap();
        let info = find_csv_info(&converted_file);
        assert_eq!(info, (b',', 18, 52, false));
    }
}
