use fancy_regex::Regex;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

use crate::grid::CodeCellLanguage;
use crate::{A1Selection, SheetNameIdMap};

use super::SheetId;

const Q_CELLS_A1_REGEX: &str = r#"\bq\.cells\s*\(\s*(['"`])(.*?)\1"#;

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
    pub fn update_cell_references(
        &mut self,
        delta_x: i64,
        delta_y: i64,
        default_sheet_id: &SheetId,
        sheet_map: &SheetNameIdMap,
    ) {
        if delta_x == 0 && delta_y == 0 {
            return;
        }

        // translate q.cells("'Sheet1'!A1:B2" cell references by delta_x and delta_y for
        // python and javascript code cells
        if self.language != CodeCellLanguage::Python
            && self.language != CodeCellLanguage::Javascript
        {
            return;
        }

        self.code = Q_CELLS_A1_REGEX_COMPILED
            .replace_all(&self.code, |caps: &fancy_regex::Captures<'_>| {
                let full_match = &caps[0]; // Capture the entire match
                let a1_str = &caps[2]; // Capture the first argument which is inside quotes

                dbg!(&a1_str);

                match A1Selection::from_str(a1_str, default_sheet_id, sheet_map) {
                    Ok(mut a1_selection) => {
                        a1_selection.translate_in_place(delta_x, delta_y);
                        let a1_str = a1_selection.to_string(Some(*default_sheet_id), sheet_map);
                        // Replace only the first argument, keep the rest unchanged
                        format!(r#"q.cells("{0}""#, a1_str)
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
        default_sheet_id: &SheetId,
        sheet_map: &SheetNameIdMap,
    ) {
        if delta == 0 {
            return;
        }

        // adjust q.cells("'Sheet1'!A1:B2" cell references by delta for python and
        // javascript code cells
        if self.language != CodeCellLanguage::Python
            && self.language != CodeCellLanguage::Javascript
        {
            return;
        }

        self.code = Q_CELLS_A1_REGEX_COMPILED
            .replace_all(&self.code, |caps: &fancy_regex::Captures<'_>| {
                let full_match = &caps[0]; // Capture the entire match
                let a1_str = &caps[2]; // Capture the first argument which is inside quotes

                match A1Selection::from_str(a1_str, default_sheet_id, sheet_map) {
                    Ok(mut a1_selection) => {
                        // adjust the range by delta
                        a1_selection.adjust_column_row_in_place(column, row, delta);
                        let a1_str = a1_selection.to_string(Some(*default_sheet_id), sheet_map);
                        // Replace only the first argument, keep the rest unchanged
                        format!(r#"q.cells("{0}""#, a1_str)
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
        let sheet_id = SheetId::new();
        let sheet_map = SheetNameIdMap::new();

        // Basic single reference
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Basic reference failed");

        // Multiple references in one line
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "x = q.cells('A1:B2') + q.cells('C3:D4')".to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"x = q.cells("B2:C3") + q.cells("D4:E5")"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2"); q.cells("C3:D4"); q.cells("E5:F6");"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("B2:C3"); q.cells("D4:E5"); q.cells("F6:G7");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2'); q.cells('C3:D4")"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("A1:B2'); q.cells('C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.update_cell_references(0, 0, &sheet_id, &sheet_map);
        assert_eq!(code.code, r#"q.cells('A1:B2')"#, "Zero delta failed");

        // Negative delta
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('C3:D4')".to_string(),
        };
        code.update_cell_references(-1, -1, &sheet_id, &sheet_map);
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Negative delta failed");

        // Whitespace variations
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells  (  'A1:B2'  )".to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("B2:C3"  )"#,
            "Whitespace variations failed"
        );

        // Non Python/JS languages should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: "A1".to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(code.code, "A1", "Non Python/JS failed");

        // Python first_row_header=True
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2", first_row_header=True)"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("B2:C3", first_row_header=True)"#,
            "first_row_header=True failed"
        );
    }

    #[test]
    fn test_update_cell_references_with_sheet_name() {
        let sheet_id = SheetId::new();
        let mut sheet_map = SheetNameIdMap::new();
        sheet_map.insert("Sheet 1".to_string(), sheet_id);
        sheet_map.insert("Sheet 1 (1)".to_string(), SheetId::new());

        // Basic single reference
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet 1 (1)'!A1:B2")"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("'Sheet 1 (1)'!B2:C3")"#,
            "Basic reference failed"
        );

        // Multiple references in one line
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"x = q.cells("'Sheet 1'!A1:B2") + q.cells("'Sheet 1 (1)'!C3:D4")"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"x = q.cells("B2:C3") + q.cells("'Sheet 1 (1)'!D4:E5")"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet 1'!A1:B2"); q.cells("'Sheet 1 (1)'!C3:D4"); q.cells("'Sheet 1'!E5:F6");"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("B2:C3"); q.cells("'Sheet 1 (1)'!D4:E5"); q.cells("F6:G7");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet 1'!A1:B2'); q.cells(''Sheet 1 (1)'!C3:D4")"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("'Sheet 1'!A1:B2'); q.cells(''Sheet 1 (1)'!C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet 1 (1)'!A1:B2")"#.to_string(),
        };
        code.update_cell_references(0, 0, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("'Sheet 1 (1)'!A1:B2")"#,
            "Zero delta failed"
        );

        // Negative delta
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet 1 (1)'!C3:D4")"#.to_string(),
        };
        code.update_cell_references(-1, -1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("'Sheet 1 (1)'!B2:C3")"#,
            "Negative delta failed"
        );

        // Whitespace variations
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells  (  "'Sheet 1 (1)'!A1:B2"  )"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("'Sheet 1 (1)'!B2:C3"  )"#,
            "Whitespace variations failed"
        );

        // Non Python/JS languages should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: r#"A1"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(code.code, r#"A1"#, "Non Python/JS failed");

        // Python first_row_header=True
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet 1 (1)'!A1:B2", first_row_header=True)"#.to_string(),
        };
        code.update_cell_references(1, 1, &sheet_id, &sheet_map);
        assert_eq!(
            code.code, r#"q.cells("'Sheet 1 (1)'!B2:C3", first_row_header=True)"#,
            "first_row_header=True failed"
        );
    }
}
