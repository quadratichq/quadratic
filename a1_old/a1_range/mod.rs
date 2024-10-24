//! A1Range is an enum that represents a range within in an A1 string.

pub mod a1_range_from_a1;
pub mod a1_range_to_a1;
pub mod a1_range_translate;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{grid::SheetId, Pos, Rect, A1};

#[derive(Debug, PartialEq, TS)]
pub struct A1Range {
    pub sheet_id: SheetId,
    pub range: A1RangeType,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Hash, Clone, TS)]
pub enum A1RangeType {
    All,
    Column(RelColRow),
    Row(RelColRow),
    ColumnRange(RelColRowRange),
    RowRange(RelColRowRange),
    Rect(RelRect),
    Pos(RelPos),
}

impl A1RangeType {
    /// Whether this range intersects with a Rect.
    pub fn intersects(&self, other: &Rect) -> bool {
        match self {
            A1RangeType::All => true,
            A1RangeType::Column(col) => other.contains_col(col.index as i64),
            A1RangeType::Row(row) => other.contains_row(row.index as i64),
            A1RangeType::ColumnRange(range) => {
                range.iter().any(|row| other.contains_col(row as i64))
            }
            A1RangeType::RowRange(range) => range.iter().any(|col| other.contains_row(col as i64)),
            A1RangeType::Rect(rect) => other.intersects((*rect).into()),
            A1RangeType::Pos(pos) => other.contains((*pos).into()),
        }
    }

