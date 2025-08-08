use std::{collections::HashMap, ops::Range};

use lazy_static::lazy_static;
use regex::Regex;

use crate::{
    CellValue, Pos, Rect, RefError, Spanned,
    a1::{
        A1Context, CellRefCoord, CellRefRange, RefRangeBounds, SheetCellRefRange, quote_sheet_name,
    },
    formulas::find_cell_references,
    grid::{CodeCellLanguage, CodeCellValue, Grid, GridBounds, SheetId},
};

const PYTHON_C_CELL_GETCELL_REGEX: &str = r#"\b(?:c|cell|getCell)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*(?:sheet\s*=\s*)?['"`]([^'"`]+)['"`]\s*)?\)"#;
const PYTHON_CELLS_GETCELLS_REGEX: &str = r#"\b(?:cells|getCells)\s*\(\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*,\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*(?:,\s*(?:sheet\s*=\s*)?['"`]([^'"`]*)['"`]\s*)?"#;
const PYTHON_RC_RELCELL_REGEX: &str = r#"\b(?:rc|rel_cell)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)"#;
const PYTHON_RELCELLS_REGEX: &str = r#"\b(?:rel_cells)\s*\(\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*,\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*(?:,\s*(?:sheet\s*=\s*)?['"`]([^'"`]*)['"`]\s*)?"#;

const JAVASCRIPT_C_CELL_GETCELL_REGEX: &str =
    r#"\b(?:c|cell|getCell)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*['"`]([^'"`]+)['"`]\s*)?\)"#;
const JAVASCRIPT_CELLS_GETCELLS_REGEX: &str = r#"\b(?:cells|getCells)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*['"`]([^'"`]*)['"`]\s*)?"#;
const JAVASCRIPT_RC_RELCELL_REGEX: &str = r#"\b(?:rc|relCell)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)"#;
const JAVASCRIPT_RELCELLS_REGEX: &str = r#"\b(?:relCells)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*['"`]([^'"`]*)['"`]\s*)?"#;

const POS_REGEX: &str = r#"\bpos\s*\(\s*\)"#;

lazy_static! {
    static ref PYTHON_C_CELL_GETCELL_REGEX_COMPILED: Regex =
        Regex::new(PYTHON_C_CELL_GETCELL_REGEX)
            .expect("Failed to compile PYTHON_C_CELL_GETCELL_REGEX");
    static ref PYTHON_CELLS_GETCELLS_REGEX_COMPILED: Regex =
        Regex::new(PYTHON_CELLS_GETCELLS_REGEX)
            .expect("Failed to compile PYTHON_CELLS_GETCELLS_REGEX");
    static ref PYTHON_RC_RELCELL_REGEX_COMPILED: Regex =
        Regex::new(PYTHON_RC_RELCELL_REGEX).expect("Failed to compile PYTHON_RC_RELCELL_REGEX");
    static ref PYTHON_RELCELLS_REGEX_COMPILED: Regex =
        Regex::new(PYTHON_RELCELLS_REGEX).expect("Failed to compile PYTHON_RELCELLS_REGEX");
    static ref JAVASCRIPT_C_CELL_GETCELL_REGEX_COMPILED: Regex =
        Regex::new(JAVASCRIPT_C_CELL_GETCELL_REGEX)
            .expect("Failed to compile JAVASCRIPT_C_CELL_GETCELL_REGEX");
    static ref JAVASCRIPT_CELLS_GETCELLS_REGEX_COMPILED: Regex =
        Regex::new(JAVASCRIPT_CELLS_GETCELLS_REGEX)
            .expect("Failed to compile JAVASCRIPT_CELLS_GETCELLS_REGEX");
    static ref JAVASCRIPT_RC_RELCELL_REGEX_COMPILED: Regex =
        Regex::new(JAVASCRIPT_RC_RELCELL_REGEX)
            .expect("Failed to compile JAVASCRIPT_RC_RELCELL_REGEX");
    static ref JAVASCRIPT_RELCELLS_REGEX_COMPILED: Regex =
        Regex::new(JAVASCRIPT_RELCELLS_REGEX).expect("Failed to compile JAVASCRIPT_RELCELLS_REGEX");
    static ref POS_REGEX_COMPILED: Regex =
        Regex::new(POS_REGEX).expect("Failed to compile POS_REGEX");
}

