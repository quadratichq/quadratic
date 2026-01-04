use bincode::{Decode, Encode};

use crate::{Pos, Rgba, SheetId};

/// Hash render fills - used for communication between core and client
/// Note: Uses serde only (not bincode) due to SheetId/Pos dependencies
#[derive(Debug, PartialEq)]
pub struct HashRenderFills {
    pub sheet_id: SheetId,
    pub hash: Pos,
    pub fills: Vec<RenderFill>,
}

/// A single cell fill (background color)
/// Supports bincode encoding for efficient core-to-renderer communication
#[derive(Debug, Clone, PartialEq, Encode, Decode)]
pub struct RenderFill {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,

    pub color: Rgba,
}

impl RenderFill {
    /// Create a new render fill
    pub fn new(x: i64, y: i64, w: u32, h: u32, color: Rgba) -> Self {
        Self { x, y, w, h, color }
    }

    /// Create a single-cell fill
    pub fn single(x: i64, y: i64, color: Rgba) -> Self {
        Self::new(x, y, 1, 1, color)
    }
}

/// A sheet-level fill (infinite row/column/sheet background)
/// Supports bincode encoding for efficient core-to-renderer communication
#[derive(Default, Debug, Clone, PartialEq, Encode, Decode)]
pub struct SheetFill {
    pub x: u32,
    pub y: u32,
    pub w: Option<u32>,
    pub h: Option<u32>,
    pub color: Rgba,
}
