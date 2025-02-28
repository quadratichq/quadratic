use fancy_regex::Regex;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

use crate::a1::{A1Context, A1Selection};
use crate::grid::CodeCellLanguage;
use crate::RefError;

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
    pub fn new(language: CodeCellLanguage, code: String) -> Self {
        Self { language, code }
    }

    pub fn new_python(code: String) -> Self {
        Self {
            language: CodeCellLanguage::Python,
            code,
        }
    }

    pub fn is_code_cell(&self) -> bool {
        self.language == CodeCellLanguage::Python || self.language == CodeCellLanguage::Javascript
    }

    fn replace_q_cells_a1_selection(
        &mut self,
        default_sheet_id: &SheetId,
        a1_context: &A1Context,
        mut func: impl FnMut(A1Selection) -> Result<String, RefError>,
    ) {
        self.code = Q_CELLS_A1_REGEX_COMPILED
            .replace_all(&self.code, |caps: &fancy_regex::Captures<'_>| {
                let full_match = &caps[0]; // Capture the entire match
                let a1_str = &caps[2]; // Capture the first argument which is inside quotes

                match A1Selection::parse_a1(a1_str, default_sheet_id, a1_context) {
                    Ok(a1_selection) => {
                        let a1_str = func(a1_selection).unwrap_or_else(|e: RefError| e.to_string());

                        // let a1_str = a1_selection.to_string(Some(*default_sheet_id), a1_context);

                        // Replace only the first argument, keep the rest unchanged
                        format!(r#"q.cells("{a1_str}""#)
                    }
                    // If the cell reference is invalid, return the original string
                    Err(_) => full_match.to_string(),
                }
            })
            .to_string();
    }

    /// Updates the cell references in the code by translating them by the given
    /// delta. Updates only relative cell references.
    pub fn translate_cell_references(
        &mut self,
        delta_x: i64,
        delta_y: i64,
        default_sheet_id: &SheetId,
        a1_context: &A1Context,
    ) {
        if delta_x == 0 && delta_y == 0 || !self.is_code_cell() {
            return;
        }

        self.replace_q_cells_a1_selection(default_sheet_id, a1_context, |mut a1_selection| {
            a1_selection.translate_in_place(delta_x, delta_y)?;
            Ok(a1_selection.to_string(Some(*default_sheet_id), a1_context))
        });
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
        a1_context: &A1Context,
    ) {
        if delta != 0 && self.is_code_cell() {
            self.replace_q_cells_a1_selection(default_sheet_id, a1_context, |mut a1_selection| {
                a1_selection.adjust_column_row_in_place(column, row, delta);
                Ok(a1_selection.to_string(Some(*default_sheet_id), a1_context))
            });
        }
    }

    /// Replaces the sheet name in the code cell references.
    pub fn replace_sheet_name_in_cell_references(
        &mut self,
        old_name: &str,
        new_name: &str,
        default_sheet_id: &SheetId,
        a1_context: &A1Context,
    ) {
        if old_name != new_name && self.is_code_cell() {
            let mut old_a1_context = a1_context.clone();

            if let Some(sheet_id) = a1_context.try_sheet_name(old_name) {
                old_a1_context.sheet_map.insert_parts(new_name, sheet_id);
            }

            // create a copy of the a1_context so that we can send it to the to_string() function
            let mut new_a1_context = old_a1_context.clone();
            new_a1_context.sheet_map.remove_name(old_name);

            self.replace_q_cells_a1_selection(default_sheet_id, &old_a1_context, |a1_selection| {
                Ok(a1_selection.to_string(Some(*default_sheet_id), &new_a1_context))
            });
        }
    }

    /// Replaces the table name in the code cell references.
    pub fn replace_table_name_in_cell_references(
        &mut self,
        old_name: &str,
        new_name: &str,
        default_sheet_id: &SheetId,
        a1_context: &A1Context,
    ) {
        if old_name != new_name && self.is_code_cell() {
            self.replace_q_cells_a1_selection(default_sheet_id, a1_context, |mut a1_selection| {
                a1_selection.replace_table_name(old_name, new_name);
                Ok(a1_selection.to_string(Some(*default_sheet_id), a1_context))
            });
        }
    }

    /// Replaces column names in the code cell references.
    pub fn replace_column_name_in_cell_references(
        &mut self,
        table_name: &str,
        old_name: &str,
        new_name: &str,
        default_sheet_id: &SheetId,
        a1_context: &A1Context,
    ) {
        if old_name != new_name && self.is_code_cell() {
            self.replace_q_cells_a1_selection(default_sheet_id, a1_context, |mut a1_selection| {
                a1_selection.replace_column_name(table_name, old_name, new_name);
                Ok(a1_selection.to_string(Some(*default_sheet_id), a1_context))
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_update_cell_references() {
        let sheet_id = SheetId::new();
        let a1_context = A1Context::default();

        // Basic single reference
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Basic reference failed");

        // Multiple references in one line
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "x = q.cells('A1:B2') + q.cells('C3:D4')".to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"x = q.cells("B2:C3") + q.cells("D4:E5")"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2"); q.cells("C3:D4"); q.cells("E5:F6");"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("B2:C3"); q.cells("D4:E5"); q.cells("F6:G7");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2'); q.cells('C3:D4")"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("A1:B2'); q.cells('C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.translate_cell_references(0, 0, &sheet_id, &a1_context);
        assert_eq!(code.code, r#"q.cells('A1:B2')"#, "Zero delta failed");

        // Negative delta
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('C3:D4')".to_string(),
        };
        code.translate_cell_references(-1, -1, &sheet_id, &a1_context);
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Negative delta failed");

        // Whitespace variations
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells  (  'A1:B2'  )".to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("B2:C3"  )"#,
            "Whitespace variations failed"
        );

        // Non Python/JS languages should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: "A1".to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(code.code, "A1", "Non Python/JS failed");

        // Python first_row_header=True
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2", first_row_header=True)"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("B2:C3", first_row_header=True)"#,
            "first_row_header=True failed"
        );
    }

    #[test]
    fn test_update_cell_references_with_sheet_name() {
        let sheet_id = SheetId::new();
        let mut a1_context = A1Context::default();
        a1_context.sheet_map.insert_test("Sheet1", sheet_id);
        a1_context
            .sheet_map
            .insert_test("Sheet1 (1)", SheetId::new());

        // Basic single reference
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!A1:B2")"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3")"#,
            "Basic reference failed"
        );

        // Multiple references in one line
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"x = q.cells("'Sheet1'!A1:B2") + q.cells("'Sheet1 (1)'!C3:D4")"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"x = q.cells("B2:C3") + q.cells("'Sheet1 (1)'!D4:E5")"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1'!A1:B2"); q.cells("'Sheet1 (1)'!C3:D4"); q.cells("'Sheet1'!E5:F6");"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("B2:C3"); q.cells("'Sheet1 (1)'!D4:E5"); q.cells("F6:G7");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1'!A1:B2'); q.cells(''Sheet1 (1)'!C3:D4")"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("'Sheet1'!A1:B2'); q.cells(''Sheet1 (1)'!C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!A1:B2")"#.to_string(),
        };
        code.translate_cell_references(0, 0, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!A1:B2")"#,
            "Zero delta failed"
        );

        // Negative delta
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!C3:D4")"#.to_string(),
        };
        code.translate_cell_references(-1, -1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3")"#,
            "Negative delta failed"
        );

        // Whitespace variations
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells  (  "'Sheet1 (1)'!A1:B2"  )"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3"  )"#,
            "Whitespace variations failed"
        );

        // Non Python/JS languages should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: r#"A1"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(code.code, r#"A1"#, "Non Python/JS failed");

        // Python first_row_header=True
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!A1:B2", first_row_header=True)"#.to_string(),
        };
        code.translate_cell_references(1, 1, &sheet_id, &a1_context);
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3", first_row_header=True)"#,
            "first_row_header=True failed"
        );
    }

    #[test]
    fn test_replace_sheet_name_in_cell_references() {
        let sheet_id = SheetId::TEST;
        let a1_context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[("test.csv", &["city"], Rect::test_a1("A1:C3"))],
        );

        let mut code = CodeCellValue::new_python("q.cells('Sheet1!A1:B2')".to_string());
        code.replace_sheet_name_in_cell_references(
            "Sheet1",
            "Sheet1_new",
            &SheetId::new(),
            &a1_context,
        );
        assert_eq!(code.code, r#"q.cells("'Sheet1_new'!A1:B2")"#);
    }

    #[test]
    fn test_replace_table_name_in_cell_references() {
        let sheet_id = SheetId::TEST;
        let a1_context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[("simple", &["city"], Rect::test_a1("A1:C3"))],
        );

        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('simple[city]')".to_string(),
        };
        code.replace_table_name_in_cell_references(
            "simple",
            "test_new.csv",
            &sheet_id,
            &a1_context,
        );
        assert_eq!(code.code, r#"q.cells("test_new.csv[city]")"#);
    }

    #[test]
    fn test_replace_column_name_in_cell_references() {
        let sheet_id = SheetId::TEST;
        let a1_context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[("test.csv", &["city", "state"], Rect::test_a1("A1:C3"))],
        );

        // ColRange::Col
        let mut code = CodeCellValue::new_python("q.cells('test.csv[city]')".to_string());
        code.replace_column_name_in_cell_references(
            "test.csv",
            "city",
            "city_new",
            &sheet_id,
            &a1_context,
        );
        assert_eq!(code.code, r#"q.cells("test.csv[city_new]")"#);

        // ColRange::ColRange
        let mut code = CodeCellValue::new_python("q.cells('test.csv[[city]:[state]]')".to_string());
        code.replace_column_name_in_cell_references(
            "test.csv",
            "state",
            "state_new",
            &sheet_id,
            &a1_context,
        );
        assert_eq!(code.code, r#"q.cells("test.csv[[city]:[state_new]]")"#);

        // ColRange::ColToEnd
        let mut code = CodeCellValue::new_python("q.cells('test.csv[[city]:]')".to_string());
        code.replace_column_name_in_cell_references(
            "test.csv",
            "city",
            "city_new",
            &sheet_id,
            &a1_context,
        );
        assert_eq!(code.code, r#"q.cells("test.csv[[city_new]:]")"#);
    }
}
