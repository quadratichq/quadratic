// todo: fix this
#![allow(non_local_definitions)]

use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Pos, Rect, RefRangeBounds};

use super::{A1Error, CellRefRangeEnd};

#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(test, proptest(filter = "|range| range.is_valid()"))]
#[serde(untagged)]
pub enum CellRefRange {
    Sheet { range: RefRangeBounds },
}

impl fmt::Debug for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sheet { range } => write!(f, "CellRefRange::Sheet({})", range),
        }
    }
}

impl fmt::Display for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sheet { range } => fmt::Display::fmt(range, f),
        }
    }
}

impl FromStr for CellRefRange {
    type Err = A1Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self::Sheet {
            range: RefRangeBounds::from_str(s)?,
        })
    }
}

impl CellRefRange {
    pub const ALL: Self = Self::Sheet {
        range: RefRangeBounds::ALL,
    };
}

impl CellRefRange {
    pub fn is_valid(self) -> bool {
        match self {
            Self::Sheet { range } => range.is_valid(),
        }
    }

    pub fn new_relative_all_from(pos: Pos) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_all_from(pos),
        }
    }

    pub fn new_relative_row_from(row: u64, min_col: u64) -> Self {
        Self::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(min_col, row),
                end: Some(CellRefRangeEnd::new_infinite_row(row)),
            },
        }
    }

    pub fn new_relative_column_from(col: u64, min_row: u64) -> Self {
        Self::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(col, min_row),
                end: Some(CellRefRangeEnd::new_infinite_column(col)),
            },
        }
    }

    pub fn new_relative_xy(x: u64, y: u64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_xy(x, y),
        }
    }

    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_pos(pos),
        }
    }

    pub fn new_relative_column(x: u64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_column(x),
        }
    }

    pub fn new_relative_row(y: u64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row(y),
        }
    }

    pub fn new_relative_column_range(x1: u64, x2: u64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_column_range(x1, x2),
        }
    }

    pub fn new_relative_row_range(y1: u64, y2: u64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row_range(y1, y2),
        }
    }

    pub fn new_relative_rect(rect: Rect) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_rect(rect),
        }
    }

    pub fn might_intersect_rect(self, rect: Rect) -> bool {
        match self {
            Self::Sheet { range } => range.might_intersect_rect(rect),
        }
    }

    pub fn might_contain_pos(self, pos: Pos) -> bool {
        match self {
            Self::Sheet { range } => range.might_contain_pos(pos),
        }
    }

    pub fn contains_pos(self, pos: Pos) -> bool {
        match self {
            Self::Sheet { range } => range.contains_pos(pos),
        }
    }

    pub fn is_column_range(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_column_range(),
        }
    }

    pub fn has_column(&self, col: u64) -> bool {
        match self {
            Self::Sheet { range } => range.has_column(col),
        }
    }

    pub fn is_row_range(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_row_range(),
        }
    }

    pub fn has_row(&self, row: u64) -> bool {
        match self {
            Self::Sheet { range } => range.has_row(row),
        }
    }

    pub fn is_finite(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_finite(),
        }
    }

    pub fn to_rect(&self) -> Option<Rect> {
        match self {
            Self::Sheet { range } => range.to_rect(),
        }
    }

    pub fn selected_columns_finite(&self) -> Vec<u64> {
        match self {
            Self::Sheet { range } => range.selected_columns_finite(),
        }
    }

    pub fn selected_columns(&self, from: u64, to: u64) -> Vec<u64> {
        match self {
            Self::Sheet { range } => range.selected_columns(from, to),
        }
    }

    pub fn selected_rows_finite(&self) -> Vec<u64> {
        match self {
            Self::Sheet { range } => range.selected_rows_finite(),
        }
    }

    pub fn selected_rows(&self, from: u64, to: u64) -> Vec<u64> {
        match self {
            Self::Sheet { range } => range.selected_rows(from, to),
        }
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        match self {
            Self::Sheet { range } => range.translate_in_place(x, y),
        }
    }

    pub fn translate(&self, x: i64, y: i64) -> Self {
        match self {
            Self::Sheet { range } => Self::Sheet {
                range: range.translate(x, y),
            },
        }
    }

    pub fn is_single_cell(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_single_cell(),
        }
    }

    #[cfg(test)]
    pub fn test(a1: &str) -> Self {
        use std::str::FromStr;

        Self::Sheet {
            range: RefRangeBounds::from_str(a1).unwrap(),
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn proptest_cell_ref_range_parsing(cell_ref_range: CellRefRange) {
            // We skip tests where start = end since we remove the end when parsing
            match cell_ref_range {
                CellRefRange::Sheet { range } => {
                    if range.end.is_none_or(|end| end != range.start) {
                        assert_eq!(cell_ref_range, cell_ref_range.to_string().parse().unwrap());
                    }
                }
            };
        }
    }

    #[test]
    fn test_is_finite() {
        assert!(CellRefRange::test("A1").is_finite());
        assert!(!CellRefRange::test("A").is_finite());
        assert!(!CellRefRange::test("1").is_finite());
    }

    #[test]
    fn test_to_rect() {
        assert_eq!(
            CellRefRange::test("A1").to_rect(),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            CellRefRange::test("A1:B2").to_rect(),
            Some(Rect::new(1, 1, 2, 2))
        );
        assert_eq!(CellRefRange::test("A:B").to_rect(), None);
        assert_eq!(CellRefRange::test("1:2").to_rect(), None);
        assert_eq!(CellRefRange::test("A1:C").to_rect(), None);
        assert_eq!(CellRefRange::test("A:C3").to_rect(), None);
        assert_eq!(CellRefRange::test("*").to_rect(), None);
    }

    #[test]
    fn test_is_column_row() {
        assert!(!CellRefRange::test("A1").is_column_range());
        assert!(CellRefRange::test("A").is_column_range());
        assert!(!CellRefRange::test("A1:C3").is_column_range());
        assert!(CellRefRange::test("A:C").is_column_range());
        assert!(CellRefRange::test("A1:C").is_column_range());
        assert!(CellRefRange::test("A:C1").is_column_range());
    }

    #[test]
    fn test_is_row_range() {
        assert!(!CellRefRange::test("A1").is_row_range());
        assert!(!CellRefRange::test("A").is_row_range());
        assert!(!CellRefRange::test("A1:C3").is_row_range());
        assert!(CellRefRange::test("1").is_row_range());
        assert!(CellRefRange::test("1:3").is_row_range());
        assert!(CellRefRange::test("A1:3").is_row_range());
        assert!(CellRefRange::test("1:C3").is_row_range());
    }

    #[test]
    fn test_has_column() {
        assert!(CellRefRange::test("A").has_column(1));
        assert!(!CellRefRange::test("A").has_column(2));
        assert!(CellRefRange::test("A:B").has_column(1));
        assert!(CellRefRange::test("A:B").has_column(2));
        assert!(!CellRefRange::test("A:B").has_column(3));

        assert!(!CellRefRange::test("A1").has_column(1));
        assert!(!CellRefRange::test("1").has_column(1));
        assert!(!CellRefRange::test("A1:C3").has_column(2));
    }

    #[test]
    fn test_has_row() {
        assert!(CellRefRange::test("1").has_row(1));
        assert!(!CellRefRange::test("1").has_row(2));
        assert!(CellRefRange::test("1:3").has_row(1));
        assert!(CellRefRange::test("1:3").has_row(2));
        assert!(CellRefRange::test("1:3").has_row(3));
        assert!(!CellRefRange::test("1:3").has_row(4));

        assert!(!CellRefRange::test("A1").has_row(1));
        assert!(!CellRefRange::test("A").has_row(1));
        assert!(!CellRefRange::test("A1:C3").has_row(2));
    }

    #[test]
    fn test_selected_columns() {
        assert_eq!(CellRefRange::test("A1").selected_columns(1, 10), vec![1]);
        assert_eq!(CellRefRange::test("A").selected_columns(1, 10), vec![1]);
        assert_eq!(
            CellRefRange::test("A:B").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test("A1:B2").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test("A1:D1").selected_columns(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test("1:D").selected_columns(1, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("A1:C3").selected_columns(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test("A1:").selected_columns(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("*").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(CellRefRange::test(":D").selected_columns(2, 5), vec![4, 5]);
        assert_eq!(
            CellRefRange::test("10").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(CellRefRange::test("4:E").selected_columns(2, 5), vec![5]);
    }

    #[test]
    fn test_selected_rows() {
        assert_eq!(CellRefRange::test("A1").selected_rows(1, 10), vec![1]);
        assert_eq!(CellRefRange::test("1").selected_rows(1, 10), vec![1]);
        assert_eq!(
            CellRefRange::test("1:3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(CellRefRange::test("A1:B2").selected_rows(1, 10), vec![1, 2]);
        assert_eq!(
            CellRefRange::test("A1:A4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test("1:4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test("A1:C3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test("A1:").selected_rows(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test(":4").selected_rows(2, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("*").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test("A").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test("C:E5").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("E5:C").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
    }

    #[test]
    fn test_is_single_cell() {
        assert!(CellRefRange::test("A1").is_single_cell());
        assert!(!CellRefRange::test("A").is_single_cell());
        assert!(!CellRefRange::test("3").is_single_cell());
        assert!(!CellRefRange::test("A1:B2").is_single_cell());
    }

    #[test]
    fn test_selected_columns_finite() {
        assert_eq!(CellRefRange::test("A1").selected_columns_finite(), vec![1]);
        assert_eq!(CellRefRange::test("A").selected_columns_finite(), vec![1]);
        assert_eq!(
            CellRefRange::test("A:B").selected_columns_finite(),
            vec![1, 2]
        );
        assert!(CellRefRange::test("A1:")
            .selected_columns_finite()
            .is_empty());
        assert!(CellRefRange::test("*").selected_columns_finite().is_empty());
        assert!(CellRefRange::test(":B")
            .selected_columns_finite()
            .is_empty());
    }

    #[test]
    fn test_selected_rows_finite() {
        assert_eq!(CellRefRange::test("A1").selected_rows_finite(), vec![1]);
        assert_eq!(CellRefRange::test("1").selected_rows_finite(), vec![1]);
        assert_eq!(
            CellRefRange::test("1:3").selected_rows_finite(),
            vec![1, 2, 3]
        );
        assert!(CellRefRange::test("A1:").selected_rows_finite().is_empty());
        assert!(CellRefRange::test("*").selected_rows_finite().is_empty());
        assert!(CellRefRange::test(":3").selected_rows_finite().is_empty());
    }

    #[test]
    fn test_translate_in_place() {
        // Test single cell translation
        let mut cell = CellRefRange::test("A1");
        cell.translate_in_place(1, 2);
        assert_eq!(cell.to_string(), "B3");

        // Test range translation
        let mut range = CellRefRange::test("A1:B2");
        range.translate_in_place(2, 1);
        assert_eq!(range.to_string(), "C2:D3");

        // Test column range translation
        let mut col_range = CellRefRange::test("A:B");
        col_range.translate_in_place(1, 0);
        assert_eq!(col_range.to_string(), "B:C");

        // Test row range translation
        let mut row_range = CellRefRange::test("1:2");
        row_range.translate_in_place(0, 2);
        assert_eq!(row_range.to_string(), "3:4");

        // Test negative translation capping
        let mut cell = CellRefRange::test("A1");
        cell.translate_in_place(-10, -10);
        assert_eq!(cell.to_string(), "A1");
    }

    #[test]
    fn test_translate() {
        // Test single cell translation
        let cell = CellRefRange::test("A1");
        let translated = cell.translate(1, 2);
        assert_eq!(translated.to_string(), "B3");
        assert_eq!(cell, CellRefRange::test("A1"));

        // Test range translation
        let range = CellRefRange::test("A1:B2");
        let translated = range.translate(2, 1);
        assert_eq!(translated.to_string(), "C2:D3");
        assert_eq!(range, CellRefRange::test("A1:B2"));

        // Test column range translation
        let col_range = CellRefRange::test("A:B");
        let translated = col_range.translate(1, 0);
        assert_eq!(translated.to_string(), "B:C");
        assert_eq!(col_range, CellRefRange::test("A:B"));

        // Test row range translation
        let row_range = CellRefRange::test("1:2");
        let translated = row_range.translate(0, 2);
        assert_eq!(translated.to_string(), "3:4");
        assert_eq!(row_range, CellRefRange::test("1:2"));

        // Test negative translation capping
        let cell = CellRefRange::test("A1");
        let translated = cell.translate(-10, -10);
        assert_eq!(translated.to_string(), "A1");
        assert_eq!(cell, CellRefRange::test("A1"));
    }
}
