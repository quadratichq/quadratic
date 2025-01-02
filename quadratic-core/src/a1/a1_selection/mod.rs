use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{A1Context, A1Error, CellRefRange, RefRangeBounds, SheetCellRefRange, TableRef};
use crate::{grid::SheetId, selection::OldSelection, Pos, SheetPos, SheetRect};

mod exclude;
mod mutate;
mod query;
mod select;
mod table;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct A1Selection {
    /// Current sheet.
    ///
    /// Selections can only span a single sheet.
    #[cfg_attr(test, proptest(value = "SheetId::test()"))]
    pub sheet_id: SheetId,
    /// Cursor position, which is moved using the arrow keys (while not holding
    /// shift).
    ///
    /// This always coincides with the start of the last range in `ranges`, but
    /// in the case of an infinite selection it contains information that cannot
    /// be inferred from `ranges`.
    pub cursor: Pos,
    /// Selected ranges (union).
    ///
    /// The cursor selection must always contain at least one range, and the
    /// last range can be manipulated using the arrow keys.
    ///
    /// The `start` of the last range is where the cursor outline is drawn, and
    /// can be moved by pressing arrow keys without holding the shift key.
    ///
    /// The `end` of the last range can be moved by pressing arrow keys while
    /// holding the shift key.
    pub ranges: Vec<CellRefRange>,
}

impl From<OldSelection> for A1Selection {
    fn from(value: OldSelection) -> Self {
        let OldSelection {
            sheet_id,
            x,
            y,
            rects,
            rows,
            columns,
            all,
        } = value;

        let mut ranges = if all {
            vec![CellRefRange::ALL]
        } else {
            itertools::chain!(
                rows.into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_row),
                columns
                    .into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_column),
                rects
                    .into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_rect),
            )
            .collect()
        };

        if ranges.is_empty() {
            ranges.push(CellRefRange::new_relative_pos(Pos { x, y }));
        }

        Self {
            sheet_id,
            cursor: Pos { x, y },
            ranges,
        }
    }
}

impl A1Selection {
    /// Constructs a basic selection containing a single region.
    pub fn from_range(range: CellRefRange, sheet: SheetId, context: &A1Context) -> Self {
        Self {
            sheet_id: sheet,
            cursor: cursor_pos_from_last_range(&range, context),
            ranges: vec![range],
        }
    }

    pub fn from_ref_range_bounds(sheet_id: SheetId, range: RefRangeBounds) -> Self {
        Self {
            sheet_id,
            cursor: range.cursor_pos_from_last_range(),
            ranges: vec![CellRefRange::Sheet { range }],
        }
    }

    /// Constructs a selection containing a single cell.
    pub fn from_single_cell(sheet_pos: SheetPos) -> Self {
        Self::from_ref_range_bounds(
            sheet_pos.sheet_id,
            RefRangeBounds::new_relative_pos(sheet_pos.into()),
        )
    }

    /// Constructs a selection containing a single rectangle.
    pub fn from_rect(sheet_rect: SheetRect) -> Self {
        Self::from_ref_range_bounds(
            sheet_rect.sheet_id,
            RefRangeBounds::new_relative_rect(sheet_rect.into()),
        )
    }

    /// Constructs a selection containing a single cell.
    pub fn from_xy(x: i64, y: i64, sheet: SheetId) -> Self {
        let sheet_id = sheet;
        Self::from_single_cell(SheetPos { x, y, sheet_id })
    }

    /// Constructs a selection all for a sheet.
    pub fn all(sheet: SheetId) -> Self {
        Self::from_ref_range_bounds(sheet, RefRangeBounds::ALL)
    }

    /// Constructs the default selection, which contains only the cell A1.
    pub fn default(sheet: SheetId) -> Self {
        Self::from_single_cell(pos![A1].to_sheet_pos(sheet))
    }

