use super::Sheet;
use crate::{
    grid::GridBounds,
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    Pos, Rect,
};
use std::collections::HashSet;

impl Sheet {
    /// Sends the modified cell sheets to the render web worker
    pub fn send_render_cells(&self, positions: &HashSet<Pos>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        // calculate the hashes that were updated
        let mut modified = HashSet::new();
        positions.iter().for_each(|pos| {
            let quadrant = pos.quadrant();
            modified.insert(Pos {
                x: quadrant.0,
                y: quadrant.1,
            });
        });

        // send the modified cells to the render web worker
        self.send_render_cells_in_hashes(modified);
    }

    /// Sends the modified cells in hash to the render web worker
    pub fn send_render_cells_in_hashes(&self, hashes: HashSet<Pos>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        hashes.into_iter().for_each(|hash| {
            self.send_render_cells_in_hash(hash);
        });
    }

    /// Sends the modified cells in hash to the render web worker
    pub fn send_render_cells_in_hash(&self, hash: Pos) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let rect = Rect::from_numbers(
            hash.x * CELL_SHEET_WIDTH as i64,
            hash.y * CELL_SHEET_HEIGHT as i64,
            CELL_SHEET_WIDTH as i64,
            CELL_SHEET_HEIGHT as i64,
        );
        let render_cells = self.get_render_cells(rect);
        if let Ok(cells) = serde_json::to_string(&render_cells) {
            crate::wasm_bindings::js::jsRenderCellSheets(
                self.id.to_string(),
                hash.x,
                hash.y,
                cells,
            );
        }
        self.send_validation_warnings_from_hash(hash.x, hash.y, rect);
    }

    /// Sends all render cells to the render web worker
    pub fn send_all_render_cells(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match self.bounds(true) {
            GridBounds::Empty => {}
            GridBounds::NonEmpty(bounds) => {
                for y in (bounds.min.y..=bounds.max.y + CELL_SHEET_HEIGHT as i64)
                    .step_by(CELL_SHEET_HEIGHT as usize)
                {
                    for x in (bounds.min.x..=bounds.max.x + CELL_SHEET_WIDTH as i64)
                        .step_by(CELL_SHEET_WIDTH as usize)
                    {
                        let quadrant = Pos { x, y }.quadrant();
                        let rect = Rect::from_numbers(
                            quadrant.0 * CELL_SHEET_WIDTH as i64,
                            quadrant.1 * CELL_SHEET_HEIGHT as i64,
                            CELL_SHEET_WIDTH as i64,
                            CELL_SHEET_HEIGHT as i64,
                        );
                        let render_cells = self.get_render_cells(rect);
                        if !render_cells.is_empty() {
                            if let Ok(cells) = serde_json::to_string(&render_cells) {
                                crate::wasm_bindings::js::jsRenderCellSheets(
                                    self.id.to_string(),
                                    quadrant.0,
                                    quadrant.1,
                                    cells,
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    /// Sends render cells to the render web worker for the specified columns.
    pub fn send_column_render_cells(&self, columns: Vec<i64>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let mut render_hash = HashSet::new();
        columns.iter().for_each(|column| {
            if let Some(bounds) = self.column_bounds(*column, true) {
                for y in (bounds.0..=bounds.1 + CELL_SHEET_HEIGHT as i64)
                    .step_by(CELL_SHEET_HEIGHT as usize)
                {
                    let quadrant = Pos { x: *column, y }.quadrant();
                    render_hash.insert(Pos {
                        x: quadrant.0,
                        y: quadrant.1,
                    });
                }
            }
        });

        render_hash.iter().for_each(|pos| {
            let rect = Rect::from_numbers(
                pos.x * CELL_SHEET_WIDTH as i64,
                pos.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );
            let render_cells = self.get_render_cells(rect);
            if !render_cells.is_empty() {
                if let Ok(cells) = serde_json::to_string(&render_cells) {
                    crate::wasm_bindings::js::jsRenderCellSheets(
                        self.id.to_string(),
                        pos.x,
                        pos.y,
                        cells,
                    );
                }
            }
        });
    }

    /// Sends render cells to the render web worker for the specified rows.
    pub fn send_row_render_cells(&self, rows: Vec<i64>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let mut render_hash = HashSet::new();
        rows.iter().for_each(|row| {
            if let Some(bounds) = self.row_bounds(*row, true) {
                for x in (bounds.0..=bounds.1 + CELL_SHEET_WIDTH as i64)
                    .step_by(CELL_SHEET_WIDTH as usize)
                {
                    render_hash.insert(Pos {
                        x: x / CELL_SHEET_WIDTH as i64,
                        y: row / CELL_SHEET_HEIGHT as i64,
                    });
                }
            }
        });

        render_hash.iter().for_each(|pos| {
            let rect = Rect::from_numbers(
                pos.x * CELL_SHEET_WIDTH as i64,
                pos.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );
            let render_cells = self.get_render_cells(rect);
            if !render_cells.is_empty() {
                if let Ok(cells) = serde_json::to_string(&render_cells) {
                    crate::wasm_bindings::js::jsRenderCellSheets(
                        self.id.to_string(),
                        pos.x,
                        pos.y,
                        cells,
                    );
                }
            }
        });
    }

    /// Sends html output to the client within a sheetRect
    pub fn send_html_output(&self, positions: &HashSet<Pos>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        positions.iter().for_each(|pos| {
            if let Some(html_output) = self.get_single_html_output(*pos) {
                if let Ok(html) = serde_json::to_string(&html_output) {
                    crate::wasm_bindings::js::jsUpdateHtml(html);
                }
            }
        });
    }

    /// Sends all sheet fills to the client, ie, fills for columns, rows, and
    /// the entire sheet.
    pub fn send_sheet_fills(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let fills = self.get_all_sheet_fills();
        if let Ok(fills) = serde_json::to_string(&fills) {
            crate::wasm_bindings::js::jsSheetMetaFills(self.id.to_string(), fills);
        }
    }

    /// Sends all column-based fills in the sheet.
    pub fn resend_fills(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let fills = self.get_all_render_fills();
        if let Ok(fills) = serde_json::to_string(&fills) {
            crate::wasm_bindings::js::jsSheetFills(self.id.to_string(), fills);
        }
        self.send_sheet_fills();
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        clear_option::ClearOption,
        grid::{formats::SheetFormatUpdates, Contiguous2D},
        wasm_bindings::js::{clear_js_calls, expect_js_call, hash_test},
        A1Selection, CellValue,
    };
    use serial_test::serial;

    fn expect_render_cell_sheet(sheet: &Sheet, hash_x: i64, hash_y: i64, clear: bool) {
        let rect = Rect::from_numbers(
            hash_x * CELL_SHEET_WIDTH as i64,
            hash_y * CELL_SHEET_HEIGHT as i64,
            CELL_SHEET_WIDTH as i64,
            CELL_SHEET_HEIGHT as i64,
        );
        let cells = serde_json::to_string(&sheet.get_render_cells(rect)).unwrap();
        let args = format!("{},{},{},{}", sheet.id, hash_x, hash_y, hash_test(&cells));
        expect_js_call("jsRenderCellSheets", args, clear);
    }

    #[test]
    #[serial]
    fn send_render_cells() {
        clear_js_calls();
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("test".to_string()));
        sheet.recalculate_bounds();
        let mut positions = HashSet::new();
        positions.insert(Pos { x: 1, y: 2 });
        sheet.send_render_cells(&positions);
        expect_render_cell_sheet(&sheet, 0, 0, true);
    }

    #[test]
    #[serial]
    fn send_all_render_cells() {
        clear_js_calls();
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            CELL_SHEET_WIDTH as i64 - 1,
            1,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        sheet.recalculate_bounds();
        sheet.send_all_render_cells();
        expect_render_cell_sheet(&sheet, 0, 0, false);
        expect_render_cell_sheet(&sheet, 1, 0, true);
    }

    #[test]
    #[serial]
    fn send_column_render_cells() {
        clear_js_calls();
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            CELL_SHEET_WIDTH as i64 - 1,
            1,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        sheet.recalculate_bounds();
        sheet.send_column_render_cells(vec![CELL_SHEET_WIDTH as i64 - 1]);
        expect_render_cell_sheet(&sheet, 0, 0, true);

        sheet.send_column_render_cells(vec![CELL_SHEET_WIDTH as i64 - 1, CELL_SHEET_WIDTH as i64]);
        expect_render_cell_sheet(&sheet, 0, 0, false);
        expect_render_cell_sheet(&sheet, 1, 0, true);
    }

    #[test]
    #[serial]
    fn send_row_render_cells() {
        clear_js_calls();
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            1,
            CELL_SHEET_HEIGHT as i64 - 1,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        sheet.recalculate_bounds();
        sheet.send_row_render_cells(vec![CELL_SHEET_HEIGHT as i64 - 1]);
        expect_render_cell_sheet(&sheet, 0, 0, true);

        sheet.send_row_render_cells(vec![CELL_SHEET_HEIGHT as i64 - 1, CELL_SHEET_HEIGHT as i64]);
        expect_render_cell_sheet(&sheet, 0, 0, false);
        expect_render_cell_sheet(&sheet, 0, 1, true);
    }

    #[test]
    #[serial]
    fn test_send_sheet_fills() {
        clear_js_calls();
        let mut sheet = Sheet::test();
        sheet.set_formats_a1(&SheetFormatUpdates {
            bold: Contiguous2D::new_from_opt_selection(
                &A1Selection::test_a1("A1"),
                Some(ClearOption::Some(true)),
            ),
            ..Default::default()
        });
        sheet.send_sheet_fills();
        let fills = sheet.get_all_sheet_fills();
        expect_js_call(
            "jsSheetMetaFills",
            format!("{},{}", sheet.id, serde_json::to_string(&fills).unwrap()),
            true,
        );
    }
}