pub fn replace_formula_a1_references_to_rc(grid: &mut Grid) {
    let a1_context = grid.expensive_make_a1_context();
    for (sheet_id, sheet) in grid.sheets.iter_mut() {
        sheet.migration_recalculate_bounds(&a1_context);
        sheet.columns.migration_regenerate_has_cell_value();

        if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
            for x in bounds.x_range() {
                if sheet.get_column(x).is_none() {
                    continue;
                }
                for y in bounds.y_range() {
                    if let Some(CellValue::Code(code_cell)) = sheet.cell_value_mut((x, y).into())
                        && code_cell.language == CodeCellLanguage::Formula
                    {
                        code_cell.code = migration_convert_a1_to_rc(
                            &code_cell.code,
                            &a1_context,
                            *sheet_id,
                            (x + 1, y).into(),
                        );
                    }
                }
            }
        }
    }
}

pub fn replace_formula_rc_references_to_a1(grid: &mut Grid) {
    let a1_context = grid.expensive_make_a1_context();
    for (sheet_id, sheet) in grid.sheets.iter_mut() {
        sheet.migration_recalculate_bounds(&a1_context);
        sheet.columns.migration_regenerate_has_cell_value();

        if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
            for x in bounds.x_range() {
                if sheet.get_column(x).is_none() {
                    continue;
                }
                for y in bounds.y_range() {
                    if let Some(CellValue::Code(code_cell)) = sheet.cell_value_mut((x, y).into()) {
                        if code_cell.language == CodeCellLanguage::Formula {
                            code_cell.code = migration_convert_rc_to_a1(
                                &code_cell.code,
                                &a1_context,
                                *sheet_id,
                                (x, y).into(),
                            );
                        }
                    }
                }
            }
        }
    }
}

fn migration_convert_a1_to_rc(
    source: &str,
    ctx: &A1Context,
    sheet_id: SheetId,
    base_pos: Pos,
) -> String {
    let replace_fn = |range_ref: SheetCellRefRange| {
        Ok(range_ref.migration_to_rc_string(Some(sheet_id), ctx, base_pos))
    };
    migration_replace_cell_range_references(source, ctx, sheet_id, base_pos, replace_fn)
}

fn migration_convert_rc_to_a1(
    source: &str,
    ctx: &A1Context,
    sheet_id: SheetId,
    base_pos: Pos,
) -> String {
    let replace_fn = |range_ref: SheetCellRefRange| Ok(range_ref.to_a1_string(Some(sheet_id), ctx));
    migration_replace_cell_range_references(source, ctx, sheet_id, base_pos, replace_fn)
}

fn migration_replace_cell_range_references(
    source: &str,
    ctx: &A1Context,
    sheet_id: SheetId,
    base_pos: Pos,
    replace_fn: impl Fn(SheetCellRefRange) -> Result<String, RefError>,
) -> String {
    let spans = find_cell_references(source, ctx, sheet_id, Some(base_pos));
    let mut replaced = source.to_string();

    // replace in reverse order to preserve previous span indexes into string
    spans
        .into_iter()
        .rev()
        .for_each(|spanned: Spanned<Result<SheetCellRefRange, RefError>>| {
            let Spanned { span, inner } = spanned;
            let new_str = match inner.and_then(&replace_fn) {
                Ok(new_ref) => new_ref,
                Err(RefError) => RefError.to_string(),
            };
            replaced.replace_range::<Range<usize>>(span.into(), &new_str);
        });

    replaced
}

impl SheetCellRefRange {
    /// Returns an RC-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    fn migration_to_rc_string(
        &self,
        default_sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        base_pos: Pos,
    ) -> String {
        if self.needs_sheet_name(default_sheet_id) {
            if let Some(sheet_name) = a1_context.try_sheet_id(self.sheet_id) {
                return format!(
                    "{}!{}",
                    quote_sheet_name(sheet_name),
                    self.cells.migration_to_rc_string(base_pos),
                );
            }
        }
        self.cells.migration_to_rc_string(base_pos)
    }
}

impl CellRefRange {
    /// Converts the reference to a string, preferring RC notation.
    fn migration_to_rc_string(&self, base_pos: Pos) -> String {
        match self {
            CellRefRange::Sheet { range } => range.migration_to_rc_string(base_pos),
            CellRefRange::Table { range } => range.to_string(),
        }
    }
}

