use std::collections::HashSet;

use itertools::Itertools;

use crate::{
    grid::{js_types::JsPos, SheetId},
    viewport::ViewportBuffer,
    Pos, SheetRect,
};

use super::{active_transactions::pending_transaction::PendingTransaction, GridController};

impl GridController {
    pub fn send_viewport_buffer(&self, transaction: &mut PendingTransaction) {
        if !cfg!(target_family = "wasm") || transaction.is_server() {
            return;
        }

        let viewport_buffer = ViewportBuffer::default();
        crate::wasm_bindings::js::jsSendViewportBuffer(
            transaction.id.to_string(),
            viewport_buffer.get_buffer(),
        );
        transaction.viewport_buffer = Some(viewport_buffer);
    }

    pub fn clear_viewport_buffer(&self, transaction: &mut PendingTransaction) {
        if !cfg!(target_family = "wasm") || transaction.is_server() {
            return;
        }

        crate::wasm_bindings::js::jsClearViewportBuffer(transaction.id.to_string());
        transaction.viewport_buffer = None;
    }

    pub fn add_dirty_hashes_from_sheet_rect(
        &self,
        transaction: &mut PendingTransaction,
        sheet_rect: SheetRect,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let hashes = sheet_rect.to_hashes();
        let dirty_hashes = transaction
            .dirty_hashes
            .entry(sheet_rect.sheet_id)
            .or_default();
        dirty_hashes.extend(hashes);
    }

    pub fn add_dirty_hashes_from_sheet_cell_positions(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        positions: HashSet<Pos>,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || transaction.is_server() {
            return;
        }

        let mut hashes = HashSet::new();
        positions.iter().for_each(|pos| {
            let quadrant = pos.quadrant();
            hashes.insert(Pos {
                x: quadrant.0,
                y: quadrant.1,
            });
        });

        let dirty_hashes = transaction.dirty_hashes.entry(sheet_id).or_default();
        dirty_hashes.extend(hashes);
    }

    pub fn process_visible_dirty_hashes(&self, transaction: &mut PendingTransaction) {
        // during tests, send all dirty hashes to the client
        if cfg!(test) {
            for (sheet_id, hashes) in transaction.dirty_hashes.iter() {
                if let Some(sheet) = self.try_sheet(sheet_id.to_owned()) {
                    sheet.send_render_cells_in_hashes(hashes.to_owned());
                }
            }
            return;
        }

        if !cfg!(target_family = "wasm")
            || transaction.dirty_hashes.is_empty()
            || transaction.is_server()
        {
            return;
        }

        if let Some(viewport_buffer) = &transaction.viewport_buffer {
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

                    let remaining_hashes = self.send_render_cells_in_viewport(
                        viewport_sheet_id,
                        nearest_dirty_hashes,
                        viewport_buffer,
                    );
                    transaction
                        .dirty_hashes
                        .insert(viewport_sheet_id, remaining_hashes);
                }
            }
        }
    }

    pub fn send_render_cells_in_viewport(
        &self,
        sheet_id: SheetId,
        dirty_hashes: Vec<Pos>,
        viewport_buffer: &ViewportBuffer,
    ) -> HashSet<Pos> {
        if !cfg!(target_family = "wasm") || dirty_hashes.is_empty() {
            return HashSet::new();
        }

        let mut remaining_hashes = HashSet::new();
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
        remaining_hashes
    }

    pub fn process_remaining_dirty_hashes(&self, transaction: &mut PendingTransaction) {
        if !cfg!(target_family = "wasm") || transaction.dirty_hashes.is_empty() {
            return;
        }

        for (&sheet_id, dirty_hashes) in transaction.dirty_hashes.iter_mut() {
            self.flag_hashes_dirty(sheet_id, dirty_hashes);
            dirty_hashes.clear();
        }
        transaction.dirty_hashes.clear();
    }

    pub fn flag_hashes_dirty(&self, sheet_id: SheetId, dirty_hashes: &HashSet<Pos>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) || dirty_hashes.is_empty() {
            return;
        }

        let hashes = dirty_hashes
            .iter()
            .map(|pos| JsPos::from(*pos))
            .collect::<Vec<JsPos>>();

        if let Ok(hashes_string) = serde_json::to_string(&hashes) {
            crate::wasm_bindings::js::jsHashesDirty(sheet_id.to_string(), hashes_string);
        }
    }
}
