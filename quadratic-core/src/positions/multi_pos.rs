//! A position that can be either on a sheet or within a table.
//!
//! [`MultiPos`] unifies sheet positions and table positions, allowing code to
//! work with either type transparently.

use crate::{Pos, SheetPos, grid::SheetId};
use serde::{Deserialize, Serialize};

use super::TablePos;

/// A position that can be either on a sheet or within a table.
///
/// This enum allows code to handle both regular sheet cells and cells within
/// data tables uniformly.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum MultiPos {
    /// A position directly on the sheet.
    Pos(Pos),

    /// A position within a data table.
    TablePos(TablePos),
}

impl MultiPos {
    /// Creates a new MultiPos from a sheet position.
    pub fn new_pos(pos: Pos) -> Self {
        MultiPos::Pos(pos)
    }

    /// Creates a new MultiPos from a table position.
    pub fn new_table_pos(parent_pos: Pos, sub_table_pos: Pos) -> Self {
        MultiPos::TablePos(TablePos::new(parent_pos, sub_table_pos))
    }

    /// Returns true if this is a TablePos.
    pub fn is_table_pos(&self) -> bool {
        matches!(self, MultiPos::TablePos(_))
    }

    /// Returns true if this is a regular Pos.
    pub fn is_pos(&self) -> bool {
        matches!(self, MultiPos::Pos(_))
    }

    /// Returns the Pos if this is a Pos variant, None otherwise.
    pub fn as_pos(&self) -> Option<Pos> {
        match self {
            MultiPos::Pos(pos) => Some(*pos),
            MultiPos::TablePos(_) => None,
        }
    }

    /// Returns the TablePos if this is a TablePos variant, None otherwise.
    pub fn as_table_pos(&self) -> Option<TablePos> {
        match self {
            MultiPos::Pos(_) => None,
            MultiPos::TablePos(table_pos) => Some(*table_pos),
        }
    }

    /// Converts this MultiPos to a MultiSheetPos with the given sheet ID.
    pub fn to_multi_sheet_pos(&self, sheet_id: SheetId) -> super::MultiSheetPos {
        super::MultiSheetPos::new(sheet_id, *self)
    }

    /// For a Pos, returns the position directly.
    /// For a TablePos, returns the parent table's anchor position.
    ///
    /// Note: This does NOT translate the TablePos to sheet coordinates.
    /// Use `Sheet::table_pos_to_sheet_pos()` for that.
    pub fn anchor_pos(&self) -> Pos {
        match self {
            MultiPos::Pos(pos) => *pos,
            MultiPos::TablePos(table_pos) => table_pos.parent_pos,
        }
    }
}

impl Default for MultiPos {
    fn default() -> Self {
        MultiPos::Pos(Pos::default())
    }
}

impl From<Pos> for MultiPos {
    fn from(pos: Pos) -> Self {
        MultiPos::Pos(pos)
    }
}

impl From<&Pos> for MultiPos {
    fn from(pos: &Pos) -> Self {
        MultiPos::Pos(*pos)
    }
}

impl From<SheetPos> for MultiPos {
    fn from(sheet_pos: SheetPos) -> Self {
        MultiPos::Pos(sheet_pos.into())
    }
}

impl From<TablePos> for MultiPos {
    fn from(table_pos: TablePos) -> Self {
        MultiPos::TablePos(table_pos)
    }
}

impl std::fmt::Display for MultiPos {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MultiPos::Pos(pos) => write!(f, "{}", pos.a1_string()),
            MultiPos::TablePos(table_pos) => write!(f, "{}", table_pos),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_pos_from_pos() {
        let pos = Pos::new(1, 2);
        let multi_pos: MultiPos = pos.into();

        assert!(multi_pos.is_pos());
        assert!(!multi_pos.is_table_pos());
        assert_eq!(multi_pos.as_pos(), Some(pos));
        assert_eq!(multi_pos.as_table_pos(), None);
    }

    #[test]
    fn test_multi_pos_from_table_pos() {
        let table_pos = TablePos::from_coords(1, 1, 0, 0);
        let multi_pos: MultiPos = table_pos.into();

        assert!(!multi_pos.is_pos());
        assert!(multi_pos.is_table_pos());
        assert_eq!(multi_pos.as_pos(), None);
        assert_eq!(multi_pos.as_table_pos(), Some(table_pos));
    }

    #[test]
    fn test_multi_pos_new_pos() {
        let pos = Pos::new(5, 10);
        let multi_pos = MultiPos::new_pos(pos);

        assert_eq!(multi_pos, MultiPos::Pos(pos));
    }

    #[test]
    fn test_multi_pos_new_table_pos() {
        let parent = Pos::new(1, 1);
        let sub = Pos::new(0, 0);
        let multi_pos = MultiPos::new_table_pos(parent, sub);

        assert_eq!(
            multi_pos,
            MultiPos::TablePos(TablePos::new(parent, sub))
        );
    }

    #[test]
    fn test_multi_pos_anchor_pos() {
        // For Pos, returns the position
        let pos = Pos::new(5, 10);
        let multi_pos = MultiPos::Pos(pos);
        assert_eq!(multi_pos.anchor_pos(), pos);

        // For TablePos, returns the parent position
        let parent = Pos::new(1, 1);
        let sub = Pos::new(2, 3);
        let multi_pos = MultiPos::TablePos(TablePos::new(parent, sub));
        assert_eq!(multi_pos.anchor_pos(), parent);
    }

    #[test]
    fn test_multi_pos_default() {
        let multi_pos = MultiPos::default();
        assert_eq!(multi_pos, MultiPos::Pos(Pos::default()));
    }

    #[test]
    fn test_multi_pos_from_sheet_pos() {
        let sheet_id = SheetId::new();
        let sheet_pos = SheetPos::new(sheet_id, 3, 4);
        let multi_pos: MultiPos = sheet_pos.into();

        assert_eq!(multi_pos, MultiPos::Pos(Pos::new(3, 4)));
    }

    #[test]
    fn test_multi_pos_equality() {
        let pos1 = MultiPos::Pos(Pos::new(1, 2));
        let pos2 = MultiPos::Pos(Pos::new(1, 2));
        let pos3 = MultiPos::Pos(Pos::new(1, 3));
        let table_pos = MultiPos::TablePos(TablePos::from_coords(1, 2, 0, 0));

        assert_eq!(pos1, pos2);
        assert_ne!(pos1, pos3);
        assert_ne!(pos1, table_pos);
    }
}
