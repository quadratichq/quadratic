use lazy_static::lazy_static;
use regex::Regex;
use wasm_bindgen::prelude::*;

use crate::a1::A1Context;

const A1_REGEX: &str = r#"\b\$?[a-zA-Z]+\$\d+\b"#;
const R1C1_REGEX: &str = r#"\bR\d+C\d+\b"#;
const TABLE_NAME_VALID_CHARS: &str = r#"^[a-zA-Z_\\][a-zA-Z0-9_.]*$"#;

lazy_static! {
    static ref A1_REGEX_COMPILED: Regex = Regex::new(A1_REGEX).expect("Failed to compile A1_REGEX");
    static ref R1C1_REGEX_COMPILED: Regex =
        Regex::new(R1C1_REGEX).expect("Failed to compile R1C1_REGEX");
    static ref TABLE_NAME_VALID_CHARS_COMPILED: Regex =
        Regex::new(TABLE_NAME_VALID_CHARS).expect("Failed to compile TABLE_NAME_VALID_CHARS");
}

#[wasm_bindgen(js_name = "validateTableName")]
pub fn validate_table_name(name: &str, context: &str) -> Result<bool, String> {
    // Check length limit
    if name.is_empty() || name.len() > 255 {
        return Err("Table name must be between 1 and 255 characters".to_string());
    }

    // Check if name is a single "R", "r", "C", or "c"
    if matches!(name.to_uppercase().as_str(), "R" | "C") {
        return Err("Table name cannot be a single 'R' or 'C'".to_string());
    }

    // Check if name matches a cell reference pattern (A1 or R1C1)
    if A1_REGEX_COMPILED.is_match(name) || R1C1_REGEX_COMPILED.is_match(name) {
        return Err("Table name cannot be a cell reference".to_string());
    }

    // Validate characters using regex pattern
    if !TABLE_NAME_VALID_CHARS_COMPILED.is_match(name) {
        return Err("Table name contains invalid characters".to_string());
    }

    let context = serde_json::from_str::<A1Context>(context).map_err(|e| e.to_string())?;
    if context.table_info().iter().any(|info| info.name == name) {
        return Err("Table name must be unique".to_string());
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use crate::{grid::SheetId, Rect};

    use super::*;

    #[test]
    fn test_valid_table_names() {
        let context = A1Context::default();
        let longest_name = "a".repeat(255);
        let valid_names = vec![
            "Sales",
            "tbl_Sales",
            "First_Quarter",
            "First.Quarter",
            "Table_2023",
            "_hidden",
            "\\special",
            longest_name.as_str(),
        ];

        for name in valid_names {
            assert!(validate_table_name(name, &context.to_string()).is_ok());
        }
    }

    #[test]
    fn test_invalid_table_names() {
        let context = A1Context::default();
        let long_name = "a".repeat(256);
        let test_cases = vec![
            ("", "Table name must be between 1 and 255 characters"),
            (
                long_name.as_str(),
                "Table name must be between 1 and 255 characters",
            ),
            ("R", "Table name cannot be a single 'R' or 'C'"),
            ("C", "Table name cannot be a single 'R' or 'C'"),
            ("r", "Table name cannot be a single 'R' or 'C'"),
            ("c", "Table name cannot be a single 'R' or 'C'"),
            ("A$1", "Table name cannot be a cell reference"),
            ("R1C1", "Table name cannot be a cell reference"),
            ("2Sales", "Table name contains invalid characters"),
            ("Sales Space", "Table name contains invalid characters"),
            ("#Invalid", "Table name contains invalid characters"),
        ];

        for (name, expected_error) in test_cases {
            let result = validate_table_name(name, &context.to_string());
            assert!(result.is_err());
            assert_eq!(result.unwrap_err(), expected_error);
        }
    }

    #[test]
    fn test_duplicate_table_names() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[
                ("Table1", &["col1", "col2"], Rect::test_a1("A1:B3")),
                ("Table2", &["col3", "col4"], Rect::test_a1("D1:E3")),
            ],
        );
        let result = validate_table_name("Table1", &context.to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Table name must be unique");
    }
}
