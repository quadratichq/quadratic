//! Message handler for bincode messages from core.
//!
//! Decodes CoreToRenderer messages and updates the renderer state.

use quadratic_core_shared::{serialization, CoreToRenderer, SheetOffsets};

use super::state::RendererState;

/// Handle a bincode-encoded message from core.
///
/// Returns true if the message was handled successfully.
pub fn handle_core_message(state: &mut RendererState, data: &[u8]) -> Result<(), String> {
    log::info!(
        "[message_handler] Received message from core ({} bytes)",
        data.len()
    );

    let message: CoreToRenderer = serialization::deserialize(data)
        .map_err(|e| format!("Failed to deserialize message: {e}"))?;

    log::info!("[message_handler] Decoded message: {:?}", message);

    match message {
        CoreToRenderer::SheetOffsets {
            sheet_id,
            offsets_bytes,
        } => {
            // Decode the SheetOffsets from the embedded bytes
            // Core's SheetOffsets and core-shared's SheetOffsets are structurally identical
            let offsets: SheetOffsets = serialization::deserialize(&offsets_bytes)
                .map_err(|e| format!("Failed to deserialize offsets: {e}"))?;

            let (default_col, default_row) = offsets.defaults();
            log::info!(
                "[message_handler] Received SheetOffsets for sheet {}: default_col={}, default_row={}",
                sheet_id,
                default_col,
                default_row
            );

            // Store the offsets in the renderer state
            state.set_sheet_offsets(sheet_id.to_string(), offsets);

            Ok(())
        }

        CoreToRenderer::InitSheet { sheet_id, .. } => {
            log::info!("[message_handler] Received InitSheet for sheet {}", sheet_id);
            // TODO: Implement cell data handling
            Ok(())
        }

        CoreToRenderer::HashCells(_) => {
            log::debug!("[message_handler] Received HashCells");
            // TODO: Implement cell data handling
            Ok(())
        }

        CoreToRenderer::DirtyHashes { sheet_id, hashes } => {
            log::debug!(
                "[message_handler] Received DirtyHashes for sheet {}: {} hashes",
                sheet_id,
                hashes.len()
            );
            // TODO: Implement dirty hash handling
            Ok(())
        }

        CoreToRenderer::Selection(selection) => {
            log::debug!(
                "[message_handler] Received Selection for sheet {} at ({}, {})",
                selection.sheet_id,
                selection.cursor.x,
                selection.cursor.y
            );
            // TODO: Implement selection handling
            Ok(())
        }

        CoreToRenderer::MultiplayerCursors(cursors) => {
            log::debug!(
                "[message_handler] Received MultiplayerCursors: {} cursors",
                cursors.len()
            );
            // TODO: Implement multiplayer cursor handling
            Ok(())
        }

        CoreToRenderer::SheetInfo(info) => {
            // Decode the SheetOffsets from the embedded bytes
            let offsets: SheetOffsets = serialization::deserialize(&info.offsets_bytes)
                .map_err(|e| format!("Failed to deserialize offsets in SheetInfo: {e}"))?;

            let (default_col, default_row) = offsets.defaults();
            log::info!(
                "[message_handler] Received SheetInfo for sheet {}: '{}', order={}, color={:?}, default_col={}, default_row={}",
                info.sheet_id,
                info.name,
                info.order,
                info.color,
                default_col,
                default_row
            );

            // Add or update the sheet in the renderer state
            state.set_sheet(
                info.sheet_id.to_string(),
                info.name,
                info.order,
                info.color,
                offsets,
            );

            Ok(())
        }

        CoreToRenderer::SheetDeleted { sheet_id } => {
            log::info!("[message_handler] Received SheetDeleted for sheet {}", sheet_id);
            state.remove_sheet(&sheet_id.to_string());
            Ok(())
        }

        CoreToRenderer::ClearSheet { sheet_id } => {
            log::info!("[message_handler] Received ClearSheet for sheet {}", sheet_id);
            // TODO: Implement sheet clear handling
            Ok(())
        }
    }
}
