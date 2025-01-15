use std::collections::{HashMap, HashSet};

use itertools::Itertools;

use crate::{
    grid::{js_types::JsOffset, SheetId},
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    viewport::ViewportBuffer,
    wasm_bindings::controller::sheet_info::{SheetBounds, SheetInfo},
    CellValue, Pos, SheetPos, SheetRect,
};

use super::{active_transactions::pending_transaction::PendingTransaction, GridController};

impl GridController {
    pub fn send_viewport_buffer(&mut self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let viewport_buffer = ViewportBuffer::default();
        crate::wasm_bindings::js::jsSendViewportBuffer(viewport_buffer.get_buffer());
        self.viewport_buffer = Some(viewport_buffer);
    }

    pub fn process_visible_dirty_hashes(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test))
            || transaction.is_server()
            || transaction.dirty_hashes.is_empty()
        {
            return;
        }

        if let Some(viewport_buffer) = &self.viewport_buffer {
            if let Some((top_left, bottom_right, viewport_sheet_id)) =
                viewport_buffer.get_viewport()
            {
                if let Some(dirty_hashes_in_viewport) =
                    transaction.dirty_hashes.remove(&viewport_sheet_id)
                {
                    let center = Pos {
                        x: (top_left.x + bottom_right.x) / 2,
                        y: (top_left.y + bottom_right.y) / 2,
                    };
                    let nearest_dirty_hashes = dirty_hashes_in_viewport
                        .iter()
                        .cloned()
                        .sorted_by(|a, b| {
                            let a_distance = (a.x - center.x).abs() + (a.y - center.y).abs();
                            let b_distance = (b.x - center.x).abs() + (b.y - center.y).abs();
                            a_distance.cmp(&b_distance)
                        })
                        .collect();

                    let remaining_hashes =
                        self.send_render_cells_in_viewport(viewport_sheet_id, nearest_dirty_hashes);
                    if !remaining_hashes.is_empty() {
                        transaction
                            .dirty_hashes
                            .insert(viewport_sheet_id, remaining_hashes);
                    }
                }
            }
        }
    }

    pub fn send_render_cells_in_viewport(
        &self,
        sheet_id: SheetId,
        dirty_hashes: Vec<Pos>,
    ) -> HashSet<Pos> {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || dirty_hashes.is_empty() {
            return HashSet::new();
        }

        let mut remaining_hashes = HashSet::new();
        if let Some(viewport_buffer) = &self.viewport_buffer {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                for pos in dirty_hashes.into_iter() {
                    if let Some((top_left, bottom_right, viewport_sheet_id)) =
                        viewport_buffer.get_viewport()
                    {
                        if sheet_id == viewport_sheet_id
                            && pos.x >= top_left.x
                            && pos.x <= bottom_right.x
                            && pos.y >= top_left.y
                            && pos.y <= bottom_right.y
                        {
                            sheet.send_render_cells_in_hash(pos);
                        } else {
                            remaining_hashes.insert(pos);
                        }
                    }
                }
            }
        }
        remaining_hashes
    }

    pub fn process_remaining_dirty_hashes(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test))
            || transaction.is_server()
            || transaction.dirty_hashes.is_empty()
        {
            return;
        }

        for (&sheet_id, dirty_hashes) in transaction.dirty_hashes.iter_mut() {
            self.flag_hashes_dirty(sheet_id, dirty_hashes);
            dirty_hashes.clear();
        }
        transaction.dirty_hashes.clear();
    }

    pub fn flag_hashes_dirty(&self, sheet_id: SheetId, dirty_hashes: &HashSet<Pos>) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || dirty_hashes.is_empty() {
            return;
        }

        let hashes = dirty_hashes.iter().cloned().collect::<Vec<Pos>>();
        if let Ok(hashes_string) = serde_json::to_string(&hashes) {
            crate::wasm_bindings::js::jsHashesDirty(sheet_id.to_string(), hashes_string);
        }
    }

    pub fn send_render_cells_from_hash(&self, sheet_id: SheetId, modified: &HashSet<Pos>) {
        // send the modified cells to the render web worker
        modified.iter().for_each(|hash| {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                sheet.send_render_cells_in_hash(*hash);
            }
        });
    }

    /// Sends the modified cell sheets to the render web worker
    pub fn send_render_cells(&self, sheet_rect: &SheetRect) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        // calculate the hashes that were updated
        let mut modified = HashSet::new();
        for y in sheet_rect.y_range() {
            let y_hash = (y as f64 / CELL_SHEET_HEIGHT as f64).floor() as i64;
            for x in sheet_rect.x_range() {
                let x_hash = (x as f64 / CELL_SHEET_WIDTH as f64).floor() as i64;
                modified.insert(Pos {
                    x: x_hash,
                    y: y_hash,
                });
            }
        }
        self.send_render_cells_from_hash(sheet_rect.sheet_id, &modified);
    }

    pub fn send_all_fills(&self, sheet_id: SheetId) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        if let Some(sheet) = self.try_sheet(sheet_id) {
            let fills = sheet.get_all_render_fills();
            if let Ok(fills) = serde_json::to_string(&fills) {
                crate::wasm_bindings::js::jsSheetFills(sheet_id.to_string(), fills);
            }
            let sheet_fills = sheet.get_all_sheet_fills();
            if let Ok(sheet_fills) = serde_json::to_string(&sheet_fills) {
                crate::wasm_bindings::js::jsSheetMetaFills(sheet_id.to_string(), sheet_fills);
            }
        }
    }

    /// Recalculates sheet bounds, and if changed then sends to TS.
    pub fn send_updated_bounds(&mut self, sheet_id: SheetId) {
        let recalculated = if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            sheet.recalculate_bounds()
        } else {
            false
        };

        if cfg!(target_family = "wasm") && recalculated {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let Ok(sheet_info) = serde_json::to_string(&SheetBounds::from(sheet)) {
                    crate::wasm_bindings::js::jsSheetBoundsUpdate(sheet_info);
                }
            }
        };
    }

    /// Sends html output to the client within a sheetRect
    pub fn send_html_output_rect(&self, sheet_rect: &SheetRect) {
        if cfg!(target_family = "wasm") | cfg!(test) {
            if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
                sheet
                    .get_html_output()
                    .iter()
                    .filter(|html_output| {
                        sheet_rect.contains(SheetPos {
                            sheet_id: sheet_rect.sheet_id,
                            x: html_output.x,
                            y: html_output.y,
                        })
                    })
                    .for_each(|html_output| {
                        if let Ok(html) = serde_json::to_string(&html_output) {
                            crate::wasm_bindings::js::jsUpdateHtml(html);
                        }
                    });
            }
        }
    }

    /// Sends add sheet to the client
    pub fn send_add_sheet(&self, sheet_id: SheetId, transaction: &PendingTransaction) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                let sheet_info = SheetInfo::from(sheet);
                if let Ok(sheet_info) = serde_json::to_string(&sheet_info) {
                    crate::wasm_bindings::js::jsAddSheet(
                        sheet_info,
                        transaction.is_user_undo_redo(),
                    );
                }
            }
        }
    }

    /// Sends delete sheet to the client
    pub fn send_delete_sheet(&self, sheet_id: SheetId, transaction: &PendingTransaction) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            crate::wasm_bindings::js::jsDeleteSheet(
                sheet_id.to_string(),
                transaction.is_user_undo_redo(),
            );
        }
    }

    /// Sends sheet info to the client
    pub fn send_sheet_info(&self, sheet_id: SheetId) {
        if cfg!(target_family = "wasm") || cfg!(test) {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                let sheet_info = SheetInfo::from(sheet);
                if let Ok(sheet_info) = serde_json::to_string(&sheet_info) {
                    crate::wasm_bindings::js::jsSheetInfoUpdate(sheet_info);
                }
            }
        }
    }

    /// Sends individual offsets that have been modified to the client
    pub fn send_offsets_modified(
        &self,
        sheet_id: SheetId,
        offsets: &HashMap<(Option<i64>, Option<i64>), f64>,
    ) {
        if cfg!(target_family = "wasm") || cfg!(test) {
            let mut offsets = offsets
                .iter()
                .map(|(&(column, row), &size)| JsOffset {
                    column: column.map(|c| c as i32),
                    row: row.map(|r| r as i32),
                    size,
                })
                .collect::<Vec<JsOffset>>();
            offsets.sort_by(|a, b| a.row.cmp(&b.row).then(a.column.cmp(&b.column)));
            let offsets = serde_json::to_string(&offsets).unwrap();
            crate::wasm_bindings::js::jsOffsetsModified(sheet_id.to_string(), offsets);
        }
    }

    pub fn send_image(&self, sheet_pos: SheetPos) {
        if cfg!(target_family = "wasm") || cfg!(test) {
            if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
                let image = sheet.code_run(sheet_pos.into()).and_then(|code_run| {
                    code_run
                        .cell_value_at(0, 0)
                        .and_then(|cell_value| match cell_value {
                            CellValue::Image(image) => Some(image.clone()),
                            _ => None,
                        })
                });
                let (w, h) = if let Some(size) = sheet.formats.render_size.get(sheet_pos.into()) {
                    (Some(size.w), Some(size.h))
                } else {
                    (None, None)
                };

                crate::wasm_bindings::js::jsSendImage(
                    sheet_pos.sheet_id.to_string(),
                    sheet_pos.x as i32,
                    sheet_pos.y as i32,
                    image,
                    w,
                    h,
                );
            }
        }
    }

    /// Send transaction progress to client
    pub fn send_transaction_progress(&self, transaction: &PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        crate::wasm_bindings::js::jsTransactionProgress(
            transaction.id.to_string(),
            transaction.operations.len() as i32,
        );
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::{
            active_transactions::pending_transaction::PendingTransaction,
            execution::TransactionSource, transaction_types::JsCodeResult, GridController,
        },
        grid::{
            js_types::{JsHtmlOutput, JsRenderCell},
            RenderSize, SheetId,
        },
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count, hash_test},
        A1Selection, Pos,
    };
    use serial_test::serial;
    use std::collections::HashSet;

    #[test]
    #[serial]
    fn test_process_visible_dirty_hashes() {
        clear_js_calls();
        let gc = GridController::test_with_viewport_buffer();
        let sheet_id = gc.sheet_ids()[0];

        // Empty transaction
        let mut transaction = PendingTransaction::default();
        gc.process_visible_dirty_hashes(&mut transaction);
        assert!(transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsRenderCellSheets", 0, false);
        expect_js_call_count("jsHashesDirty", 0, false);

        // User transaction
        let mut transaction = PendingTransaction::default();
        transaction.add_dirty_hashes_from_sheet_cell_positions(
            sheet_id,
            HashSet::from([
                Pos { x: -5, y: -5 },     // Inside viewport
                Pos { x: 5, y: 5 },       // Inside viewport
                Pos { x: 1500, y: 1500 }, // Outside viewport
            ]),
        );
        gc.process_visible_dirty_hashes(&mut transaction);
        assert!(!transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsRenderCellSheets", 2, false);
        expect_js_call_count("jsHashesDirty", 0, false);
        gc.process_remaining_dirty_hashes(&mut transaction);
        assert!(transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsRenderCellSheets", 0, false);
        expect_js_call_count("jsHashesDirty", 1, false);

        // Server transaction
        let mut transaction = PendingTransaction {
            source: TransactionSource::Server,
            ..Default::default()
        };
        transaction.add_dirty_hashes_from_sheet_cell_positions(
            sheet_id,
            HashSet::from([
                Pos { x: -5, y: -5 },     // Inside viewport
                Pos { x: 5, y: 5 },       // Inside viewport
                Pos { x: 1500, y: 1500 }, // Outside viewport
            ]),
        );
        gc.process_visible_dirty_hashes(&mut transaction);
        assert!(!transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsRenderCellSheets", 0, false);
        expect_js_call_count("jsHashesDirty", 0, false);
        gc.process_remaining_dirty_hashes(&mut transaction);
        assert!(!transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsRenderCellSheets", 0, false);
        expect_js_call_count("jsHashesDirty", 0, false);
    }

    #[test]
    #[serial]
    fn test_process_remaining_dirty_hashes() {
        clear_js_calls();

        let gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        let positions: HashSet<Pos> = vec![Pos { x: 10, y: 10 }].into_iter().collect();

        transaction.add_dirty_hashes_from_sheet_cell_positions(sheet_id, positions);
        gc.process_remaining_dirty_hashes(&mut transaction);
        assert!(transaction.dirty_hashes.is_empty());

        let hashes: HashSet<Pos> = vec![Pos { x: 0, y: 0 }].into_iter().collect();
        let hashes_string = serde_json::to_string(&hashes).unwrap();
        expect_js_call(
            "jsHashesDirty",
            format!("{},{}", sheet_id, hashes_string),
            false,
        );
        expect_js_call_count("jsRenderCellSheets", 0, true);
    }

    #[test]
    #[serial]
    fn send_render_cells() {
        clear_js_calls();

        let mut gc = GridController::test_with_viewport_buffer();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value((0, 0, sheet_id).into(), "test 1".to_string(), None);
        let result = vec![JsRenderCell {
            value: "test 1".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&result)),
            true,
        );

        gc.set_cell_value((100, 100, sheet_id).into(), "test 2".to_string(), None);
        let result = vec![JsRenderCell {
            x: 100,
            y: 100,
            value: "test 2".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 6, 3, hash_test(&result)),
            true,
        );
    }

    #[test]
    #[serial]
    fn send_html_output_rect() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            crate::grid::CodeCellLanguage::Python,
            "test".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id.to_string();
        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id,
            success: true,
            std_err: None,
            std_out: None,
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            output_array: None,
            line_number: None,
            output_display_type: None,
            cancel_compute: None,
        });

        expect_js_call(
            "jsUpdateHtml",
            serde_json::to_string(&JsHtmlOutput {
                sheet_id: sheet_id.to_string(),
                x: 0,
                y: 0,
                html: Some("<html></html>".to_string()),
                w: None,
                h: None,
            })
            .unwrap(),
            true,
        );
    }

    #[test]
    #[serial]
    fn send_html_output_rect_after_resize() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            (1, 1, sheet_id).into(),
            crate::grid::CodeCellLanguage::Python,
            "test".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id.to_string();
        gc.calculation_complete(JsCodeResult {
            transaction_id,
            success: true,
            std_err: None,
            std_out: None,
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            output_array: None,
            line_number: None,
            output_display_type: None,
            cancel_compute: None,
        })
        .unwrap();

        gc.set_render_size(
            &A1Selection::test_a1("A1"),
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            None,
        )
        .unwrap();

        expect_js_call(
            "jsUpdateHtml",
            serde_json::to_string(&JsHtmlOutput {
                sheet_id: sheet_id.to_string(),
                x: 1,
                y: 1,
                html: Some("<html></html>".to_string()),
                w: Some("1".to_string()),
                h: Some("2".to_string()),
            })
            .unwrap(),
            true,
        );
    }

    #[test]
    #[serial]
    fn send_render_cells_from_rects() {
        let mut gc = GridController::test_with_viewport_buffer();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value((0, 0, sheet_id).into(), "test 1".to_string(), None);
        gc.set_cell_value((100, 100, sheet_id).into(), "test 2".to_string(), None);

        let result = vec![JsRenderCell {
            value: "test 1".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&result)),
            false,
        );

        let result = vec![JsRenderCell {
            x: 100,
            y: 100,
            value: "test 2".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 6, 3, hash_test(&result)),
            true,
        );
    }
}
