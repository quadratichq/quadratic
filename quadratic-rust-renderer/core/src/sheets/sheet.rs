//! Single sheet data

use quadratic_core_shared::SheetId;

use super::fills::CellsFills;
use super::text::CellsText;

/// Data for a single sheet
pub struct Sheet {
    /// Sheet ID
    pub id: SheetId,

    /// Sheet offsets (column widths, row heights)
    pub offsets: quadratic_core_shared::SheetOffsets,

    /// Cell fills (backgrounds)
    pub fills: CellsFills,

    /// Cell text
    pub text: CellsText,
}

impl Sheet {
    pub fn new(id: SheetId) -> Self {
        Self {
            id,
            offsets: quadratic_core_shared::SheetOffsets::default(),
            fills: CellsFills::new(),
            text: CellsText::new(),
        }
    }

    pub fn id(&self) -> SheetId {
        self.id
    }

    /// Get max content width for a column (for auto-resize)
    pub fn get_column_max_width(&self, _column: i64) -> f32 {
        // TODO: Implement based on text content
        0.0
    }

    /// Get max content height for a row (for auto-resize)
    pub fn get_row_max_height(&self, _row: i64) -> f32 {
        // TODO: Implement based on text content
        0.0
    }
}
