//! A1Range is an enum that represents a range within in an A1 string.

pub mod a1_range_from_a1;
pub mod a1_range_to_a1;
pub mod a1_range_translate;

use crate::{grid::SheetId, Pos, Rect, A1};

#[derive(Debug, PartialEq)]
pub struct A1Range {
    pub sheet_id: SheetId,
    pub range: A1RangeType,
}

#[derive(Debug, PartialEq)]
pub enum A1RangeType {
    All,
    Column(RelColRow),
    Row(RelColRow),
    ColumnRange(RelColRowRange),
    RowRange(RelColRowRange),
    Rect(RelRect),
    Pos(RelPos),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RelColRowRange {
    pub from: RelColRow,
    pub to: RelColRow,
}

impl From<RelColRowRange> for Vec<u64> {
    fn from(range: RelColRowRange) -> Self {
        let mut indices = Vec::new();
        let mut current = range.from.index;
        while current <= range.to.index {
            indices.push(current);
            current += 1;
        }
        indices
    }
}

#[derive(Debug, Copy, Clone, PartialEq)]
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

#[derive(Debug, PartialEq, Copy, Clone)]
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

#[derive(Debug, PartialEq, Copy, Clone)]
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
}
