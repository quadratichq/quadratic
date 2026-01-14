use std::ops::RangeInclusive;

use fancy_regex::Regex;
use lazy_static::lazy_static;

use crate::a1::{A1Context, SheetCellRefRange};
use crate::grid::{CodeCellLanguage, SheetId};
use crate::{RefError, SheetPos};

use super::CodeRun;

const Q_CELLS_A1_REGEX: &str = r#"\bq\.cells\s*\(\s*(['"`])(.*?)\1"#;

lazy_static! {
    static ref Q_CELLS_A1_REGEX_COMPILED: Regex =
        Regex::new(Q_CELLS_A1_REGEX).expect("Failed to compile Q_CELLS_A1_REGEX");
    pub static ref HANDLEBARS_REGEX_COMPILED: Regex =
        Regex::new(r#"\{\{(.*?)\}\}"#).expect("Failed to compile HANDLEBARS_REGEX");
}

impl CodeRun {
    /// Replaces `q.cells()` calls in Python and Javascript.
    ///
    /// Do not call this function unless `self.language.has_q_cells()`.
    fn replace_q_cells_a1_selection(
        &mut self,
        pos: SheetPos,
        a1_context: &A1Context,
        mut func: impl FnMut(SheetCellRefRange) -> Result<String, RefError>,
    ) {
        self.code = Q_CELLS_A1_REGEX_COMPILED
            .replace_all(&self.code, |caps: &fancy_regex::Captures<'_>| {
                let full_match = &caps[0]; // Capture the entire match
                let a1_str = &caps[2]; // Capture the first argument which is inside quotes

                match SheetCellRefRange::parse_at(a1_str, pos, a1_context) {
                    Ok(sheet_cell_ref_range) => {
                        let a1_str =
                            func(sheet_cell_ref_range).unwrap_or_else(|e: RefError| e.to_string());

                        // Replace only the first argument, keep the rest unchanged
                        format!(r#"q.cells("{a1_str}""#)
                    }
                    // If the cell reference is invalid, return the original string
                    Err(_) => full_match.to_string(),
                }
            })
            .to_string();
    }

    /// Replaces `{{ a1_str }}` calls in Connections.
    ///
    /// Do not call this function unless `self.language.has_handle_bars()`.
    fn replace_handle_bars_a1_selection(
        &mut self,
        pos: SheetPos,
        a1_context: &A1Context,
        mut func: impl FnMut(SheetCellRefRange) -> Result<String, RefError>,
    ) {
        self.code = HANDLEBARS_REGEX_COMPILED
            .replace_all(&self.code, |caps: &fancy_regex::Captures<'_>| {
                let full_match = &caps[0]; // Capture the entire match
                let a1_str = caps[1].trim(); // Capture the string inside the handlebars

                match SheetCellRefRange::parse_at(a1_str, pos, a1_context) {
                    Ok(sheet_cell_ref_range) => {
                        let a1_str =
                            func(sheet_cell_ref_range).unwrap_or_else(|e: RefError| e.to_string());

                        format!(r#"{{{{ {a1_str} }}}}"#)
                    }
                    // If the cell reference is invalid, return the original string
                    Err(_) => full_match.to_string(),
                }
            })
            .to_string();
    }

    /// Adjusts references in the code cell.
    ///
    /// `pos` is the position from which to parse the formula, while
    /// `new_default_sheet_id` is used to determine whether a reference needs an
    /// explicit sheet name.
    pub fn adjust_references(
        &mut self,
        new_default_sheet_id: SheetId,
        a1_context: &A1Context,
        pos: SheetPos,
        adjust: RefAdjust,
    ) {
        if !(adjust.is_no_op() && new_default_sheet_id == pos.sheet_id) {
            if self.language == CodeCellLanguage::Formula {
                self.code = crate::formulas::adjust_references(
                    &self.code,
                    new_default_sheet_id,
                    a1_context,
                    pos,
                    adjust,
                );
                // Clear cached AST since the code has changed
                self.formula_ast = None;
            } else if self.language.has_q_cells() {
                self.replace_q_cells_a1_selection(pos, a1_context, |cell_ref| {
                    Ok(cell_ref
                        .adjust(adjust)?
                        .to_a1_string(Some(new_default_sheet_id), a1_context))
                });
            } else if self.language.has_handle_bars() {
                self.replace_handle_bars_a1_selection(pos, a1_context, |cell_ref| {
                    Ok(cell_ref
                        .adjust(adjust)?
                        .to_a1_string(Some(new_default_sheet_id), a1_context))
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
            self.replace_q_cells_a1_selection(pos, old_a1_context, |cell_ref| {
                Ok(cell_ref.to_a1_string(Some(pos.sheet_id), new_a1_context))
            });
        } else if self.language.has_handle_bars() {
            self.replace_handle_bars_a1_selection(pos, old_a1_context, |cell_ref| {
                Ok(cell_ref.to_a1_string(Some(pos.sheet_id), new_a1_context))
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
                self.replace_q_cells_a1_selection(pos, a1_context, |mut cell_ref| {
                    cell_ref.replace_table_name(old_name, new_name);
                    Ok(cell_ref.to_a1_string(Some(pos.sheet_id), a1_context))
                });
            } else if self.language.has_handle_bars() {
                self.replace_handle_bars_a1_selection(pos, a1_context, |mut cell_ref| {
                    cell_ref.replace_table_name(old_name, new_name);
                    Ok(cell_ref.to_a1_string(Some(pos.sheet_id), a1_context))
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
                self.replace_q_cells_a1_selection(pos, a1_context, |mut cell_ref| {
                    cell_ref.replace_column_name(table_name, old_name, new_name);
                    Ok(cell_ref.to_a1_string(Some(pos.sheet_id), a1_context))
                });
            } else if self.language.has_handle_bars() {
                self.replace_handle_bars_a1_selection(pos, a1_context, |mut cell_ref| {
                    cell_ref.replace_column_name(table_name, old_name, new_name);
                    Ok(cell_ref.to_a1_string(Some(pos.sheet_id), a1_context))
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
    /// If specified, then only references to this sheet will be adjusted. If
    /// `None`, then all references will be adjusted.
    pub sheet_id: Option<SheetId>,

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
    /// Adjustment with no effect.
    pub const NO_OP: Self = Self {
        sheet_id: None,
        relative_only: false,
        dx: 0,
        dy: 0,
        x_start: 0,
        y_start: 0,
    };

    /// Returns whether the adjustment has no effect.
    pub fn is_no_op(self) -> bool {
        self.dx == 0 && self.dy == 0
    }

    /// Returns whether the adjustment affects a sheet.
    pub fn affects_sheet(self, sheet_id: SheetId) -> bool {
        self.sheet_id.is_none_or(|id| id == sheet_id)
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
            sheet_id: Some(sheet_id),
            relative_only: false,
            x_start: *range.start(),
            dx: range.count() as i64,
            ..Self::NO_OP
        }
    }
    /// Constructs an adjustment for deleting multiple columns at once.
    pub fn new_delete_columns(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            sheet_id: Some(sheet_id),
            relative_only: false,
            x_start: *range.start(),
            dx: -(range.count() as i64),
            ..Self::NO_OP
        }
    }
    /// Constructs an adjustment for inserting multiple rows at once.
    pub fn new_insert_rows(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            sheet_id: Some(sheet_id),
            relative_only: false,
            y_start: *range.start(),
            dy: range.count() as i64,
            ..Self::NO_OP
        }
    }
    /// Constructs an adjustment for deleting multiple rows at once.
    pub fn new_delete_rows(sheet_id: SheetId, range: RangeInclusive<i64>) -> Self {
        Self {
            sheet_id: Some(sheet_id),
            relative_only: false,
            y_start: *range.start(),
            dy: -(range.count() as i64),
            ..Self::NO_OP
        }
    }

    /// Constructs a simple translation that applies to all non -ve references.
    pub fn new_translate(dx: i64, dy: i64) -> Self {
        Self {
            relative_only: false,
            dx,
            dy,
            ..Self::NO_OP
        }
    }

    /// Constructs a simple translation that applies to all references greater than or equal to the start.
    pub fn new_translate_with_start(dx: i64, dy: i64, x_start: i64, y_start: i64) -> Self {
        Self {
            sheet_id: None,
            relative_only: false,
            dx,
            dy,
            x_start,
            y_start,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_update_cell_references_same_sheet() {
        let sheet_id = SheetId::new();
        let mut a1_context = A1Context::default();
        a1_context.sheet_map.insert_parts("This", sheet_id);
        a1_context.sheet_map.insert_parts("Other", SheetId::new());
        let pos = SheetPos {
            x: 100,
            y: 100,
            sheet_id,
        };

        let translate = |x, y| RefAdjust::new_translate(x, y);

        // Basic single reference
        let mut code = CodeRun::new_python("q.cells('A1:B2')".to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 1));
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Basic reference failed");

        // Absolute single reference
        let mut code = CodeRun::new_python("q.cells('$A$1:$B$2')".to_string());
        let mut ref_adjust = RefAdjust::new_translate(1, 1);
        ref_adjust.relative_only = true;
        code.adjust_references(sheet_id, &a1_context, pos, ref_adjust);
        assert_eq!(
            code.code, r#"q.cells("$A$1:$B$2")"#,
            "Absolute single reference failed"
        );

        // Absolute columns reference
        let mut code = CodeRun::new_python("q.cells('$A:$B')".to_string());
        let mut ref_adjust = RefAdjust::new_translate(1, 1);
        ref_adjust.relative_only = true;
        code.adjust_references(sheet_id, &a1_context, pos, ref_adjust);
        assert_eq!(
            code.code, r#"q.cells("$A:$B")"#,
            "Absolute columns reference failed"
        );

        // Absolute rows reference
        let mut code = CodeRun::new_python("q.cells('$1:$2')".to_string());
        let mut ref_adjust = RefAdjust::new_translate(1, 1);
        ref_adjust.relative_only = true;
        code.adjust_references(sheet_id, &a1_context, pos, ref_adjust);
        assert_eq!(
            code.code, r#"q.cells("$1:$2")"#,
            "Absolute rows reference failed"
        );

        // Multiple references in one line
        let mut code = CodeRun::new_python("x = q.cells('A1:B2') + q.cells('C3:D4')".to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"x = q.cells("B2:C3") + q.cells("D4:E5")"#,
            "Multiple references failed"
        );

        // Sheet names
        let mut code = CodeRun::new_python(
            "x = q.cells('This!A1:C2') + q.cells('Other!B3:E4') + q.cells('Nonexistent!E5:G6')"
                .to_string(),
        );
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 5));
        // Excel adjusts `E5:G6` to `F10:H11` but we aren't able to represent that
        assert_eq!(
            code.code,
            r#"x = q.cells("This!B6:D7") + q.cells("Other!C8:F9") + q.cells('Nonexistent!E5:G6')"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeRun::new_python(
            r#"q.cells("A1:B2"); q.cells("C3:D4"); q.cells("E5:F6");"#.to_string(),
        );
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("B2:C3"); q.cells("D4:E5"); q.cells("F6:G7");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeRun::new_python(r#"q.cells("A1:B2'); q.cells('C3:D4")"#.to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("A1:B2'); q.cells('C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeRun::new_python("q.cells('A1:B2')".to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(0, 0));
        assert_eq!(code.code, r#"q.cells('A1:B2')"#, "Zero delta failed");

        // Negative delta
        let mut code = CodeRun::new_python("q.cells('C3:D4')".to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(-1, -1));
        assert_eq!(code.code, r#"q.cells("B2:C3")"#, "Negative delta failed");

        // Whitespace variations
        let mut code = CodeRun::new_python("q.cells  (  'A1:B2'  )".to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("B2:C3"  )"#,
            "Whitespace variations failed"
        );

        // Formulas should get translated too
        let mut code = CodeRun::new_formula("A1".to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 1));
        assert_eq!(code.code, "B2", "Formula failed");

        // Python first_row_header=True
        let mut code =
            CodeRun::new_python(r#"q.cells("A1:B2", first_row_header=True)"#.to_string());
        code.adjust_references(sheet_id, &a1_context, pos, translate(1, 1));
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
        a1_context.sheet_map.insert_parts("Sheet1", sheet_id_init);
        a1_context.sheet_map.insert_parts("Sheet1 (1)", sheet_id_11);
        let pos = SheetPos {
            x: 100,
            y: 100,
            sheet_id: sheet_id_init,
        };

        let translate = |x, y| RefAdjust::new_translate(x, y);

        // Basic single reference
        let mut code = CodeRun::new_python(r#"q.cells("'Sheet1 (1)'!A1:B2")"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3")"#,
            "Basic reference failed"
        );

        let mut code =
            CodeRun::new_connection(r#"SELECT * FROM {{ 'Sheet1 (1)'!A1:B2 }}"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"SELECT * FROM {{ 'Sheet1 (1)'!B2:C3 }}"#,
            "Basic reference failed"
        );

        // Multiple references in one line
        let mut code = CodeRun::new_python(
            r#"x = q.cells("'Sheet1'!A1:B2") + q.cells("'Sheet1 (1)'!C3:D4")"#.to_string(),
        );
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"x = q.cells("Sheet1!B2:C3") + q.cells("'Sheet1 (1)'!D4:E5")"#,
            "Multiple references failed"
        );

        let mut code = CodeRun::new_connection(
            r#"SELECT * FROM {{ 'Sheet1'!A1:B2 }} FILTER(city = {{ 'Sheet1 (1)'!C3:D4 }})"#
                .to_string(),
        );
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code,
            r#"SELECT * FROM {{ Sheet1!B2:C3 }} FILTER(city = {{ 'Sheet1 (1)'!D4:E5 }})"#,
            "Multiple references failed"
        );

        // Different quote types
        let mut code = CodeRun::new_python(r#"q.cells("'Sheet1'!A1:B2"); q.cells("'Sheet1 (1)'!C3:D4"); q.cells("'Sheet1'!E5:F6");"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code,
            r#"q.cells("Sheet1!B2:C3"); q.cells("'Sheet1 (1)'!D4:E5"); q.cells("Sheet1!F6:G7");"#,
            "Quote types failed"
        );

        // Mismatched quotes should remain unchanged
        let mut code = CodeRun::new_python(
            r#"q.cells("'Sheet1'!A1:B2'); q.cells(''Sheet1 (1)'!C3:D4")"#.to_string(),
        );
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1'!A1:B2'); q.cells(''Sheet1 (1)'!C3:D4")"#,
            "Mismatched quotes failed"
        );

        // Zero delta should not change anything
        let mut code = CodeRun::new_python(r#"q.cells("'Sheet1 (1)'!A1:B2")"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(0, 0));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!A1:B2")"#,
            "Zero delta failed"
        );

        let mut code = CodeRun::new_connection(r#"SELECT * FROM {{ 'Sheet1'!A1:B2 }}"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(0, 0));
        assert_eq!(
            code.code, r#"SELECT * FROM {{ 'Sheet1'!A1:B2 }}"#,
            "Zero delta failed"
        );

        // Negative delta
        let mut code = CodeRun::new_python(r#"q.cells("'Sheet1 (1)'!C3:D4")"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(-1, -1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3")"#,
            "Negative delta failed"
        );

        let mut code =
            CodeRun::new_connection(r#"SELECT * FROM {{ 'Sheet1 (1)'!C3:D4 }}"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(-1, -1));
        assert_eq!(
            code.code, r#"SELECT * FROM {{ 'Sheet1 (1)'!B2:C3 }}"#,
            "Negative delta failed"
        );

        // Whitespace variations
        let mut code = CodeRun::new_python(r#"q.cells  (  "'Sheet1 (1)'!A1:B2"  )"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3"  )"#,
            "Whitespace variations failed"
        );

        let mut code =
            CodeRun::new_connection(r#"SELECT * FROM {{ 'Sheet1'!A1:B2    }} "#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"SELECT * FROM {{ Sheet1!B2:C3 }} "#,
            "Whitespace variations failed"
        );

        // Formulas should get translated too
        let mut code = CodeRun::new_formula(r#"A1 + 'Sheet1 (1)'!A1"#.to_string());
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(code.code, r#"B2 + 'Sheet1 (1)'!B2"#, "Formula failed");

        // Python first_row_header=True
        let mut code = CodeRun::new_python(
            r#"q.cells("'Sheet1 (1)'!A1:B2", first_row_header=True)"#.to_string(),
        );
        code.adjust_references(sheet_id_init, &a1_context, pos, translate(1, 1));
        assert_eq!(
            code.code, r#"q.cells("'Sheet1 (1)'!B2:C3", first_row_header=True)"#,
            "first_row_header=True failed"
        );
    }

    #[test]
    fn test_update_cell_references_with_sheet_id() {
        let id1 = SheetId::new();
        let id2 = SheetId::new();
        let id3 = SheetId::new();
        let a1_context = A1Context::test(&[("Sheet1", id1), ("Sheet2", id2), ("Sheet3", id3)], &[]);

        let mut code =
            CodeRun::new_formula(r#"A1 + Sheet1!A1 + Sheet2!A1 + Sheet3!A1"#.to_string());

        let pos = SheetPos {
            x: 2,
            y: 2,
            sheet_id: id1, // starting on Sheet1
        };
        let adjust = RefAdjust {
            sheet_id: Some(id2), // update Sheet2 references
            relative_only: false,
            dx: 5,
            dy: 3,
            x_start: 0,
            y_start: 0,
        };
        code.adjust_references(pos.sheet_id, &a1_context, pos, adjust);
        assert_eq!(code.code, r#"A1 + Sheet1!A1 + Sheet2!F4 + Sheet3!A1"#);

        let adjust = RefAdjust {
            sheet_id: Some(id1), // update Sheet1 references
            relative_only: false,
            dx: 1,
            dy: 2,
            x_start: 0,
            y_start: 0,
        };
        code.adjust_references(pos.sheet_id, &a1_context, pos, adjust);
        assert_eq!(code.code, r#"B3 + Sheet1!B3 + Sheet2!F4 + Sheet3!A1"#);
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

        let mut code = CodeRun::new_python(r#"q.cells("'Sheet1'!A1:B2")"#.to_string());
        code.replace_sheet_name_in_cell_references(&old_a1_context, &new_a1_context, pos);
        assert_eq!(code.code, r#"q.cells("'Sheet1_new'!A1:B2")"#);

        let mut code = CodeRun::new_connection(r#"SELECT * FROM {{ 'Sheet1'!A1:B2 }}"#.to_string());
        code.replace_sheet_name_in_cell_references(&old_a1_context, &new_a1_context, pos);
        assert_eq!(code.code, r#"SELECT * FROM {{ 'Sheet1_new'!A1:B2 }}"#);
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

        let mut code = CodeRun::new_python("q.cells('simple[city]')".to_string());
        code.replace_table_name_in_cell_references(&a1_context, pos, "simple", "test_new.csv");
        assert_eq!(code.code, r#"q.cells("test_new.csv[city]")"#);

        let mut code = CodeRun::new_connection(r#"SELECT * FROM {{ simple[city] }}"#.to_string());
        code.replace_table_name_in_cell_references(&a1_context, pos, "simple", "test_new.csv");
        assert_eq!(code.code, r#"SELECT * FROM {{ test_new.csv[city] }}"#);
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
        let mut code = CodeRun::new_python("q.cells('test.csv[city]')".to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "city",
            "city_new",
        );
        assert_eq!(code.code, r#"q.cells("test.csv[city_new]")"#);

        let mut code = CodeRun::new_connection(r#"SELECT * FROM {{ test.csv[city] }}"#.to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "city",
            "city_new",
        );
        assert_eq!(code.code, r#"SELECT * FROM {{ test.csv[city_new] }}"#);

        // ColRange::ColRange
        let mut code = CodeRun::new_python("q.cells('test.csv[[city]:[state]]')".to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "state",
            "state_new",
        );
        assert_eq!(code.code, r#"q.cells("test.csv[[city]:[state_new]]")"#);

        let mut code =
            CodeRun::new_connection(r#"SELECT * FROM {{ test.csv[[city]:[state]] }}"#.to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "state",
            "state_new",
        );
        assert_eq!(
            code.code,
            r#"SELECT * FROM {{ test.csv[[city]:[state_new]] }}"#
        );

        // ColRange::ColToEnd
        let mut code = CodeRun::new_python("q.cells('test.csv[[city]:]')".to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "city",
            "city_new",
        );
        assert_eq!(code.code, r#"q.cells("test.csv[[city_new]:]")"#);

        let mut code =
            CodeRun::new_connection(r#"SELECT * FROM {{ test.csv[[city]:] }}"#.to_string());
        code.replace_column_name_in_cell_references(
            &a1_context,
            pos,
            "test.csv",
            "city",
            "city_new",
        );
        assert_eq!(code.code, r#"SELECT * FROM {{ test.csv[[city_new]:] }}"#);
    }
}
