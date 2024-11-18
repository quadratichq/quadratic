#[cfg(test)]
use std::ops::RangeInclusive;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::A1Subspaces;
use crate::{
    grid::SheetId, selection::OldSelection, A1Error, CellRefRange, Pos, Rect, SheetCellRefRange,
    SheetNameIdMap, SheetPos, SheetRect,
};

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
                    .filter_map(|x| u64::try_from(x).ok())
                    .map(CellRefRange::new_relative_row),
                columns
                    .into_iter()
                    .flatten()
                    .filter_map(|x| u64::try_from(x).ok())
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
            cursor: cursor_pos_from_last_range(range),
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
    /// Constructs a selection containing a set of columns.
    #[cfg(test)]
    pub fn from_column_ranges(column_ranges: &[RangeInclusive<u64>], sheet: SheetId) -> Self {
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
    pub fn from_row_ranges(row_ranges: &[RangeInclusive<u64>], sheet: SheetId) -> Self {
        let ranges = row_ranges.iter().map(|range| {
            if range.start() == range.end() {
                CellRefRange::new_relative_row(*range.start())
            } else {
                CellRefRange::new_relative_row_range(*range.start(), *range.end())
            }
        });
        Self::from_ranges(ranges, sheet)
    }
    #[cfg(test)]
    pub fn from_ranges(ranges: impl Iterator<Item = CellRefRange>, sheet: SheetId) -> Self {
        let ranges = ranges.collect_vec();
        let last_range = ranges.last().expect("empty selection is invalid");
        let cursor = Pos {
            x: last_range.start.col.map_or(1, |col| col.coord as i64),
            y: last_range.start.row.map_or(1, |row| row.coord as i64),
        };
        Self {
            sheet_id: sheet,
            cursor,
            ranges,
        }
    }

    /// Constructs a selection containing multiple rectangles.
    #[cfg(test)]
    pub fn from_rects(rects: &[Rect], sheet: SheetId) -> Self {
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
        default_sheet_id: SheetId,
        sheet_map: &SheetNameIdMap,
    ) -> Result<Self, A1Error> {
        let mut sheet = None;
        let mut ranges = vec![];

        for segment in a1.strip_suffix(',').unwrap_or(a1).split(',') {
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
            sheet_id: sheet.unwrap_or(default_sheet_id),
            cursor: cursor_pos_from_last_range(last_range),
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
            .join(",")
    }

    /// Returns `true` on exactly the regions/cells that the range includes, and
    /// `false` or nothing elsewhere.
    pub fn subspaces(&self) -> A1Subspaces {
        // TODO: Consider using interval tree for perf. If iteration order is
        //       the same, then the change would be backwards-compatible.
        let mut ret = A1Subspaces::default();

        for range in &self.ranges {
            let start = range.start;
            match range.end {
                None => match (start.col, start.row) {
                    (None, None) => (), // TODO(sentry): empty range
                    (Some(col), None) => {
                        ret.add_column(col.coord, 1..);
                    }
                    (None, Some(row)) => {
                        ret.add_row(row.coord, 1..);
                    }
                    (Some(col), Some(row)) => {
                        let pos = Pos::new(col.coord as i64, row.coord as i64);
                        ret.add_rect(Rect::single_pos(pos));
                    }
                },
                Some(end) => {
                    let start_col = start.col.map_or(1, |c| c.coord);
                    let start_row = start.row.map_or(1, |c| c.coord);
                    match (end.col, end.row) {
                        (None, None) => {
                            // Include whole sheet after `start`
                            ret.add_all(Pos::new(start_col as i64, start_row as i64)..);
                        }
                        (Some(end_col), None) => {
                            let (lo, hi) = crate::util::minmax(start_col, end_col.coord);
                            for c in lo..=hi {
                                // Include whole column after `start_row`
                                ret.add_column(c, start_row..);
                            }
                        }
                        (None, Some(end_row)) => {
                            let (lo, hi) = crate::util::minmax(start_row, end_row.coord);
                            for r in lo..=hi {
                                // Include whole row after `start_col`
                                ret.add_row(r, start_col..);
                            }
                        }
                        (Some(end_col), Some(end_row)) => {
                            // Include rectangle
                            ret.add_rect(Rect::new(
                                start_col as i64,
                                start_row as i64,
                                end_col.coord as i64,
                                end_row.coord as i64,
                            ));
                        }
                    }
                }
            }
        }

        ret.make_disjoint();

        ret
    }

    /// Returns a test selection from the A1-string with SheetId::test().
    #[cfg(test)]
    pub fn test(a1: &str) -> Self {
        Self::from_str(a1, SheetId::test(), &std::collections::HashMap::new()).unwrap()
    }

    /// Returns a test selection from the A1-string with the given sheet ID.
    #[cfg(test)]
    pub fn test_sheet_id(a1: &str, sheet_id: SheetId) -> Self {
        Self::from_str(a1, sheet_id, &std::collections::HashMap::new()).unwrap()
    }
}

fn cursor_pos_from_last_range(last_range: CellRefRange) -> Pos {
    let x = last_range.start.col.map_or(1, |col| col.coord) as i64;
    let y = last_range.start.row.map_or(1, |row| row.coord) as i64;
    Pos { x, y }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use std::collections::HashMap;

    use super::*;
    use crate::CellRefRangeEnd;

    #[test]
    fn test_from_a1() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("A1", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_xy(1, 1, sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_all() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("*", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(CellRefRange::ALL, sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_columns() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("A:C", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_column_ranges(&[1..=3], sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_rows() {
        let sheet_id = SheetId::test();
        assert_eq!(
            A1Selection::from_str("1:3", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_row_ranges(&[1..=3], sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_rect() {
        let sheet_id = SheetId::test();
        let d1a5 = CellRefRange {
            start: CellRefRangeEnd::new_relative_xy(4, 1),
            end: Some(CellRefRangeEnd::new_relative_xy(1, 5)),
        };
        assert_eq!(
            A1Selection::from_str("A1:B2", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_rect(SheetRect::new(1, 1, 2, 2, sheet_id))),
        );
        assert_eq!(
            A1Selection::from_str("D1:A5", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(d1a5, sheet_id)),
        );
        assert_eq!(
            A1Selection::from_str("A1:B2,D1:A5", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_ranges(
                [CellRefRange::new_relative_rect(Rect::new(1, 1, 2, 2)), d1a5].into_iter(),
                sheet_id,
            )),
        );
    }

    #[test]
    fn test_from_a1_everything() {
        let sheet_id = SheetId::test();
        let selection =
            A1Selection::from_str("A1,B1:D2,E:G,2:3,5:7,F6:G8,4", sheet_id, &HashMap::new())
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
            A1Selection::from_str("1", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(
                CellRefRange::new_relative_row(1),
                sheet_id,
            )),
        );

        assert_eq!(
            A1Selection::from_str("1:3", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_row_ranges(&[1..=3], sheet_id)),
        );

        assert_eq!(
            A1Selection::from_str("1:", sheet_id, &HashMap::new()),
            Ok(A1Selection::from_range(
                CellRefRange {
                    start: CellRefRangeEnd::new_relative_row(1),
                    end: Some(CellRefRangeEnd::UNBOUNDED),
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
            A1Selection::from_str("'Second'!A1", sheet_id, &rev_map),
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
                CellRefRange::new_relative_rect(Rect::new(1, 1, 2, 2)),
                CellRefRange::new_relative_rect(Rect::new(3, 3, 4, 4)),
            ],
        };
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A:E,J:L,O,1:5,10:12,15,A1:B2,C3:D4",
        );
    }

    #[test]
    fn test_a1_with_one_sized_rect() {
        let selection = A1Selection {
            sheet_id: SheetId::test(),
            cursor: Pos { x: 1, y: 1 },
            ranges: vec![CellRefRange::new_relative_rect(Rect::new(1, 1, 1, 1))],
        };
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1",
        );
    }

    #[test]
    fn test_extra_comma() {
        let sheet_id = SheetId::test();
        let selection = A1Selection::from_str("1,", sheet_id, &HashMap::new()).unwrap();
        assert_eq!(selection.to_string(Some(sheet_id), &HashMap::new()), "1");
    }

    #[test]
    fn test_multiple_one_sized_rects() {
        let sheet_id = SheetId::test();
        let selection = A1Selection::from_str("A1,B1,C1", sheet_id, &HashMap::new()).unwrap();
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
            A1Selection::from_str("second!A1,second!B1,second!C1", sheet_id, &rev_map).unwrap();
        assert_eq!(
            selection.to_string(Some(sheet_id), &map),
            "Second!A1,Second!B1,Second!C1",
        );
    }
}
