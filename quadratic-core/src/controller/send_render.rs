use std::collections::{HashMap, HashSet};

use itertools::Itertools;

use crate::{
    Pos, Rect,
    compression::{SerializationFormat, serialize},
    grid::{
        SheetId,
        js_types::{
            JsHashRenderCells, JsHashRenderFills, JsHashValidationWarnings, JsHashesDirty,
            JsHtmlOutput, JsOffset, JsUpdateCodeCell,
        },
    },
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    viewport::ViewportBuffer,
    wasm_bindings::controller::sheet_info::{SheetBounds, SheetInfo},
};

use super::{GridController, active_transactions::pending_transaction::PendingTransaction};

impl GridController {
    pub(crate) fn send_viewport_buffer(&mut self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let viewport_buffer = ViewportBuffer::default();
        crate::wasm_bindings::js::jsSendViewportBuffer(viewport_buffer.get_buffer());
        self.viewport_buffer = Some(viewport_buffer);
    }

    /// Sends all pending updates to the client and render worker
    pub(crate) fn send_client_render_updates(&mut self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        self.update_a1_context_table_map(transaction);
        self.send_a1_context();
        self.send_sheet_info(transaction);
        self.send_content_cache(transaction);
        self.send_offsets_modified(transaction);
        self.send_code_cells(transaction);
        self.send_merge_cells(transaction);
        self.process_visible_dirty_hashes(transaction);
        self.process_remaining_dirty_hashes(transaction);
        self.send_validations(transaction);
        self.send_conditional_formats(transaction);
        self.send_borders(transaction);
        self.send_fills(transaction);
        self.send_undo_redo();
        self.send_set_cursor(transaction);
    }

