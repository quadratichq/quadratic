use std::collections::HashMap;

use lazy_static::lazy_static;
use regex::Regex;

use crate::{
    CellValue, Pos, Rect,
    a1::CellRefRange,
    formulas::convert_a1_to_rc,
    grid::{CodeCellLanguage, CodeRun, Grid},
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

pub fn replace_formula_a1_references_to_r1c1(grid: &mut Grid) {
    let a1_context = grid.expensive_make_a1_context();
    for sheet in grid.sheets.values_mut() {
        // Migrate code runs in data_tables
        for (pos, code_run) in sheet.data_tables.migration_iter_code_runs_mut() {
            if code_run.language == CodeCellLanguage::Formula {
                code_run.code = convert_a1_to_rc(
                    &code_run.code,
                    &a1_context,
                    crate::SheetPos::new(sheet.id, pos.x + 1, pos.y),
                );
            }
        }

        // Migrate CellValue::Code cells in columns
        for (x, column) in sheet.columns.iter_mut() {
            for (y, cell_value) in column.values.iter_mut() {
                if let CellValue::Code(code_cell) = cell_value
                    && code_cell.code_run.language == CodeCellLanguage::Formula
                {
                    code_cell.code_run.code = convert_a1_to_rc(
                        &code_cell.code_run.code,
                        &a1_context,
                        crate::SheetPos::new(sheet.id, *x + 1, *y),
                    );
                }
            }
        }
    }
}

pub fn migrate_code_cell_references(
    grid: &mut Grid,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    for sheet in grid.sheets.values_mut() {
        let sheet_name = sheet.name.clone();

        // Migrate code runs in data_tables
        for (pos, code_run) in sheet.data_tables.migration_iter_code_runs_mut() {
            migrate_code_run(code_run, pos, &sheet_name, shifted_offsets);
        }

        // Migrate CellValue::Code cells in columns
        for (x, column) in sheet.columns.iter_mut() {
            for (y, cell_value) in column.values.iter_mut() {
                if let CellValue::Code(code_cell) = cell_value {
                    let pos = Pos { x: *x, y: *y };
                    migrate_code_run(&mut code_cell.code_run, pos, &sheet_name, shifted_offsets);
                }
            }
        }
    }
}

fn migrate_code_run(
    code_run: &mut CodeRun,
    pos: Pos,
    sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    match code_run.language {
        CodeCellLanguage::Python => {
            migrate_python_c_cell_getcell(code_run, sheet_name, shifted_offsets);
            migrate_python_cells_getcells(code_run, sheet_name, shifted_offsets);
            migrate_python_rc_relcell(code_run, pos);
            migrate_python_relcells(code_run, pos);
            migrate_python_javascript_pos(code_run);
        }
        CodeCellLanguage::Javascript => {
            migrate_javascript_c_cell_getcell(code_run, sheet_name, shifted_offsets);
            migrate_javascript_cells_getcells(code_run, sheet_name, shifted_offsets);
            migrate_javascript_rc_relcell(code_run, pos);
            migrate_javascript_relcells(code_run, pos);
            migrate_python_javascript_pos(code_run);
        }
        _ => {}
    }
}

fn migrate_python_c_cell_getcell(
    code_run: &mut CodeRun,
    code_run_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_run.language != CodeCellLanguage::Python {
        return;
    }

    code_run.code = PYTHON_C_CELL_GETCELL_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // get the sheet name from the match, or use the current sheet name if not provided
                let sheet_name = caps
                    .get(3)
                    .map(|m| m.as_str())
                    .unwrap_or(code_run_sheet_name);

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
    code_run: &mut CodeRun,
    code_run_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_run.language != CodeCellLanguage::Python {
        return;
    }

    code_run.code = PYTHON_CELLS_GETCELLS_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
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
                    .unwrap_or(code_run_sheet_name);

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

fn migrate_python_rc_relcell(code_run: &mut CodeRun, code_run_pos: Pos) {
    if code_run.language != CodeCellLanguage::Python {
        return;
    }

    code_run.code = PYTHON_RC_RELCELL_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // apply code cell position to the reference delta coordinates
                x += code_run_pos.x;
                y += code_run_pos.y;

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

fn migrate_python_relcells(code_run: &mut CodeRun, code_run_pos: Pos) {
    if code_run.language != CodeCellLanguage::Python {
        return;
    }

    code_run.code = PYTHON_RELCELLS_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
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
                x0 += code_run_pos.x;
                y0 += code_run_pos.y;
                x1 += code_run_pos.x;
                y1 += code_run_pos.y;

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
    code_run: &mut CodeRun,
    code_run_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_run.language != CodeCellLanguage::Javascript {
        return;
    }

    code_run.code = JAVASCRIPT_C_CELL_GETCELL_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // get the sheet name from the match, or use the current sheet name if not provided
                let sheet_name = caps
                    .get(3)
                    .map(|m| m.as_str())
                    .unwrap_or(code_run_sheet_name);

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
    code_run: &mut CodeRun,
    code_run_sheet_name: &str,
    shifted_offsets: &HashMap<String, (i64, i64)>,
) {
    if code_run.language != CodeCellLanguage::Javascript {
        return;
    }

    code_run.code = JAVASCRIPT_CELLS_GETCELLS_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
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
                    .unwrap_or(code_run_sheet_name);

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

fn migrate_javascript_rc_relcell(code_run: &mut CodeRun, code_run_pos: Pos) {
    if code_run.language != CodeCellLanguage::Javascript {
        return;
    }

    code_run.code = JAVASCRIPT_RC_RELCELL_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
            let full_match = &caps[0]; // Capture the entire match
            let x = &caps[1]; // x coordinate
            let y = &caps[2]; // y coordinate

            if let (Ok(mut x), Ok(mut y)) = (x.parse::<i64>(), y.parse::<i64>()) {
                // apply code cell position to the reference delta coordinates
                x += code_run_pos.x;
                y += code_run_pos.y;

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

fn migrate_javascript_relcells(code_run: &mut CodeRun, code_run_pos: Pos) {
    if code_run.language != CodeCellLanguage::Javascript {
        return;
    }

    code_run.code = JAVASCRIPT_RELCELLS_REGEX_COMPILED
        .replace_all(&code_run.code, |caps: &regex::Captures<'_>| {
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
                x0 += code_run_pos.x;
                y0 += code_run_pos.y;
                x1 += code_run_pos.x;
                y1 += code_run_pos.y;

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

fn migrate_python_javascript_pos(code_run: &mut CodeRun) {
    if code_run.language != CodeCellLanguage::Python
        && code_run.language != CodeCellLanguage::Javascript
    {
        return;
    }

    code_run.code = POS_REGEX_COMPILED
        .replace_all(&code_run.code, |_: &regex::Captures<'_>| "q.pos()")
        .to_string();
}

#[cfg(test)]
mod test {
    use std::collections::HashMap;

    use super::*;

    fn create_code_run(language: CodeCellLanguage, code: &str) -> CodeRun {
        CodeRun {
            language,
            code: code.to_string(),
            ..Default::default()
        }
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
            let mut code_run = create_code_run(CodeCellLanguage::Python, input);
            migrate_python_c_cell_getcell(&mut code_run, sheet_name, &shifted_offsets);
            assert_eq!(code_run.code, expected);
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
            let mut code_run = create_code_run(CodeCellLanguage::Python, input);
            migrate_python_cells_getcells(&mut code_run, sheet_name, &shifted_offsets);
            assert_eq!(code_run.code, expected);
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
            let mut code_run = create_code_run(CodeCellLanguage::Python, input);
            migrate_python_rc_relcell(&mut code_run, pos);
            assert_eq!(code_run.code, expected);
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
            let mut code_run = create_code_run(CodeCellLanguage::Python, input);
            migrate_python_relcells(&mut code_run, pos);
            assert_eq!(code_run.code, expected);
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
            let mut code_run = create_code_run(CodeCellLanguage::Javascript, input);
            migrate_javascript_c_cell_getcell(&mut code_run, sheet_name, &shifted_offsets);
            assert_eq!(code_run.code, expected);
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
            let mut code_run = create_code_run(CodeCellLanguage::Javascript, input);
            migrate_javascript_cells_getcells(&mut code_run, sheet_name, &shifted_offsets);
            assert_eq!(code_run.code, expected);
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
            let mut code_run = create_code_run(CodeCellLanguage::Javascript, input);
            migrate_javascript_rc_relcell(&mut code_run, pos);
            assert_eq!(code_run.code, expected);
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
            let mut code_run = create_code_run(CodeCellLanguage::Javascript, input);
            migrate_javascript_relcells(&mut code_run, pos);
            assert_eq!(code_run.code, expected);
        }
    }

    #[test]
    fn test_pos_migration() {
        let test_cases = vec![
            ("pos()", "q.pos()", CodeCellLanguage::Python),
            ("pos()", "q.pos()", CodeCellLanguage::Javascript),
        ];

        for (input, expected, language) in test_cases {
            let mut code_run = create_code_run(language, input);
            migrate_python_javascript_pos(&mut code_run);
            assert_eq!(code_run.code, expected);
        }
    }
}
