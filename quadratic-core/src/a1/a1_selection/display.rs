use crate::a1::{A1Context, SheetCellRefRange};
use std::fmt;

use super::*;

impl A1Selection {
    /// Returns an A1-style string describing the selection. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    ///
    /// The cursor position has no effect on the output.
    pub fn to_string(&self, default_sheet_id: Option<SheetId>, a1_context: &A1Context) -> String {
        self.to_string_force_sheet_name(default_sheet_id, a1_context, false)
    }

    /// Returns an A1-style string describing the selection. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range or `force_sheet_name` is
    /// true.
    ///
    /// The cursor position has no effect on the output.
    pub fn to_string_force_sheet_name(
        &self,
        default_sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        force_sheet_name: bool,
    ) -> String {
        let sheet_id = self.sheet_id;
        self.ranges
            .iter()
            .map(|cells| {
                SheetCellRefRange {
                    sheet_id,
                    cells: cells.clone(),
                    explicit_sheet_name: force_sheet_name,
                }
                .to_a1_string(default_sheet_id, a1_context)
            })
            .collect::<Vec<_>>()
            .join(",")
    }

    pub fn to_cursor_a1(&self) -> String {
        self.cursor.a1_string()
    }

    /// Returns an A1-style string describing the selection with default
    /// SheetId.
    #[cfg(test)]
    pub fn test_to_string(&self) -> String {
        self.to_string(Some(SheetId::TEST), &A1Context::default())
    }
}

impl fmt::Debug for A1Selection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_string(None, &A1Context::default()))
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_to_a1_all() {
        let context = A1Context::default();
        let selection = A1Selection::from_range(CellRefRange::ALL, SheetId::TEST, &context);
        assert_eq!(selection.to_string(Some(SheetId::TEST), &context), "*",);
    }

    #[test]
    fn test_to_a1_columns() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A:e,J:L,O");
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &context),
            "A:E,J:L,O",
        );
    }

    #[test]
    fn test_to_a1_rows() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("1:5,10:12,15:15");
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &context),
            "1:5,10:12,15:15",
        );
    }

    #[test]
    fn test_to_a1_rects() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1:B2,C3:D4");
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &context),
            "A1:B2,C3:D4",
        );
    }

    #[test]
    fn test_to_a1_pos() {
        let selection = A1Selection {
            sheet_id: SheetId::TEST,
            cursor: pos![A1],
            ranges: vec![CellRefRange::new_relative_rect(Rect::new(1, 1, 1, 1))],
        };
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &A1Context::default()),
            "A1",
        );
    }

    #[test]
    fn test_to_a1() {
        let selection = A1Selection {
            sheet_id: SheetId::TEST,
            cursor: Pos { x: 10, y: 11 }, // this should be ignored
            ranges: vec![
                CellRefRange::new_relative_column_range(1, 5),
                CellRefRange::new_relative_column_range(10, 12),
                CellRefRange::new_relative_column(15),
                CellRefRange::new_relative_row_range(1, 5),
                CellRefRange::new_relative_row_range(10, 12),
                CellRefRange::new_relative_row(15),
            ],
        };
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &A1Context::default()),
            "A:E,J:L,O,1:5,10:12,15:15",
        );
    }

    #[test]
    fn test_a1_with_one_sized_rect() {
        let selection = A1Selection {
            sheet_id: SheetId::TEST,
            cursor: Pos { x: 1, y: 1 },
            ranges: vec![CellRefRange::test_a1("A1:A1")],
        };
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &A1Context::default()),
            "A1",
        );
    }

    #[test]
    fn test_extra_comma() {
        let sheet_id = SheetId::TEST;
        let selection = A1Selection::parse("1,", sheet_id, &A1Context::default()).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &A1Context::default()),
            "1:1",
        );
    }

    #[test]
    fn test_multiple_one_sized_rects() {
        let sheet_id = SheetId::TEST;
        let selection = A1Selection::parse("A1,B1,C1", sheet_id, &A1Context::default()).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &A1Context::default()),
            "A1,B1,C1",
        );
    }

    #[test]
    fn test_different_sheet() {
        let sheet_id = SheetId::TEST;
        let sheet_second = SheetId::new();
        let context = A1Context::test(&[("First", sheet_id), ("Second", sheet_second)], &[]);
        let selection =
            A1Selection::parse("second!A1,second!B1,second!C1", sheet_id, &context).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &context),
            "Second!A1,Second!B1,Second!C1",
        );
    }

    #[test]
    fn test_cursor_a1_string() {
        // Test basic cursor position
        let selection = A1Selection::test_a1("A1");
        assert_eq!(
            selection.to_cursor_a1(),
            "A1",
            "Basic cursor A1 string failed"
        );

        // Test cursor at different positions
        let selection = A1Selection::test_a1("B2");
        assert_eq!(selection.to_cursor_a1(), "B2", "B2 cursor A1 string failed");

        // Test cursor with large coordinates
        let selection = A1Selection::test_a1("Z100");
        assert_eq!(
            selection.to_cursor_a1(),
            "Z100",
            "Large coordinate cursor A1 string failed"
        );

        // Test cursor with multi-letter column
        let selection = A1Selection::test_a1("AA1");
        assert_eq!(
            selection.to_cursor_a1(),
            "AA1",
            "Multi-letter column cursor A1 string failed"
        );

        // Test cursor position in a range selection
        let selection = A1Selection::test_a1("A1:C3");
        assert_eq!(
            selection.to_cursor_a1(),
            "A1",
            "Range selection cursor A1 string failed"
        );
    }

    #[test]
    fn test_table() {
        let context = A1Context::test(
            &[("First", SheetId::TEST)],
            &[("test_table", &["Col1"], Rect::test_a1("A1:C3"))],
        );
        let selection =
            A1Selection::test_a1_context("test_table[[#DATA],[#HEADERS],[Col1]]", &context);
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &context),
            "test_table[[#DATA],[#HEADERS],[Col1]]"
        );
    }
}
