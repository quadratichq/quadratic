//! Message types for core ↔ renderer communication.
//!
//! These messages are serialized using bincode for efficient binary transfer
//! between workers.

use serde::{Deserialize, Serialize};

use crate::{Pos, Rect, Rgba, SheetId};

/// Messages sent from quadratic-core to quadratic-rust-renderer.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum CoreToRenderer {
    /// Initial viewport data when a sheet is opened
    InitSheet {
        sheet_id: SheetId,
        /// Hash cells data for the visible viewport
        hash_cells: Vec<HashCells>,
    },

    /// Updated cell data for specific hashes
    HashCells(Vec<HashCells>),

    /// Notification that specific hashes need to be re-rendered
    DirtyHashes {
        sheet_id: SheetId,
        hashes: Vec<Pos>,
    },

    /// Selection has changed
    Selection(Selection),

    /// Multiplayer cursors have changed
    MultiplayerCursors(Vec<MultiplayerCursor>),

    /// Sheet metadata has changed (name, color, order)
    SheetInfo(SheetInfo),

    /// Column/row sizes have changed
    SheetOffsets {
        sheet_id: SheetId,
        column_widths: Vec<(i64, f64)>,
        row_heights: Vec<(i64, f64)>,
    },

    /// Sheet was deleted
    SheetDeleted { sheet_id: SheetId },

    /// Request renderer to clear cache for a sheet
    ClearSheet { sheet_id: SheetId },
}

/// Messages sent from quadratic-rust-renderer to quadratic-core.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum RendererToCore {
    /// Renderer's viewport has changed, requesting cell data
    ViewportChanged {
        sheet_id: SheetId,
        /// Visible rectangle in cell coordinates
        visible_rect: Rect,
        /// Hash bounds (min/max hash coordinates)
        hash_bounds: Rect,
    },

    /// User clicked on a cell
    CellClick {
        sheet_id: SheetId,
        pos: Pos,
        modifiers: Modifiers,
    },

    /// User is hovering over a cell
    CellHover {
        sheet_id: SheetId,
        pos: Option<Pos>,
    },

    /// User started selecting cells
    SelectionStart {
        sheet_id: SheetId,
        pos: Pos,
        modifiers: Modifiers,
    },

    /// User is dragging selection
    SelectionDrag {
        sheet_id: SheetId,
        pos: Pos,
    },

    /// User finished selecting
    SelectionEnd,

    /// User double-clicked to edit a cell
    CellEdit {
        sheet_id: SheetId,
        pos: Pos,
    },

    /// User is resizing a column
    ColumnResize {
        sheet_id: SheetId,
        column: i64,
        width: f64,
    },

    /// User is resizing a row
    RowResize {
        sheet_id: SheetId,
        row: i64,
        height: f64,
    },

    /// Renderer is ready and requesting initial data
    Ready,
}

/// Cell data for a hash bucket.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HashCells {
    pub sheet_id: SheetId,
    /// Hash position (quadrant coordinates)
    pub hash_pos: Pos,
    /// Cells in this hash
    pub cells: Vec<RenderCell>,
}

/// A cell to be rendered.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RenderCell {
    /// Position within the sheet
    pub pos: Pos,
    /// Display value (formatted string)
    pub value: String,
    /// Text style
    pub style: TextStyle,
}

/// Text styling for a cell.
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct TextStyle {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strike_through: bool,
    pub text_color: Option<Rgba>,
    pub fill_color: Option<Rgba>,
    pub align: Option<crate::CellAlign>,
    pub vertical_align: Option<crate::CellVerticalAlign>,
    pub wrap: Option<crate::CellWrap>,
}

/// Current selection state.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Selection {
    pub sheet_id: SheetId,
    /// Primary cursor position
    pub cursor: Pos,
    /// Selected ranges (may be multiple for multi-select)
    pub ranges: Vec<Rect>,
}

/// Another user's cursor in multiplayer mode.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MultiplayerCursor {
    pub user_id: String,
    pub user_name: String,
    pub color: Rgba,
    pub sheet_id: SheetId,
    pub cursor: Pos,
    pub selection: Option<Rect>,
}

/// Sheet metadata for rendering tabs.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SheetInfo {
    pub sheet_id: SheetId,
    pub name: String,
    pub order: i32,
    pub color: Option<Rgba>,
}

/// Keyboard/mouse modifiers.
#[derive(Serialize, Deserialize, Debug, Default, Clone, Copy)]
pub struct Modifiers {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

impl Modifiers {
    pub const NONE: Self = Self {
        shift: false,
        ctrl: false,
        alt: false,
        meta: false,
    };

    pub const SHIFT: Self = Self {
        shift: true,
        ctrl: false,
        alt: false,
        meta: false,
    };

    pub const CTRL: Self = Self {
        shift: false,
        ctrl: true,
        alt: false,
        meta: false,
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::serialization;

    #[test]
    fn test_core_to_renderer_serialization() {
        let msg = CoreToRenderer::DirtyHashes {
            sheet_id: SheetId::test(),
            hashes: vec![Pos::new(0, 0), Pos::new(1, 1)],
        };

        let bytes = serialization::serialize(&msg).unwrap();
        let decoded: CoreToRenderer = serialization::deserialize(&bytes).unwrap();

        match decoded {
            CoreToRenderer::DirtyHashes { sheet_id, hashes } => {
                assert_eq!(sheet_id, SheetId::test());
                assert_eq!(hashes.len(), 2);
            }
            _ => panic!("Wrong message type"),
        }
    }

    #[test]
    fn test_renderer_to_core_serialization() {
        let msg = RendererToCore::CellClick {
            sheet_id: SheetId::test(),
            pos: Pos::new(5, 10),
            modifiers: Modifiers::SHIFT,
        };

        let bytes = serialization::serialize(&msg).unwrap();
        let decoded: RendererToCore = serialization::deserialize(&bytes).unwrap();

        match decoded {
            RendererToCore::CellClick { sheet_id, pos, modifiers } => {
                assert_eq!(sheet_id, SheetId::test());
                assert_eq!(pos, Pos::new(5, 10));
                assert!(modifiers.shift);
            }
            _ => panic!("Wrong message type"),
        }
    }
}
