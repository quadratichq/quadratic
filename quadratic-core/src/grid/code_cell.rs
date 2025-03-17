use std::ops::RangeInclusive;

use fancy_regex::Regex;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

use crate::a1::{A1Context, A1Selection};
use crate::grid::CodeCellLanguage;
use crate::{RefError, SheetPos};

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
    /// Constructs a code cell.
    pub fn new(language: CodeCellLanguage, code: String) -> Self {
        Self { language, code }
    }

    /// Constructs a new Python code cell.
    #[cfg(test)]
    pub fn new_python(code: String) -> Self {
        Self {
            language: CodeCellLanguage::Python,
            code,
        }
    }

    /// Replaces `q.cells()` calls in Python and Javascript.
    ///
    /// Do not call this function unless `self.is_code_cell()`.
    fn replace_q_cells_a1_selection(
        &mut self,
        default_sheet_id: SheetId,
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

    /// Adjusts references in the code cell.
    pub fn adjust_references(&mut self, a1_context: &A1Context, pos: SheetPos, adjust: RefAdjust) {
        if !adjust.is_no_op() {
            if self.language == CodeCellLanguage::Formula {
                self.code = crate::formulas::adjust_references(&self.code, a1_context, pos, adjust);
            } else if self.language.has_q_cells() {
                self.replace_q_cells_a1_selection(pos.sheet_id, a1_context, |a1_selection| {
                    Ok(a1_selection
                        .adjust(adjust)?
                        .to_string(Some(pos.sheet_id), a1_context))
                });
            }
        }
    }

    /// Replaces the sheet name in the code cell references.
    pub fn replace_sheet_name_in_cell_references(
        &mut self,
        old_a1_context: &A1Context,
        new_a1_context: &A1Context,
        pos: SheetPos,
    ) {
        if self.language == CodeCellLanguage::Formula {
            self.code = crate::formulas::replace_sheet_name(
                &self.code,
                pos,
                old_a1_context,
                new_a1_context,
            );
        } else if self.language.has_q_cells() {
            self.replace_q_cells_a1_selection(pos.sheet_id, old_a1_context, |a1_selection| {
                Ok(a1_selection.to_string(Some(pos.sheet_id), new_a1_context))
            });
        }
    }

    /// Replaces a table name in the code cell references.
    pub fn replace_table_name_in_cell_references(
        &mut self,
        a1_context: &A1Context,
        pos: SheetPos,
        old_name: &str,
        new_name: &str,
    ) {
        if old_name != new_name {
            if self.language == CodeCellLanguage::Formula {
                self.code = crate::formulas::replace_table_name(
                    &self.code, a1_context, pos, old_name, new_name,
                );
            } else if self.language.has_q_cells() {
                self.replace_q_cells_a1_selection(pos.sheet_id, a1_context, |mut a1_selection| {
                    a1_selection.replace_table_name(old_name, new_name);
                    Ok(a1_selection.to_string(Some(pos.sheet_id), a1_context))
                });
            }
        }
    }

    /// Replaces column names in the code cell references.
    pub fn replace_column_name_in_cell_references(
        &mut self,
        a1_context: &A1Context,
        pos: SheetPos,
        table_name: &str,
        old_name: &str,
        new_name: &str,
    ) {
        if old_name != new_name {
            if self.language == CodeCellLanguage::Formula {
                self.code = crate::formulas::replace_column_name(
                    &self.code, a1_context, pos, table_name, old_name, new_name,
                );
            } else if self.language.has_q_cells() {
                self.replace_q_cells_a1_selection(pos.sheet_id, a1_context, |mut a1_selection| {
                    a1_selection.replace_column_name(table_name, old_name, new_name);
                    Ok(a1_selection.to_string(Some(pos.sheet_id), a1_context))
                });
            }
        }
    }
}

/// Adjustment to make to the coordinates of cell references in code cells.
///
/// Unbounded coordinates are always unmodified.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct RefAdjust {
    /// Only references to this sheet will be adjusted.
    pub sheet_id: SheetId,

    /// Whether to translate only relative references.
    ///
    /// If this is false, then relative and absolute references are both
    /// translated.
    pub relative_only: bool,

    /// Offset to add to each X coordinate.
    pub dx: i64,
    /// Offset to add to each Y coordinate.
    pub dy: i64,

    /// Column before which coordinates should remain unmodified, or 0 if all
    /// columns should be affected.
    ///
    /// This is used when adding/removing a column.
    pub x_start: i64,
    /// Row before which coordinates should remain unmodified, or 0 if all rows
    /// should be affected.
    ///
    /// This is used when adding/removing a row.
    pub y_start: i64,
}
impl RefAdjust {
    /// Returns whether the adjustment has no effect.
    pub fn is_no_op(self) -> bool {
        self.dx == 0 && self.dy == 0
    }