    /// Parses a selection from a comma-separated list of ranges.
    ///
    /// Returns an error if ranges refer to different sheets. Ranges without an
    /// explicit sheet use `default_sheet_id`.
    pub fn parse(
        a1: &str,
        default_sheet_id: &SheetId,
        context: &A1Context,
    ) -> Result<Self, A1Error> {
        let mut sheet = None;
        let mut ranges = vec![];

        let mut segments = Vec::new();
        let mut current_segment = String::new();
        let mut in_quotes = false;

        for c in a1.chars() {
            match c {
                '\'' => {
                    in_quotes = !in_quotes;
                    current_segment.push(c);
                }
                ',' if !in_quotes => {
                    if !current_segment.is_empty() {
                        segments.push(current_segment);
                        current_segment = String::new();
                    }
                }
                _ => current_segment.push(c),
            }
        }

        if !current_segment.is_empty() {
            segments.push(current_segment);
        }

        for segment in segments {
            let range = SheetCellRefRange::parse(segment.trim(), default_sheet_id, context)?;
            if *sheet.get_or_insert(range.sheet_id) != range.sheet_id {
                return Err(A1Error::TooManySheets(a1.to_string()));
            }

            ranges.push(range.cells);
        }

        let last_range = ranges
            .last()
            .ok_or_else(|| A1Error::InvalidRange(a1.to_string()))?;

        Ok(Self {
            sheet_id: sheet.unwrap_or(default_sheet_id.to_owned()),
            cursor: cursor_pos_from_last_range(last_range, context),
            ranges,
        })
    }

    /// Returns an A1-style string describing the selection. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    ///
    /// The cursor position has no effect on the output.
    pub fn to_string(&self, default_sheet_id: Option<SheetId>, context: &A1Context) -> String {
        let sheet_id = self.sheet_id;
        self.ranges
            .iter()
            .map(|cells| {
                SheetCellRefRange {
                    sheet_id,
                    cells: cells.clone(),
                }
                .to_string(default_sheet_id, context)
            })
            .collect::<Vec<_>>()
            .join(",")
    }

    pub fn to_cursor_a1(&self) -> String {
        self.cursor.a1_string()
    }

    pub fn to_cursor_sheet_pos(&self) -> SheetPos {
        self.cursor.to_sheet_pos(self.sheet_id)
    }

