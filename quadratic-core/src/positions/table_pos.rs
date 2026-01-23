//! Position within a data table.
//!
//! A [`TablePos`] represents a cell position inside a data table, using:
//! - `parent_pos`: The table's anchor position on the sheet
//! - `sub_table_pos`: The position within the table (0-indexed from the first data cell)

use crate::Pos;
use serde::{Deserialize, Serialize};

/// A position within a data table.
///
/// This is used to reference cells inside a table, independent of how the table
/// is sorted, filtered, or has hidden columns. The `sub_table_pos` refers to
/// the logical data position, not the visual display position.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct TablePos {
    /// The anchor position of the parent table on the sheet.
    pub parent_pos: Pos,

    /// The position within the table (0-indexed).
    /// x = column index in the table's data (not display order)
    /// y = row index in the table's data (not display order)
    pub sub_table_pos: Pos,
}

impl TablePos {
    /// Creates a new TablePos.
    pub fn new(parent_pos: Pos, sub_table_pos: Pos) -> Self {
        Self {
            parent_pos,
            sub_table_pos,
        }
    }

    /// Creates a new TablePos from coordinates.
    pub fn from_coords(parent_x: i64, parent_y: i64, sub_x: i64, sub_y: i64) -> Self {
        Self {
            parent_pos: Pos::new(parent_x, parent_y),
            sub_table_pos: Pos::new(sub_x, sub_y),
        }
    }
}

impl std::fmt::Display for TablePos {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "TablePos(parent: {}, sub: ({}, {}))",
            self.parent_pos.a1_string(),
            self.sub_table_pos.x,
            self.sub_table_pos.y
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_pos_new() {
        let parent_pos = Pos::new(1, 1);
        let sub_table_pos = Pos::new(0, 0);
        let table_pos = TablePos::new(parent_pos, sub_table_pos);

        assert_eq!(table_pos.parent_pos, parent_pos);
        assert_eq!(table_pos.sub_table_pos, sub_table_pos);
    }

    #[test]
    fn test_table_pos_from_coords() {
        let table_pos = TablePos::from_coords(1, 2, 3, 4);

        assert_eq!(table_pos.parent_pos, Pos::new(1, 2));
        assert_eq!(table_pos.sub_table_pos, Pos::new(3, 4));
    }

    #[test]
    fn test_table_pos_display() {
        let table_pos = TablePos::from_coords(1, 1, 0, 0);
        let display = format!("{}", table_pos);
        assert!(display.contains("TablePos"));
        assert!(display.contains("A1"));
    }

    #[test]
    fn test_table_pos_equality() {
        let pos1 = TablePos::from_coords(1, 1, 0, 0);
        let pos2 = TablePos::from_coords(1, 1, 0, 0);
        let pos3 = TablePos::from_coords(1, 1, 0, 1);

        assert_eq!(pos1, pos2);
        assert_ne!(pos1, pos3);
    }

    #[test]
    fn test_table_pos_hash() {
        use std::collections::HashSet;

        let mut set = HashSet::new();
        let pos1 = TablePos::from_coords(1, 1, 0, 0);
        let pos2 = TablePos::from_coords(1, 1, 0, 0);
        let pos3 = TablePos::from_coords(2, 2, 0, 0);

        set.insert(pos1);
        assert!(set.contains(&pos2)); // Same as pos1
        assert!(!set.contains(&pos3)); // Different
    }
}
