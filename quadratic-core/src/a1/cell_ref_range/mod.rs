use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Pos, Rect};

use super::{A1Context, A1Error, RefRangeBounds, TableRef, UNBOUNDED};

mod col_row;
mod query;

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[serde(untagged)]
pub enum CellRefRange {
    Sheet { range: RefRangeBounds },
    Table { range: TableRef },
}

impl fmt::Debug for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CellRefRange::Sheet { range } => write!(f, "CellRefRange::Sheet({})", range),
            CellRefRange::Table { range } => write!(f, "CellRefRange::Table({})", range),
        }
    }
}

impl fmt::Display for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sheet { range } => fmt::Display::fmt(range, f),
            Self::Table { range } => fmt::Display::fmt(range, f),
        }
    }
}

impl CellRefRange {
    pub const ALL: Self = Self::Sheet {
        range: RefRangeBounds::ALL,
    };
}

impl CellRefRange {
    pub fn parse(s: &str, context: &A1Context) -> Result<Self, A1Error> {
        // first try table parsing
        if let Ok(range) = TableRef::parse(s, context) {
            return Ok(Self::Table { range });
        }
        // then try sheet parsing
        Ok(Self::Sheet {
            range: RefRangeBounds::from_str(s)?,
        })
    }

    pub fn new_relative_all_from(pos: Pos) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_all_from(pos),
        }
    }

    pub fn new_relative_row_from(row: i64, min_col: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative(min_col, row, UNBOUNDED, row),
        }
    }

    pub fn new_relative_column_from(col: i64, min_row: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative(col, min_row, UNBOUNDED, min_row),
        }
    }

    pub fn new_relative_xy(x: i64, y: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_xy(x, y),
        }
    }

    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_pos(pos),
        }
    }

    pub fn new_relative_column(x: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_col(x),
        }
    }

    pub fn new_relative_row(y: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row(y),
        }
    }

    pub fn new_relative_column_range(x1: i64, x2: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_column_range(x1, x2),
        }
    }

    pub fn new_relative_row_range(y1: i64, y2: i64) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_row_range(y1, y2),
        }
    }

    pub fn new_relative_rect(rect: Rect) -> Self {
        Self::Sheet {
            range: RefRangeBounds::new_relative_rect(rect),
        }
    }

    pub fn might_intersect_rect(&self, rect: Rect, context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.might_intersect_rect(rect),
            Self::Table { range } => range.intersect_rect(rect, context),
        }
    }

    pub fn might_contain_pos(&self, pos: Pos, context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.might_contain_pos(pos),
            Self::Table { range } => range.contains_pos(pos, context),
        }
    }

    pub fn contains_pos(&self, pos: Pos, context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.contains_pos(pos),
            Self::Table { range } => range.contains_pos(pos, context),
        }
    }

    pub fn is_col_range(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_col_range(),
            Self::Table { .. } => false,
        }
    }

    pub fn has_col_range(&self, col: i64) -> bool {
        match self {
            Self::Sheet { range } => range.has_col_range(col),
            Self::Table { .. } => false,
        }
    }

    pub fn is_row_range(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_row_range(),
            Self::Table { .. } => false,
        }
    }

    pub fn has_row_range(&self, row: i64) -> bool {
        match self {
            Self::Sheet { range } => range.has_row_range(row),
            Self::Table { .. } => false,
        }
    }

    pub fn is_finite(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_finite(),
            Self::Table { .. } => true,
        }
    }

    pub fn to_rect(&self) -> Option<Rect> {
        match self {
            Self::Sheet { range } => range.to_rect(),
            Self::Table { .. } => None,
        }
    }

    pub fn selected_columns_finite(&self, context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_columns_finite(),
            Self::Table { range } => range.selected_cols_finite(context),
        }
    }

    pub fn selected_columns(&self, from: i64, to: i64, context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_columns(from, to),
            Self::Table { range } => range.selected_cols(from, to, context),
        }
    }

    pub fn selected_rows_finite(&self, context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_rows_finite(),
            Self::Table { range } => range.selected_rows_finite(context),
        }
    }

    pub fn selected_rows(&self, from: i64, to: i64, context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_rows(from, to),
            Self::Table { range } => range.selected_rows(from, to, context),
        }
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        match self {
            Self::Sheet { range } => range.translate_in_place(x, y),
            Self::Table { .. } => todo!(),
        }
    }

    pub fn translate(&self, x: i64, y: i64) -> Self {
        match self {
            Self::Sheet { range } => Self::Sheet {
                range: range.translate(x, y),
            },
            Self::Table { .. } => todo!(),
        }
    }

    pub fn adjust_column_row_in_place(
        &mut self,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        match self {
            Self::Sheet { range } => range.adjust_column_row_in_place(column, row, delta),
            Self::Table { .. } => todo!(),
        }
    }

    pub fn adjust_column_row(&self, column: Option<i64>, row: Option<i64>, delta: i64) -> Self {
        match self {
            Self::Sheet { range } => Self::Sheet {
                range: range.adjust_column_row(column, row, delta),
            },
            Self::Table { .. } => todo!(),
        }
    }

    pub fn try_to_pos(&self) -> Option<Pos> {
        match self {
            Self::Sheet { range } => range.try_to_pos(),
            Self::Table { .. } => todo!(),
        }
    }

    pub fn is_single_cell(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_single_cell(),
            Self::Table { .. } => false,
        }
    }

    #[cfg(test)]
    pub fn test_a1(a1: &str) -> Self {
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
            if matches!(cell_ref_range, CellRefRange::Table { .. }) {
                return Ok(());
            }
            let context = A1Context::default();
            assert_eq!(cell_ref_range, CellRefRange::parse(&cell_ref_range.to_string(), &context).unwrap());
        }
    }

    #[test]
    fn test_is_finite() {
        assert!(CellRefRange::test_a1("A1").is_finite());
        assert!(!CellRefRange::test_a1("A").is_finite());
        assert!(!CellRefRange::test_a1("1").is_finite());
    }

    #[test]
    fn test_to_rect() {
        assert_eq!(
            CellRefRange::test_a1("A1").to_rect(),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            CellRefRange::test_a1("A1:B2").to_rect(),
            Some(Rect::new(1, 1, 2, 2))
        );
        assert_eq!(CellRefRange::test_a1("A:B").to_rect(), None);
        assert_eq!(CellRefRange::test_a1("1:2").to_rect(), None);
        assert_eq!(CellRefRange::test_a1("A1:C").to_rect(), None);
        assert_eq!(
            CellRefRange::test_a1("A:C3").to_rect(),
            Some(Rect::new(1, 1, 3, 3))
        );
        assert_eq!(CellRefRange::test_a1("*").to_rect(), None);
    }

    #[test]
    fn test_is_column_row() {
        assert!(!CellRefRange::test_a1("A1").is_col_range());
        assert!(CellRefRange::test_a1("A").is_col_range());
        assert!(!CellRefRange::test_a1("A1:C3").is_col_range());
        assert!(CellRefRange::test_a1("A:C").is_col_range());
        assert!(CellRefRange::test_a1("A1:C").is_col_range());
        assert!(!CellRefRange::test_a1("A:C1").is_col_range());
    }

    #[test]
    fn test_is_row_range() {
        assert!(!CellRefRange::test_a1("A1").is_row_range());
        assert!(!CellRefRange::test_a1("A").is_row_range());
        assert!(!CellRefRange::test_a1("A1:C3").is_row_range());
        assert!(CellRefRange::test_a1("1").is_row_range());
        assert!(CellRefRange::test_a1("1:3").is_row_range());
        assert!(CellRefRange::test_a1("A1:3").is_row_range());
        assert!(!CellRefRange::test_a1("1:C3").is_row_range());
    }

    #[test]
    fn test_has_column() {
        assert!(CellRefRange::test_a1("A").has_col_range(1));
        assert!(!CellRefRange::test_a1("A").has_col_range(2));
        assert!(CellRefRange::test_a1("A:B").has_col_range(1));
        assert!(CellRefRange::test_a1("A:B").has_col_range(2));
        assert!(!CellRefRange::test_a1("A:B").has_col_range(3));

        assert!(!CellRefRange::test_a1("A1").has_col_range(1));
        assert!(!CellRefRange::test_a1("1").has_col_range(1));
        assert!(!CellRefRange::test_a1("A1:C3").has_col_range(2));
    }

    #[test]
    fn test_has_row() {
        assert!(CellRefRange::test_a1("1").has_row_range(1));
        assert!(!CellRefRange::test_a1("1").has_row_range(2));
        assert!(CellRefRange::test_a1("1:3").has_row_range(1));
        assert!(CellRefRange::test_a1("1:3").has_row_range(2));
        assert!(CellRefRange::test_a1("1:3").has_row_range(3));
        assert!(!CellRefRange::test_a1("1:3").has_row_range(4));

        assert!(!CellRefRange::test_a1("A1").has_row_range(1));
        assert!(!CellRefRange::test_a1("A").has_row_range(1));
        assert!(!CellRefRange::test_a1("A1:C3").has_row_range(2));
    }

    #[test]
    fn test_selected_columns() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_columns(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A").selected_columns(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A:B").selected_columns(1, 10, &context),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:B2").selected_columns(1, 10, &context),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:D1").selected_columns(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        // same as A1:D
        assert_eq!(
            CellRefRange::test_a1("1:D").selected_columns(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:C3").selected_columns(1, 10, &context),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:").selected_columns(1, 10, &context),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test_a1("*").selected_columns(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        // same as A1:D
        assert_eq!(
            CellRefRange::test_a1(":D").selected_columns(2, 5, &context),
            vec![2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("10").selected_columns(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        // same as A1:E
        assert_eq!(
            CellRefRange::test_a1("4:E").selected_columns(2, 5, &context),
            vec![2, 3, 4, 5]
        );
    }

    #[test]
    fn test_selected_rows() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_rows(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1").selected_rows(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1:3").selected_rows(1, 10, &context),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:B2").selected_rows(1, 10, &context),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:A4").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("1:4").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:C3").selected_rows(1, 10, &context),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        // same as A1:4
        assert_eq!(
            CellRefRange::test_a1(":4").selected_rows(2, 10, &context),
            vec![2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("*").selected_rows(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test_a1("A").selected_rows(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test_a1("C:E5").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test_a1("E5:C").selected_rows(1, 10, &context),
            vec![5, 6, 7, 8, 9, 10]
        );
    }

    #[test]
    fn test_is_single_cell() {
        assert!(CellRefRange::test_a1("A1").is_single_cell());
        assert!(!CellRefRange::test_a1("A").is_single_cell());
        assert!(!CellRefRange::test_a1("3").is_single_cell());
        assert!(!CellRefRange::test_a1("A1:B2").is_single_cell());
    }

    #[test]
    fn test_selected_columns_finite() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_columns_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A").selected_columns_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A:B").selected_columns_finite(&context),
            vec![1, 2]
        );
        assert!(CellRefRange::test_a1("A1:")
            .selected_columns_finite(&context)
            .is_empty());
        assert!(CellRefRange::test_a1("*")
            .selected_columns_finite(&context)
            .is_empty());
        assert_eq!(
            CellRefRange::test_a1(":B").selected_columns_finite(&context),
            vec![1, 2]
        );
    }

    #[test]
    fn test_selected_rows_finite() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_rows_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1").selected_rows_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1:3").selected_rows_finite(&context),
            vec![1, 2, 3]
        );
        assert!(CellRefRange::test_a1("A1:")
            .selected_rows_finite(&context)
            .is_empty());
        assert!(CellRefRange::test_a1("*")
            .selected_rows_finite(&context)
            .is_empty());
        assert_eq!(
            CellRefRange::test_a1(":3").selected_rows_finite(&context),
            vec![1, 2, 3]
        );
    }

    #[test]
    fn test_translate_in_place() {
        // Test single cell translation
        let mut cell = CellRefRange::test_a1("A1");
        cell.translate_in_place(1, 2);
        assert_eq!(cell.to_string(), "B3");

        // Test range translation
        let mut range = CellRefRange::test_a1("A1:B2");
        range.translate_in_place(2, 1);
        assert_eq!(range.to_string(), "C2:D3");

        // Test column range translation
        let mut col_range = CellRefRange::test_a1("A:B");
        col_range.translate_in_place(1, 0);
        assert_eq!(col_range.to_string(), "B:C");

        // Test row range translation
        let mut row_range = CellRefRange::test_a1("1:2");
        row_range.translate_in_place(0, 2);
        assert_eq!(row_range.to_string(), "3:4");

        // Test negative translation capping
        let mut cell = CellRefRange::test_a1("A1");
        cell.translate_in_place(-10, -10);
        assert_eq!(cell.to_string(), "A1");
    }

    #[test]
    fn test_translate() {
        // Test single cell translation
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.translate(1, 2);
        assert_eq!(translated.to_string(), "B3");
        assert_eq!(cell, CellRefRange::test_a1("A1"));

        // Test range translation
        let range = CellRefRange::test_a1("A1:B2");
        let translated = range.translate(2, 1);
        assert_eq!(translated.to_string(), "C2:D3");
        assert_eq!(range, CellRefRange::test_a1("A1:B2"));

        // Test column range translation
        let col_range = CellRefRange::test_a1("A:B");
        let translated = col_range.translate(1, 0);
        assert_eq!(translated.to_string(), "B:C");
        assert_eq!(col_range, CellRefRange::test_a1("A:B"));

        // Test row range translation
        let row_range = CellRefRange::test_a1("1:2");
        let translated = row_range.translate(0, 2);
        assert_eq!(translated.to_string(), "3:4");
        assert_eq!(row_range, CellRefRange::test_a1("1:2"));

        // Test negative translation capping
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.translate(-10, -10);
        assert_eq!(translated.to_string(), "A1");
        assert_eq!(cell, CellRefRange::test_a1("A1"));
    }

    #[test]
    fn test_adjust_column_row() {
        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(Some(2), None, 1);
        assert_eq!(range.to_string(), "C3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(2), 1);
        assert_eq!(range.to_string(), "B4");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(Some(3), None, 1);
        assert_eq!(range.to_string(), "B3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(4), 1);
        assert_eq!(range.to_string(), "B3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(Some(1), None, -1);
        assert_eq!(range.to_string(), "A3");

        let mut range = CellRefRange::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(1), -1);
        assert_eq!(range.to_string(), "B2");
    }
}
