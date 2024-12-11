use std::str::FromStr;

use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::grid::CodeCellLanguage;
use crate::CellRefRange;

const Q_CELLS_A1_REGEX: &str = r#"\bq\.cells\s*\(\s*(['"`])([^'"`]+)(['"`])"#;

lazy_static! {
    static ref Q_CELLS_A1_REGEX_COMPILED: Regex =
        Regex::new(Q_CELLS_A1_REGEX).expect("Failed to compile Q_CELLS_A1_REGEX");
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCellValue {
    pub language: CodeCellLanguage,
    pub code: String,
}

impl CodeCellValue {
    /// Updates the cell references in the code by translating them by the given
    /// delta. Updates only relative cell references.
    pub fn update_cell_references(&mut self, delta_x: i64, delta_y: i64) {
        if delta_x == 0 && delta_y == 0 {
            return;
        }

        // translate q.cells("A1:B2" cell references by delta_x and delta_y for
        // python and javascript code cells
        if self.language != CodeCellLanguage::Python
            && self.language != CodeCellLanguage::Javascript
        {
            return;
        }

        self.code = Q_CELLS_A1_REGEX_COMPILED
            .replace_all(&self.code, |caps: &regex::Captures<'_>| {
                let full_match = &caps[0]; // Capture the entire match
                let start_quote = &caps[1]; // The quote type used at the start
                let cell_ref_str = &caps[2]; // Capture the first argument inside quotes
                let end_quote = &caps[3]; // The quote type used at the end

                // if the quotes are mismatched, return the original string
                if start_quote != end_quote {
                    return full_match.to_string();
                }

                match CellRefRange::from_str(cell_ref_str) {
                    Ok(mut cell_ref_range) => {
                        cell_ref_range.translate_in_place(delta_x, delta_y);
                        // Replace only the first argument, keep the rest unchanged
                        format!("q.cells({0}{1}{0}", start_quote, cell_ref_range)
                    }
                    // If the cell reference is invalid, return the original string
                    Err(_) => full_match.to_string(),
                }
            })
            .to_string();
    }

    /// Adjusts the code cell references by the given delta. Updates only relative
    /// cell references. Used for adjusting code cell references when the column
    /// or row is inserted or deleted.
    pub fn adjust_code_cell_column_row(
        &mut self,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        if delta == 0 {
            return;
        }

        // adjust q.cells("A1:B2" cell references by delta for python and
        // javascript code cells
        if self.language != CodeCellLanguage::Python
            && self.language != CodeCellLanguage::Javascript
        {
            return;
        }

        self.code = Q_CELLS_A1_REGEX_COMPILED
            .replace_all(&self.code, |caps: &regex::Captures<'_>| {
                let full_match = &caps[0]; // Capture the entire match
                let start_quote = &caps[1]; // The quote type used at the start
                let cell_ref_str = &caps[2]; // Capture the first argument inside quotes
                let end_quote = &caps[3]; // The quote type used at the end

                // if the quotes are mismatched, return the original string
                if start_quote != end_quote {
                    return full_match.to_string();
                }

                match CellRefRange::from_str(cell_ref_str) {
                    Ok(mut cell_ref_range) => {
                        // adjust the range by delta
                        cell_ref_range.adjust_column_row_in_place(column, row, delta);
                        // Replace only the first argument, keep the rest unchanged
                        format!("q.cells({0}{1}{0}", start_quote, cell_ref_range)
                    }
                    // If the cell reference is invalid, return the original string
                    Err(_) => full_match.to_string(),
                }
            })
            .to_string();
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_update_cell_references() {
        // Basic single reference
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.update_cell_references(1, 1);
        assert_eq!(code.code, "q.cells('B2:C3')", "Basic reference failed");

        // Multiple references in one line
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "x = q.cells('A1:B2') + q.cells('C3:D4')".to_string(),
        };
        code.update_cell_references(1, 1);
        assert_eq!(
            code.code, "x = q.cells('B2:C3') + q.cells('D4:E5')",
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2"); q.cells('C3:D4'); q.cells(`E5:F6`);"#.to_string(),
        };
        code.update_cell_references(1, 1);
        assert_eq!(
            code.code, r#"q.cells("B2:C3"); q.cells('D4:E5'); q.cells(`F6:G7`);"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2'); q.cells('C3:D4")"#.to_string(),
        };
        code.update_cell_references(1, 1);
        assert_eq!(
            code.code, r#"q.cells("A1:B2'); q.cells('C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.update_cell_references(0, 0);
        assert_eq!(code.code, "q.cells('A1:B2')", "Zero delta failed");

        // Negative delta
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('C3:D4')".to_string(),
        };
        code.update_cell_references(-1, -1);
        assert_eq!(code.code, "q.cells('B2:C3')", "Negative delta failed");

        // Whitespace variations
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells  (  'A1:B2'  )".to_string(),
        };
        code.update_cell_references(1, 1);
        assert_eq!(
            code.code, "q.cells('B2:C3'  )",
            "Whitespace variations failed"
        );

        // Non Python/JS languages should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: "A1".to_string(),
        };
        code.update_cell_references(1, 1);
        assert_eq!(code.code, "A1", "Non Python/JS failed");

        // Python first_row_header=True
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2', first_row_header=True)".to_string(),
        };
        code.update_cell_references(1, 1);
        assert_eq!(
            code.code, "q.cells('B2:C3', first_row_header=True)",
            "first_row_header=True failed"
        );
    }
}
