use std::{cmp::Ordering, collections::HashSet};

use crate::{
    Pos, Rect, SheetPos,
    a1::{A1Context, ColRange, RefRangeBounds, UNBOUNDED},
    grid::{CodeCellLanguage, Sheet},
};

use super::{A1Selection, CellRefRange};

impl A1Selection {
    // Returns whether the selection is one cell or multiple cells (either a
    // rect, column, row, or all)
    pub fn is_multi_cursor(&self, a1_context: &A1Context) -> bool {
        if self.ranges.len() > 1 {
            return true;
        }
        if let Some(last_range) = self.ranges.last() {
            match last_range {
                CellRefRange::Sheet { range } => range.is_multi_cursor(),
                CellRefRange::Table { range } => range.is_multi_cursor(a1_context),
            }
        } else {
            false
        }
    }

    // Returns whether the selection includes a selected column or row.
    pub fn is_column_row(&self) -> bool {
        self.ranges
            .iter()
            .any(|range| range.is_col_range() || range.is_row_range())
    }

    // range has multiple columns
    /// Returns whether the first range has multiple columns
    /// todo (DSF): this is a bit of a weird function; probably worth more
    /// thought on its utility)
    pub fn is_col_range(&self) -> bool {
        self.ranges
            .first()
            .is_some_and(|range| range.col_range() > 0)
    }

    /// Returns whether the selection contains the given position.
    pub fn might_contain_xy(&self, x: i64, y: i64, a1_context: &A1Context) -> bool {
        self.ranges
            .iter()
            .any(|range| range.might_contain_pos(Pos::new(x, y), a1_context))
    }