    /// Finds intersection of two Selections.
    pub fn intersection(&self, other: &Self, context: &A1Context) -> Option<Self> {
        if self.sheet_id != other.sheet_id {
            return None;
        }
        let mut ranges = vec![];
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                other
                    .ranges
                    .iter()
                    .for_each(|other_range| match other_range {
                        CellRefRange::Sheet { range: other_range } => {
                            let intersection = range.intersection(other_range);
                            if let Some(intersection) = intersection {
                                ranges.push(CellRefRange::Sheet {
                                    range: intersection,
                                });
                            }
                        }
                        CellRefRange::Table { .. } => (),
                    });
            }
            CellRefRange::Table { .. } => (),
        });
        if ranges.is_empty() {
            None
        } else {
            let mut result = Self {
                sheet_id: self.sheet_id,
                cursor: self.cursor,
                ranges,
            };

            // try to find a better cursor position
            result.cursor = if result.contains_pos(self.cursor, context) {
                self.cursor
            } else if result.contains_pos(other.cursor, context) {
                other.cursor
            } else {
                let pos = result.last_selection_end(context);
                if result.contains_pos(pos, context) {
                    pos
                } else {
                    let pos = result.last_selection_end(context);
                    if result.contains_pos(pos, context) {
                        pos
                    } else {
                        // give up and just use the cursor even though it's wrong
                        self.cursor
                    }
                }
            };
            Some(result)
        }
    }

    /// Returns `true` if the RefRangeBounds overlaps the TableRef.
    fn overlap_ref_range_bounds_table_ref(
        range: &RefRangeBounds,
        other_range: &TableRef,
        current_row: i64,
        context: &A1Context,
    ) -> bool {
        let rect = range.to_rect_unbounded();
        if let Some(other_rect) = other_range.to_largest_rect(current_row, context) {
            rect.intersects(other_rect)
        } else {
            false
        }
    }

    /// Returns `true` if the two selections overlap.
    pub fn overlaps_a1_selection(
        &self,
        other: &Self,
        current_row: i64,
        context: &A1Context,
    ) -> bool {
        if self.sheet_id != other.sheet_id {
            return false;
        }

        self.ranges.iter().any(|range| match range {
            CellRefRange::Sheet { range } => {
                other.ranges.iter().any(|other_range| match other_range {
                    CellRefRange::Sheet { range: other_range } => {
                        range.intersection(other_range).is_some()
                    }
                    CellRefRange::Table { range: other_range } => {
                        A1Selection::overlap_ref_range_bounds_table_ref(
                            range,
                            other_range,
                            current_row,
                            context,
                        )
                    }
                })
            }
            CellRefRange::Table { range } => {
                other.ranges.iter().any(|other_range| match other_range {
                    CellRefRange::Sheet { range: other_range } => {
                        A1Selection::overlap_ref_range_bounds_table_ref(
                            other_range,
                            range,
                            current_row,
                            context,
                        )
                    }
                    // two tables cannot overlap
                    CellRefRange::Table { .. } => false,
                })
            }
        })
    }

    /// Updates the cursor position to the position of the last range.
    pub fn update_cursor(&mut self, context: &A1Context) {
        if let Some(last) = self.ranges.last() {
            self.cursor = cursor_pos_from_last_range(last, context);
        }
    }

    /// Tries to convert the selection to a single position. This works only if
    /// there is one range, and the range is a single cell.
    pub fn try_to_pos(&self, context: &A1Context) -> Option<Pos> {
        if self.ranges.len() == 1 {
            if let Some(range) = self.ranges.first() {
                return range.try_to_pos(context);
            }
        }
        None
    }

    /// Returns a test selection from the A1-string with SheetId::test().
    #[cfg(test)]
    pub fn test_a1(a1: &str) -> Self {
        Self::parse(a1, &SheetId::TEST, &A1Context::default()).unwrap()
    }

    /// Returns a test selection from the A1-string with the given sheet ID.
    #[cfg(test)]
    pub fn test_a1_sheet_id(a1: &str, sheet_id: &SheetId) -> Self {
        Self::parse(a1, sheet_id, &A1Context::default()).unwrap()
    }

    /// Returns an A1-style string describing the selection with default
    /// SheetId.
    #[cfg(test)]
    pub fn test_to_string(&self) -> String {
        self.to_string(Some(SheetId::TEST), &A1Context::default())
    }
}

