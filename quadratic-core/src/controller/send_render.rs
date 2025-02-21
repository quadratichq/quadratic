use std::collections::HashSet;

use itertools::Itertools;

use crate::{
    grid::{
        js_types::{JsHtmlOutput, JsOffset},
        SheetId,
    },
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    viewport::ViewportBuffer,
    wasm_bindings::controller::sheet_info::{SheetBounds, SheetInfo},
    Pos, Rect,
};

use super::{active_transactions::pending_transaction::PendingTransaction, GridController};

impl GridController {
    pub(crate) fn send_viewport_buffer(&mut self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let viewport_buffer = ViewportBuffer::default();
        crate::wasm_bindings::js::jsSendViewportBuffer(viewport_buffer.get_buffer());
        self.viewport_buffer = Some(viewport_buffer);
    }

    /// Sends all pending updates to the client
    pub(crate) fn send_transaction_client_updates(&mut self, transaction: &mut PendingTransaction) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return;
        }

        crate::wasm_bindings::js::jsUndoRedo(
            !self.undo_stack.is_empty(),
            !self.redo_stack.is_empty(),
        );

        self.send_sheet_info(transaction);
        self.send_offsets_modified(transaction);
        self.send_code_cells(transaction);
        self.process_visible_dirty_hashes(transaction);
        self.process_remaining_dirty_hashes(transaction);
        self.send_validations(transaction);
        self.send_borders(transaction);
        self.send_html_cells(transaction);
        self.send_images(transaction);

        transaction.fill_cells.iter().for_each(|sheet_id| {
            self.send_all_fills(*sheet_id);
        });
        transaction.fill_cells.clear();

        // send updated SheetMap and TableMap to client
        self.send_a1_context();

        if let Some(selection) = transaction.update_selection.to_owned() {
            crate::wasm_bindings::js::jsSetCursor(selection);
        }
    }

    pub(crate) fn process_visible_dirty_hashes(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test))
            || transaction.is_server()
            || transaction.dirty_hashes.is_empty()
        {
            return;
        }

        let Some(viewport_buffer) = &self.viewport_buffer else {
            return;
        };

        let Some((top_left, bottom_right, viewport_sheet_id)) = viewport_buffer.get_viewport()
        else {
            return;
        };

        let Some(dirty_hashes_in_viewport) = transaction.dirty_hashes.remove(&viewport_sheet_id)
        else {
            return;
        };

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

        let remaining_hashes = self.send_render_cells_in_viewport(
            transaction,
            viewport_sheet_id,
            nearest_dirty_hashes,
        );
        if !remaining_hashes.is_empty() {
            transaction
                .dirty_hashes
                .insert(viewport_sheet_id, remaining_hashes);
        }
    }

    fn send_render_cells_in_viewport(
        &self,
        transaction: &PendingTransaction,
        sheet_id: SheetId,
        dirty_hashes: Vec<Pos>,
    ) -> HashSet<Pos> {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || dirty_hashes.is_empty() {
            return HashSet::new();
        }

        let mut remaining_hashes = HashSet::new();
        if let Some(viewport_buffer) = &self.viewport_buffer {
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
                        self.send_render_cells_in_hash(transaction, sheet_id, pos);
                    } else {
                        remaining_hashes.insert(pos);
                    }
                }
            }
        }
        remaining_hashes
    }

    pub(crate) fn process_remaining_dirty_hashes(&self, transaction: &mut PendingTransaction) {
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

    fn flag_hashes_dirty(&self, sheet_id: SheetId, dirty_hashes: &HashSet<Pos>) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || dirty_hashes.is_empty() {
            return;
        }

        let hashes = dirty_hashes.iter().cloned().collect::<Vec<Pos>>();
        if let Ok(hashes_string) = serde_json::to_string(&hashes) {
            crate::wasm_bindings::js::jsHashesDirty(sheet_id.to_string(), hashes_string);
        }
    }

    /// Sends the modified cells in hash to the render web worker
    fn send_render_cells_in_hash(
        &self,
        transaction: &PendingTransaction,
        sheet_id: SheetId,
        hash: Pos,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        let rect = Rect::from_numbers(
            hash.x * CELL_SHEET_WIDTH as i64,
            hash.y * CELL_SHEET_HEIGHT as i64,
            CELL_SHEET_WIDTH as i64,
            CELL_SHEET_HEIGHT as i64,
        );
        let render_cells = sheet.get_render_cells(rect);
        if let Ok(cells) = serde_json::to_string(&render_cells) {
            crate::wasm_bindings::js::jsRenderCellSheets(
                sheet_id.to_string(),
                hash.x,
                hash.y,
                cells,
            );
        }
        sheet.send_validation_warnings_from_hash(hash.x, hash.y, rect);
    }

    pub(crate) fn send_all_fills(&self, sheet_id: SheetId) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        let fills = sheet.get_all_render_fills();
        if let Ok(fills) = serde_json::to_string(&fills) {
            crate::wasm_bindings::js::jsSheetFills(sheet_id.to_string(), fills);
        }

        let sheet_fills = sheet.get_all_sheet_fills();
        if let Ok(sheet_fills) = serde_json::to_string(&sheet_fills) {
            crate::wasm_bindings::js::jsSheetMetaFills(sheet_id.to_string(), sheet_fills);
        }
    }

    /// Recalculates sheet bounds, and if changed then sends to TS.
    pub(crate) fn send_updated_bounds(
        &mut self,
        transaction: &PendingTransaction,
        sheet_id: SheetId,
    ) {
        let recalculated = if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            sheet.recalculate_bounds()
        } else {
            false
        };

        if !recalculated {
            return;
        }

        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        match serde_json::to_string(&SheetBounds::from(sheet)) {
            Ok(sheet_info) => {
                crate::wasm_bindings::js::jsSheetBoundsUpdate(sheet_info);
            }
            Err(e) => {
                dbgjs!(format!(
                    "[send_updated_bounds] Error serializing sheet bounds {:?}",
                    e.to_string()
                ));
            }
        }
    }

    /// Sends add sheet to the client
    pub(crate) fn send_add_sheet(&mut self, transaction: &PendingTransaction, sheet_id: SheetId) {
        self.update_a1_context_sheet_map(sheet_id);

        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        let sheet_info = SheetInfo::from(sheet);
        match serde_json::to_string(&sheet_info) {
            Ok(sheet_info) => {
                crate::wasm_bindings::js::jsAddSheet(sheet_info, transaction.is_user_undo_redo());
            }
            Err(e) => {
                dbgjs!(format!(
                    "[send_add_sheet] Error serializing sheet info {:?}",
                    e.to_string()
                ));
            }
        }
    }

    /// Sends delete sheet to the client
    pub(crate) fn send_delete_sheet(
        &mut self,
        transaction: &PendingTransaction,
        sheet_id: SheetId,
    ) {
        self.update_a1_context_sheet_map(sheet_id);

        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        crate::wasm_bindings::js::jsDeleteSheet(
            sheet_id.to_string(),
            transaction.is_user_undo_redo(),
        );
    }

    /// Sends sheet info to the client
    pub(crate) fn send_sheet_info(&mut self, transaction: &mut PendingTransaction) {
        for sheet_id in transaction.sheet_info.iter() {
            self.update_a1_context_sheet_map(*sheet_id);

            if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
                continue;
            }

            let Some(sheet) = self.try_sheet(*sheet_id) else {
                continue;
            };

            let sheet_info = SheetInfo::from(sheet);
            match serde_json::to_string(&sheet_info) {
                Ok(sheet_info) => {
                    crate::wasm_bindings::js::jsSheetInfoUpdate(sheet_info);
                }
                Err(e) => {
                    dbgjs!(format!(
                        "[send_sheet_info] Error serializing sheet info {:?}",
                        e.to_string()
                    ));
                }
            }
        }
        transaction.sheet_info.clear();
    }

    pub(crate) fn send_code_cells(&mut self, transaction: &mut PendingTransaction) {
        self.update_a1_context_table_map(&transaction.code_cells);

        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            for (sheet_id, positions) in transaction.code_cells.iter() {
                let Some(sheet) = self.try_sheet(*sheet_id) else {
                    continue;
                };

                for pos in positions.iter() {
                    sheet.send_code_cell(*pos);
                }
            }
        }

        transaction.code_cells.clear();
    }

    /// Sends individual offsets that have been modified to the client
    pub(crate) fn send_offsets_modified(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        for (sheet_id, offsets) in transaction.offsets_modified.iter() {
            let mut offsets = offsets
                .iter()
                .map(|(&(column, row), &size)| JsOffset {
                    column: column.map(|c| c as i32),
                    row: row.map(|r| r as i32),
                    size,
                })
                .collect::<Vec<JsOffset>>();
            offsets.sort_by(|a, b| a.row.cmp(&b.row).then(a.column.cmp(&b.column)));

            match serde_json::to_string(&offsets) {
                Ok(offsets) => {
                    crate::wasm_bindings::js::jsOffsetsModified(sheet_id.to_string(), offsets);
                }
                Err(e) => {
                    dbgjs!(format!(
                        "[send_offsets_modified] Error serializing JsOffset {:?}",
                        e.to_string()
                    ));
                }
            }
        }
        transaction.offsets_modified.clear();
    }

    fn send_validations(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        for sheet_id in transaction.validations.iter() {
            let Some(sheet) = self.try_sheet(*sheet_id) else {
                continue;
            };

            sheet.send_all_validations();
        }
        transaction.validations.clear();

        for (sheet_id, warnings) in transaction.validations_warnings.iter() {
            let Some(sheet) = self.try_sheet(*sheet_id) else {
                continue;
            };

            let warnings = warnings.values().cloned().collect::<Vec<_>>();
            sheet.send_validation_warnings(warnings);
        }
        transaction.validations_warnings.clear();
    }

    fn send_borders(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        for sheet_id in transaction.sheet_borders.iter() {
            let Some(sheet) = self.try_sheet(*sheet_id) else {
                continue;
            };

            sheet.send_sheet_borders();
        }
        transaction.sheet_borders.clear();
    }

    fn send_html_cells(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        for (sheet_id, positions) in transaction.html_cells.iter() {
            let Some(sheet) = self.try_sheet(*sheet_id) else {
                continue;
            };

            for pos in positions.iter() {
                // prepare the html for the client, or fallback to an empty html cell
                let html = sheet.get_single_html_output(*pos).unwrap_or(JsHtmlOutput {
                    sheet_id: sheet_id.to_string(),
                    x: pos.x as i32,
                    y: pos.y as i32,
                    w: 0,
                    h: 0,
                    html: None,
                    name: "".to_string(),
                    show_name: true,
                });

                match serde_json::to_string(&html) {
                    Ok(html) => {
                        crate::wasm_bindings::js::jsUpdateHtml(html);
                    }
                    Err(e) => {
                        dbgjs!(format!(
                            "[send_html_cells] Error serializing JsHtmlOutput {:?}",
                            e.to_string()
                        ));
                    }
                }
            }
        }
        transaction.html_cells.clear();
    }

    fn send_images(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        for (sheet_id, positions) in transaction.image_cells.iter() {
            let Some(sheet) = self.try_sheet(*sheet_id) else {
                continue;
            };

            for pos in positions.iter() {
                sheet.send_image(pos.to_owned());
            }
        }
        transaction.image_cells.clear();
    }

    /// Send transaction progress to client
    pub(crate) fn send_transaction_progress(&self, transaction: &PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        crate::wasm_bindings::js::jsTransactionProgress(
            transaction.id.to_string(),
            transaction.operations.len() as i32,
        );
    }

    pub(crate) fn send_a1_context(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let context = self.a1_context();
        if let Ok(context) = serde_json::to_string(context) {
            crate::wasm_bindings::js::jsA1Context(context);
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        a1::A1Selection,
        controller::{
            active_transactions::pending_transaction::PendingTransaction,
            execution::TransactionSource, transaction_types::JsCodeResult, GridController,
        },
        grid::{
            formats::SheetFormatUpdates,
            js_types::{JsHtmlOutput, JsRenderCell},
            Contiguous2D, SheetId,
        },
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count, hash_test},
        ClearOption, Pos, SheetPos,
    };
    use std::collections::HashSet;

    #[test]
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
        assert!(transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsRenderCellSheets", 0, false);
        expect_js_call_count("jsHashesDirty", 0, false);
        gc.process_remaining_dirty_hashes(&mut transaction);
        assert!(transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsRenderCellSheets", 0, false);
        expect_js_call_count("jsHashesDirty", 0, false);
    }

    #[test]
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
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            ..Default::default()
        })
        .unwrap();

        clear_js_calls();

        gc.set_chart_size(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            1,
            2,
            None,
        );

        expect_js_call(
            "jsUpdateHtml",
            serde_json::to_string(&JsHtmlOutput {
                sheet_id: sheet_id.to_string(),
                x: 1,
                y: 1,
                w: 1,
                h: 3,
                html: Some("<html></html>".to_string()),
                show_name: true,
                name: "Python1".to_string(),
            })
            .unwrap(),
            true,
        );
    }

    #[test]
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

    #[test]
    fn send_all_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.try_sheet_mut(sheet_id)
            .unwrap()
            .set_formats_a1(&SheetFormatUpdates {
                bold: Contiguous2D::new_from_opt_selection(
                    &A1Selection::test_a1("A1"),
                    Some(ClearOption::Some(true)),
                ),
                ..Default::default()
            });

        gc.send_all_fills(sheet_id);

        let sheet = gc.try_sheet(sheet_id).unwrap();
        let fills = sheet.get_all_sheet_fills();
        expect_js_call(
            "jsSheetMetaFills",
            format!("{},{}", sheet.id, serde_json::to_string(&fills).unwrap()),
            true,
        );
    }
}
