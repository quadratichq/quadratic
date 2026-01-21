//! A position (sheet or table) with sheet context.
//!
//! [`MultiSheetPos`] combines a [`MultiPos`] with a [`SheetId`] to provide
//! complete location information.

use crate::{Pos, SheetPos, grid::SheetId};
use serde::{Deserialize, Serialize};

use super::{MultiPos, TablePos};

/// A position (on sheet or in table) with sheet context.
///
/// This is the complete representation of a cell location that can be:
/// - A cell directly on a sheet (like `SheetPos`)
/// - A cell within a data table on a sheet
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub struct MultiSheetPos {
    /// The sheet containing this position.
    pub sheet_id: SheetId,

    /// The position (either sheet or table).
    pub multi_pos: MultiPos,
}

impl MultiSheetPos {
    /// Creates a new MultiSheetPos.
    pub fn new(sheet_id: SheetId, multi_pos: MultiPos) -> Self {
        Self {
            sheet_id,
            multi_pos,
        }
    }

    /// Creates a MultiSheetPos from a sheet position.
    pub fn from_pos(sheet_id: SheetId, pos: Pos) -> Self {
        Self {
            sheet_id,
            multi_pos: MultiPos::Pos(pos),
        }
    }

    /// Creates a MultiSheetPos from a table position.
    pub fn from_table_pos(sheet_id: SheetId, table_pos: TablePos) -> Self {
        Self {
            sheet_id,
            multi_pos: MultiPos::TablePos(table_pos),
        }
    }

    /// Returns true if this is a TablePos.
    pub fn is_table_pos(&self) -> bool {
        self.multi_pos.is_table_pos()
    }

    /// Returns true if this is a regular Pos.
    pub fn is_pos(&self) -> bool {
        self.multi_pos.is_pos()
    }

    /// Returns the Pos if this is a Pos variant, None otherwise.
    pub fn as_pos(&self) -> Option<Pos> {
        self.multi_pos.as_pos()
    }

    /// Returns the TablePos if this is a TablePos variant, None otherwise.
    pub fn as_table_pos(&self) -> Option<TablePos> {
        self.multi_pos.as_table_pos()
    }

    /// For a Pos, returns a SheetPos directly.
    /// For a TablePos, returns a SheetPos at the table's anchor position.
    ///
    /// Note: For TablePos, this does NOT return the translated sheet position.
    /// Use `Sheet::multi_sheet_pos_to_sheet_pos()` for proper translation.
    pub fn anchor_sheet_pos(&self) -> SheetPos {
        SheetPos::new(self.sheet_id, self.multi_pos.anchor_pos().x, self.multi_pos.anchor_pos().y)
    }

    /// Converts to a SheetPos if this is a Pos variant.
    /// Returns None for TablePos (use `Sheet::multi_sheet_pos_to_sheet_pos()` instead).
    pub fn to_sheet_pos(&self) -> Option<SheetPos> {
        match &self.multi_pos {
            MultiPos::Pos(pos) => Some(SheetPos::new(self.sheet_id, pos.x, pos.y)),
            MultiPos::TablePos(_) => None,
        }
    }
}

impl From<SheetPos> for MultiSheetPos {
    fn from(sheet_pos: SheetPos) -> Self {
        Self {
            sheet_id: sheet_pos.sheet_id,
            multi_pos: MultiPos::Pos(Pos::new(sheet_pos.x, sheet_pos.y)),
        }
    }
}

impl std::fmt::Display for MultiSheetPos {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.sheet_id, self.multi_pos)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_sheet_pos_new() {
        let sheet_id = SheetId::new();
        let pos = Pos::new(1, 2);
        let multi_pos = MultiPos::Pos(pos);

        let msp = MultiSheetPos::new(sheet_id, multi_pos);