    /// Whether this range contains a Pos.
    pub fn contains(&self, other: Pos) -> bool {
        match self {
            A1RangeType::All => true,
            A1RangeType::Column(col) => other.x == col.index as i64,
            A1RangeType::Row(row) => other.y == row.index as i64,
            A1RangeType::ColumnRange(range) => range.iter().any(|row| other.x == row as i64),
            A1RangeType::RowRange(range) => range.iter().any(|col| other.y == col as i64),
            A1RangeType::Rect(rect) => Rect::from(*rect).contains(other),
            A1RangeType::Pos(pos) => other == (*pos).into(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash, TS)]
pub struct RelColRowRange {
    pub min: RelColRow,
    pub max: RelColRow,
}

impl RelColRowRange {
    pub fn iter(&self) -> impl Iterator<Item = u64> {
        (self.min.index..=self.max.index).into_iter()
    }
}

impl From<RelColRowRange> for Vec<u64> {
    fn from(range: RelColRowRange) -> Self {
        let mut indices = Vec::new();
        let mut current = range.min.index;
        while current <= range.max.index {
            indices.push(current);
            current += 1;
        }
        indices
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
pub struct RelColRow {
    pub index: u64,
    pub relative: bool,
}

impl RelColRow {
    pub fn new(index: u64, relative: bool) -> Self {
        Self { index, relative }
    }

    /// Convert the column to an A1-style string.
    pub fn to_column_a1(&self) -> String {
        let column = A1::x_to_a1(self.index);
        if self.relative {
            column
        } else {
            format!("${}", column)
        }
    }

    /// Convert the row to an A1-style string.
    pub fn to_row_a1(&self) -> String {
        if self.relative {
            self.index.to_string()
        } else {
            format!("${}", self.index)
        }
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Copy, Clone, Eq, Hash, TS)]
pub struct RelPos {
    pub x: RelColRow,
    pub y: RelColRow,
}

impl RelPos {
    pub fn new(x: u64, y: u64, x_relative: bool, y_relative: bool) -> Self {
        Self {
            x: RelColRow::new(x, x_relative),
            y: RelColRow::new(y, y_relative),
        }
    }

    /// Convert the position to an A1-style string.
    pub fn to_a1(&self) -> String {
        format!("{}{}", self.x.to_column_a1(), self.y.to_row_a1())
    }
}

impl From<RelPos> for Pos {
    fn from(pos: RelPos) -> Self {
        Pos {
            x: pos.x.index as i64,
            y: pos.y.index as i64,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Copy, Clone, Eq, Hash, TS)]
pub struct RelRect {
    pub min: RelPos,
    pub max: RelPos,
}

impl RelRect {
    /// Counts the number of cells in the range.
    pub fn count(&self) -> usize {
        let rect = Rect::from(*self);
        rect.count()
    }
}

impl From<RelRect> for Rect {
    fn from(rect: RelRect) -> Self {
        Rect {
            min: rect.min.into(),
            max: rect.max.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_to_column_a1() {
        let rel_col_row = RelColRow::new(1, true);
        assert_eq!(rel_col_row.to_column_a1(), "A");

        let rel_col_row = RelColRow::new(1, false);
        assert_eq!(rel_col_row.to_column_a1(), "$A");
    }

    #[test]
    #[parallel]
    fn test_to_row_a1() {
        let rel_col_row = RelColRow::new(1, true);
        assert_eq!(rel_col_row.to_row_a1(), "1");

        let rel_col_row = RelColRow::new(1, false);
        assert_eq!(rel_col_row.to_row_a1(), "$1");
    }

    #[test]
    #[parallel]
    fn test_to_a1() {
        let rel_pos = RelPos::new(1, 1, true, true);
        assert_eq!(rel_pos.to_a1(), "A1");

        let rel_pos = RelPos::new(1, 1, false, false);
        assert_eq!(rel_pos.to_a1(), "$A$1");

        let rel_pos = RelPos::new(1, 1, true, false);
        assert_eq!(rel_pos.to_a1(), "A$1");

        let rel_pos = RelPos::new(1, 1, false, true);
        assert_eq!(rel_pos.to_a1(), "$A1");
    }

    #[test]
    #[parallel]
    fn test_rel_rect_count() {
        let rel_rect = RelRect {
            min: RelPos::new(1, 1, true, true),
            max: RelPos::new(3, 3, true, true),
        };
        assert_eq!(rel_rect.count(), 9);
    }

    #[test]
    #[parallel]
    fn test_intersects() {
        let sheet_rect = Rect::new(1, 1, 10, 10);

        let a1_range = A1RangeType::Rect(RelRect {
            min: RelPos::new(1, 1, true, true),
            max: RelPos::new(3, 3, true, true),
        });
        assert!(a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::Column(RelColRow::new(1, true));
        assert!(a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::Row(RelColRow::new(1, true));
        assert!(a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::Pos(RelPos::new(1, 1, true, true));
        assert!(a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::All;
        assert!(a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::Column(RelColRow::new(11, true));
        assert!(!a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::Row(RelColRow::new(11, true));
        assert!(!a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::ColumnRange(RelColRowRange {
            min: RelColRow::new(1, true),
            max: RelColRow::new(3, true),
        });
        assert!(a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::RowRange(RelColRowRange {
            min: RelColRow::new(1, true),
            max: RelColRow::new(3, true),
        });
        assert!(a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::Pos(RelPos::new(11, 11, true, true));
        assert!(!a1_range.intersects(&sheet_rect));

        let a1_range = A1RangeType::All;
        assert!(a1_range.intersects(&sheet_rect));
    }

    #[test]
    #[parallel]
    fn test_contains() {
        let a1_range = A1RangeType::Pos(RelPos::new(1, 1, true, true));
        assert!(a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::Column(RelColRow::new(1, true));
        assert!(a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::Row(RelColRow::new(1, true));
        assert!(a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::ColumnRange(RelColRowRange {
            min: RelColRow::new(1, true),
            max: RelColRow::new(3, true),
        });
        assert!(a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::RowRange(RelColRowRange {
            min: RelColRow::new(1, true),
            max: RelColRow::new(3, true),
        });
        assert!(a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::All;
        assert!(a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::Column(RelColRow::new(11, true));
        assert!(!a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::Row(RelColRow::new(11, true));
        assert!(!a1_range.contains(Pos::new(1, 1)));

        let a1_range = A1RangeType::ColumnRange(RelColRowRange {
            min: RelColRow::new(1, true),
            max: RelColRow::new(3, true),
        });
        assert!(!a1_range.contains(Pos::new(4, 1)));

        let a1_range = A1RangeType::RowRange(RelColRowRange {
            min: RelColRow::new(1, true),
            max: RelColRow::new(3, true),
        });
        assert!(!a1_range.contains(Pos::new(1, 4)));

        let a1_range = A1RangeType::Rect(RelRect {
            min: RelPos::new(1, 1, true, true),
            max: RelPos::new(3, 3, true, true),
        });
        assert!(!a1_range.contains(Pos::new(4, 1)));
        assert!(!a1_range.contains(Pos::new(1, 4)));

        let a1_range = A1RangeType::Pos(RelPos::new(11, 11, true, true));
        assert!(!a1_range.contains(Pos::new(1, 1)));
    }
}
