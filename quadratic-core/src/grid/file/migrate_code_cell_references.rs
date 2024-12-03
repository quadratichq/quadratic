use std::collections::HashMap;

use lazy_static::lazy_static;
use regex::Regex;

use crate::{
    grid::{CodeCellLanguage, CodeCellValue, Grid, GridBounds},
    CellRefRange, CellValue, Pos, Rect,
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
}

pub fn migrate_code_cell_references(
    grid: &mut Grid,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    for sheet in grid.sheets.iter_mut() {
        let sheet_name = sheet.name.clone();
        if let GridBounds::NonEmpty(bounds) = sheet.bounds(false) {
            for x in bounds.x_range() {
                if let Some(column) = sheet.get_column_mut(x) {
                    for y in bounds.y_range() {
                        if let Some(CellValue::Code(code_cell)) = column.values.get_mut(&y) {
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
                                }
                                _ => {}
                            }
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
                    return format!("q.cells(\"{}{}\")", sheet_name, cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(3)
                        .map(|m| format!(", sheet=\"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cell({}, {}{})", x, y, sheet_name);
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
                    return format!("q.cells(\"{}{}\"", sheet_name, cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cells(({}, {}), ({}, {}){}", x0, y0, x1, y1, sheet_name);
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
                    return format!("q.cells(\"{}\")", cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    return format!("rel_cell({}, {})", x, y);
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
                    return format!("q.cells(\"{}{}\"", sheet_name, cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("rel_cells(({}, {}), ({}, {}){}", x0, y0, x1, y1, sheet_name);
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
                    return format!("q.cells(\"{}{}\")", sheet_name, cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(3)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cell({}, {}{})", x, y, sheet_name);
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
                    return format!("q.cells(\"{}{}\"", sheet_name, cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("cells({}, {}, {}, {}{}", x0, y0, x1, y1, sheet_name);
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
                    return format!("q.cells(\"{}\")", cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    return format!("relCell({}, {})", x, y);
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
                    return format!("q.cells(\"{}{}\"", sheet_name, cell_ref_range);
                }
                // update only coordinates in old api, as they are still negative and cannot be represented in A1 notation
                else {
                    // if sheet name is provided, keep it in the old api
                    let sheet_name = caps
                        .get(5)
                        .map(|m| format!(", \"{}\"", m.as_str()))
                        .unwrap_or_default();
                    return format!("relCells({}, {}, {}, {}{}", x0, y0, x1, y1, sheet_name);
                }
            }

            // if unable to parse, return the original string
            full_match.to_string()
        })
        .to_string();
}

#[cfg(test)]
#[serial_test::parallel]
mod test {}
