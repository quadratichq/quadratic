//! CSV utilities to parse CSV files.
//! Based on https://www.ietf.org/rfc/rfc4180.txt

// possible CSV delimiters
const CSV_POSSIBLE_DELIMITERS: [u8; 5] = [b',', b';', b'\t', b'|', b' '];

// number of lines to sample to find the delimiter
const CSV_SAMPLE_LINES: usize = 10;

use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Cursor},
};

/// Convert a byte record to a string, handling UTF-16 encoding if necessary.
pub(crate) fn byte_record_to_string(record: &[u8]) -> String {
    String::from_utf8(record.to_vec())
        .or_else(|_| {
            if record.is_empty() || record.len() % 2 != 0 {
                return Err(());
            }

            // convert u8 to u16
            let mut utf16vec: Vec<u16> = Vec::with_capacity(record.len() / 2);
            for chunk in record.to_owned().chunks_exact(2) {
                let Ok(vec2) = <[u8; 2]>::try_from(chunk) else {
                    return Err(());
                };
                utf16vec.push(u16::from_ne_bytes(vec2));
            }

            // convert to string
            let Ok(str) = String::from_utf16(utf16vec.as_slice()) else {
                return Err(());
            };

            // strip invalid characters
            Ok(str.chars().filter(|&c| c.len_utf8() <= 2).collect())
        })
        .unwrap_or_else(|_| record.iter().map(|&b| b as char).collect())
}

struct DelimiterStats {
    delimiter: char,
    column_counts: HashMap<usize, usize>,
}

/// Finds the likely delimiter of a CSV file by reading the first lines and
/// counting potential delimiters, along with how many columns they split
/// the line into.
pub(crate) fn find_csv_delimiter(file: &[u8]) -> u8 {
    let mut reader = BufReader::new(Cursor::new(file));
    let mut line = String::new();

    // For each delimiter, track column counts
    let mut delimiter_stats: Vec<DelimiterStats> = CSV_POSSIBLE_DELIMITERS
        .iter()
        .map(|&delim| DelimiterStats {
            delimiter: delim as char,
            column_counts: HashMap::new(),
        })
        .collect();
    let mut line_count = 0;

    // Sample the lines to count the frequency of delimiters, and the number
    // of columns they create
    while line_count < CSV_SAMPLE_LINES {
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
            let columns = line.split(stats.delimiter).count();
            if columns > 1 {
                // Only consider if it actually splits the line
                *stats.column_counts.entry(columns).or_insert(0) += 1;
            }
        }
        line_count += 1;
    }

    // Find the delimiter with the most consistent column count
    let mut best_delimiter = b',';
    let mut best_consistency = 0.0;

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
        }
    }

    best_delimiter
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn test_byte_record_to_string() {
        // Test UTF-8 string
        let utf8_bytes = b"Hello, World!";
        assert_eq!(byte_record_to_string(utf8_bytes), "Hello, World!");

        // Test UTF-16 string (little endian)
        let utf16_bytes = vec![
            0xFF, 0xFE, // BOM
            0x48, 0x00, // H
            0x65, 0x00, // e
            0x6C, 0x00, // l
            0x6C, 0x00, // l
            0x6F, 0x00, // o
        ];
        assert_eq!(byte_record_to_string(&utf16_bytes), "Hello");

        // Test invalid UTF-8 that falls back to character conversion
        let invalid_utf8 = vec![0xFF, 0xFE, 0x48, 0x65, 0x6C, 0x6C, 0x6F];
        let result = byte_record_to_string(&invalid_utf8);
        assert!(!result.is_empty());
        assert!(result.chars().all(|c| c.len_utf8() <= 2));

        // Test preview
        let utf16_data: Vec<u8> = vec![
            0xFF, 0xFE, 0x68, 0x00, 0x65, 0x00, 0x61, 0x00, 0x64, 0x00, 0x65, 0x00, 0x72, 0x00,
            0x31, 0x00, 0x2C, 0x00, 0x68, 0x00, 0x65, 0x00, 0x61, 0x00, 0x64, 0x00, 0x65, 0x00,
            0x72, 0x00, 0x32, 0x00, 0x0A, 0x00, 0x76, 0x00, 0x61, 0x00, 0x6C, 0x00, 0x75, 0x00,
            0x65, 0x00, 0x31, 0x00, 0x2C, 0x00, 0x76, 0x00, 0x61, 0x00, 0x6C, 0x00, 0x75, 0x00,
            0x65, 0x00, 0x32, 0x00,
        ];
        let result = byte_record_to_string(&utf16_data);
        assert_eq!(result, "header1,header2\nvalue1,value2");

        // Test empty input
        assert_eq!(byte_record_to_string(b""), "");
    }

    #[test]
    fn test_find_delimiter() {
        let delimiter = |filename: &str| -> u8 {
            let dir = "../quadratic-rust-shared/data/csv/";
            dbg!(Path::new(dir).join(filename));
            let file = std::fs::read(Path::new(dir).join(filename)).unwrap();
            find_csv_delimiter(&file)
        };

        assert_eq!(delimiter("simple_space_separator.csv"), b' ');
        assert_eq!(delimiter("encoding_issue.csv"), b',');
        assert_eq!(delimiter("kaggle_top_100_dataset.csv"), b';');
        assert_eq!(delimiter("simple.csv"), b',');
        assert_eq!(delimiter("title_row_empty_first.csv"), b',');
        assert_eq!(delimiter("title_row.csv"), b',');
    }
}