    /// Returns whether any range in `self` might contain `pos`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_contain_pos(&self, pos: Pos, a1_context: &A1Context) -> bool {
        self.ranges
            .iter()
            .any(|range| range.might_contain_pos(pos, a1_context))
    }

    /// Returns whether any range in `self` contains `pos` regardless of data
    /// bounds. (Use might_contains_pos for that.)
    pub fn contains_pos(&self, pos: Pos, a1_context: &A1Context) -> bool {
        self.ranges
            .iter()
            .any(|range| range.contains_pos(pos, a1_context))
    }

    /// Returns the largest rectangle that can be formed by the selection,
    /// ignoring any ranges that extend infinitely.
    pub fn largest_rect_finite(&self, a1_context: &A1Context) -> Rect {
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
            CellRefRange::Table { range } => {
                if let Some(table_rect) = range.to_largest_rect(a1_context) {
                    rect = rect.union(&table_rect);
                }
            }
        });
        rect
    }

    /// Returns the largest rectangle that can be formed by the selection, including unbounded ranges.
    pub fn largest_rect_unbounded(&self, a1_context: &A1Context) -> Rect {
        let mut rect = Rect::single_pos(self.cursor);
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                rect = rect.union(&Rect::new(
                    range.start.col(),
                    range.start.row(),
                    range.end.col(),
                    range.end.row(),
                ));
            }
            CellRefRange::Table { range } => {
                if let Some(table_rect) = range.to_largest_rect(a1_context) {
                    rect = rect.union(&table_rect);
                }
            }
        });
        rect
    }

    /// Returns rectangle in case of single finite range selection having more than one cell.
    pub fn single_rect(&self, a1_context: &A1Context) -> Option<Rect> {
        if self.ranges.len() != 1 || !self.is_multi_cursor(a1_context) {
            None
        } else {
            self.ranges.first().and_then(|range| {
                range
                    .to_rect(a1_context)
                    .and_then(|rect| if rect.len() > 1 { Some(rect) } else { None })
            })
        }
    }

    /// Returns rectangle in case of single finite range selection,
    /// otherwise returns a rectangle that contains the cursor.
    pub fn single_rect_or_cursor(&self, a1_context: &A1Context) -> Option<Rect> {
        if !self.is_multi_cursor(a1_context) {
            Some(Rect::single_pos(self.cursor))
        } else if self.ranges.len() != 1 {
            None
        } else {
            self.ranges
                .first()
                .and_then(|range| range.to_rect(a1_context))
        }
    }

    // Converts to a set of quadrant positions.
    pub fn rects_to_hashes(&self, sheet: &Sheet, a1_context: &A1Context) -> HashSet<Pos> {
        let mut hashes = HashSet::new();
        let finite_selection = sheet.finitize_selection(self, false, false, false, a1_context);
        finite_selection.ranges.iter().for_each(|range| {
            // handle finite ranges
            if let Some(rect) = range.to_rect(a1_context) {
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
                // todo: not sure how autofill in tables will work
                CellRefRange::Table { .. } => self.cursor,
            }
        } else {
            self.cursor
        }
    }

    /// Returns the last selection's end. It defaults to the cursor if it's a
    /// non-finite range. Note, for tables, we need to use the end of the
    /// selection if the cursor is at the end of the table.
    pub fn last_selection_end(&self, a1_context: &A1Context) -> Pos {
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
                CellRefRange::Table { range } => {
                    let name = range.table_name.clone();
                    if let Some(range) =
                        range.convert_to_ref_range_bounds(false, a1_context, false, false)
                    {
                        if self.cursor.x == range.end.col() && self.cursor.y == range.end.row() {
                            // we adjust the y to step over the table name so we
                            // don't end up with the same selection
                            let adjust_y = if let Some(table) = a1_context.try_table(&name) {
                                if table.show_name { -1 } else { 0 }
                            } else {
                                0
                            };
                            Pos {
                                x: range.start.col(),
                                y: range.start.row() + adjust_y,
                            }
                        } else {
                            Pos {
                                x: range.end.col(),
                                y: range.end.row(),
                            }
                        }
                    } else {
                        self.cursor
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

    /// Returns true if the selection includes the entire column.
    pub fn is_entire_column_selected(&self, column: i64) -> bool {
        self.ranges.iter().any(|range| range.has_col_range(column))
    }

    /// Returns true if the selection includes the entire row.
    pub fn is_entire_row_selected(&self, row: i64) -> bool {
        self.ranges.iter().any(|range| range.has_row_range(row))
    }

    /// Returns a list of fully selected columns.
    pub fn selected_columns(&self) -> Vec<i64> {
        let mut columns = HashSet::new();
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                // break the loop if this is a * selection
                if self.is_all_selected() {
                    return;
                }
                if range.is_col_range() {
                    let start = range.start.col().min(range.end.col());
                    let end = range.start.col().max(range.end.col());
                    for col in start..=end {
                        columns.insert(col);
                    }
                }
            }
            CellRefRange::Table { .. } => (),
        });

        let mut columns = columns.into_iter().collect::<Vec<_>>();
        columns.sort_unstable();
        columns
    }

    /// Returns true if all the selected columns are finite.
    pub fn is_selected_columns_finite(&self, a1_context: &A1Context) -> bool {
        self.ranges
            .iter()
            .all(|range| !range.selected_columns_finite(a1_context).is_empty())
    }

    /// Returns the selected columns as a list of column numbers.
    pub fn columns_with_selected_cells(&self, a1_context: &A1Context) -> Vec<i64> {
        let mut columns = HashSet::new();
        self.ranges.iter().for_each(|range| {
            columns.extend(range.selected_columns_finite(a1_context));
        });

        // sort added for testing purposes
        let mut c = columns.into_iter().collect::<Vec<_>>();
        c.sort_unstable();
        c
    }

    /// Returns the selected column ranges as a list of [start, end] pairs between two coordinates.
    pub fn selected_column_ranges(&self, from: i64, to: i64, a1_context: &A1Context) -> Vec<i64> {
        let mut columns = HashSet::new();
        self.ranges.iter().for_each(|range| {
            columns.extend(
                range
                    .selected_columns(from, to, a1_context)
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
    pub fn is_selected_rows_finite(&self, a1_context: &A1Context) -> bool {
        self.ranges
            .iter()
            .all(|range| !range.selected_rows_finite(a1_context).is_empty())
    }

    /// Returns a list of fully selected rows.
    pub fn selected_rows(&self) -> Vec<i64> {
        let mut rows = HashSet::new();
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                if self.is_all_selected() {
                    return;
                }
                if range.is_row_range() {
                    let start = range.start.row().min(range.end.row());
                    let end = range.start.row().max(range.end.row());
                    for row in start..=end {
                        rows.insert(row);
                    }
                }
            }
            CellRefRange::Table { .. } => (),
        });

        let mut rows = rows.into_iter().collect::<Vec<_>>();
        rows.sort_unstable();
        rows
    }

    /// Returns the selected rows as a list of row numbers.
    pub fn rows_with_selected_cells(&self, a1_context: &A1Context) -> Vec<i64> {
        let mut rows = HashSet::new();
        self.ranges.iter().for_each(|range| {
            rows.extend(range.selected_rows_finite(a1_context));
        });

        // sort added for testing purposes
        let mut r = rows.into_iter().collect::<Vec<_>>();
        r.sort_unstable();
        r
    }

    /// Returns the selected row ranges as a list of [start, end] pairs between two coordinates.
    pub fn selected_row_ranges(&self, from: i64, to: i64, a1_context: &A1Context) -> Vec<i64> {
        let mut rows = HashSet::new();
        self.ranges
            .iter()
            .for_each(|range| rows.extend(range.selected_rows(from, to, a1_context).iter()));

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
    pub fn has_one_column_row_selection(&self, one_cell: bool, a1_context: &A1Context) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }
        let Some(range) = self.ranges.first() else {
            return false;
        };
        range.is_col_range()
            || range.is_row_range()
            || (one_cell && range.is_single_cell(a1_context))
    }

    /// Returns true if the selection can insert column or row:
    /// The selection is a single range AND
    /// 1. is a column or row selection OR
    /// 2. is a rect selection
    pub fn can_insert_column_row(&self) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }
        let Some(range) = self.ranges.first() else {
            return false;
        };
        match range {
            CellRefRange::Sheet { range } => {
                range.end.col() != UNBOUNDED || range.end.row() != UNBOUNDED
            }
            CellRefRange::Table { .. } => true,
        }
    }

    /// Returns true if the selection is a single cell.
    pub fn is_single_selection(&self, a1_context: &A1Context) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }

        if let Some(range) = self.ranges.first() {
            range.is_single_cell(a1_context)
        } else {
            false
        }
    }

    pub fn to_cursor_sheet_pos(&self) -> SheetPos {
        self.cursor.to_sheet_pos(self.sheet_id)
    }

    /// Tries to convert the selection to a single position. This works only if
    /// there is one range, and the range is a single cell.
    pub fn try_to_pos(&self, a1_context: &A1Context) -> Option<Pos> {
        if self.ranges.len() == 1 {
            if let Some(range) = self.ranges.first() {
                return range.try_to_pos(a1_context);
            }
        }
        None
    }

    /// Returns the position from the last range (either the end, or if not defined,
    /// the start).
    pub(crate) fn cursor_pos_from_last_range(
        last_range: &CellRefRange,
        a1_context: &A1Context,
    ) -> Pos {
        match last_range {
            CellRefRange::Sheet { range } => range.cursor_pos_from_last_range(),
            CellRefRange::Table { range } => range.cursor_pos_from_last_range(a1_context),
        }
    }

    /// Returns all finite RefRangeBounds for the selection, converting table selections to
    /// RefRangeBounds.
    pub fn finite_ref_range_bounds(&self, a1_context: &A1Context) -> Vec<RefRangeBounds> {
        self.ranges
            .iter()
            .filter_map(|range| match range {
                CellRefRange::Sheet { range } => {
                    if range.is_finite() {
                        Some(*range)
                    } else {
                        None
                    }
                }
                CellRefRange::Table { range } => {
                    range.convert_to_ref_range_bounds(false, a1_context, false, false)
                }
            })
            .collect()
    }

    /// Returns true if the selection is on an image.
    pub fn cursor_is_on_html_image(&self, a1_context: &A1Context) -> bool {
        let table = a1_context
            .iter_tables()
            .find(|table| table.contains(self.cursor.to_sheet_pos(self.sheet_id)));
        table.is_some_and(|table| table.is_html_image)
    }

    /// Used to trigger Python get_cells call to return a DataFrame with the
    /// appropriate column headers. This is true if the selection is a table and
    /// data is included.
    pub fn has_table_headers(&self, a1_context: &A1Context, is_python: bool) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }

        if let Some(CellRefRange::Table { range }) = self.ranges.first() {
            if is_python {
                let show_columns = a1_context
                    .try_table(&range.table_name)
                    .is_some_and(|table| table.show_columns);
                return show_columns || range.headers;
            }

            range.data || range.headers
        } else {
            false
        }
    }

    /// Returns the names of the tables that are fully selected (either data and
    /// data+headers). Also includes any tables that are completed enclosed by
    /// the selection box.
    pub fn selected_table_names(&self, context: &A1Context) -> Vec<String> {
        let mut names = Vec::new();
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Table { range } => {
                if range.data && range.col_range == ColRange::All {
                    names.push(range.table_name.clone());
                }
            }
            CellRefRange::Sheet { range } => {
                context
                    .iter_tables_in_sheet(self.sheet_id)
                    .for_each(|table| {
                        if let Some(rect) = range.to_rect() {
                            // if the selection intersects the name ui row of the table
                            if (table.show_name
                            && rect.intersects(Rect::new(
                                table.bounds.min.x,
                                table.bounds.min.y,
                                table.bounds.max.x,
                                table.bounds.min.y,
                            ))) ||
                            // or if the selection contains the entire table
                            rect.contains_rect(&table.bounds) ||
                            // or if the selection contains the code cell of a code table
                            (table.language != CodeCellLanguage::Import
                                && rect.contains(table.bounds.min))
                            {
                                names.push(table.table_name.clone());
                            }
                        }
                    });
            }
        });
        names.sort();
        names.dedup();
        names
    }

    /// Returns the columns that are selected in the table.
    pub fn table_column_selection(
        &self,
        table_name: &str,
        a1_context: &A1Context,
    ) -> Option<Vec<i64>> {
        for range in self.ranges.iter() {
            match range {
                CellRefRange::Table { range } => {
                    if let Some(cols) = range.table_column_selection(table_name, a1_context) {
                        return Some(cols);
                    }
                }
                _ => continue,
            }
        }
        None
    }

    /// Returns true if the selection contains any table references.
    pub fn has_table_refs(&self) -> bool {
        self.ranges.iter().any(|range| match range {
            CellRefRange::Table { range } => range.data,
            _ => false,
        })
    }

    /// Replaces all table references to a specific table w/sheet refs.
    pub fn replace_table_refs_table(
        &self,
        table_name: &String,
        a1_context: &A1Context,
    ) -> Option<A1Selection> {
        let mut found = false;
        let ranges = self
            .ranges
            .iter()
            .filter_map(|range| match range {
                CellRefRange::Table { range: table_range } => {
                    if table_range.table_name == *table_name {
                        if let Some(new_range) =
                            table_range.convert_to_ref_range_bounds(false, a1_context, false, false)
                        {
                            found = true;
                            Some(CellRefRange::Sheet { range: new_range })
                        } else {
                            None
                        }
                    } else {
                        Some(range.clone())
                    }
                }
                _ => Some(range.clone()),
            })
            .collect();
        if found {
            Some(A1Selection {
                ranges,
                cursor: self.cursor,
                sheet_id: self.sheet_id,
            })
        } else {
            None
        }
    }

    /// Replaces table references with sheet references.
    pub fn replace_table_refs(&self, a1_context: &A1Context) -> A1Selection {
        let ranges = self
            .ranges
            .iter()
            .filter_map(|range| match range {
                CellRefRange::Table { range } => range
                    .convert_to_ref_range_bounds(false, a1_context, false, true)
                    .map(|range| CellRefRange::Sheet { range }),
                _ => Some(range.clone()),
            })
            .collect();
        A1Selection {
            ranges,
            cursor: self.cursor,
            sheet_id: self.sheet_id,
        }
    }

    /// Returns true if the selection is a single table selection (needs only
    /// data to be true).
    pub fn get_single_full_table_selection_name(&self) -> Option<String> {
        if self.ranges.len() != 1 {
            return None;
        }
        if let Some(CellRefRange::Table { range }) = self.ranges.first() {
            if range.data && range.col_range == ColRange::All {
                return Some(range.table_name.clone());
            }
        }
        None
    }

    /// If range is a single, contiguous column(s) selection, then it returns
    /// the [start] or [start, end].
    pub fn contiguous_columns(&self) -> Option<Vec<u32>> {
        if self.ranges.len() != 1 {
            return None;
        }
        let Some(CellRefRange::Sheet { range }) = self.ranges.first() else {
            return None;
        };

        // we expect a contiguous column range
        if range.start.row() != 1 || range.end.row() != UNBOUNDED {
            return None;
        }
        let start = range.start.col();
        let end = range.end.col();
        match start.cmp(&end) {
            Ordering::Equal => Some(vec![start as u32]),
            Ordering::Less => Some(vec![start as u32, end as u32]),
            Ordering::Greater => Some(vec![end as u32, start as u32]),
        }
    }

    /// If range is a single, contiguous column(s) selection, then it returns
    /// the [start] or [start, end].
    pub fn contiguous_rows(&self) -> Option<Vec<u32>> {
        if self.ranges.len() != 1 {
            return None;
        }
        let Some(CellRefRange::Sheet { range }) = self.ranges.first() else {
            return None;
        };

        // we expect a contiguous row range
        if range.start.col() != 1 || range.end.col() != UNBOUNDED {
            return None;
        }

        let start = range.start.row();
        let end = range.end.row();
        match start.cmp(&end) {
            Ordering::Equal => Some(vec![start as u32]),
            Ordering::Less => Some(vec![start as u32, end as u32]),
            Ordering::Greater => Some(vec![end as u32, start as u32]),
        }
    }

    /// Returns true if the selection contains only table columns within the
    /// table and a minimum of the table's column (defined by index) selected.
    pub fn is_table_column_selected(
        &self,
        table_name: &str,
        column: i64,
        a1_context: &A1Context,
    ) -> bool {
        let Some(table) = a1_context.try_table(table_name) else {
            return false;
        };
        let mut found_column = false;
        self.ranges.iter().all(|range| match range {
            CellRefRange::Table { range } => {
                if range.col_range.has_col(column, table) {
                    found_column = true;
                }
                table_name == range.table_name
            }
            _ => false,
        }) && found_column
    }

    /// If a single table is selected, then returns the number of columns that
    /// are selected.
    pub fn selected_table_columns(&self, a1_context: &A1Context) -> usize {
        if self.ranges.len() != 1 {
            return 0;
        }
        let Some(CellRefRange::Table { range }) = self.ranges.first() else {
            return 0;
        };
        let Some(table) = a1_context.try_table(&range.table_name) else {
            return 0;
        };
        range.col_range.col_count(table)
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::SheetId;
    use crate::test_util::assert::*;

    use super::*;

    #[test]
    fn test_contains() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.might_contain_xy(1, 1, &context));
        assert!(!selection.might_contain_xy(4, 1, &context));
    }

    #[test]
    fn test_contains_pos() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("B7:G7");
        assert!(selection.contains_pos(pos![B7], &context));
        assert!(!selection.contains_pos(pos![A1], &context));
    }

    #[test]
    fn test_might_contain_pos() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.might_contain_pos(pos![A1], &context));
        assert!(!selection.might_contain_pos(pos![D1], &context));
    }

    #[test]
    fn test_largest_rect() {
        let selection = A1Selection::test_a1("A1,B1:D2,E:G,2:3,5:7,F6:G8,4");
        let context = A1Context::default();
        assert_eq!(
            selection.largest_rect_finite(&context),
            Rect::new(1, 1, 7, 8)
        );
    }

    #[test]
    fn test_largest_rect_finite() {
        let selection = A1Selection::test_a1("A1,B1:D2,E:G,2:3,5:7,F6:G8,4");
        let context = A1Context::default();
        assert_eq!(
            selection.largest_rect_finite(&context),
            Rect::new(1, 1, 7, 8)
        );
    }

    #[test]
    fn test_is_multi_cursor() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("A");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("1");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("A1");
        assert!(!selection.is_multi_cursor(&context));
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
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert_eq!(selection.last_selection_end(&context), pos![C3]);

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert_eq!(selection.last_selection_end(&context), pos![C2]);

        let selection = A1Selection::test_a1("C2:B1");
        assert_eq!(selection.last_selection_end(&context), pos![B1]);
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
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_column_ranges(1, 10, &context),
            vec![1, 8]
        );

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_column_ranges(1, 10, &context),
            vec![1, 2, 4, 8]
        );

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_column_ranges(2, 5, &context),
            vec![2, 2, 4, 5]
        );

        let selection = A1Selection::test_a1("C:A");
        assert_eq!(
            selection.selected_column_ranges(1, 10, &context),
            vec![1, 3]
        );
    }

    #[test]
    fn test_selected_row_ranges() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_row_ranges(1, 10, &context), vec![1, 8]);

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_row_ranges(1, 10, &context),
            vec![1, 2, 4, 8]
        );

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_row_ranges(2, 5, &context),
            vec![2, 2, 4, 5]
        );
    }

    #[test]
    fn has_one_column_row_selection() {
        let context = A1Context::default();
        assert!(A1Selection::test_a1("A").has_one_column_row_selection(false, &context));
        assert!(A1Selection::test_a1("1").has_one_column_row_selection(false, &context));
        assert!(!A1Selection::test_a1("A,B").has_one_column_row_selection(false, &context));
        assert!(!A1Selection::test_a1("A1").has_one_column_row_selection(false, &context));
        assert!(!A1Selection::test_a1("A1:B2").has_one_column_row_selection(false, &context));

        assert!(A1Selection::test_a1("A").has_one_column_row_selection(true, &context));
        assert!(A1Selection::test_a1("1").has_one_column_row_selection(true, &context));
        assert!(A1Selection::test_a1("A1").has_one_column_row_selection(true, &context));
        assert!(!A1Selection::test_a1("A,B").has_one_column_row_selection(true, &context));
        assert!(!A1Selection::test_a1("A1:B2").has_one_column_row_selection(true, &context));
    }

    #[test]
    fn is_single_selection() {
        let context = A1Context::default();
        assert!(A1Selection::test_a1("A1").is_single_selection(&context));
        assert!(!A1Selection::test_a1("A1:B4").is_single_selection(&context));
        assert!(!A1Selection::test_a1("A").is_single_selection(&context));
        assert!(!A1Selection::test_a1("3").is_single_selection(&context));
        assert!(!A1Selection::test_a1("A1,B2").is_single_selection(&context));
    }

    #[test]
    fn test_is_selected_columns_finite() {
        let context = A1Context::default();
        assert!(A1Selection::test_a1("A1,B2,C3").is_selected_columns_finite(&context));
        assert!(A1Selection::test_a1("A1,B2,C3,D:E").is_selected_columns_finite(&context));
        assert!(A1Selection::test_a1("A:B").is_selected_columns_finite(&context));
        assert!(!A1Selection::test_a1("*").is_selected_columns_finite(&context));
        assert!(!A1Selection::test_a1("1:2").is_selected_columns_finite(&context));
        assert!(!A1Selection::test_a1("A1:2").is_selected_columns_finite(&context));
    }

    #[test]
    fn test_is_selected_rows_finite() {
        let context = A1Context::default();
        assert!(A1Selection::test_a1("A1,B2,C3").is_selected_rows_finite(&context));
        assert!(A1Selection::test_a1("1:2").is_selected_rows_finite(&context));
        assert!(!A1Selection::test_a1("A1,B2,C3,D:E").is_selected_rows_finite(&context));
        assert!(!A1Selection::test_a1("A:B").is_selected_rows_finite(&context));
        assert!(!A1Selection::test_a1("*").is_selected_rows_finite(&context));
    }

    #[test]
    fn test_single_rect_or_cursor() {
        let context = A1Context::default();
        assert_eq!(
            A1Selection::test_a1("A1,B2,C3").single_rect_or_cursor(&context),
            None
        );
        assert_eq!(
            A1Selection::test_a1("A1:D5").single_rect_or_cursor(&context),
            Some(Rect::new(1, 1, 4, 5))
        );
        assert_eq!(
            A1Selection::test_a1("A1:D5, A1").single_rect_or_cursor(&context),
            None
        );
        assert_eq!(
            A1Selection::test_a1("A").single_rect_or_cursor(&context),
            None
        );
        assert_eq!(
            A1Selection::test_a1("2:5").single_rect_or_cursor(&context),
            None
        );
    }

    #[test]
    fn test_is_all_selected() {
        assert!(A1Selection::test_a1("*").is_all_selected());
        assert!(A1Selection::test_a1("A1:D5, A1:").is_all_selected());
        assert!(!A1Selection::test_a1("A1:A").is_all_selected());
        assert!(!A1Selection::test_a1("A1:1").is_all_selected());
    }

    #[test]
    fn test_cursor_pos_from_last_range() {
        let context = A1Context::default();
        assert_eq!(
            A1Selection::cursor_pos_from_last_range(&CellRefRange::test_a1("A1"), &context),
            pos![A1]
        );
        assert_eq!(
            A1Selection::cursor_pos_from_last_range(&CellRefRange::test_a1("A1:C3"), &context),
            pos![A1]
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

    #[test]
    fn test_get_ref_range_bounds() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::TEST)],
            &[("Table1", &["A", "B", "C"], Rect::test_a1("A1:C4"))],
        );
        // note we do not return the D5: range as it is infinite
        let selection = A1Selection::test_a1_context("A1,B2,D5:,C3,Table1", &context);
        let ref_range_bounds = selection.finite_ref_range_bounds(&context);
        assert_eq!(
            ref_range_bounds,
            vec![
                RefRangeBounds::test_a1("A1"),
                RefRangeBounds::test_a1("B2"),
                RefRangeBounds::test_a1("C3"),
                RefRangeBounds::test_a1("A3:C4")
            ]
        );
    }

    #[test]
    fn test_is_on_html_image() {
        // Create a context with a table that has an HTML image
        let mut context = A1Context::test(
            &[("Sheet1", SheetId::TEST), ("Sheet 2", SheetId::new())],
            &[("Table1", &["A"], Rect::test_a1("B2:D4"))],
        );
        let mut table = context.table_map.remove("Table1").unwrap();
        table.is_html_image = true;
        context.table_map.insert(table);

        // Test position inside the table
        assert!(A1Selection::test_a1("B2").cursor_is_on_html_image(&context));
        assert!(A1Selection::test_a1("C3").cursor_is_on_html_image(&context));
        assert!(A1Selection::test_a1("D4").cursor_is_on_html_image(&context));

        // Test positions outside the table
        assert!(!A1Selection::test_a1("A2").cursor_is_on_html_image(&context));
        assert!(!A1Selection::test_a1("B5").cursor_is_on_html_image(&context));
        assert!(!A1Selection::test_a1("E3").cursor_is_on_html_image(&context));

        // Test with wrong sheet_id
        assert!(
            !A1Selection::test_a1_context("'Sheet 2'!B2", &context)
                .cursor_is_on_html_image(&context)
        );
    }

    #[test]
    fn test_has_table_headers() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        assert!(
            A1Selection::test_a1_context("Table1", &context).has_table_headers(&context, false)
        );
        assert!(
            A1Selection::test_a1_context("Table1[#ALL]", &context)
                .has_table_headers(&context, false)
        );
        assert!(
            A1Selection::test_a1_context("Table1[#headers]", &context)
                .has_table_headers(&context, false)
        );
        assert!(
            A1Selection::test_a1_context("Table1[#all]", &context)
                .has_table_headers(&context, false)
        );
    }

    #[test]
    fn test_selected_table_names() {
        let context = A1Context::test(
            &[],
            &[
                ("Table1", &["A", "B"], Rect::test_a1("A1:B2")),
                ("Table2", &["C", "D"], Rect::test_a1("C3:D4")),
            ],
        );

        // Test single table selection
        let selection = A1Selection::test_a1_context("Table1", &context);
        assert_eq!(selection.selected_table_names(&context), vec!["Table1"]);

        // Test multiple table selections
        let selection = A1Selection::test_a1_context("Table1,Table2", &context);
        assert_vec_eq_unordered(
            &selection.selected_table_names(&context),
            &["Table1".to_string(), "Table2".to_string()],
        );

        // Test mixed selection with tables and regular ranges
        let selection = A1Selection::test_a1_context("D1:E15,Table1,C3", &context);
        assert_eq!(
            selection.selected_table_names(&context),
            vec!["Table1", "Table2"]
        );

        // Test selection without tables
        let selection = A1Selection::test_a1_context("D1:E2,C3", &context);
        // todo: when code is fixed, this should be changed
        // assert!(selection.selected_table_names(&context).is_empty());
        assert_eq!(selection.selected_table_names(&context), vec!["Table2"]);

        // Test column selection
        let selection = A1Selection::test_a1_context("Table1[A]", &context);
        assert!(selection.selected_table_names(&context).is_empty());

        // Test fully enclosed table
        let selection = A1Selection::test_a1_context("A1:D5", &context);
        assert_vec_eq_unordered(
            &selection.selected_table_names(&context),
            &["Table1".to_string(), "Table2".to_string()],
        );

        // Test partially enclosed table
        let selection = A1Selection::test_a1_context("A1:C3", &context);
        // todo: when code is fixed, this should be changed
        // assert_eq!(selection.selected_table_names(&context), vec!["Table1"]);
        assert!(
            selection
                .selected_table_names(&context)
                .contains(&"Table1".to_string())
        );
        assert!(
            selection
                .selected_table_names(&context)
                .contains(&"Table2".to_string())
        );

        // Test selection that overlaps but doesn't fully enclose any tables
        let selection = A1Selection::test_a1_context("B2:D3", &context);
        // todo: when code is fixed, this should be changed
        // assert!(selection.selected_table_names(&context).is_empty());
        assert_eq!(selection.selected_table_names(&context), vec!["Table2"]);
    }

    #[test]
    fn test_has_table_refs() {
        let context = A1Context::test(
            &[],
            &[
                ("Table1", &["A", "B"], Rect::test_a1("A1:B2")),
                ("Table2", &["C", "D"], Rect::test_a1("C3:D4")),
            ],
        );

        // Test with table data reference
        let selection = A1Selection::test_a1_context("Table1", &context);
        assert!(selection.has_table_refs());

        // Test with table headers reference (should be false since data=false)
        let selection = A1Selection::test_a1_context("Table1[#Headers]", &context);
        assert!(!selection.has_table_refs());

        // Test with multiple selections including a table
        let selection = A1Selection::test_a1_context("A1:B2,Table1", &context);
        assert!(selection.has_table_refs());

        // Test with no table references
        let selection = A1Selection::test_a1_context("A1:B2,C3", &context);
        assert!(!selection.has_table_refs());
    }

    #[test]
    fn test_replace_table_refs() {
        let context = A1Context::test(
            &[],
            &[
                ("Table1", &["A", "B"], Rect::test_a1("A1:B2")),
                ("Table2", &["C", "D"], Rect::test_a1("C3:D4")),
            ],
        );

        // Test replacing single table reference
        let selection = A1Selection::test_a1_context("Table1", &context);
        let replaced = selection.replace_table_refs(&context);
        let mut expected = A1Selection::test_a1("A1:B2");
        expected.cursor = pos![A2];
        assert_eq!(replaced, expected);

        // Test replacing multiple table references
        let selection = A1Selection::test_a1_context("Table1,Table2", &context);
        let replaced = selection.replace_table_refs(&context);
        let mut expected = A1Selection::test_a1("A1:B2,C3:D4");
        expected.cursor = pos![C4];
        assert_eq!(replaced, expected);

        // Test mixed selection with tables and regular ranges
        let selection = A1Selection::test_a1_context("A1:B2,Table1,C3", &context);
        let replaced = selection.replace_table_refs(&context);
        let expected = A1Selection::test_a1("A1:B2,A1:B2,C3");
        assert_eq!(replaced, expected);

        // Test selection without tables (should remain unchanged)
        let selection = A1Selection::test_a1_context("A1:B2,C3", &context);
        let replaced = selection.replace_table_refs(&context);
        assert_eq!(replaced, selection);
    }

    #[test]
    fn test_get_single_full_table_selection_name() {
        let context = A1Context::test(
            &[],
            &[
                ("Table1", &["A", "B"], Rect::test_a1("A1:B2")),
                ("Table2", &["C", "D"], Rect::test_a1("C3:D4")),
            ],
        );

        // Test single full table selection
        let selection = A1Selection::test_a1_context("Table1", &context);
        assert_eq!(
            selection.get_single_full_table_selection_name(),
            Some("Table1".to_string())
        );

        // Test multiple table selections
        let selection = A1Selection::test_a1_context("Table1,Table2", &context);
        assert_eq!(selection.get_single_full_table_selection_name(), None);

        // Test table headers only
        let selection = A1Selection::test_a1_context("Table1[#Headers]", &context);
        assert_eq!(selection.get_single_full_table_selection_name(), None);

        // Test non-table selection
        let selection = A1Selection::test_a1_context("A1:B2", &context);
        assert_eq!(selection.get_single_full_table_selection_name(), None);
    }

    #[test]
    fn test_table_column_selection() {
        let context = A1Context::test(
            &[],
            &[
                ("Table1", &["A", "B", "C"], Rect::test_a1("A1:C3")),
                ("Table2", &["D", "E"], Rect::test_a1("D1:E3")),
            ],
        );

        // Test selecting specific columns from a table
        let selection = A1Selection::test_a1_context("Table1[[A]:[C]]", &context);
        assert_eq!(
            selection.table_column_selection("Table1", &context),
            Some(vec![0, 1, 2])
        );

        // Test selecting all columns from a table
        let selection = A1Selection::test_a1_context("Table1", &context);
        assert_eq!(
            selection.table_column_selection("Table1", &context),
            Some(vec![0, 1, 2])
        );

        // Test selecting from wrong table name
        let selection = A1Selection::test_a1_context("Table1[[A]:[C]]", &context);
        assert_eq!(selection.table_column_selection("Table2", &context), None);

        // Test non-table selection
        let selection = A1Selection::test_a1_context("A1:C3", &context);
        assert_eq!(selection.table_column_selection("Table1", &context), None);

        // Test multiple table selections
        let selection = A1Selection::test_a1_context("Table1[A],Table2[D]", &context);
        assert_eq!(
            selection.table_column_selection("Table1", &context),
            Some(vec![0])
        );
        assert_eq!(
            selection.table_column_selection("Table2", &context),
            Some(vec![0])
        );
    }

    #[test]
    fn test_is_entire_column_selected() {
        // Test explicit column selection
        assert!(A1Selection::test_a1("A").is_entire_column_selected(1));
        assert!(!A1Selection::test_a1("A").is_entire_column_selected(2));

        // Test range of columns
        assert!(A1Selection::test_a1("A:C").is_entire_column_selected(2));
        assert!(!A1Selection::test_a1("A:C").is_entire_column_selected(4));

        // Test with cell selections (should be false)
        assert!(!A1Selection::test_a1("A1").is_entire_column_selected(1));
        assert!(!A1Selection::test_a1("A1:A5").is_entire_column_selected(1));

        // Test with multiple ranges
        assert!(A1Selection::test_a1("A,C:E").is_entire_column_selected(1));
        assert!(A1Selection::test_a1("A,C:E").is_entire_column_selected(4));
        assert!(!A1Selection::test_a1("A,C:E").is_entire_column_selected(6));

        // Test with all cells selected
        assert!(A1Selection::test_a1("*").is_entire_column_selected(1));
        assert!(A1Selection::test_a1("*").is_entire_column_selected(100));
    }

    #[test]
    fn test_is_entire_row_selected() {
        // Test explicit row selection
        assert!(A1Selection::test_a1("1").is_entire_row_selected(1));
        assert!(!A1Selection::test_a1("1").is_entire_row_selected(2));

        // Test range of rows
        assert!(A1Selection::test_a1("1:3").is_entire_row_selected(2));
        assert!(!A1Selection::test_a1("1:3").is_entire_row_selected(4));

        // Test with cell selections (should be false)
        assert!(!A1Selection::test_a1("A1").is_entire_row_selected(1));
        assert!(!A1Selection::test_a1("A1:E1").is_entire_row_selected(1));

        // Test with multiple ranges
        assert!(A1Selection::test_a1("1,3:5").is_entire_row_selected(1));
        assert!(A1Selection::test_a1("1,3:5").is_entire_row_selected(4));
        assert!(!A1Selection::test_a1("1,3:5").is_entire_row_selected(6));

        // Test with all cells selected
        assert!(A1Selection::test_a1("*").is_entire_row_selected(1));
        assert!(A1Selection::test_a1("*").is_entire_row_selected(100));
    }

    #[test]
    fn test_single_rect() {
        let context = A1Context::default();

        // Test single range with multiple cells
        let selection = A1Selection::test_a1("A1:B2");
        assert_eq!(
            selection.single_rect(&context),
            Some(Rect::new(1, 1, 2, 2)),
            "Single range with multiple cells should return a rect"
        );

        // Test single cell selection
        let selection = A1Selection::test_a1("A1");
        assert_eq!(
            selection.single_rect(&context),
            None,
            "Single cell selection should return None"
        );

        // Test multiple ranges
        let selection = A1Selection::test_a1("A1:B2,C3:D4");
        assert_eq!(
            selection.single_rect(&context),
            None,
            "Multiple ranges should return None"
        );

        // Test column selection
        let selection = A1Selection::test_a1("A:B");
        assert_eq!(
            selection.single_rect(&context),
            None,
            "Column selection should return None"
        );

        // Test row selection
        let selection = A1Selection::test_a1("1:2");
        assert_eq!(
            selection.single_rect(&context),
            None,
            "Row selection should return None"
        );

        // Test larger single range
        let selection = A1Selection::test_a1("B2:D5");
        assert_eq!(
            selection.single_rect(&context),
            Some(Rect::new(2, 2, 4, 5)),
            "Larger single range should return correct rect"
        );
    }

    #[test]
    fn test_contiguous_columns() {
        // Test single column selection
        let selection = A1Selection::test_a1("A");
        assert_eq!(selection.contiguous_columns(), Some(vec![1]));

        // Test column range selection
        let selection = A1Selection::test_a1("A:C");
        assert_eq!(selection.contiguous_columns(), Some(vec![1, 3]));

        // Test reverse column range
        let selection = A1Selection::test_a1("C:A");
        assert_eq!(selection.contiguous_columns(), Some(vec![1, 3]));

        // Test non-contiguous columns
        let selection = A1Selection::test_a1("A,C");
        assert_eq!(selection.contiguous_columns(), None);

        // Test cell selection (not a column)
        let selection = A1Selection::test_a1("A1");
        assert_eq!(selection.contiguous_columns(), None);

        // Test cell range (not a column)
        let selection = A1Selection::test_a1("A1:C3");
        assert_eq!(selection.contiguous_columns(), None);

        // Test row selection (not a column)
        let selection = A1Selection::test_a1("1:3");
        assert_eq!(selection.contiguous_columns(), None);
    }

    #[test]
    fn test_contiguous_rows() {
        // Test single row selection
        let selection = A1Selection::test_a1("1");
        assert_eq!(selection.contiguous_rows(), Some(vec![1]));

        // Test row range selection
        let selection = A1Selection::test_a1("1:3");
        assert_eq!(selection.contiguous_rows(), Some(vec![1, 3]));

        // Test reverse row range
        let selection = A1Selection::test_a1("3:1");
        assert_eq!(selection.contiguous_rows(), Some(vec![1, 3]));

        // Test non-contiguous rows
        let selection = A1Selection::test_a1("1,3");
        assert_eq!(selection.contiguous_rows(), None);

        // Test cell selection (not a row)
        let selection = A1Selection::test_a1("A1");
        assert_eq!(selection.contiguous_rows(), None);

        // Test cell range (not a row)
        let selection = A1Selection::test_a1("A1:C3");
        assert_eq!(selection.contiguous_rows(), None);

        // Test column selection (not a row)
        let selection = A1Selection::test_a1("A:C");
        assert_eq!(selection.contiguous_rows(), None);
    }

    #[test]
    fn test_rects_to_hashes() {
        let context = A1Context::default();
        let sheet = Sheet::test();

        // Test single cell
        let selection = A1Selection::test_a1("A1");
        let hashes = selection.rects_to_hashes(&sheet, &context);
        assert_eq!(hashes.len(), 1);
        assert!(hashes.contains(&Pos { x: 0, y: 0 }));

        // Test range
        let selection = A1Selection::test_a1("A1:B2");
        let hashes = selection.rects_to_hashes(&sheet, &context);
        assert_eq!(hashes.len(), 1);
        assert!(hashes.contains(&Pos { x: 0, y: 0 }));

        // Test multiple ranges
        let selection = A1Selection::test_a1("A1,Q31");
        let hashes = selection.rects_to_hashes(&sheet, &context);
        assert_eq!(hashes.len(), 2);
        assert!(hashes.contains(&Pos { x: 0, y: 0 }));
        assert!(hashes.contains(&Pos { x: 1, y: 1 }));
    }

    #[test]
    fn test_is_col_range() {
        // Test single column
        assert!(A1Selection::test_a1("A").is_col_range());

        // Test column range
        assert!(A1Selection::test_a1("A:C").is_col_range());

        // Test cell selection (not a column range)
        assert!(!A1Selection::test_a1("A1").is_col_range());

        // Test row selection (not a column range)
        assert!(!A1Selection::test_a1("1").is_col_range());

        // Test row selection (is a column range because multiple columns are selected)
        assert!(A1Selection::test_a1("1:3").is_col_range());

        // Test cell range (is a column range because multiple columns are selected)
        assert!(A1Selection::test_a1("A1:C3").is_col_range());
    }

    #[test]
    fn test_selected_columns_finite() {
        let context = A1Context::default();

        // Test single column
        let selection = A1Selection::test_a1("A");
        assert_eq!(selection.columns_with_selected_cells(&context), vec![1]);

        // Test column range
        let selection = A1Selection::test_a1("A:C");
        assert_eq!(
            selection.columns_with_selected_cells(&context),
            vec![1, 2, 3]
        );

        // Test multiple columns
        let selection = A1Selection::test_a1("A,C,E");
        assert_eq!(
            selection.columns_with_selected_cells(&context),
            vec![1, 3, 5]
        );

        // Test cell selection
        let selection = A1Selection::test_a1("A1");
        assert_eq!(selection.columns_with_selected_cells(&context), vec![1]);

        // Test cell range
        let selection = A1Selection::test_a1("A1:C3");
        assert_eq!(
            selection.columns_with_selected_cells(&context),
            vec![1, 2, 3]
        );
    }

    #[test]
    fn test_selected_rows_finite() {
        let context = A1Context::default();

        // Test single row
        let selection = A1Selection::test_a1("1");
        assert_eq!(selection.rows_with_selected_cells(&context), vec![1]);

        // Test row range
        let selection = A1Selection::test_a1("1:3");
        assert_eq!(selection.rows_with_selected_cells(&context), vec![1, 2, 3]);

        // Test multiple rows
        let selection = A1Selection::test_a1("1,3,5");
        assert_eq!(selection.rows_with_selected_cells(&context), vec![1, 3, 5]);

        // Test cell selection
        let selection = A1Selection::test_a1("A1");
        assert_eq!(selection.rows_with_selected_cells(&context), vec![1]);

        // Test cell range
        let selection = A1Selection::test_a1("A1:C3");
        assert_eq!(selection.rows_with_selected_cells(&context), vec![1, 2, 3]);
    }

    #[test]
    fn test_is_table_column_selected() {
        let context = A1Context::test(
            &[],
            &[
                ("Table1", &["A", "B", "C"], Rect::test_a1("A1:C3")),
                ("Table2", &["D", "E"], Rect::test_a1("D1:E3")),
            ],
        );

        // Test selecting all columns from a table
        let selection = A1Selection::test_a1_context("Table1", &context);
        assert!(selection.is_table_column_selected("Table1", 0, &context));
        assert!(selection.is_table_column_selected("Table1", 1, &context));
        assert!(selection.is_table_column_selected("Table1", 2, &context));

        // Test selecting specific columns from a table
        let selection = A1Selection::test_a1_context("Table1[[A]:[C]]", &context);
        assert!(selection.is_table_column_selected("Table1", 0, &context));
        assert!(selection.is_table_column_selected("Table1", 1, &context));
        assert!(selection.is_table_column_selected("Table1", 2, &context));

        // Test selecting single column from a table
        let selection = A1Selection::test_a1_context("Table1[A]", &context);
        assert!(selection.is_table_column_selected("Table1", 0, &context));
        assert!(!selection.is_table_column_selected("Table1", 1, &context));
        assert!(!selection.is_table_column_selected("Table1", 2, &context));

        // Test selecting from wrong table name
        let selection = A1Selection::test_a1_context("Table1", &context);
        assert!(!selection.is_table_column_selected("Table2", 0, &context));

        // Test non-table selection
        let selection = A1Selection::test_a1_context("A1:C3", &context);
        assert!(!selection.is_table_column_selected("Table1", 0, &context));

        // Test multiple table selections
        let selection = A1Selection::test_a1_context("Table1[A],Table2[D]", &context);
        assert!(!selection.is_table_column_selected("Table1", 0, &context));
        assert!(!selection.is_table_column_selected("Table2", 0, &context));

        // Test table headers only
        let selection = A1Selection::test_a1_context("Table1[#Headers]", &context);
        assert!(selection.is_table_column_selected("Table1", 0, &context));

        // Test with non-existent table
        let selection = A1Selection::test_a1_context("Table1", &context);
        assert!(!selection.is_table_column_selected("NonExistentTable", 0, &context));
    }

    #[test]
    fn test_replace_table_refs_table() {
        let context = A1Context::test(
            &[],
            &[
                ("Table1", &["A", "B"], Rect::test_a1("A1:B4")),
                ("Table2", &["C", "D"], Rect::test_a1("C3:D6")),
            ],
        );

        // Test replacing single table reference
        let selection = A1Selection::test_a1_context("Table1", &context);
        let replaced = selection
            .replace_table_refs_table(&"Table1".to_string(), &context)
            .unwrap();
        let mut expected = A1Selection::test_a1("A3:B4");
        expected.cursor = pos![A2];
        assert_eq!(replaced, expected);

        // Test replacing table reference in mixed selection
        let selection = A1Selection::test_a1_context("A1:B2,Table1,C3", &context);
        let replaced = selection
            .replace_table_refs_table(&"Table1".to_string(), &context)
            .unwrap();
        let mut expected = A1Selection::test_a1("A1:B2,A3:B4,C3");
        expected.cursor = pos![C3];
        assert_eq!(
            replaced.to_string(None, &context),
            expected.to_string(None, &context)
        );

        // Test replacing non-existent table reference
        let selection = A1Selection::test_a1_context("A1:B2,C3", &context);
        assert_eq!(
            selection.replace_table_refs_table(&"Table1".to_string(), &context),
            None
        );

        // Test replacing table reference with multiple tables
        let selection = A1Selection::test_a1_context("Table1,Table2", &context);
        let replaced = selection
            .replace_table_refs_table(&"Table1".to_string(), &context)
            .unwrap();
        let mut expected = A1Selection::test_a1_context("A3:B4,Table2", &context);
        expected.cursor = pos![B2];
        assert_eq!(
            replaced.to_string(None, &context),
            expected.to_string(None, &context)
        );

        // Test replacing table reference with table headers
        let selection = A1Selection::test_a1_context("Table1[#Headers]", &context);
        let replaced = selection
            .replace_table_refs_table(&"Table1".to_string(), &context)
            .unwrap();
        let mut expected = A1Selection::test_a1("A2:B2");
        expected.cursor = pos![A1];
        assert_eq!(
            replaced.to_string(None, &context),
            expected.to_string(None, &context)
        );

        // Test replacing table reference with table data
        let selection = A1Selection::test_a1_context("Table1[#Data]", &context);
        let replaced = selection
            .replace_table_refs_table(&"Table1".to_string(), &context)
            .unwrap();
        let mut expected = A1Selection::test_a1("A3:B4");
        expected.cursor = pos![A2];
        assert_eq!(replaced, expected);
    }

    #[test]
    fn test_selected_columns() {
        // Test single column selection
        let selection = A1Selection::test_a1("A");
        assert_eq!(selection.selected_columns(), vec![1]);

        // Test multiple column selections
        let selection = A1Selection::test_a1("A,C,E");
        assert_eq!(selection.selected_columns(), vec![1, 3, 5]);

        // Test column range
        let selection = A1Selection::test_a1("A:C");
        assert_eq!(selection.selected_columns(), vec![1, 2, 3]);

        let selection = A1Selection::test_a1("C:A");
        assert_eq!(selection.selected_columns(), vec![1, 2, 3]);

        // Test multiple column ranges
        let selection = A1Selection::test_a1("A:C,E:G");
        assert_eq!(selection.selected_columns(), vec![1, 2, 3, 5, 6, 7]);

        // Test mixed selections with cells and columns
        let selection = A1Selection::test_a1("A1,B,C:D");
        assert_eq!(selection.selected_columns(), vec![2, 3, 4]);

        // Test all cells selected
        let selection = A1Selection::test_a1("*");
        assert!(selection.selected_columns().is_empty());

        // Test cell selections (should not return any columns)
        let selection = A1Selection::test_a1("A1:B2");
        assert!(selection.selected_columns().is_empty());

        // Test row selections (should not return any columns)
        let selection = A1Selection::test_a1("1:3");
        assert!(selection.selected_columns().is_empty());
    }

    #[test]
    fn test_selected_rows() {
        // Test single row selection
        let selection = A1Selection::test_a1("1");
        assert_eq!(selection.selected_rows(), vec![1]);

        // Test multiple row selections
        let selection = A1Selection::test_a1("1,3,5");
        assert_eq!(selection.selected_rows(), vec![1, 3, 5]);

        // Test row range
        let selection = A1Selection::test_a1("1:3");
        assert_eq!(selection.selected_rows(), vec![1, 2, 3]);

        // Test reverse row range
        let selection = A1Selection::test_a1("3:1");
        assert_eq!(selection.selected_rows(), vec![1, 2, 3]);

        // Test multiple row ranges
        let selection = A1Selection::test_a1("1:3,5:7");
        assert_eq!(selection.selected_rows(), vec![1, 2, 3, 5, 6, 7]);

        // Test mixed selections with cells and rows
        let selection = A1Selection::test_a1("A1,2,3:4");
        assert_eq!(selection.selected_rows(), vec![2, 3, 4]);

        // Test all cells selected
        let selection = A1Selection::test_a1("*");
        assert!(selection.selected_rows().is_empty());

        // Test cell selections (should not return any rows)
        let selection = A1Selection::test_a1("A1:B2");
        assert!(selection.selected_rows().is_empty());

        // Test column selections (should not return any rows)
        let selection = A1Selection::test_a1("A:C");
        assert!(selection.selected_rows().is_empty());
    }

    #[test]
    fn test_can_insert_column_row() {
        // Test single column selection
        assert!(A1Selection::test_a1("A").can_insert_column_row());
        assert!(A1Selection::test_a1("A:C").can_insert_column_row());

        // Test single row selection
        assert!(A1Selection::test_a1("1").can_insert_column_row());
        assert!(A1Selection::test_a1("1:3").can_insert_column_row());

        // Test single finite range
        assert!(A1Selection::test_a1("A1:B2").can_insert_column_row());
        assert!(A1Selection::test_a1("A1").can_insert_column_row());

        // Test multiple ranges (should be false)
        assert!(!A1Selection::test_a1("A1,B2").can_insert_column_row());
        assert!(!A1Selection::test_a1("A,B").can_insert_column_row());
        assert!(!A1Selection::test_a1("1,2").can_insert_column_row());

        // Test infinite ranges (should be false)
        assert!(!A1Selection::test_a1("A:").can_insert_column_row());
        assert!(!A1Selection::test_a1("1:").can_insert_column_row());
        assert!(!A1Selection::test_a1("B2:").can_insert_column_row());
        assert!(!A1Selection::test_a1("*").can_insert_column_row());
    }
}
