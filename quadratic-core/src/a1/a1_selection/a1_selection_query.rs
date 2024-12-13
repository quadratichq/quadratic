use std::collections::HashSet;

use crate::{grid::Sheet, Pos, Rect};

use super::{A1Selection, CellRefRange};

impl A1Selection {
    // Returns whether the selection is one cell or multiple cells (either a
    // rect, column, row, or all)
    pub fn is_multi_cursor(&self) -> bool {
        if self.ranges.len() > 1 {
            return true;
        }
        if let Some(last_range) = self.ranges.last() {
            match last_range {
                CellRefRange::Sheet { range } => range.is_multi_cursor(),
            }
        } else {
            false
        }
    }

    // Returns whether the selection includes a selected column or row.
    pub fn is_column_row(&self) -> bool {
        self.ranges
            .iter()
            .any(|range| range.is_column_range() || range.is_row_range())
    }

    /// Returns whether the selection contains the given position.
    pub fn might_contain_xy(&self, x: i64, y: i64) -> bool {
        self.ranges
            .iter()
            .any(|range| range.might_contain_pos(Pos::new(x, y)))
    }

    /// Returns whether any range in `self` might contain `pos`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_contain_pos(&self, pos: Pos) -> bool {
        self.ranges.iter().any(|range| range.might_contain_pos(pos))
    }

    /// Returns whether any range in `self` contains `pos` regardless of data
    /// bounds. (Use might_contains_pos for that.)
    pub fn contains_pos(&self, pos: Pos) -> bool {
        self.ranges.iter().any(|range| range.contains_pos(pos))
    }

    /// Returns the largest rectangle that can be formed by the selection,
    /// ignoring any ranges that extend infinitely.
    pub fn largest_rect_finite(&self) -> Rect {
        let mut rect = Rect::single_pos(self.cursor);
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                if !range.end.is_unbounded() {
                    rect = rect.union(&Rect::new(
                        range.start.col(),
                        range.start.row(),
                        range.end.col(),
                        range.end.row(),
                    ));
                }
            }
        });
        rect
    }

    /// Returns rectangle in case of single finite range selection having more than one cell.
    pub fn single_rect(&self) -> Option<Rect> {
        if self.ranges.len() != 1 || !self.is_multi_cursor() {
            None
        } else {
            self.ranges.first().and_then(|range| range.to_rect())
        }
    }

    /// Returns rectangle in case of single finite range selection,
    /// otherwise returns a rectangle that contains the cursor.
    pub fn single_rect_or_cursor(&self) -> Option<Rect> {
        if !self.is_multi_cursor() {
            Some(Rect::single_pos(self.cursor))
        } else if self.ranges.len() != 1 {
            None
        } else {
            self.ranges.first().and_then(|range| range.to_rect())
        }
    }

    // Converts to a set of quadrant positions.
    pub fn rects_to_hashes(&self, sheet: &Sheet) -> HashSet<Pos> {
        let mut hashes = HashSet::new();
        let finite_selection = sheet.finitize_selection(self);
        finite_selection.ranges.iter().for_each(|range| {
            // handle finite ranges
            if let Some(rect) = range.to_rect() {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        let mut pos = Pos { x, y };
                        pos.to_quadrant();
                        hashes.insert(pos);
                    }
                }
            }
        });
        hashes
    }

    /// Returns the bottom-right cell for the selection. It defaults to the cursor if it's
    /// a non-finite range.
    pub fn bottom_right_cell(&self) -> Pos {
        if let Some(range) = self.ranges.last() {
            match range {
                CellRefRange::Sheet { range } => {
                    let x = if range.end.is_unbounded() {
                        self.cursor.x
                    } else {
                        range.end.col().max(range.start.col())
                    };
                    let y = if range.end.row.is_unbounded() {
                        self.cursor.y
                    } else {
                        range.end.row().max(range.start.row())
                    };
                    Pos { x, y }
                }
            }
        } else {
            self.cursor
        }
    }

    /// Returns the last selection's end. It defaults to the cursor if it's
    /// a non-finite range.
    pub fn last_selection_end(&self) -> Pos {
        if let Some(range) = self.ranges.last() {
            match range {
                CellRefRange::Sheet { range } => {
                    if range.end.is_unbounded() {
                        self.cursor
                    } else {
                        Pos {
                            x: range.end.col(),
                            y: range.end.row(),
                        }
                    }
                }
            }
        } else {
            self.cursor
        }
    }

    /// Returns true if the selection is the entire sheet.
    pub fn is_all_selected(&self) -> bool {
        self.ranges.contains(&CellRefRange::ALL)
    }

    /// Returns true if all the selected columns are finite.
    pub fn is_selected_columns_finite(&self) -> bool {
        self.ranges
            .iter()
            .all(|range| !range.selected_columns_finite().is_empty())
    }

    /// Returns the selected columns as a list of column numbers.
    pub fn selected_columns_finite(&self) -> Vec<i64> {
        let mut columns = HashSet::new();
        self.ranges.iter().for_each(|range| {
            columns.extend(range.selected_columns_finite());
        });
        columns.into_iter().collect::<Vec<_>>()
    }

    /// Returns the selected column ranges as a list of [start, end] pairs between two coordinates.
    pub fn selected_column_ranges(&self, from: i64, to: i64) -> Vec<i64> {
        let mut columns = HashSet::new();
        self.ranges.iter().for_each(|range| {
            columns.extend(
                range
                    .selected_columns(from, to)
                    .iter()
                    .filter(|c| c >= &&from && c <= &&to),
            );
        });

        let mut columns = columns.into_iter().collect::<Vec<_>>();
        columns.sort_unstable();
        let mut ranges = Vec::new();
        if !columns.is_empty() {
            let mut start = columns[0];
            let mut end = start;

            for &col in &columns[1..] {
                if col == end + 1 {
                    end = col;
                } else {
                    ranges.push(start);
                    ranges.push(end);
                    start = col;
                    end = start;
                }
            }

            ranges.push(start);
            ranges.push(end);
        }
        ranges
    }

    /// Returns true if all the selected rows are finite.
    pub fn is_selected_rows_finite(&self) -> bool {
        self.ranges
            .iter()
            .all(|range| !range.selected_rows_finite().is_empty())
    }

    /// Returns the selected rows as a list of row numbers.
    pub fn selected_rows_finite(&self) -> Vec<i64> {
        let mut rows = HashSet::new();
        self.ranges.iter().for_each(|range| {
            rows.extend(range.selected_rows_finite());
        });
        rows.into_iter().collect::<Vec<_>>()
    }

    /// Returns the selected row ranges as a list of [start, end] pairs between two coordinates.
    pub fn selected_row_ranges(&self, from: i64, to: i64) -> Vec<i64> {
        let mut rows = HashSet::new();
        self.ranges
            .iter()
            .for_each(|range| rows.extend(range.selected_rows(from, to).iter()));

        let mut rows = rows.into_iter().collect::<Vec<_>>();
        rows.sort_unstable();
        let mut ranges = Vec::new();
        if !rows.is_empty() {
            let mut start = rows[0];
            let mut end = start;

            for &row in &rows[1..] {
                if row == end + 1 {
                    end = row;
                } else {
                    ranges.push(start);
                    ranges.push(end);
                    start = row;
                    end = start;
                }
            }

            ranges.push(start);
            ranges.push(end);
        }
        ranges
    }

    /// Returns true if the selection is a single column or row range or
    /// one_cell is true and the selection is only a single cell.
    pub fn has_one_column_row_selection(&self, one_cell: bool) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }
        let Some(range) = self.ranges.first() else {
            return false;
        };
        range.is_column_range() || range.is_row_range() || (one_cell && range.is_single_cell())
    }

    /// Returns true if the selection is a single cell.
    pub fn is_single_selection(&self) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }

        if let Some(range) = self.ranges.first() {
            range.is_single_cell()
        } else {
            false
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_contains() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.might_contain_xy(1, 1));
        assert!(!selection.might_contain_xy(4, 1));
    }

    #[test]
    fn test_contains_pos() {
        let selection = A1Selection::test_a1("B7:G7");
        assert!(selection.contains_pos(pos![B7]));
        assert!(!selection.contains_pos(pos![A1]));
    }

    #[test]
    fn test_might_contain_pos() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.might_contain_pos(pos![A1]));
        assert!(!selection.might_contain_pos(pos![D1]));
    }

    #[test]
    fn test_largest_rect() {
        let selection = A1Selection::test_a1("A1,B1:D2,E:G,2:3,5:7,F6:G8,4");
        assert_eq!(selection.largest_rect_finite(), Rect::new(1, 1, 7, 8));
    }

    #[test]
    fn test_largest_rect_finite() {
        let selection = A1Selection::test_a1("A1,B1:D2,E:G,2:3,5:7,F6:G8,4");
        assert_eq!(selection.largest_rect_finite(), Rect::new(1, 1, 7, 8));
    }

    #[test]
    fn test_is_multi_cursor() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.is_multi_cursor());

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert!(selection.is_multi_cursor());

        let selection = A1Selection::test_a1("A");
        assert!(selection.is_multi_cursor());

        let selection = A1Selection::test_a1("1");
        assert!(selection.is_multi_cursor());

        let selection = A1Selection::test_a1("A1");
        assert!(!selection.is_multi_cursor());
    }

    #[test]
    fn test_is_column_row() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(!selection.is_column_row());

        let selection = A1Selection::test_a1("D");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("A:C");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("10");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("1:3");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("A1:3");
        assert!(selection.is_column_row());
        let selection = A1Selection::test_a1("1:C3");
        assert!(!selection.is_column_row());
    }

    #[test]
    fn test_selection_end() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert_eq!(selection.last_selection_end(), pos![C3]);

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert_eq!(selection.last_selection_end(), pos![C2]);

        let selection = A1Selection::test_a1("C2:B1");
        assert_eq!(selection.last_selection_end(), pos![B1]);
    }

    #[test]
    fn test_bottom_right_cell() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert_eq!(selection.bottom_right_cell(), pos![C3]);

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert_eq!(selection.bottom_right_cell(), pos![C2]);

        let selection = A1Selection::test_a1("C2:B1");
        assert_eq!(selection.bottom_right_cell(), pos![C2]);
    }

    #[test]
    fn test_selected_column_ranges() {
        let selection = A1Selection::test_a1("A1,B2,C3,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_column_ranges(1, 10), vec![1, 8]);

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_column_ranges(1, 10), vec![1, 2, 4, 8]);

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_column_ranges(2, 5), vec![2, 2, 4, 5]);
    }

    #[test]
    fn test_selected_row_ranges() {
        let selection = A1Selection::test_a1("A1,B2,C3,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_row_ranges(1, 10), vec![1, 8]);

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_row_ranges(1, 10), vec![1, 2, 4, 8]);

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_row_ranges(2, 5), vec![2, 2, 4, 5]);
    }

    #[test]
    fn has_one_column_row_selection() {
        assert!(A1Selection::test_a1("A").has_one_column_row_selection(false));
        assert!(A1Selection::test_a1("1").has_one_column_row_selection(false));
        assert!(!A1Selection::test_a1("A,B").has_one_column_row_selection(false));
        assert!(!A1Selection::test_a1("A1").has_one_column_row_selection(false));
        assert!(!A1Selection::test_a1("A1:B2").has_one_column_row_selection(false));

        assert!(A1Selection::test_a1("A").has_one_column_row_selection(true));
        assert!(A1Selection::test_a1("1").has_one_column_row_selection(true));
        assert!(A1Selection::test_a1("A1").has_one_column_row_selection(true));
        assert!(!A1Selection::test_a1("A,B").has_one_column_row_selection(true));
        assert!(!A1Selection::test_a1("A1:B2").has_one_column_row_selection(true));
    }

    #[test]
    fn is_single_selection() {
        assert!(A1Selection::test_a1("A1").is_single_selection());
        assert!(!A1Selection::test_a1("A1:B4").is_single_selection());
        assert!(!A1Selection::test_a1("A").is_single_selection());
        assert!(!A1Selection::test_a1("3").is_single_selection());
        assert!(!A1Selection::test_a1("A1,B2").is_single_selection());
    }

    #[test]
    fn test_is_selected_columns_finite() {
        assert!(A1Selection::test_a1("A1,B2,C3").is_selected_columns_finite());
        assert!(A1Selection::test_a1("A1,B2,C3,D:E").is_selected_columns_finite());
        assert!(A1Selection::test_a1("A:B").is_selected_columns_finite());
        assert!(!A1Selection::test_a1("*").is_selected_columns_finite());
        assert!(!A1Selection::test_a1("1:2").is_selected_columns_finite());
        assert!(!A1Selection::test_a1("A1:2").is_selected_columns_finite());
    }

    #[test]
    fn test_is_selected_rows_finite() {
        assert!(A1Selection::test_a1("A1,B2,C3").is_selected_rows_finite());
        assert!(A1Selection::test_a1("1:2").is_selected_rows_finite());
        assert!(!A1Selection::test_a1("A1,B2,C3,D:E").is_selected_rows_finite());
        assert!(!A1Selection::test_a1("A:B").is_selected_rows_finite());
        assert!(!A1Selection::test_a1("*").is_selected_rows_finite());
    }

    #[test]
    fn test_single_rect_or_cursor() {
        assert_eq!(
            A1Selection::test_a1("A1,B2,C3").single_rect_or_cursor(),
            None
        );
        assert_eq!(
            A1Selection::test_a1("A1:D5").single_rect_or_cursor(),
            Some(Rect::new(1, 1, 4, 5))
        );
        assert_eq!(
            A1Selection::test_a1("A1:D5, A1").single_rect_or_cursor(),
            None
        );
        assert_eq!(A1Selection::test_a1("A").single_rect_or_cursor(), None);
        assert_eq!(A1Selection::test_a1("2:5").single_rect_or_cursor(), None);
    }

    #[test]
    fn test_is_all_selected() {
        assert!(A1Selection::test_a1("*").is_all_selected());
        assert!(A1Selection::test_a1("A1:D5, A1:").is_all_selected());
        assert!(!A1Selection::test_a1("A1:A").is_all_selected());
        assert!(!A1Selection::test_a1("A1:1").is_all_selected());
    }
}