    pub(crate) fn process_visible_dirty_hashes(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test))
            || transaction.is_server()
            || transaction.dirty_hashes.is_empty()
        {
            transaction.dirty_hashes.clear();
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
            .into_iter()
            .sorted_by(|a, b| {
                let a_distance = (a.x - center.x).abs() + (a.y - center.y).abs();
                let b_distance = (b.x - center.x).abs() + (b.y - center.y).abs();
                a_distance.cmp(&b_distance)
            })
            .collect::<Vec<_>>();

        let mut viewport_hashes = Vec::new();
        let mut remaining_hashes = Vec::new();

        for pos in nearest_dirty_hashes.into_iter() {
            if Rect::new_span(top_left, bottom_right).contains(pos) {
                viewport_hashes.push(pos);
            } else {
                remaining_hashes.push(pos);
            }
        }

        // send sheet info, offsets are required before sending render cells
        self.send_sheet_info(transaction);
        self.send_offsets_modified(transaction);

        self.send_render_cells_in_hashes(transaction, viewport_sheet_id, viewport_hashes);

        if !remaining_hashes.is_empty() {
            transaction
                .dirty_hashes
                .insert(viewport_sheet_id, remaining_hashes.into_iter().collect());
        }
    }

    /// Sends the modified cells in hash to the render web worker
    fn send_render_cells_in_hashes(
        &self,
        transaction: &PendingTransaction,
        sheet_id: SheetId,
        hashes: Vec<Pos>,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        let mut render_cells_in_hashes = Vec::new();

        let mut validation_warnings = Vec::new();

        for hash in hashes.into_iter() {
            let rect = Rect::from_numbers(
                hash.x * CELL_SHEET_WIDTH as i64,
                hash.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );

            let mut cells = sheet.get_render_cells(rect, &self.a1_context);

            // Apply conditional formatting to render cells
            self.apply_conditional_formatting_to_cells(sheet_id, rect, &mut cells);

            render_cells_in_hashes.push(JsHashRenderCells {
                sheet_id,
                hash,
                cells,
            });

            validation_warnings.extend(sheet.get_validation_warnings_in_rect(rect, true));
        }

        if !render_cells_in_hashes.is_empty() {
            match serde_json::to_vec(&render_cells_in_hashes) {
                Ok(render_cells) => {
                    crate::wasm_bindings::js::jsHashesRenderCells(render_cells);
                }
                Err(e) => {
                    dbgjs!(format!(
                        "[send_render_cells_in_hashes] Error serializing render cells {:?}",
                        e
                    ));
                }
            }
        }

        self.send_validation_warnings(validation_warnings);
    }

    pub(crate) fn process_remaining_dirty_hashes(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test))
            || transaction.is_server()
            || transaction.dirty_hashes.is_empty()
        {
            transaction.dirty_hashes.clear();
            return;
        }

        let dirty_hashes = std::mem::take(&mut transaction.dirty_hashes);
        let dirty_hashes = dirty_hashes
            .into_iter()
            .map(|(sheet_id, hashes)| JsHashesDirty {
                sheet_id,
                hashes: hashes.into_iter().collect::<Vec<Pos>>(),
            })
            .collect::<Vec<_>>();
        if !dirty_hashes.is_empty() {
            match serde_json::to_vec(&dirty_hashes) {
                Ok(dirty_hashes) => {
                    crate::wasm_bindings::js::jsHashesDirty(dirty_hashes);
                }
                Err(e) => {
                    dbgjs!(format!(
                        "[process_remaining_dirty_hashes] Error serializing dirty hashes {:?}",
                        e
                    ));
                }
            }
        }
    }

    pub(crate) fn send_validation_warnings(&self, warnings: Vec<JsHashValidationWarnings>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        if !warnings.is_empty() {
            match serde_json::to_vec(&warnings) {
                Ok(warnings) => {
                    crate::wasm_bindings::js::jsValidationWarnings(warnings);
                }
                Err(e) => {
                    dbgjs!(format!(
                        "[send_validation_warnings] Error serializing validation warnings {:?}",
                        e
                    ));
                }
            }
        }
    }

    /// Recalculates sheet bounds, and if changed then sends to TS.
    pub(crate) fn send_updated_bounds(
        &mut self,
        transaction: &PendingTransaction,
        sheet_id: SheetId,
    ) {
        let recalculated = self
            .grid
            .try_sheet_mut(sheet_id)
            .is_some_and(|sheet| sheet.recalculate_bounds(&self.a1_context));

        if !recalculated {
            return;
        }

        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        match serde_json::to_vec(&SheetBounds::from(sheet)) {
            Ok(sheet_bounds) => {
                crate::wasm_bindings::js::jsSheetBoundsUpdate(sheet_bounds);
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
        self.grid
            .try_sheet_mut(sheet_id)
            .map(|sheet| sheet.recalculate_bounds(&self.a1_context));

        self.update_a1_context_sheet_map(sheet_id);

        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        match serde_json::to_vec(&SheetInfo::from(sheet)) {
            Ok(sheet_info) => {
                crate::wasm_bindings::js::jsAddSheet(
                    sheet_info,
                    transaction.is_user_ai_undo_redo(),
                );
            }
            Err(e) => {
                dbgjs!(format!(
                    "[send_add_sheet] Error serializing sheet info {:?}",
                    e.to_string()
                ));
            }
        }

        sheet.send_content_cache();
        sheet.send_data_tables_cache();
        sheet.send_merge_cells();
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
            transaction.is_user_ai_undo_redo(),
        );
    }

    /// Sends sheet info to the client
    pub(crate) fn send_sheet_info(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.sheet_info.clear();
            return;
        }

        let sheet_ids = std::mem::take(&mut transaction.sheet_info);
        for sheet_id in sheet_ids.iter() {
            let Some(sheet) = self.try_sheet(*sheet_id) else {
                continue;
            };

            match serde_json::to_vec(&SheetInfo::from(sheet)) {
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
    }

    /// Sends individual offsets that have been modified to the client
    pub(crate) fn send_offsets_modified(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.offsets_modified.clear();
            return;
        }

        let offsets_modified = std::mem::take(&mut transaction.offsets_modified);
        for (sheet_id, offsets) in offsets_modified.into_iter() {
            let mut offsets = offsets
                .into_iter()
                .map(|((column, row), size)| JsOffset {
                    column: column.map(|c| c as i32),
                    row: row.map(|r| r as i32),
                    size,
                })
                .collect::<Vec<JsOffset>>();
            offsets.sort_by(|a, b| a.row.cmp(&b.row).then(a.column.cmp(&b.column)));

            match serde_json::to_vec(&offsets) {
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
    }

    pub(crate) fn send_code_cells(&mut self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.sheet_data_tables_cache.clear();
            transaction.code_cells.clear();
            transaction.html_cells.clear();
            transaction.image_cells.clear();
            return;
        }

        self.send_sheet_data_tables_cache(transaction);

        let mut update_code_cells = Vec::new();
        let code_cells = std::mem::take(&mut transaction.code_cells);
        for (sheet_id, positions) in code_cells.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            for pos in positions.into_iter() {
                update_code_cells.push(JsUpdateCodeCell {
                    sheet_id: sheet.id,
                    pos,
                    render_code_cell: sheet.get_render_code_cell(pos),
                });
            }
        }
        if !update_code_cells.is_empty() {
            // Sort so that None render cells come first, then Some render cells
            update_code_cells.sort_by(|a, b| {
                match (a.render_code_cell.is_none(), b.render_code_cell.is_none()) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => std::cmp::Ordering::Equal,
                }
            });

            if let Ok(update_code_cells) = serde_json::to_vec(&update_code_cells) {
                crate::wasm_bindings::js::jsUpdateCodeCells(update_code_cells);
            }
        }

        self.send_html_cells(transaction);
        self.send_images(transaction);
    }

    fn send_sheet_data_tables_cache(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.sheet_data_tables_cache.clear();
            return;
        }

        let sheet_data_tables_cache = std::mem::take(&mut transaction.sheet_data_tables_cache);
        for sheet_id in sheet_data_tables_cache.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            sheet.send_data_tables_cache();
        }
    }

    fn send_html_cells(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.html_cells.clear();
            return;
        }

        let html_cells = std::mem::take(&mut transaction.html_cells);
        for (sheet_id, positions) in html_cells.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
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
                    chart_image: None,
                });

                match serde_json::to_vec(&html) {
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
    }

    fn send_images(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.image_cells.clear();
            return;
        }

        let image_cells = std::mem::take(&mut transaction.image_cells);
        for (sheet_id, positions) in image_cells.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            for pos in positions.iter() {
                sheet.send_image(pos.to_owned());
            }
        }
    }

    fn send_validations(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.validations.clear();
            transaction.validations_warnings.clear();
            return;
        }

        let validations = std::mem::take(&mut transaction.validations);
        for sheet_id in validations.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            sheet.send_all_validations();
        }

        let validations_warnings = std::mem::take(&mut transaction.validations_warnings);
        let mut all_warnings = Vec::new();
        for (sheet_id, warnings) in validations_warnings.into_iter() {
            all_warnings.push(JsHashValidationWarnings {
                sheet_id,
                hash: None,
                warnings: warnings.into_values().collect::<Vec<_>>(),
            });
        }
        self.send_validation_warnings(all_warnings);
    }

    fn send_conditional_formats(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.conditional_formats.clear();
            return;
        }

        let conditional_formats = std::mem::take(&mut transaction.conditional_formats);
        for sheet_id in conditional_formats.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            sheet.send_all_conditional_formats(self.a1_context());
        }
    }

    fn send_borders(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.sheet_borders.clear();
            return;
        }

        let sheet_borders = std::mem::take(&mut transaction.sheet_borders);
        for sheet_id in sheet_borders.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            sheet.send_sheet_borders();
        }
    }

    fn send_fills(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.fill_cells.clear();
            transaction.sheet_meta_fills.clear();
            return;
        }

        let fill_cells = std::mem::take(&mut transaction.fill_cells);
        let sheet_meta_fills = std::mem::take(&mut transaction.sheet_meta_fills);

        // Get viewport info to determine which fills are visible
        let viewport_info = self
            .viewport_buffer
            .as_ref()
            .and_then(|vb| vb.get_viewport());

        let mut render_fills_in_hashes = Vec::new();
        let mut dirty_fills_outside_viewport: HashMap<SheetId, Vec<Pos>> = HashMap::new();

        // Track which sheets we've already sent meta fills for
        let mut meta_fills_sent: HashSet<SheetId> = HashSet::new();

        for (sheet_id, hashes) in fill_cells.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            for hash in hashes.into_iter() {
                // Check if this hash is in the viewport
                let in_viewport = viewport_info
                    .as_ref()
                    .map(|(top_left, bottom_right, viewport_sheet_id)| {
                        *viewport_sheet_id == sheet_id
                            && Rect::new_span(*top_left, *bottom_right).contains(hash)
                    })
                    .unwrap_or(true); // If no viewport info, send all fills

                if in_viewport {
                    let rect = Rect::from_numbers(
                        hash.x * CELL_SHEET_WIDTH as i64,
                        hash.y * CELL_SHEET_HEIGHT as i64,
                        CELL_SHEET_WIDTH as i64,
                        CELL_SHEET_HEIGHT as i64,
                    );

                    let mut fills = sheet.get_render_fills_in_rect(rect);

                    // Add conditional format fills
                    let cf_fills =
                        self.get_conditional_format_fills(sheet_id, rect, self.a1_context());
                    for (fill_rect, color) in cf_fills {
                        fills.push(crate::grid::js_types::JsRenderFill {
                            x: fill_rect.min.x,
                            y: fill_rect.min.y,
                            w: fill_rect.width(),
                            h: fill_rect.height(),
                            color,
                        });
                    }

                    render_fills_in_hashes.push(JsHashRenderFills {
                        sheet_id,
                        hash,
                        fills,
                    });
                } else {
                    dirty_fills_outside_viewport
                        .entry(sheet_id)
                        .or_default()
                        .push(hash);
                }
            }

            // Only send meta fills if they were explicitly marked dirty
            if sheet_meta_fills.contains(&sheet_id) {
                let sheet_fills = sheet.get_all_sheet_fills();
                if let Ok(sheet_fills) = serde_json::to_vec(&sheet_fills) {
                    crate::wasm_bindings::js::jsSheetMetaFills(sheet_id.to_string(), sheet_fills);
                }
                meta_fills_sent.insert(sheet_id);
            }
        }

        // Send meta fills for sheets that only have meta fill changes (no finite fill changes)
        for sheet_id in sheet_meta_fills.into_iter() {
            if !meta_fills_sent.contains(&sheet_id) {
                let Some(sheet) = self.try_sheet(sheet_id) else {
                    continue;
                };

                let sheet_fills = sheet.get_all_sheet_fills();
                if let Ok(sheet_fills) = serde_json::to_vec(&sheet_fills) {
                    crate::wasm_bindings::js::jsSheetMetaFills(sheet_id.to_string(), sheet_fills);
                }
            }
        }

        // Send visible fills
        if !render_fills_in_hashes.is_empty() {
            match serde_json::to_vec(&render_fills_in_hashes) {
                Ok(render_fills) => {
                    crate::wasm_bindings::js::jsHashRenderFills(render_fills);
                }
                Err(e) => {
                    dbgjs!(format!(
                        "[send_fills] Error serializing render fills {:?}",
                        e
                    ));
                }
            }
        }

        // Send dirty fills outside viewport so client can request them later
        if !dirty_fills_outside_viewport.is_empty() {
            let dirty_hashes: Vec<JsHashesDirty> = dirty_fills_outside_viewport
                .into_iter()
                .map(|(sheet_id, hashes)| JsHashesDirty { sheet_id, hashes })
                .collect();

            if let Ok(dirty_hashes) = serde_json::to_vec(&dirty_hashes) {
                crate::wasm_bindings::js::jsHashesDirtyFills(dirty_hashes);
            }
        }
    }

    /// Sends A1Context as bytes to the client.
    pub(crate) fn send_a1_context(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serialize(&SerializationFormat::Bincode, self.a1_context()) {
            Ok(bytes) => crate::wasm_bindings::js::jsA1Context(bytes),
            Err(e) => {
                dbgjs!(format!(
                    "[send_a1_context] Error serializing A1Context {:?}",
                    e.to_string()
                ));
            }
        }
    }

    /// Sends the content cache to the client.
    pub fn send_content_cache(&self, transaction: &mut PendingTransaction) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let sheet_content_cache = std::mem::take(&mut transaction.sheet_content_cache);
        for sheet_id in sheet_content_cache.into_iter() {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                continue;
            };

            sheet.send_content_cache();
        }
    }

    fn send_set_cursor(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            transaction.update_selection = None;
            return;
        }

        if let Some(selection) = std::mem::take(&mut transaction.update_selection) {
            crate::wasm_bindings::js::jsSetCursor(selection);
        }
    }

    fn send_undo_redo(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        crate::wasm_bindings::js::jsUndoRedo(
            !self.undo_stack.is_empty(),
            !self.redo_stack.is_empty(),
        );
    }

    fn send_merge_cells(&self, transaction: &mut PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        for (sheet_id, dirty_hashes) in transaction.merge_cells_updates.iter() {
            if let Some(sheet) = self.try_sheet(*sheet_id) {
                match serialize(&SerializationFormat::Bincode, &sheet.merge_cells) {
                    Ok(merge_cells) => {
                        let hashes: Vec<Pos> = dirty_hashes.iter().copied().collect();
                        let dirty_hashes_json =
                            serde_json::to_vec(&hashes).unwrap_or_default();
                        crate::wasm_bindings::js::jsMergeCells(
                            sheet_id.to_string(),
                            merge_cells,
                            dirty_hashes_json,
                        );
                    }
                    Err(e) => {
                        dbgjs!(format!(
                            "[send_merge_cells] Error serializing merge cells {:?}",
                            e
                        ));
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        Pos, SheetPos,
        a1::A1Selection,
        controller::{
            GridController,
            active_transactions::pending_transaction::PendingTransaction,
            execution::TransactionSource,
            transaction_types::{JsCellValueResult, JsCodeResult},
        },
        grid::{
            SheetId,
            js_types::{JsHashRenderCells, JsHashesDirty, JsHtmlOutput, JsRenderCell},
        },
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count},
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
        expect_js_call_count("jsHashesRenderCells", 0, false);
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
        expect_js_call_count("jsHashesRenderCells", 1, false);
        expect_js_call_count("jsHashesDirty", 0, false);
        gc.process_remaining_dirty_hashes(&mut transaction);
        assert!(transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsHashesRenderCells", 0, false);
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
        expect_js_call_count("jsHashesRenderCells", 0, false);
        expect_js_call_count("jsHashesDirty", 0, false);
        gc.process_remaining_dirty_hashes(&mut transaction);
        assert!(transaction.dirty_hashes.is_empty());
        expect_js_call_count("jsHashesRenderCells", 0, false);
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

        let dirty_hashes = vec![JsHashesDirty {
            sheet_id,
            hashes: vec![Pos { x: 0, y: 0 }],
        }];
        expect_js_call(
            "jsHashesDirty",
            format!("{:?}", serde_json::to_vec(&dirty_hashes).unwrap()),
            false,
        );
        expect_js_call_count("jsHashesRenderCells", 0, true);
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
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id.to_string();
        gc.calculation_complete(JsCodeResult {
            transaction_id,
            success: true,
            output_value: Some(JsCellValueResult("<html></html>".to_string(), 1)),
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
            false,
        );

        expect_js_call(
            "jsUpdateHtml",
            format!(
                "{:?}",
                serde_json::to_vec(&JsHtmlOutput {
                    sheet_id: sheet_id.to_string(),
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 3,
                    html: Some("<html></html>".to_string()),
                    show_name: true,
                    name: "Python1".to_string(),
                    chart_image: None,
                })
                .unwrap()
            ),
            true,
        );
    }

    #[test]
    fn send_render_cells_from_rects() {
        let mut gc = GridController::test_with_viewport_buffer();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value((0, 0, sheet_id).into(), "test 1".to_string(), None, false);
        gc.set_cell_value(
            (100, 100, sheet_id).into(),
            "test 2".to_string(),
            None,
            false,
        );

        let render_cells = vec![JsHashRenderCells {
            sheet_id,
            hash: (Pos { x: 0, y: 0 }).quadrant().into(),
            cells: vec![JsRenderCell {
                value: "test 1".to_string(),
                ..Default::default()
            }],
        }];
        expect_js_call(
            "jsHashesRenderCells",
            format!("{:?}", serde_json::to_vec(&render_cells).unwrap()),
            false,
        );

        let render_cells = vec![JsHashRenderCells {
            sheet_id,
            hash: (Pos { x: 100, y: 100 }).quadrant().into(),
            cells: vec![JsRenderCell {
                x: 100,
                y: 100,
                value: "test 2".to_string(),
                ..Default::default()
            }],
        }];
        expect_js_call(
            "jsHashesRenderCells",
            format!("{:?}", serde_json::to_vec(&render_cells).unwrap()),
            true,
        );
    }

    #[test]
    fn test_send_fills_in_viewport() {
        clear_js_calls();
        let mut gc = GridController::test_with_viewport_buffer();

        // Set a fill color on a cell inside the viewport (0,0 is inside the test viewport)
        gc.set_fill_color(
            &A1Selection::test_a1("A1"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        // Verify jsHashRenderFills was called (fill is in viewport)
        expect_js_call_count("jsHashRenderFills", 1, false);
        // Verify jsHashesDirtyFills was NOT called (no fills outside viewport)
        expect_js_call_count("jsHashesDirtyFills", 0, true);
    }

    #[test]
    fn test_send_fills_outside_viewport() {
        clear_js_calls();
        let mut gc = GridController::test_with_viewport_buffer();

        // Set a fill color on a cell far outside the viewport
        // The test viewport is approximately -10 to 10 in hash coordinates
        gc.set_fill_color(
            &A1Selection::test_a1("ZZ1000"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        // Verify jsHashRenderFills was NOT called (fill is outside viewport)
        expect_js_call_count("jsHashRenderFills", 0, false);
        // Verify jsHashesDirtyFills was called (fill outside viewport marked dirty)
        expect_js_call_count("jsHashesDirtyFills", 1, true);
    }

    #[test]
    fn test_send_fills_mixed_viewport() {
        clear_js_calls();
        let mut gc = GridController::test_with_viewport_buffer();

        // Set fills both inside and outside the viewport
        gc.set_fill_color(
            &A1Selection::test_a1("A1,ZZ1000"),
            Some("green".to_string()),
            None,
            false,
        )
        .unwrap();

        // Both should be called - one for visible fills, one for dirty fills
        expect_js_call_count("jsHashRenderFills", 1, false);
        expect_js_call_count("jsHashesDirtyFills", 1, true);
    }

    #[test]
    fn test_send_fills_server_transaction() {
        clear_js_calls();
        let gc = GridController::test_with_viewport_buffer();
        let sheet_id = gc.sheet_ids()[0];

        // Create a server transaction with fill cells
        let mut transaction = PendingTransaction {
            source: TransactionSource::Server,
            ..Default::default()
        };
        transaction
            .fill_cells
            .insert(sheet_id, HashSet::from([Pos { x: 0, y: 0 }]));

        gc.send_fills(&mut transaction);

        // Server transactions should not send fills
        expect_js_call_count("jsHashRenderFills", 0, false);
        expect_js_call_count("jsHashesDirtyFills", 0, false);
        expect_js_call_count("jsSheetMetaFills", 0, true);
    }

    #[test]
    fn test_send_meta_fills() {
        clear_js_calls();
        let mut gc = GridController::test_with_viewport_buffer();

        // Set an infinite column fill (meta fill)
        gc.set_fill_color(
            &A1Selection::test_a1("A:A"),
            Some("yellow".to_string()),
            None,
            false,
        )
        .unwrap();

        // Meta fills should be sent
        expect_js_call_count("jsSheetMetaFills", 1, true);
    }

    #[test]
    fn test_send_fills_without_viewport_buffer() {
        clear_js_calls();
        let mut gc = GridController::test(); // No viewport buffer

        // Set a fill color - without viewport buffer, all fills should be sent
        gc.set_fill_color(
            &A1Selection::test_a1("ZZ1000"),
            Some("purple".to_string()),
            None,
            false,
        )
        .unwrap();

        // Without viewport buffer, fills should be sent immediately (not marked dirty)
        expect_js_call_count("jsHashRenderFills", 1, false);
        expect_js_call_count("jsHashesDirtyFills", 0, true);
    }
}