        assert_eq!(msp.sheet_id, sheet_id);
        assert_eq!(msp.multi_pos, multi_pos);
    }

    #[test]
    fn test_multi_sheet_pos_from_pos() {
        let sheet_id = SheetId::new();
        let pos = Pos::new(3, 4);

        let msp = MultiSheetPos::from_pos(sheet_id, pos);

        assert_eq!(msp.sheet_id, sheet_id);
        assert!(msp.is_pos());
        assert_eq!(msp.as_pos(), Some(pos));
    }

    #[test]
    fn test_multi_sheet_pos_from_table_pos() {
        let sheet_id = SheetId::new();
        let table_pos = TablePos::from_coords(1, 1, 0, 0);

        let msp = MultiSheetPos::from_table_pos(sheet_id, table_pos);

        assert_eq!(msp.sheet_id, sheet_id);
        assert!(msp.is_table_pos());
        assert_eq!(msp.as_table_pos(), Some(table_pos));
    }

    #[test]
    fn test_multi_sheet_pos_from_sheet_pos() {
        let sheet_id = SheetId::new();
        let sheet_pos = SheetPos::new(sheet_id, 5, 6);

        let msp: MultiSheetPos = sheet_pos.into();

        assert_eq!(msp.sheet_id, sheet_id);
        assert!(msp.is_pos());
        assert_eq!(msp.as_pos(), Some(Pos::new(5, 6)));
    }

    #[test]
    fn test_multi_sheet_pos_anchor_sheet_pos() {
        let sheet_id = SheetId::new();

        // For Pos, returns the position as SheetPos
        let pos = Pos::new(5, 10);
        let msp = MultiSheetPos::from_pos(sheet_id, pos);
        assert_eq!(msp.anchor_sheet_pos(), SheetPos::new(sheet_id, 5, 10));

        // For TablePos, returns the parent position as SheetPos
        let table_pos = TablePos::from_coords(1, 2, 3, 4);
        let msp = MultiSheetPos::from_table_pos(sheet_id, table_pos);
        assert_eq!(msp.anchor_sheet_pos(), SheetPos::new(sheet_id, 1, 2));
    }

    #[test]
    fn test_multi_sheet_pos_to_sheet_pos() {
        let sheet_id = SheetId::new();

        // For Pos, returns Some(SheetPos)
        let pos = Pos::new(5, 10);
        let msp = MultiSheetPos::from_pos(sheet_id, pos);
        assert_eq!(msp.to_sheet_pos(), Some(SheetPos::new(sheet_id, 5, 10)));

        // For TablePos, returns None
        let table_pos = TablePos::from_coords(1, 2, 3, 4);
        let msp = MultiSheetPos::from_table_pos(sheet_id, table_pos);
        assert_eq!(msp.to_sheet_pos(), None);
    }

    #[test]
    fn test_multi_sheet_pos_equality() {
        let sheet_id = SheetId::new();
        let other_sheet_id = SheetId::new();

        let msp1 = MultiSheetPos::from_pos(sheet_id, Pos::new(1, 2));
        let msp2 = MultiSheetPos::from_pos(sheet_id, Pos::new(1, 2));
        let msp3 = MultiSheetPos::from_pos(sheet_id, Pos::new(1, 3));
        let msp4 = MultiSheetPos::from_pos(other_sheet_id, Pos::new(1, 2));

        assert_eq!(msp1, msp2);
        assert_ne!(msp1, msp3); // Different position
        assert_ne!(msp1, msp4); // Different sheet
    }

    #[test]
    fn test_multi_sheet_pos_hash() {
        use std::collections::HashSet;

        let sheet_id = SheetId::new();
        let mut set = HashSet::new();

        let msp1 = MultiSheetPos::from_pos(sheet_id, Pos::new(1, 2));
        let msp2 = MultiSheetPos::from_pos(sheet_id, Pos::new(1, 2));
        let msp3 = MultiSheetPos::from_pos(sheet_id, Pos::new(3, 4));

        set.insert(msp1);
        assert!(set.contains(&msp2)); // Same as msp1
        assert!(!set.contains(&msp3)); // Different
    }
}
