#[cfg(test)]
use std::ops::RangeInclusive;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{CellRefRange, SheetCellRefRange};
use crate::{
    grid::SheetId, selection::OldSelection, A1Error, Pos, SheetNameIdMap, SheetPos, SheetRect,
};

pub mod a1_selection_exclude;
pub mod a1_selection_mutate;
pub mod a1_selection_query;
pub mod a1_selection_select;

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
    pub fn from_range(range: CellRefRange, sheet: SheetId) -> Self {
        Self {
            sheet_id: sheet,
            cursor: cursor_pos_from_last_range(&range),
            ranges: vec![range],
        }
    }

    /// Constructs a selection containing a single cell.
    pub fn from_single_cell(sheet_pos: SheetPos) -> Self {
        Self::from_range(
            CellRefRange::new_relative_pos(sheet_pos.into()),
            sheet_pos.sheet_id,
        )
    }

    /// Constructs a selection containing a single rectangle.
    pub fn from_rect(sheet_rect: SheetRect) -> Self {
        Self::from_range(
            CellRefRange::new_relative_rect(sheet_rect.into()),
            sheet_rect.sheet_id,
        )
    }

    /// Constructs a selection containing a single cell.
    pub fn from_xy(x: i64, y: i64, sheet: SheetId) -> Self {
        let sheet_id = sheet;
        Self::from_single_cell(SheetPos { x, y, sheet_id })
    }

    /// Constructs a selection all for a sheet.
    pub fn all(sheet: SheetId) -> Self {
        Self::from_range(CellRefRange::ALL, sheet)
    }

    /// Constructs a selection containing a set of columns.
    #[cfg(test)]
    pub fn from_column_ranges(column_ranges: &[RangeInclusive<i64>], sheet: SheetId) -> Self {
        let ranges = column_ranges.iter().map(|range| {
            if range.start() == range.end() {
                CellRefRange::new_relative_column(*range.start())
            } else {
                CellRefRange::new_relative_column_range(*range.start(), *range.end())
            }
        });
        Self::from_ranges(ranges, sheet)
    }
    /// Constructs a selection containing a set of rows.
    #[cfg(test)]
    pub fn from_row_ranges(row_ranges: &[RangeInclusive<i64>], sheet: SheetId) -> Self {
        let ranges = row_ranges.iter().map(|range| {
            if range.start() == range.end() {
                CellRefRange::new_relative_row(*range.start())
            } else {
                CellRefRange::new_relative_row_range(*range.start(), *range.end())
            }
        });
        Self::from_ranges(ranges, sheet)
    }

    pub fn from_ranges(ranges: impl Iterator<Item = CellRefRange>, sheet: SheetId) -> Self {
        let ranges = ranges.collect::<Vec<_>>();
        let last_range = ranges.last().expect("empty selection is invalid");
        let cursor = cursor_pos_from_last_range(last_range);
        Self {
            sheet_id: sheet,
            cursor,
            ranges,
        }
    }

    /// Constructs a selection containing multiple rectangles.
    #[cfg(test)]
    pub fn from_rects(rects: &[crate::Rect], sheet: SheetId) -> Self {
        Self::from_ranges(
            rects.iter().copied().map(CellRefRange::new_relative_rect),
            sheet,
        )
    }

    /// Constructs the default selection, which contains only the cell A1.
    pub fn default(sheet: SheetId) -> Self {
        Self::from_single_cell(pos![A1].to_sheet_pos(sheet))
    }

    /// Parses a selection from a comma-separated list of ranges.
    ///
    /// Returns an error if ranges refer to different sheets. Ranges without an
    /// explicit sheet use `default_sheet_id`.
    pub fn from_str(
        a1: &str,
        default_sheet_id: &SheetId,
        sheet_map: &SheetNameIdMap,
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
            let range = SheetCellRefRange::from_str(segment.trim(), default_sheet_id, sheet_map)?;
            if *sheet.get_or_insert(range.sheet) != range.sheet {
                return Err(A1Error::TooManySheets(a1.to_string()));
            }

            ranges.push(range.cells);
        }

        let last_range = ranges
            .last()
            .copied()
            .ok_or_else(|| A1Error::InvalidRange(a1.to_string()))?;

        Ok(Self {
            sheet_id: sheet.unwrap_or(default_sheet_id.to_owned()),
            cursor: cursor_pos_from_last_range(&last_range),
            ranges,
        })
    }

    /// Returns an A1-style string describing the selection. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    ///
    /// The cursor position has no effect on the output.
    pub fn to_string(
        &self,
        default_sheet_id: Option<SheetId>,
        sheet_map: &SheetNameIdMap,
    ) -> String {
        let sheet = self.sheet_id;
        self.ranges
            .iter()
            .map(|&cells| SheetCellRefRange { sheet, cells }.to_string(default_sheet_id, sheet_map))
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
    pub fn intersection(&self, other: &Self) -> Option<Self> {
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
                    });
            }
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
            result.cursor = if result.contains_pos(self.cursor) {
                self.cursor
            } else if result.contains_pos(other.cursor) {
                other.cursor
            } else {
                let pos = result.last_selection_end();
                if result.contains_pos(pos) {
                    pos
                } else {
                    let pos = result.last_selection_end();
                    if result.contains_pos(pos) {
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

    /// Returns `true` if the two selections overlap.
    pub fn overlaps_a1_selection(&self, other: &Self) -> bool {
        if self.sheet_id != other.sheet_id {
            return false;
        }

        self.ranges.iter().any(|range| match range {
            CellRefRange::Sheet { range } => {
                other.ranges.iter().any(|other_range| match other_range {
                    CellRefRange::Sheet { range: other_range } => {
                        range.intersection(other_range).is_some()
                    }
                })
            }
        })
    }

    pub fn update_cursor(&mut self) {
        if let Some(last) = self.ranges.last() {
            self.cursor = cursor_pos_from_last_range(last);
        }
    }

    /// Tries to convert the selection to a single position. This works only if
    /// there is one range, and the range is a single cell.
    pub fn try_to_pos(&self) -> Option<Pos> {
        if self.ranges.len() == 1 {
            if let Some(range) = self.ranges.first() {
                return range.try_to_pos();
            }
        }
        None
    }

    /// Returns a test selection from the A1-string with SheetId::test().
    #[cfg(test)]
    pub fn test_a1(a1: &str) -> Self {
        Self::from_str(a1, &SheetId::TEST, &std::collections::HashMap::new()).unwrap()
    }

    /// Returns a test selection from the A1-string with the given sheet ID.
    #[cfg(test)]
    pub fn test_a1_sheet_id(a1: &str, sheet_id: &SheetId) -> Self {
        Self::from_str(a1, sheet_id, &std::collections::HashMap::new()).unwrap()
    }

    /// Returns an A1-style string describing the selection with default
    /// SheetId.
    #[cfg(test)]
    pub fn test_to_string(&self) -> String {
        self.to_string(Some(SheetId::TEST), &std::collections::HashMap::new())
    }
}

/// Returns the position from the last range (either the end, or if not defined,
/// the start).
fn cursor_pos_from_last_range(last_range: &CellRefRange) -> Pos {
    match last_range {
        CellRefRange::Sheet { range } => {
            let x = range.start.col();
            let y = range.start.row();
            Pos { x, y }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use std::collections::HashMap;

    use crate::{Rect, RefRangeBounds};

    use super::*;

    #[test]
    fn test_cursor_pos_from_last_range() {
        assert_eq!(
            cursor_pos_from_last_range(&CellRefRange::test_a1("A1")),
            pos![A1]
        );
        assert_eq!(
            cursor_pos_from_last_range(&CellRefRange::test_a1("A1:C3")),
            pos![A1]
        );
    }

    #[test]
    fn test_from_a1() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("A1", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_xy(1, 1, sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_all() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("*", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(CellRefRange::ALL, sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_columns() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("A:C", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_column_ranges(&[1..=3], sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_rows() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("1:3", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_row_ranges(&[1..=3], sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_rect() {
        let sheet_id = SheetId::test();
        let d1a5 = RefRangeBounds::new_relative(4, 1, 1, 5);
        assert_eq!(
            A1Selection::from_str("A1:B2", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_rect(SheetRect::new(1, 1, 2, 2, sheet_id))),
        );
        assert_eq!(
            A1Selection::from_str("D1:A5", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(
                CellRefRange::Sheet { range: d1a5 },
                sheet_id,
            )),
        );
        assert_eq!(
            A1Selection::from_str("A1:B2,D1:A5", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_ranges(
                [
                    CellRefRange::new_relative_rect(Rect::new(1, 1, 2, 2)),
                    CellRefRange::Sheet { range: d1a5 }
                ]
                .into_iter(),
                sheet_id,
            )),
        );
    }

    #[test]
    fn test_from_a1_everything() {
        let sheet_id = SheetId::test();
        let selection =
            A1Selection::from_str("A1,B1:D2,E:G,2:3,5:7,F6:G8,4", &sheet_id, &HashMap::new())
                .unwrap();

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
        assert_eq!(
            A1Selection::from_str("1", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(
                CellRefRange::new_relative_row(1),
                sheet_id,
            )),
        );

        assert_eq!(
            A1Selection::from_str("1:3", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_row_ranges(&[1..=3], sheet_id)),
        );

        assert_eq!(
            A1Selection::from_str("1:", &sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(
                CellRefRange::Sheet {
                    range: RefRangeBounds::ALL
                },
                sheet_id,
            )),
        );
    }

    #[test]
    fn test_from_a1_sheets() {
        let sheet_id = SheetId::new();
        let sheet_id2 = SheetId::new();
        let map = HashMap::from([
            (sheet_id, "Sheet1".to_string()),
            (sheet_id2, "Second".to_string()),
        ]);
        let rev_map = map
            .iter()
            .map(|(&id, name)| (crate::util::case_fold(name), id))
            .collect();
        assert_eq!(
            A1Selection::from_str("'Second'!A1", &sheet_id, &rev_map),
            Ok(A1Selection::from_xy(1, 1, sheet_id2)),
        );
    }

    #[test]
    fn test_to_a1_all() {
        let selection = A1Selection::from_range(CellRefRange::ALL, SheetId::test());
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "*",
        );
    }

    #[test]
    fn test_to_a1_columns() {
        let selection =
            A1Selection::from_column_ranges(&[1..=5, 10..=12, 15..=15], SheetId::test());
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A:E,J:L,O",
        );
    }

    #[test]
    fn test_to_a1_rows() {
        let selection = A1Selection::from_row_ranges(&[1..=5, 10..=12, 15..=15], SheetId::test());
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "1:5,10:12,15",
        );
    }

    #[test]
    fn test_to_a1_rects() {
        let selection = A1Selection::from_rects(
            &[Rect::new(1, 1, 2, 2), Rect::new(3, 3, 4, 4)],
            SheetId::test(),
        );
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
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
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
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
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A:E,J:L,O,1:5,10:12,15",
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
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1",
        );
    }

    #[test]
    fn test_extra_comma() {
        let sheet_id = SheetId::test();
        let selection = A1Selection::from_str("1,", &sheet_id, &HashMap::new()).unwrap();
        assert_eq!(selection.to_string(Some(sheet_id), &HashMap::new()), "1");
    }

    #[test]
    fn test_multiple_one_sized_rects() {
        let sheet_id = SheetId::test();
        let selection = A1Selection::from_str("A1,B1,C1", &sheet_id, &HashMap::new()).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &HashMap::new()),
            "A1,B1,C1",
        );
    }

    #[test]
    fn test_different_sheet() {
        let sheet_id = SheetId::test();
        let sheet_second = SheetId::new();
        let map = HashMap::from([
            ("First".to_string(), sheet_id),
            ("Second".to_string(), sheet_second),
        ]);
        let rev_map = map
            .iter()
            .map(|(name, &id)| (crate::util::case_fold(name), id))
            .collect();
        let selection =
            A1Selection::from_str("second!A1,second!B1,second!C1", &sheet_id, &rev_map).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &map),
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
        // Test different sheets return None
        let sel1 = A1Selection::test_a1_sheet_id("A1:B2", &SheetId::new());
        let sel2 = A1Selection::test_a1_sheet_id("B2:C3", &SheetId::new());
        assert_eq!(
            sel1.intersection(&sel2),
            None,
            "Different sheets should return None"
        );

        // Test non-overlapping rectangles return None
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("C3:D4");
        assert_eq!(
            sel1.intersection(&sel2),
            None,
            "Non-overlapping rectangles should return None"
        );

        // Test overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:C3");
        let sel2 = A1Selection::test_a1("B2:D4");
        assert_eq!(
            sel1.intersection(&sel2).unwrap().test_to_string(),
            "B2:C3",
            "Overlapping rectangles intersection failed"
        );
        assert_eq!(
            sel1.intersection(&sel2).unwrap().cursor,
            pos![B2],
            "Cursor position incorrect for overlapping rectangles"
        );

        // Test one rectangle inside another
        let sel1 = A1Selection::test_a1("A1:D4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert_eq!(
            sel1.intersection(&sel2).unwrap().test_to_string(),
            "B2:C3",
            "Rectangle inside another intersection failed"
        );

        // Test overlapping columns
        let sel1 = A1Selection::test_a1("A:C");
        let sel2 = A1Selection::test_a1("B:D");
        let intersection = sel1.intersection(&sel2).unwrap();
        assert_eq!(
            intersection.test_to_string(),
            "B:C",
            "Overlapping columns intersection failed"
        );

        // Test non-overlapping columns return None
        let sel1 = A1Selection::test_a1("A:B");
        let sel2 = A1Selection::test_a1("C:D");
        assert_eq!(
            sel1.intersection(&sel2),
            None,
            "Non-overlapping columns should return None"
        );

        // Test overlapping rows
        let sel1 = A1Selection::test_a1("1:3");
        let sel2 = A1Selection::test_a1("2:4");
        let intersection = sel1.intersection(&sel2).unwrap();
        assert_eq!(
            intersection.test_to_string(),
            "2:3",
            "Overlapping rows intersection failed"
        );

        // Test non-overlapping rows return None
        let sel1 = A1Selection::test_a1("1:2");
        let sel2 = A1Selection::test_a1("3:4");
        assert_eq!(
            sel1.intersection(&sel2),
            None,
            "Non-overlapping rows should return None"
        );

        // Test all (*) intersect with all (*)
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("*");
        assert_eq!(
            sel1.intersection(&sel2).unwrap().test_to_string(),
            "*",
            "All (*) intersection with all (*) failed"
        );

        // Test single cell intersection
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("B2");
        assert_eq!(
            sel1.intersection(&sel2).unwrap().test_to_string(),
            "B2",
            "Single cell intersection failed"
        );

        // Test multiple disjoint intersections
        let sel1 = A1Selection::test_a1("A1:C3,E1:G3");
        let sel2 = A1Selection::test_a1("B2:F2");
        assert_eq!(
            sel1.intersection(&sel2).unwrap().test_to_string(),
            "B2:C2,E2:F2",
            "Multiple disjoint intersections failed"
        );

        // Test all (*) intersect with rectangle
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert_eq!(
            sel1.intersection(&sel2).unwrap().test_to_string(),
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
        // Different sheets don't overlap
        let sel1 = A1Selection::test_a1_sheet_id("A1:B2", &SheetId::new());
        let sel2 = A1Selection::test_a1_sheet_id("B2:C3", &SheetId::new());
        assert!(
            !sel1.overlaps_a1_selection(&sel2),
            "Different sheets should not overlap"
        );

        // Non-overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("C3:D4");
        assert!(
            !sel1.overlaps_a1_selection(&sel2),
            "Non-overlapping rectangles should not overlap"
        );

        // Overlapping rectangles
        let sel1 = A1Selection::test_a1("A1:C3");
        let sel2 = A1Selection::test_a1("B2:D4");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Overlapping rectangles should overlap"
        );

        // One rectangle inside another
        let sel1 = A1Selection::test_a1("A1:D4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Nested rectangles should overlap"
        );

        // Overlapping columns
        let sel1 = A1Selection::test_a1("A:C");
        let sel2 = A1Selection::test_a1("B:D");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Overlapping columns should overlap"
        );

        // Non-overlapping columns
        let sel1 = A1Selection::test_a1("A:B");
        let sel2 = A1Selection::test_a1("C:D");
        assert!(
            !sel1.overlaps_a1_selection(&sel2),
            "Non-overlapping columns should not overlap"
        );

        // Overlapping rows
        let sel1 = A1Selection::test_a1("1:3");
        let sel2 = A1Selection::test_a1("2:4");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Overlapping rows should overlap"
        );

        // Non-overlapping rows
        let sel1 = A1Selection::test_a1("1:2");
        let sel2 = A1Selection::test_a1("3:4");
        assert!(
            !sel1.overlaps_a1_selection(&sel2),
            "Non-overlapping rows should not overlap"
        );

        // Single cell overlap
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("B2");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Single cell should overlap with containing rectangle"
        );

        // Multiple disjoint ranges with overlap
        let sel1 = A1Selection::test_a1("A1:C3,E1:G3");
        let sel2 = A1Selection::test_a1("B2:F2");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Disjoint ranges should overlap when intersecting"
        );

        // Multiple disjoint ranges without overlap
        let sel1 = A1Selection::test_a1("A1:B2,D1:E2");
        let sel2 = A1Selection::test_a1("F1:G2,H1:I2");
        assert!(
            !sel1.overlaps_a1_selection(&sel2),
            "Disjoint ranges should not overlap when separate"
        );

        // Complex overlapping selections
        let sel1 = A1Selection::test_a1("A1:C3,E:G,2:4");
        let sel2 = A1Selection::test_a1("B2:D4,F:H,3:5");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Complex selections should detect overlap correctly"
        );

        // All (*) overlaps with anything
        let sel1 = A1Selection::test_a1("*");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "All (*) should overlap with any selection"
        );

        // Row overlapping with rectangle
        let sel1 = A1Selection::test_a1("2:4");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Row should overlap with intersecting rectangle"
        );

        // Column overlapping with rectangle
        let sel1 = A1Selection::test_a1("B:D");
        let sel2 = A1Selection::test_a1("B2:C3");
        assert!(
            sel1.overlaps_a1_selection(&sel2),
            "Column should overlap with intersecting rectangle"
        );
    }

    #[test]
    fn test_try_to_pos() {
        let selection = A1Selection::test_a1("A1");
        assert_eq!(selection.try_to_pos(), Some(pos![A1]));

        let selection = A1Selection::test_a1("A1:B2");
        assert_eq!(selection.try_to_pos(), None);

        let selection = A1Selection::test_a1("A");
        assert_eq!(selection.try_to_pos(), None);

        let selection = A1Selection::test_a1("*");
        assert_eq!(selection.try_to_pos(), None);

        let selection = A1Selection::test_a1("1:4");
        assert_eq!(selection.try_to_pos(), None);
    }
}