    /// Constructs an adjustment with no effect.
    pub fn new_no_op(sheet_id: SheetId) -> Self {
        Self {
            sheet_id,
            relative_only: false,
            dx: 0,
            dy: 0,
            x_start: 0,
            y_start: 0,
        }
    }

    /// Constructs an adjustment for inserting a column.
    pub fn new_insert_column(sheet_id: SheetId, column: i64) -> Self {
        Self::new_insert_columns(sheet_id, column..=column)
    }
    /// Constructs an adjustment for deleting a column.
    pub fn new_delete_column(sheet_id: SheetId, column: i64) -> Self {
        Self::new_delete_columns(sheet_id, column..=column)
    }
    /// Constructs an adjustment for inserting a row.
    pub fn new_insert_row(sheet_id: SheetId, row: i64) -> Self {
        Self::new_insert_rows(sheet_id, row..=row)
    }
    /// Constructs an adjustment for deleting a row.
    pub fn new_delete_row(sheet_id: SheetId, row: i64) -> Self {
        Self::new_delete_rows(sheet_id, row..=row)
    }

    /// Constructs an adjustment for inserting multiple columns at once.
    pub fn new_insert_columns(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            relative_only: false,
            x_start: *range.start(),
            dx: range.count() as i64,
            ..Self::new_no_op(sheet_id)
        }
    }
    /// Constructs an adjustment for deleting multiple columns at once.
    pub fn new_delete_columns(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            relative_only: false,
            x_start: *range.start(),
            dx: -(range.count() as i64),
            ..Self::new_no_op(sheet_id)
        }
    }
    /// Constructs an adjustment for inserting multiple rows at once.
    pub fn new_insert_rows(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            relative_only: false,
            y_start: *range.start(),
            dy: range.count() as i64,
            ..Self::new_no_op(sheet_id)
        }
    }
    /// Constructs an adjustment for deleting multiple rows at once.
    pub fn new_delete_rows(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            relative_only: false,
            y_start: *range.start(),
            dy: -(range.count() as i64),
            ..Self::new_no_op(sheet_id)
        }
    }

    /// Constructs a simple translation that applies to all references.
    pub fn new_translate(sheet_id: SheetId, dx: i64, dy: i64) -> Self {
        Self {
            relative_only: false,
            dx,
            dy,
            ..Self::new_no_op(sheet_id)
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
        let mut a1_context = A1Context::default();
        a1_context.sheet_map.insert_parts("This", sheet_id);
        a1_context.sheet_map.insert_parts("Other", SheetId::new());
        let pos = SheetPos {
            x: 100,
            y: 100,
            sheet_id,
        };

        let translate = |x, y| RefAdjust::new_translate(sheet_id, x, y);

        // Basic single reference
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Basic reference failed");

        // Multiple references in one line
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "x = q.cells('A1:B2') + q.cells('C3:D4')".to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"x = q.cells("B2:C3") + q.cells("D4:E5")"#,
            "Multiple references failed"
        );

        // Sheet names
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code:
                "x = q.cells('This!A1:C2') + q.cells('Other!B3:E4') + q.cells('Nonexistent!E5:G6')"
                    .to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 5));
        assert_eq!(
            code.code,
            r#"x = q.cells("B6:D7") + q.cells("Other!B3:E4") + q.cells('Nonexistent!E5:G6')"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2"); q.cells("C3:D4"); q.cells("E5:F6");"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("B2:C3"); q.cells("D4:E5"); q.cells("F6:G7");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2'); q.cells('C3:D4")"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("A1:B2'); q.cells('C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('A1:B2')".to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(0, 0));
        assert_eq!(code.code, r#"q.cells('A1:B2')"#, "Zero delta failed");

        // Negative delta
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('C3:D4')".to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(-1, -1));
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Negative delta failed");

        // Whitespace variations
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells  (  'A1:B2'  )".to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("B2:C3"  )"#,
            "Whitespace variations failed"
        );

        // Formulas should get translated too
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: "A1".to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(code.code, "B2", "Formula failed");

        // Python first_row_header=True
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("A1:B2", first_row_header=True)"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("B2:C3", first_row_header=True)"#,
            "first_row_header=True failed"
        );
    }

    #[test]
    fn test_update_cell_references_with_sheet_name() {
        let sheet_id_init = SheetId::new();
        let sheet_id_11 = SheetId::new();
        let mut a1_context = A1Context::default();
        a1_context.sheet_map.insert_test("Sheet1", sheet_id_init);
        a1_context.sheet_map.insert_test("Sheet1 (1)", sheet_id_11);
        let pos = SheetPos {
            x: 100,
            y: 100,
            sheet_id: sheet_id_init,
        };

        let translate = |x, y| RefAdjust::new_translate(sheet_id_11, x, y);

        // Basic single reference
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!A1:B2")"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3")"#,
            "Basic reference failed"
        );

        // Multiple references in one line
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"x = q.cells("'Sheet1'!A1:B2") + q.cells("'Sheet1 (1)'!C3:D4")"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"x = q.cells("'Sheet1'!A1:B2") + q.cells("'Sheet1 (1)'!D4:E5")"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1'!A1:B2"); q.cells("'Sheet1 (1)'!C3:D4"); q.cells("'Sheet1'!E5:F6");"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("A1:B2"); q.cells("'Sheet1 (1)'!D4:E5"); q.cells("E5:F6");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1'!A1:B2'); q.cells(''Sheet1 (1)'!C3:D4")"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1'!A1:B2'); q.cells(''Sheet1 (1)'!C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!A1:B2")"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(0, 0));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!A1:B2")"#,
            "Zero delta failed"
        );

        // Negative delta
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!C3:D4")"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(-1, -1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3")"#,
            "Negative delta failed"
        );

        // Whitespace variations
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells  (  "'Sheet1 (1)'!A1:B2"  )"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3"  )"#,
            "Whitespace variations failed"
        );

        // Formulas should get translated too
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: r#"A1"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(code.code, r#"B2"#, "Formula failed");

        // Python first_row_header=True
        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("'Sheet1 (1)'!A1:B2", first_row_header=True)"#.to_string(),
        };
        code.adjust_references(&a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3", first_row_header=True)"#,
            "first_row_header=True failed"
        );
    }

    #[test]
    fn test_replace_sheet_name_in_cell_references() {
        let changed_sheet_id = SheetId::new();
        let old_a1_context = A1Context::test(
            &[("Sheet1", changed_sheet_id)],
            &[("test.csv", &["city"], Rect::test_a1("A1:C3"))],
        );
        let mut new_a1_context = old_a1_context.clone();
        new_a1_context.sheet_map.remove_name("Sheet1");
        new_a1_context
            .sheet_map
            .insert_parts("Sheet1_new", changed_sheet_id);
        let pos = SheetPos {
            x: 100,
            y: 100,
            sheet_id: SheetId::new(),
        };

        let mut code = CodeCellValue::new_python(r#"q.cells("'Sheet1'!A1:B2")"#.to_string());
        code.replace_sheet_name_in_cell_references(&old_a1_context, &new_a1_context, pos);
        assert_eq!(code.code, r#"q.cells("'Sheet1_new'!A1:B2")"#);
    }

    #[test]
    fn test_replace_table_name_in_cell_references() {
        let sheet_id = SheetId::TEST;
        let a1_context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[("simple", &["city"], Rect::test_a1("A1:C3"))],
        );
        let pos = SheetPos {
            x: 100,
            y: 100,
            sheet_id,
        };

        let mut code = CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "q.cells('simple[city]')".to_string(),
        };

        code.replace_table_name_in_cell_references(&a1_context, pos, "simple", "test_new.csv");
        assert_eq!(code.code, r#"q.cells("test_new.csv[city]")"#);
    }

    #[test]
    fn test_replace_column_name_in_cell_references() {
        let sheet_id = SheetId::TEST;
        let a1_context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[("test.csv", &["city", "state"], Rect::test_a1("A1:C3"))],
        );
        let pos = SheetPos {
            x: 100,
            y: 100,
            sheet_id,
        };

        // ColRange::Col
        let mut code = CodeCellValue::new_python("q.cells('test.csv[city]')".to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "city",
            "city_new",
        );
        assert_eq!(code.code, r#"q.cells("test.csv[city_new]")"#);

        // ColRange::ColRange
        let mut code = CodeCellValue::new_python("q.cells('test.csv[[city]:[state]]')".to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "state",
            "state_new",
        );
        assert_eq!(code.code, r#"q.cells("test.csv[[city]:[state_new]]")"#);

        // ColRange::ColToEnd
        let mut code = CodeCellValue::new_python("q.cells('test.csv[[city]:]')".to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "city",
            "city_new",
        );
        assert_eq!(code.code, r#"q.cells("test.csv[[city_new]:]")"#);
    }
}
