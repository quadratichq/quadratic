//! Message handler for bincode messages from core.
//!
//! Decodes CoreToRenderer messages and updates the renderer state.

use quadratic_core_shared::{CoreToRenderer, SheetFill, SheetOffsets, serialization};

use super::state::RendererState;

/// Handle a bincode-encoded message from core.
///
/// Returns true if the message was handled successfully.
pub fn handle_core_message(state: &mut RendererState, data: &[u8]) -> Result<(), String> {
    let message: CoreToRenderer = serialization::deserialize(data)
        .map_err(|e| format!("Failed to deserialize message: {e}"))?;

    match message {
        CoreToRenderer::SheetOffsets {
            sheet_id,
            offsets_bytes,
        } => {
            let offsets: SheetOffsets = serialization::deserialize(&offsets_bytes)
                .map_err(|e| format!("Failed to deserialize offsets: {e}"))?;
            state.set_sheet_offsets(sheet_id, offsets);
            Ok(())
        }

        CoreToRenderer::InitSheet { .. } => Ok(()),

        CoreToRenderer::HashCells(hash_cells_vec) => {
            for hash_cells in hash_cells_vec {
                // If current sheet is not set or differs, set it from the hash data
                // This handles the race condition where hashes arrive before SheetInfo
                if state.current_sheet_id() != Some(hash_cells.sheet_id) {
                    log::info!(
                        "[rust_renderer] Setting current sheet from hash data: {:?}",
                        hash_cells.sheet_id
                    );
                    state.set_current_sheet(hash_cells.sheet_id);
                }

                state.set_fills_for_hash(
                    hash_cells.hash_pos.x,
                    hash_cells.hash_pos.y,
                    hash_cells.fills,
                );
                state.set_labels_for_hash(
                    hash_cells.hash_pos.x,
                    hash_cells.hash_pos.y,
                    hash_cells.cells,
                );
            }
            Ok(())
        }

        CoreToRenderer::DirtyHashes { .. } => {
            // TODO: Implement dirty hash handling
            Ok(())
        }

        CoreToRenderer::Selection(_selection) => {
            // TODO: Implement selection handling
            Ok(())
        }

        CoreToRenderer::MultiplayerCursors(_cursors) => {
            // TODO: Implement multiplayer cursor handling
            Ok(())
        }

        CoreToRenderer::SheetInfo(info) => {
            let offsets: SheetOffsets = serialization::deserialize(&info.offsets_bytes)
                .map_err(|e| format!("Failed to deserialize offsets in SheetInfo: {e}"))?;
            log::info!(
                "[rust_renderer] Received SheetInfo for sheet {:?}, bounds: {:?}",
                info.sheet_id,
                info.bounds
            );
            state.set_sheet(info.sheet_id, offsets, info.bounds);
            Ok(())
        }

        CoreToRenderer::SheetDeleted { sheet_id } => {
            state.remove_sheet(sheet_id);
            Ok(())
        }

        CoreToRenderer::ClearSheet { .. } => {
            // TODO: Implement sheet clear handling
            Ok(())
        }

        CoreToRenderer::SheetMetaFills {
            sheet_id: _,
            fills_bytes,
        } => {
            let fills: Vec<SheetFill> = serialization::deserialize(&fills_bytes)
                .map_err(|e| format!("Failed to deserialize meta fills: {e}"))?;
            state.set_meta_fills(fills);
            Ok(())
        }

        CoreToRenderer::CodeCells {
            sheet_id,
            code_cells,
        } => {
            state.set_code_cells(sheet_id, code_cells);
            Ok(())
        }

        CoreToRenderer::CodeCellUpdate {
            sheet_id,
            code_cell,
            pos,
        } => {
            state.update_code_cell(sheet_id, pos, code_cell);
            Ok(())
        }

        CoreToRenderer::ActiveTable { sheet_id, pos } => {
            state.set_active_table(sheet_id, pos);
            Ok(())
        }
    }
}