impl RefRangeBounds {
    /// Returns an R[1]C[1]-style reference relative to the given position.
    fn migration_to_rc_string(&self, base_pos: Pos) -> String {
        let start_col = self.start.col.migration_to_rc_string(base_pos.x);
        let start_row = self.start.row.migration_to_rc_string(base_pos.y);
        let end_col = self.end.col.migration_to_rc_string(base_pos.x);
        let end_row = self.end.row.migration_to_rc_string(base_pos.y);
        if *self == Self::ALL {
            "*".to_string()
        } else if self.is_col_range() {
            if self.start.col == self.end.col {
                format!("C{start_col}")
            } else {
                format!("C{start_col}:C{end_col}")
            }
        } else if self.is_row_range() {
            // handle special case of An: (show as An: instead of n:)
            if self.end.col.is_unbounded()
                && self.end.row.is_unbounded()
                && self.start.col.coord == 1
            {
                format!("R{start_row}:")
            } else {
                format!("R{start_row}:R{end_row}")
            }
        } else if self.start == self.end {
            format!("R{start_row}C{start_col}")
        } else {
            format!("R{start_row}C{start_col}:R{end_row}C{end_col}")
        }
    }
}

impl CellRefCoord {
    /// Returns the number as a string for use in RC-style notation.
    ///
    /// - If the coordinate is relative, returns a string containing the number
    ///   surrounded by square brackets.
    /// - If the coordinate is absolute, returns a string containing the number.
    fn migration_to_rc_string(self, base_coord: i64) -> String {
        match self.is_absolute {
            true => format!("{{{}}}", self.coord),
            false => format!("[{}]", self.coord.saturating_sub(base_coord)), // when changing to `u64`, this MUST stay `i64`
        }
    }
}