/// Returns the position from the last range (either the end, or if not defined,
/// the start).
fn cursor_pos_from_last_range(last_range: &CellRefRange, context: &A1Context) -> Pos {
    match last_range {
        CellRefRange::Sheet { range } => range.cursor_pos_from_last_range(),
        CellRefRange::Table { range } => range.cursor_pos_from_last_range(context),
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_cursor_pos_from_last_range() {
        let context = A1Context::default();
        assert_eq!(
            cursor_pos_from_last_range(&CellRefRange::test_a1("A1"), &context),
            pos![A1]
        );
        assert_eq!(
            cursor_pos_from_last_range(&CellRefRange::test_a1("A1:C3"), &context),
            pos![A1]
        );
    }

    #[test]
    fn test_from_a1() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("A1", &sheet_id, &context),
            Ok(A1Selection::from_xy(1, 1, sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_all() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("*", &sheet_id, &context),
            Ok(A1Selection::from_range(
                CellRefRange::ALL,
                sheet_id,
                &context
            )),
        );
    }

    #[test]
    fn test_from_a1_rect() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("A1:B2", &sheet_id, &context),
            Ok(A1Selection::test_a1("A1:B2")),
        );
        assert_eq!(
            A1Selection::parse("D1:A5", &sheet_id, &context),
            Ok(A1Selection::test_a1("D1:A5")),
        );
        assert_eq!(
            A1Selection::parse("A1:B2,D1:A5", &sheet_id, &context),
            Ok(A1Selection::test_a1("A1:B2,D1:A5")),
        );
    }

    #[test]
    fn test_from_a1_everything() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        let selection =
            A1Selection::parse("A1,B1:D2,E:G,2:3,5:7,F6:G8,4", &sheet_id, &context).unwrap();

        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.cursor, pos![A4]);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::new_relative_pos(Pos { x: 1, y: 1 }),
                CellRefRange::new_relative_rect(Rect::new(2, 1, 4, 2)),
                CellRefRange::new_relative_column_range(5, 7),
                CellRefRange::new_relative_row_range(2, 3),
                CellRefRange::new_relative_row_range(5, 7),
                CellRefRange::new_relative_rect(Rect::new(6, 6, 7, 8)),
                CellRefRange::new_relative_row(4),
            ],
        );
    }

    #[test]
    fn test_row_to_a1() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("1", &sheet_id, &context),
            Ok(A1Selection::from_range(
                CellRefRange::new_relative_row(1),
                sheet_id,
                &context,
            )),
        );

        assert_eq!(
            A1Selection::parse("1:3", &sheet_id, &context),
            Ok(A1Selection::test_a1("1:3")),
        );

        assert_eq!(
            A1Selection::parse("1:", &sheet_id, &context),
            Ok(A1Selection::test_a1("*")),
        );
    }

    #[test]
    fn test_from_a1_sheets() {
        let sheet_id = SheetId::new();
        let sheet_id2 = SheetId::new();
        let context = A1Context::test(&[("Sheet1", sheet_id), ("Second", sheet_id2)], &[]);
        assert_eq!(
            A1Selection::parse("'Second'!A1", &sheet_id, &context),
            Ok(A1Selection::from_xy(1, 1, sheet_id2)),
        );
    }

    #[test]
    fn test_to_a1_all() {
        let context = A1Context::default();
        let selection = A1Selection::from_range(CellRefRange::ALL, SheetId::test(), &context);
        assert_eq!(selection.to_string(Some(SheetId::test()), &context), "*",);
    }

    #[test]
    fn test_to_a1_columns() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A:e,J:L,O");
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "A:E,J:L,O",
        );
    }

    #[test]
    fn test_to_a1_rows() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("1:5,10:12,A15:15");
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "1:5,10:12,A15:15",
        );
    }

    #[test]
    fn test_to_a1_rects() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1:B2,C3:D4");
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "A1:B2,C3:D4",
        );
    }

    #[test]
    fn test_to_a1_pos() {
        let selection = A1Selection {
            sheet_id: SheetId::test(),
            cursor: pos![A1],
            ranges: vec![CellRefRange::new_relative_rect(Rect::new(1, 1, 1, 1))],
        };
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &A1Context::default()),
            "A1",
        );
    }

    #[test]
    fn test_to_a1() {
        let selection = A1Selection {
            sheet_id: SheetId::test(),
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
            selection.to_string(Some(SheetId::test()), &A1Context::default()),
            "A:E,J:L,O,1:5,10:12,A15:15",
        );
    }

    #[test]
    fn test_a1_with_one_sized_rect() {
        let selection = A1Selection {
            sheet_id: SheetId::test(),
            cursor: Pos { x: 1, y: 1 },
            ranges: vec![CellRefRange::test_a1("A1:A1")],
        };
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &A1Context::default()),
            "A1",
        );
    }

    #[test]
    fn test_extra_comma() {
        let sheet_id = SheetId::test();
        let selection = A1Selection::parse("1,", &sheet_id, &A1Context::default()).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &A1Context::default()),
            "A1:1",
        );
    }

    #[test]
    fn test_multiple_one_sized_rects() {
        let sheet_id = SheetId::test();
        let selection = A1Selection::parse("A1,B1,C1", &sheet_id, &A1Context::default()).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &A1Context::default()),
            "A1,B1,C1",
        );
    }

    #[test]
    fn test_different_sheet() {
        let sheet_id = SheetId::test();
        let sheet_second = SheetId::new();
        let context = A1Context::test(&[("First", sheet_id), ("Second", sheet_second)], &[]);
        let selection =
            A1Selection::parse("second!A1,second!B1,second!C1", &sheet_id, &context).unwrap();
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
    fn test_cursor_sheet_pos() {
        // Test basic cursor position
        let selection = A1Selection::test_a1("A1");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 1, 1),
            "Basic cursor sheet pos failed"
        );

        // Test cursor at different positions
        let selection = A1Selection::test_a1("B2");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 2, 2),
            "B2 cursor sheet pos failed"
        );

        // Test cursor with large coordinates
        let selection = A1Selection::test_a1("Z100");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 26, 100),
            "Large coordinate cursor sheet pos failed"
        );

        // Test cursor with multi-letter column
        let selection = A1Selection::test_a1("AA1");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 27, 1),
            "Multi-letter column cursor sheet pos failed"
        );

        // Test cursor position in a range selection
        let selection = A1Selection::test_a1("A1:C3");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 1, 1),
            "Range selection cursor sheet pos failed"
        );
    }
}

