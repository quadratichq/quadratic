//! Core message handler

use quadratic_core_shared::{CoreToRenderer, SheetOffsets, serialization};

use super::LayoutState;

/// Handle a bincode-encoded message from Core
pub fn handle_core_message(state: &mut LayoutState, data: &[u8]) -> Result<(), String> {
    let message: CoreToRenderer = serialization::deserialize(data)
        .map_err(|e| format!("Failed to decode CoreToRenderer: {}", e))?;

    match message {
        CoreToRenderer::InitSheet {
            sheet_id,
            hash_cells,
        } => {
            // Initialize sheet with initial hash data
            for hash_data in hash_cells {
                if hash_data.sheet_id == sheet_id {
                    state.set_labels_for_hash(
                        hash_data.hash_pos.x,
                        hash_data.hash_pos.y,
                        hash_data.cells,
                    );
                    state.set_fills_for_hash(
                        hash_data.hash_pos.x,
                        hash_data.hash_pos.y,
                        hash_data.fills,
                    );
                }
            }
        }

        CoreToRenderer::HashCells(hash_cells) => {
            log::info!(
                "[layout] Received HashCells: {} hashes, current_sheet_id: {:?}",
                hash_cells.len(),
                state.current_sheet_id()
            );

            // Updated cell data for specific hashes
            for hash_data in hash_cells {
                // If current sheet is not set or differs, set it from the hash data
                // This handles the race condition where hashes arrive before SheetInfo
                if state.current_sheet_id() != Some(hash_data.sheet_id) {
                    log::info!(
                        "[layout] Setting current sheet from hash data: {:?}",
                        hash_data.sheet_id
                    );
                    state.set_current_sheet(hash_data.sheet_id);
                }

                log::debug!(
                    "[layout] Processing hash ({}, {}) with {} cells",
                    hash_data.hash_pos.x,
                    hash_data.hash_pos.y,
                    hash_data.cells.len()
                );
                state.set_labels_for_hash(
                    hash_data.hash_pos.x,
                    hash_data.hash_pos.y,
                    hash_data.cells,
                );
                state.set_fills_for_hash(
                    hash_data.hash_pos.x,
                    hash_data.hash_pos.y,
                    hash_data.fills,
                );
            }
        }

        CoreToRenderer::DirtyHashes { sheet_id, hashes } => {
            // Mark hashes as dirty (need re-render)
            if state.current_sheet_id() == Some(sheet_id) {
                for hash_pos in hashes {
                    state.mark_hash_dirty(hash_pos.x, hash_pos.y);
                }
            }
        }

        CoreToRenderer::Selection(selection) => {
            // Update cursor/selection
            state.ui.cursor.set_selected_cell(selection.cursor.x, selection.cursor.y);
            // TODO: Handle ranges for multi-select
        }

        CoreToRenderer::MultiplayerCursors(_cursors) => {
            // TODO: Handle multiplayer cursors
        }

        CoreToRenderer::SheetInfo(info) => {
            // Decode offsets from SheetInfo
            let offsets: SheetOffsets = serialization::deserialize(&info.offsets_bytes)
                .map_err(|e| format!("Failed to deserialize offsets in SheetInfo: {}", e))?;

            log::info!(
                "[layout] Received SheetInfo for sheet {:?}, bounds: {:?}",
                info.sheet_id,
                info.bounds
            );

            // Create/update the sheet with offsets and bounds
            state.set_sheet(info.sheet_id, offsets, info.bounds);
        }

        CoreToRenderer::SheetOffsets {
            sheet_id,
            offsets_bytes,
        } => {
            // Decode and update sheet offsets
            if let Ok(offsets) = serialization::deserialize(&offsets_bytes) {
                if let Some(sheet) = state.sheets.get_mut(&sheet_id) {
                    sheet.sheet_offsets = offsets;
                }
            }
        }

        CoreToRenderer::SheetDeleted { sheet_id } => {
            state.sheets.remove_sheet(sheet_id);
        }

        CoreToRenderer::ClearSheet { sheet_id } => {
            if let Some(sheet) = state.sheets.get_mut(&sheet_id) {
                sheet.hashes.clear();
                sheet.label_count = 0;
            }
        }

        CoreToRenderer::SheetMetaFills {
            sheet_id: _,
            fills_bytes,
        } => {
            // Decode and update meta fills
            if let Ok(fills) = serialization::deserialize(&fills_bytes) {
                state.set_meta_fills(fills);
            }
        }

        CoreToRenderer::CodeCells {
            sheet_id,
            code_cells,
        } => {
            state.set_code_cells(sheet_id, code_cells);
        }

        CoreToRenderer::CodeCellUpdate {
            sheet_id,
            pos,
            code_cell,
        } => {
            state.update_code_cell(sheet_id, pos, code_cell);
        }

        CoreToRenderer::ActiveTable { sheet_id, pos } => {
            state.set_active_table(sheet_id, pos);
        }
    }

    Ok(())
}
