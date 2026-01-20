//! Location identifier for code cells, including those embedded in DataTable arrays.

use serde::{Deserialize, Serialize};

use crate::SheetPos;

/// Identifies the location of a code cell for dependency tracking and execution.
///
/// Regular code cells (in sheet columns or DataTable code_runs) use a simple
/// SheetPos. Code cells embedded in a DataTable's value array use the table's
/// anchor position plus an offset into the data array.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CodeCellLocation {
    /// Regular code cell in sheet columns or DataTable code_run
    Sheet(SheetPos),

    /// CellValue::Code embedded in a DataTable's value array
    Embedded {
        /// The DataTable's anchor position (top-left of the table)
        table_pos: SheetPos,
        /// Position within the data array (0-indexed, independent of UI headers/sorting)
        x: u32,
        y: u32,
    },
}

impl CodeCellLocation {
    /// Creates a new sheet-level code cell location
    pub fn sheet(sheet_pos: SheetPos) -> Self {
        Self::Sheet(sheet_pos)
    }

    /// Creates a new embedded code cell location
    pub fn embedded(table_pos: SheetPos, x: u32, y: u32) -> Self {
        Self::Embedded { table_pos, x, y }
    }

    /// Returns the sheet ID where this code cell is located
    pub fn sheet_id(&self) -> crate::grid::SheetId {
        match self {
            Self::Sheet(pos) => pos.sheet_id,
            Self::Embedded { table_pos, .. } => table_pos.sheet_id,
        }
    }

    /// Returns the SheetPos for sheet-level code cells, or the table anchor for embedded cells
    pub fn anchor_pos(&self) -> SheetPos {
        match self {
            Self::Sheet(pos) => *pos,
            Self::Embedded { table_pos, .. } => *table_pos,
        }
    }

    /// Returns true if this is an embedded code cell
    pub fn is_embedded(&self) -> bool {
        matches!(self, Self::Embedded { .. })
    }
}

impl From<SheetPos> for CodeCellLocation {
    fn from(pos: SheetPos) -> Self {
        Self::Sheet(pos)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::SheetId;

    #[test]
    fn test_code_cell_location() {
        let sheet_id = SheetId::new();
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };

        // Test Sheet variant
        let loc = CodeCellLocation::sheet(sheet_pos);
        assert_eq!(loc.sheet_id(), sheet_id);
        assert_eq!(loc.anchor_pos(), sheet_pos);
        assert!(!loc.is_embedded());

        // Test Embedded variant
        let table_pos = SheetPos {
            x: 5,
            y: 10,
            sheet_id,
        };
        let loc = CodeCellLocation::embedded(table_pos, 2, 3);
        assert_eq!(loc.sheet_id(), sheet_id);
        assert_eq!(loc.anchor_pos(), table_pos);
        assert!(loc.is_embedded());

        // Test From<SheetPos>
        let loc: CodeCellLocation = sheet_pos.into();
        assert_eq!(loc, CodeCellLocation::Sheet(sheet_pos));

        // Test Hash (used in HashSet)
        let mut set = std::collections::HashSet::new();
        set.insert(CodeCellLocation::sheet(sheet_pos));
        set.insert(CodeCellLocation::embedded(table_pos, 2, 3));
        assert_eq!(set.len(), 2);

        // Same location should not increase set size
        set.insert(CodeCellLocation::embedded(table_pos, 2, 3));
        assert_eq!(set.len(), 2);
    }
}