#[cfg(test)]
mod intersection_tests {

    use super::*;

    #[test]
    fn test_intersection() {
        let context = A1Context::default();
        // Test different sheets return None
        let sel1 = A1Selection::test_a1_sheet_id("A1:B2", &SheetId::new());
        let sel2 = A1Selection::test_a1_sheet_id("B2:C3", &SheetId::new());
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Different sheets should return None"
        );

        // Test non-overlapping rectangles return None
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("C3:D4");
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Non-overlapping rectangles should return None"
        );

        // Test overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:C3");
        let sel2 = A1Selection::test_a1("B2:D4");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C3",
            "Overlapping rectangles intersection failed"
        );
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().cursor,
            pos![B2],
            "Cursor position incorrect for overlapping rectangles"
        );

        // Test one rectangle inside another
        let sel1 = A1Selection::test_a1("A1:D4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C3",
            "Rectangle inside another intersection failed"
        );

        // Test overlapping columns
        let sel1 = A1Selection::test_a1("A:C");
        let sel2 = A1Selection::test_a1("B:D");
        let intersection = sel1.intersection(&sel2, &context).unwrap();
        assert_eq!(
            intersection.test_to_string(),
            "B:C",
            "Overlapping columns intersection failed"
        );

        // Test non-overlapping columns return None
        let sel1 = A1Selection::test_a1("A:B");
        let sel2 = A1Selection::test_a1("C:D");
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Non-overlapping columns should return None"
        );

        // Test overlapping rows
        let sel1 = A1Selection::test_a1("1:3");
        let sel2 = A1Selection::test_a1("2:4");
        let intersection = sel1.intersection(&sel2, &context).unwrap();
        assert_eq!(
            intersection.test_to_string(),
            "2:3",
            "Overlapping rows intersection failed"
        );

        // Test non-overlapping rows return None
        let sel1 = A1Selection::test_a1("1:2");
        let sel2 = A1Selection::test_a1("3:4");
        assert_eq!(
            sel1.intersection(&sel2, &context),
            None,
            "Non-overlapping rows should return None"
        );

        // Test all (*) intersect with all (*)
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("*");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "*",
            "All (*) intersection with all (*) failed"
        );

        // Test single cell intersection
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("B2");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2",
            "Single cell intersection failed"
        );

        // Test multiple disjoint intersections
        let sel1 = A1Selection::test_a1("A1:C3,E1:G3");
        let sel2 = A1Selection::test_a1("B2:F2");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C2,E2:F2",
            "Multiple disjoint intersections failed"
        );

        // Test all (*) intersect with rectangle
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert_eq!(
            sel1.intersection(&sel2, &context).unwrap().test_to_string(),
            "B2:C3",
            "All (*) intersection with rectangle failed"
        );

        // todo(ayush): make this work

        // Test complex intersection with multiple ranges
        // let sel1 = A1Selection::test_a1("A1:C3,E:G,2:4");
        // let sel2 = A1Selection::test_a1("B2:D4,F:H,3:5");
        // assert_eq!(
        //     sel1.intersection(&sel2).unwrap().test_to_string(),
        //     "B2:C3,F:G,3:4",
        //     "Complex intersection with multiple ranges failed"
        // );
    }

    #[test]
    fn test_overlaps_a1_selection() {
        let context = A1Context::test(&[], &[]);
        // Different sheets don't overlap
        let sel1 = A1Selection::test_a1_sheet_id("A1:B2", &SheetId::new());
        let sel2 = A1Selection::test_a1_sheet_id("B2:C3", &SheetId::new());
        assert!(
            !sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Different sheets should not overlap"
        );

        // Non-overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("C3:D4");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Non-overlapping rectangles should not overlap"
        );

        // Overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:C3");
        let sel2 = A1Selection::test_a1("B2:D4");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Overlapping rectangles should overlap"
        );

        // One rectangle inside another
        let sel1 = A1Selection::test_a1("A1:D4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Nested rectangles should overlap"
        );

        // Overlapping columns
        let sel1 = A1Selection::test_a1("A:C");
        let sel2 = A1Selection::test_a1("B:D");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Overlapping columns should overlap"
        );

        // Non-overlapping columns
        let sel1 = A1Selection::test_a1("A:B");
        let sel2 = A1Selection::test_a1("C:D");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Non-overlapping columns should not overlap"
        );

        // Overlapping rows
        let sel1 = A1Selection::test_a1("1:3");
        let sel2 = A1Selection::test_a1("2:4");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Overlapping rows should overlap"
        );

        // Non-overlapping rows
        let sel1 = A1Selection::test_a1("1:2");
        let sel2 = A1Selection::test_a1("3:4");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Non-overlapping rows should not overlap"
        );

        // Single cell overlap
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("B2");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Single cell should overlap with containing rectangle"
        );

        // Multiple disjoint ranges with overlap
        let sel1 = A1Selection::test_a1("A1:C3,E1:G3");
        let sel2 = A1Selection::test_a1("B2:F2");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Disjoint ranges should overlap when intersecting"
        );

        // Multiple disjoint ranges without overlap
        let sel1 = A1Selection::test_a1("A1:B2,D1:E2");
        let sel2 = A1Selection::test_a1("F1:G2,H1:I2");
        assert!(
            !sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Disjoint ranges should not overlap when separate"
        );

        // Complex overlapping selections
        let sel1 = A1Selection::test_a1("A1:C3,E:G,2:4");
        let sel2 = A1Selection::test_a1("B2:D4,F:H,3:5");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Complex selections should detect overlap correctly"
        );

        // All (*) overlaps with anything
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "All (*) should overlap with any selection"
        );

        // Row overlapping with rectangle
        let sel1 = A1Selection::test_a1("2:4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Row should overlap with intersecting rectangle"
        );

        // Column overlapping with rectangle
        let sel1 = A1Selection::test_a1("B:D");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2, 1, &context),
            "Column should overlap with intersecting rectangle"
        );
    }

    #[test]
    fn test_try_to_pos() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1");
        assert_eq!(selection.try_to_pos(&context), Some(pos![A1]));

        let selection = A1Selection::test_a1("A1:B2");
        assert_eq!(selection.try_to_pos(&context), None);

        let selection = A1Selection::test_a1("A");
        assert_eq!(selection.try_to_pos(&context), None);

        let selection = A1Selection::test_a1("*");
        assert_eq!(selection.try_to_pos(&context), None);

        let selection = A1Selection::test_a1("1:4");
        assert_eq!(selection.try_to_pos(&context), None);
    }
}