pub fn migrate_code_cell_references(
    grid: &mut Grid,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    let a1_context = grid.expensive_make_a1_context();
    for sheet in grid.sheets.values_mut() {
        sheet.migration_recalculate_bounds(&a1_context);
        sheet.columns.migration_regenerate_has_cell_value();

        let sheet_name = sheet.name.clone();
        if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
            for x in bounds.x_range() {
                if sheet.get_column(x).is_none() {
                    continue;
                }
                for y in bounds.y_range() {
                    if let Some(CellValue::Code(code_cell)) = sheet.cell_value_mut((x, y).into()) {
                        match code_cell.language {
                            CodeCellLanguage::Python => {
                                migrate_python_c_cell_getcell(
                                    code_cell,
                                    &sheet_name,
                                    shifted_offsets,
                                );
                                migrate_python_cells_getcells(
                                    code_cell,
                                    &sheet_name,
                                    shifted_offsets,
                                );
                                migrate_python_rc_relcell(code_cell, (x, y).into());
                                migrate_python_relcells(code_cell, (x, y).into());
                                migrate_python_javascript_pos(code_cell);
                            }
                            CodeCellLanguage::Javascript => {
                                migrate_javascript_c_cell_getcell(
                                    code_cell,
                                    &sheet_name,
                                    shifted_offsets,
                                );
                                migrate_javascript_cells_getcells(
                                    code_cell,
                                    &sheet_name,
                                    shifted_offsets,
                                );
                                migrate_javascript_rc_relcell(code_cell, (x, y).into());
                                migrate_javascript_relcells(code_cell, (x, y).into());
                                migrate_python_javascript_pos(code_cell);
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }
}

fn migrate_python_c_cell_getcell(
    code_cell: &mut CodeCellValue,
    code_cell_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_cell.language != CodeCellLanguage::Python {
        return;
    }

    code_cell.code = PYTHON_C_CELL_GETCELL_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // get the sheet name from the match, or use the current sheet name if not provided
                let sheet_name = caps
                    .get(3)
                    .map(|m| m.as_str())
                    .unwrap_or(code_cell_sheet_name);

                // get the shift offsets for the sheet having the reference
                let (delta_x, delta_y) = shifted_offsets.get(sheet_name).unwrap_or(&(0, 0));

                // apply the shift to the reference coordinates
                x += delta_x;
                y += delta_y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x > 0 && y > 0 {
                    // if sheet name is provided, append ! and wrap it in quotes for A1 notation
                    let sheet_name = caps
                        .get(3)
                        .map(|m| format!("\'{}\'!", m.as_str()))
                        .unwrap_or_default();
                    let cell_ref_range = CellRefRange::new_relative_pos((x, y).into());
                    return format!("q.cells(\"{sheet_name}{cell_ref_range}\")");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(3)
                        .map(|m| format!(", sheet=\"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cell({x}, {y}{sheet_name})");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_python_cells_getcells(
    code_cell: &mut CodeCellValue,
    code_cell_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_cell.language != CodeCellLanguage::Python {
        return;
    }

    code_cell.code = PYTHON_CELLS_GETCELLS_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x0 = &caps[1]; // x0 coordinate of first tuple
            let y0 = &caps[2]; // y0 coordinate of first tuple
            let x1 = &caps[3]; // x1 coordinate of second tuple
            let y1 = &caps[4]; // y1 coordinate of second tuple

            if let (Ok(mut x0), Ok(mut y0), Ok(mut x1), Ok(mut y1)) = (
                x0.parse::<i64>(),
                y0.parse::<i64>(),
                x1.parse::<i64>(),
                y1.parse::<i64>(),
            ) {
                // get the sheet name from the match, or use the current sheet name if not provided
                let sheet_name = caps
                    .get(5)
                    .map(|m| m.as_str())
                    .unwrap_or(code_cell_sheet_name);

                // get the shift offsets for the sheet having the reference
                let (delta_x, delta_y) = shifted_offsets.get(sheet_name).unwrap_or(&(0, 0));

                // apply the shift to the reference coordinates
                x0 += delta_x;
                y0 += delta_y;
                x1 += delta_x;
                y1 += delta_y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x0 > 0 && y0 > 0 && x1 > 0 && y1 > 0 {
                    // if sheet name is provided, append ! and wrap it in quotes for A1 notation
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!("\'{}\'!", m.as_str()))
                        .unwrap_or_default();
                    let cell_ref_range = CellRefRange::new_relative_rect(Rect::new(x0, y0, x1, y1));
                    return format!("q.cells(\"{sheet_name}{cell_ref_range}\"");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cells(({x0}, {y0}), ({x1}, {y1}){sheet_name}");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_python_rc_relcell(code_cell: &mut CodeCellValue, code_cell_pos: Pos) {
    if code_cell.language != CodeCellLanguage::Python {
        return;
    }

    code_cell.code = PYTHON_RC_RELCELL_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // apply code cell position to the reference delta coordinates
                x += code_cell_pos.x;
                y += code_cell_pos.y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x > 0 && y > 0 {
                    let cell_ref_range = CellRefRange::new_relative_pos((x, y).into());
                    return format!("q.cells(\"{cell_ref_range}\")");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    return format!("rel_cell({x}, {y})");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_python_relcells(code_cell: &mut CodeCellValue, code_cell_pos: Pos) {
    if code_cell.language != CodeCellLanguage::Python {
        return;
    }

    code_cell.code = PYTHON_RELCELLS_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x0 = &caps[1]; // x0 coordinate of first tuple
            let y0 = &caps[2]; // y0 coordinate of first tuple
            let x1 = &caps[3]; // x1 coordinate of second tuple
            let y1 = &caps[4]; // y1 coordinate of second tuple

            if let (Ok(mut x0), Ok(mut y0), Ok(mut x1), Ok(mut y1)) = (
                x0.parse::<i64>(),
                y0.parse::<i64>(),
                x1.parse::<i64>(),
                y1.parse::<i64>(),
            ) {
                // apply code cell position to the reference delta coordinates
                x0 += code_cell_pos.x;
                y0 += code_cell_pos.y;
                x1 += code_cell_pos.x;
                y1 += code_cell_pos.y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x0 > 0 && y0 > 0 && x1 > 0 && y1 > 0 {
                    // if sheet name is provided, append ! and wrap it in quotes for A1 notation
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!("\'{}\'!", m.as_str()))
                        .unwrap_or_default();
                    let cell_ref_range = CellRefRange::new_relative_rect(Rect::new(x0, y0, x1, y1));
                    return format!("q.cells(\"{sheet_name}{cell_ref_range}\"");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("rel_cells(({x0}, {y0}), ({x1}, {y1}){sheet_name}");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_javascript_c_cell_getcell(
    code_cell: &mut CodeCellValue,
    code_cell_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_cell.language != CodeCellLanguage::Javascript {
        return;
    }

    code_cell.code = JAVASCRIPT_C_CELL_GETCELL_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // get the sheet name from the match, or use the current sheet name if not provided
                let sheet_name = caps
                    .get(3)
                    .map(|m| m.as_str())
                    .unwrap_or(code_cell_sheet_name);

                // get the shift offsets for the sheet having the reference
                let (delta_x, delta_y) = shifted_offsets.get(sheet_name).unwrap_or(&(0, 0));

                // apply the shift to the reference coordinates
                x += delta_x;
                y += delta_y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x > 0 && y > 0 {
                    // if sheet name is provided, append ! and wrap it in quotes for A1 notation
                    let sheet_name = caps
                        .get(3)
                        .map(|m| format!("\'{}\'!", m.as_str()))
                        .unwrap_or_default();
                    let cell_ref_range = CellRefRange::new_relative_pos((x, y).into());
                    return format!("q.cells(\"{sheet_name}{cell_ref_range}\")");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(3)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cell({x}, {y}{sheet_name})");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_javascript_cells_getcells(
    code_cell: &mut CodeCellValue,
    code_cell_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_cell.language != CodeCellLanguage::Javascript {
        return;
    }

    code_cell.code = JAVASCRIPT_CELLS_GETCELLS_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x0 = &caps[1]; // x0 coordinate of first tuple
            let y0 = &caps[2]; // y0 coordinate of first tuple
            let x1 = &caps[3]; // x1 coordinate of second tuple
            let y1 = &caps[4]; // y1 coordinate of second tuple

            if let (Ok(mut x0), Ok(mut y0), Ok(mut x1), Ok(mut y1)) = (
                x0.parse::<i64>(),
                y0.parse::<i64>(),
                x1.parse::<i64>(),
                y1.parse::<i64>(),
            ) {
                // get the sheet name from the match, or use the current sheet name if not provided
                let sheet_name = caps
                    .get(5)
                    .map(|m| m.as_str())
                    .unwrap_or(code_cell_sheet_name);

                // get the shift offsets for the sheet having the reference
                let (delta_x, delta_y) = shifted_offsets.get(sheet_name).unwrap_or(&(0, 0));

                // apply the shift to the reference coordinates
                x0 += delta_x;
                y0 += delta_y;
                x1 += delta_x;
                y1 += delta_y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x0 > 0 && y0 > 0 && x1 > 0 && y1 > 0 {
                    // if sheet name is provided, append ! and wrap it in quotes for A1 notation
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!("\'{}\'!", m.as_str()))
                        .unwrap_or_default();
                    let cell_ref_range = CellRefRange::new_relative_rect(Rect::new(x0, y0, x1, y1));
                    return format!("q.cells(\"{sheet_name}{cell_ref_range}\"");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cells({x0}, {y0}, {x1}, {y1}{sheet_name}");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_javascript_rc_relcell(code_cell: &mut CodeCellValue, code_cell_pos: Pos) {
    if code_cell.language != CodeCellLanguage::Javascript {
        return;
    }

    code_cell.code = JAVASCRIPT_RC_RELCELL_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // apply code cell position to the reference delta coordinates
                x += code_cell_pos.x;
                y += code_cell_pos.y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x > 0 && y > 0 {
                    let cell_ref_range = CellRefRange::new_relative_pos((x, y).into());
                    return format!("q.cells(\"{cell_ref_range}\")");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    return format!("relCell({x}, {y})");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_javascript_relcells(code_cell: &mut CodeCellValue, code_cell_pos: Pos) {
    if code_cell.language != CodeCellLanguage::Javascript {
        return;
    }

    code_cell.code = JAVASCRIPT_RELCELLS_REGEX_COMPILED
        .replace_all(&code_cell.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x0 = &caps[1]; // x0 coordinate of first tuple
            let y0 = &caps[2]; // y0 coordinate of first tuple
            let x1 = &caps[3]; // x1 coordinate of second tuple
            let y1 = &caps[4]; // y1 coordinate of second tuple

            if let (Ok(mut x0), Ok(mut y0), Ok(mut x1), Ok(mut y1)) = (
                x0.parse::<i64>(),
                y0.parse::<i64>(),
                x1.parse::<i64>(),
                y1.parse::<i64>(),
            ) {
                // apply code cell position to the reference delta coordinates
                x0 += code_cell_pos.x;
                y0 += code_cell_pos.y;
                x1 += code_cell_pos.x;
                y1 += code_cell_pos.y;

                // migrate to new q.cells() api with equivalent a1 notation of reference coordinates
                if x0 > 0 && y0 > 0 && x1 > 0 && y1 > 0 {
                    // if sheet name is provided, append ! and wrap it in quotes for A1 notation
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!("\'{}\'!", m.as_str()))
                        .unwrap_or_default();
                    let cell_ref_range = CellRefRange::new_relative_rect(Rect::new(x0, y0, x1, y1));
                    return format!("q.cells(\"{sheet_name}{cell_ref_range}\"");
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("relCells({x0}, {y0}, {x1}, {y1}{sheet_name}");
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

fn migrate_python_javascript_pos(code_cell: &mut CodeCellValue) {
    if code_cell.language != CodeCellLanguage::Python
        && code_cell.language != CodeCellLanguage::Javascript
    {
        return;
    }

    code_cell.code = POS_REGEX_COMPILED
        .replace_all(&code_cell.code, |_: &regex::Captures<'_>| "q.pos()")
        .to_string();
}

#[cfg(test)]
mod test {
    use proptest::prelude::*;

    use std::collections::HashMap;

    use super::*;

    fn create_code_cell(language: CodeCellLanguage, code: &str) -> CodeCellValue {
        CodeCellValue {
            language,
            code: code.to_string(),
        }
    }

    proptest! {
        #[test]
        fn proptest_ref_range_bounds_parsing(ref_range_bounds: RefRangeBounds) {
            let base_pos = Pos::new(10, 15);

            // We skip tests where start = end since we remove the end when parsing
            if ref_range_bounds.end != ref_range_bounds.start {
                assert_eq!(ref_range_bounds, RefRangeBounds::from_str(&ref_range_bounds.to_string(), None).unwrap());
                assert_eq!(ref_range_bounds, RefRangeBounds::from_str(&ref_range_bounds.to_string(), Some(base_pos)).unwrap());
            }

            assert_eq!(ref_range_bounds, RefRangeBounds::from_str(&ref_range_bounds.migration_to_rc_string(base_pos), Some(base_pos)).unwrap());
        }

          #[test]
        fn proptest_cell_ref_range_parsing(cell_ref_range: CellRefRange) {
            if matches!(cell_ref_range, CellRefRange::Table { .. }) {
                return Ok(());
            }
            let context = A1Context::default();

            let base_pos = Pos::new(10, 15);
            let a1_string = cell_ref_range.to_string();
            let rc_string = cell_ref_range.migration_to_rc_string(base_pos);
            let expected = (cell_ref_range, None);

            assert_eq!(expected, CellRefRange::parse(&a1_string, &context, None).unwrap());
            assert_eq!(expected, CellRefRange::parse(&a1_string, &context, Some(base_pos)).unwrap());
            assert_eq!(expected, CellRefRange::parse(&rc_string, &context, Some(base_pos)).unwrap());
        }
    }

    #[test]
    fn test_convert_rc_to_a1() {
        let ctx = A1Context::test(&[], &[]);
        let src = "SUM(R[1]C[2])
        + SUM(R[2]C[4])";
        let expected = "SUM(C2)
        + SUM(E3)";

        let replaced = migration_convert_rc_to_a1(src, &ctx, SheetId::TEST, pos![A1]);
        assert_eq!(replaced, expected);
    }

    #[test]
    fn test_convert_a1_to_rc() {
        let ctx = A1Context::test(&[], &[]);
        let src = "SUM(A$1)
        + SUM($B3)";
        let expected = "SUM(R{1}C[0])
        + SUM(R[2]C{2})";

        let replaced = migration_convert_a1_to_rc(src, &ctx, SheetId::TEST, pos![A1]);
        assert_eq!(expected, replaced);
    }

    #[test]
    fn test_python_c_cell_getcell_migration() {
        let mut shifted_offsets = HashMap::new();
        shifted_offsets.insert("Sheet1".to_string(), (1, 1));
        shifted_offsets.insert("Sheet 2".to_string(), (2, 2));

        let test_cases = vec![
            // Basic cell reference
            ("cell(1, 2)", "q.cells(\"B3\")", "Sheet1"),
            // With sheet name
            (
                "cell(1, 2, sheet=\"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4\")",
                "Sheet1",
            ),
            // Negative coordinates (should stay in old format)
            ("cell(-1, 2)", "cell(0, 3)", "Sheet1"),
            // Invalid format (should remain unchanged)
            ("cell(invalid, 2)", "cell(invalid, 2)", "Sheet1"),
            // Basic cell reference
            ("c(1, 2)", "q.cells(\"B3\")", "Sheet1"),
            // With sheet name
            (
                "c(1, 2, sheet=\"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4\")",
                "Sheet1",
            ),
            // Negative coordinates (should stay in old format)
            ("c(-1, 2)", "cell(0, 3)", "Sheet1"),
            // Invalid format (should remain unchanged)
            ("c(invalid, 2)", "c(invalid, 2)", "Sheet1"),
            // Basic cell reference
            ("getCell(1, 2)", "q.cells(\"B3\")", "Sheet1"),
            // With sheet name
            (
                "getCell(1, 2, sheet=\"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4\")",
                "Sheet1",
            ),
            // Negative coordinates (should stay in old format)
            ("getCell(-1, 2)", "cell(0, 3)", "Sheet1"),
            // Invalid format (should remain unchanged)
            ("getCell(invalid, 2)", "getCell(invalid, 2)", "Sheet1"),
        ];

        for (input, expected, sheet_name) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Python, input);
            migrate_python_c_cell_getcell(&mut code_cell, sheet_name, &shifted_offsets);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_python_cells_getcells_migration() {
        let mut shifted_offsets = HashMap::new();
        shifted_offsets.insert("Sheet1".to_string(), (1, 1));
        shifted_offsets.insert("Sheet 2".to_string(), (2, 2));

        let test_cases = vec![
            // Basic range
            ("cells((1, 2), (3, 4))", "q.cells(\"B3:D5\")", "Sheet1"),
            // With sheet name
            (
                "cells((1, 2), (3, 4), \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4:E6\")",
                "Sheet1",
            ),
            // Negative coordinates
            ("cells((-1, 2), (3, 4))", "cells((0, 3), (4, 5))", "Sheet1"),
            // Basic range
            ("getCells((1, 2), (3, 4))", "q.cells(\"B3:D5\")", "Sheet1"),
            // With sheet name
            (
                "getCells((1, 2), (3, 4), \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4:E6\")",
                "Sheet1",
            ),
            // Negative coordinates
            (
                "getCells((-1, 2), (3, 4))",
                "cells((0, 3), (4, 5))",
                "Sheet1",
            ),
        ];

        for (input, expected, sheet_name) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Python, input);
            migrate_python_cells_getcells(&mut code_cell, sheet_name, &shifted_offsets);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_python_rc_relcell_migration() {
        let test_cases = vec![
            // Basic relative cell
            ("rc(1, 2)", "q.cells(\"B3\")", Pos::new(1, 1)),
            // Negative result
            ("rc(-2, -2)", "rel_cell(-1, -1)", Pos::new(1, 1)),
            // Alternative syntax
            ("rel_cell(1, 2)", "q.cells(\"B3\")", Pos::new(1, 1)),
        ];

        for (input, expected, pos) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Python, input);
            migrate_python_rc_relcell(&mut code_cell, pos);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_python_relcells_migration() {
        let test_cases = vec![
            // Basic relative cell
            (
                "rel_cells((1, 2), (3, 4))",
                "q.cells(\"B3:D5\")",
                Pos::new(1, 1),
            ),
            // with sheet name
            (
                "rel_cells((1, 2), (3, 4), \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4:E6\")",
                Pos::new(2, 2),
            ),
        ];

        for (input, expected, pos) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Python, input);
            migrate_python_relcells(&mut code_cell, pos);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_javascript_c_cell_getcell_migration() {
        let mut shifted_offsets = HashMap::new();
        shifted_offsets.insert("Sheet1".to_string(), (1, 1));
        shifted_offsets.insert("Sheet 2".to_string(), (2, 2));

        let test_cases = vec![
            // Basic cell reference
            ("cell(1, 2)", "q.cells(\"B3\")", "Sheet1"),
            // With sheet name
            (
                "cell(1, 2, \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4\")",
                "Sheet1",
            ),
            // Negative coordinates (should stay in old format)
            ("cell(-1, 2)", "cell(0, 3)", "Sheet1"),
            // Invalid format (should remain unchanged)
            ("cell(invalid, 2)", "cell(invalid, 2)", "Sheet1"),
            // Basic cell reference
            ("c(1, 2)", "q.cells(\"B3\")", "Sheet1"),
            // With sheet name
            (
                "c(1, 2, \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4\")",
                "Sheet1",
            ),
            // Negative coordinates (should stay in old format)
            ("c(-1, 2)", "cell(0, 3)", "Sheet1"),
            // Invalid format (should remain unchanged)
            ("c(invalid, 2)", "c(invalid, 2)", "Sheet1"),
            // Basic cell reference
            ("getCell(1, 2)", "q.cells(\"B3\")", "Sheet1"),
            // With sheet name
            (
                "getCell(1, 2, \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4\")",
                "Sheet1",
            ),
            // Negative coordinates (should stay in old format)
            ("getCell(-1, 2)", "cell(0, 3)", "Sheet1"),
            // Invalid format (should remain unchanged)
            ("getCell(invalid, 2)", "getCell(invalid, 2)", "Sheet1"),
        ];

        for (input, expected, sheet_name) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Javascript, input);
            migrate_javascript_c_cell_getcell(&mut code_cell, sheet_name, &shifted_offsets);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_javascript_cells_getcells_migration() {
        let mut shifted_offsets = HashMap::new();
        shifted_offsets.insert("Sheet1".to_string(), (1, 1));
        shifted_offsets.insert("Sheet 2".to_string(), (2, 2));

        let test_cases = vec![
            // Basic range
            ("cells(1, 2, 3, 4)", "q.cells(\"B3:D5\")", "Sheet1"),
            // With sheet name
            (
                "cells(1, 2, 3, 4, \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4:E6\")",
                "Sheet1",
            ),
            // Negative coordinates
            ("cells(-1, 2, 3, 4)", "cells(0, 3, 4, 5)", "Sheet1"),
            // Basic range
            ("getCells(1, 2, 3, 4)", "q.cells(\"B3:D5\")", "Sheet1"),
            // With sheet name
            (
                "getCells(1, 2, 3, 4, \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4:E6\")",
                "Sheet1",
            ),
            // Negative coordinates
            ("getCells(-1, 2, 3, 4)", "cells(0, 3, 4, 5)", "Sheet1"),
        ];

        for (input, expected, sheet_name) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Javascript, input);
            migrate_javascript_cells_getcells(&mut code_cell, sheet_name, &shifted_offsets);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_javascript_rc_relcell_migration() {
        let test_cases = vec![
            // Basic relative cell
            ("rc(1, 2)", "q.cells(\"B3\")", Pos::new(1, 1)),
            // Negative result
            ("rc(-2, -2)", "relCell(-1, -1)", Pos::new(1, 1)),
            // Alternative syntax
            ("relCell(1, 2)", "q.cells(\"B3\")", Pos::new(1, 1)),
        ];

        for (input, expected, pos) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Javascript, input);
            migrate_javascript_rc_relcell(&mut code_cell, pos);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_javascript_relcells_migration() {
        let test_cases = vec![
            // Basic relative cell
            ("relCells(1, 2, 3, 4)", "q.cells(\"B3:D5\")", Pos::new(1, 1)),
            // with sheet name
            (
                "relCells(1, 2, 3, 4, \"Sheet 2\")",
                "q.cells(\"'Sheet 2'!C4:E6\")",
                Pos::new(2, 2),
            ),
        ];

        for (input, expected, pos) in test_cases {
            let mut code_cell = create_code_cell(CodeCellLanguage::Javascript, input);
            migrate_javascript_relcells(&mut code_cell, pos);
            assert_eq!(code_cell.code, expected);
        }
    }

    #[test]
    fn test_pos_migration() {
        let test_cases = vec![
            ("pos()", "q.pos()", CodeCellLanguage::Python),
            ("pos()", "q.pos()", CodeCellLanguage::Javascript),
        ];

        for (input, expected, language) in test_cases {
            let mut code_cell = create_code_cell(language, input);
            migrate_python_javascript_pos(&mut code_cell);
            assert_eq!(code_cell.code, expected);
        }
    }
}
