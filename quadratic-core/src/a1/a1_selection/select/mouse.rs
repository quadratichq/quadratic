use crate::{
    a1::{A1Context, A1Selection, CellRefRange, CellRefRangeEnd, ColRange, RefRangeBounds},
    grid::sheet::merge_cells::MergeCells,
};

impl A1Selection {
    /// to the ranges (or, if the last selection was a range, then the end of that range is extended).
    pub(crate) fn select_to(
        &mut self,
        column: i64,
        row: i64,
        append: bool,
        a1_context: &A1Context,
        _merge_cells: &MergeCells,
    ) {
        // if the selection is empty, then we use the cursor as the starting point
        if self.ranges.is_empty() {
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        };
        if let Some(last) = self.ranges.last_mut() {
            match last {
                CellRefRange::Table { range } => {
                    if let Some(table) = a1_context.try_table(&range.table_name) {
                        let mut start: Option<(i64, i64)> = None;
                        match &range.col_range {
                            // all gets the entire table selection
                            ColRange::All => {
                                if table.show_name {
                                    start = Some((table.bounds.min.x, table.bounds.min.y));
                                }
                            }
                            ColRange::Col(col) => {
                                if table.show_columns
                                    && let Some(col_index) = table.try_col_index(col)
                                {
                                    start = Some((
                                        table.bounds.min.x + col_index,
                                        table.bounds.min.y + if table.show_name { 1 } else { 0 },
                                    ));
                                }
                            }
                            ColRange::ColRange(start_col, _) => {
                                if let Some(col_index) = table.try_col_index(start_col) {
                                    start = Some((
                                        table.bounds.min.x + col_index,
                                        table.bounds.min.y + if table.show_name { 1 } else { 0 },
                                    ));
                                }
                            }
                            ColRange::ColToEnd(col) => {
                                if let Some(col_index) = table.try_col_index(col) {
                                    start = Some((
                                        table.bounds.min.x + col_index,
                                        table.bounds.min.y + if table.show_name { 1 } else { 0 },
                                    ));
                                }
                            }
                        }
                        if let Some((start_col, start_row)) = start {
                            let range =
                                RefRangeBounds::new_relative(start_col, start_row, column, row);
                            *last = CellRefRange::Sheet { range };
                            if !append {
                                self.ranges =
                                    self.ranges.split_off(self.ranges.len().saturating_sub(1));
                            }
                            return;
                        }
                    }
                    if let Some(mut range_converted) = range
                        .clone()
                        .convert_to_ref_range_bounds(false, a1_context, false, false)
                    {
                        // if cursor is at the end of the table, then reverse the selection
                        if self.cursor.x == range_converted.end.col()
                            && self.cursor.y == range_converted.end.row()
                        {
                            range_converted.start = range_converted.end;
                        }
                        range_converted.end = CellRefRangeEnd::new_relative_xy(column, row);
                        *last = CellRefRange::Sheet {
                            range: range_converted,
                        };
                    } else {
                        dbgjs!(
                            "Could not convert table range to ref range bounds in A1Selection::select_to"
                        );
                        // Update selection_end to track the target position
                        // return Pos::new(column, row);
                    }
                    if !append {
                        self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
                    }
                }
                CellRefRange::Sheet { range } => {
                    if range.start.row.is_unbounded() {
                        self.cursor.y = row;
                    }
                    if range.start.col.is_unbounded() {
                        self.cursor.x = column;
                    }

                    range.end = CellRefRangeEnd::new_relative_xy(column, row);

                    if !append {
                        self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
                    }
                }
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Rect, grid::SheetId};

    #[test]
    fn test_select_to() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        let mut selection = A1Selection::test_a1("A1");
        selection.select_to(2, 2, false, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

        let mut selection = A1Selection::test_a1("A:B");
        selection.select_to(2, 2, false, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A:B2")]);

        let mut selection = A1Selection::test_a1("A1");
        selection.select_to(3, 3, false, &context, &merge_cells);
        selection.select_to(1, 1, false, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1")]);

        let mut selection = A1Selection::test_a1("A1,B2,C3");
        selection.select_to(2, 2, false, &context, &merge_cells);
        // When selecting from C3 to B2, the range keeps the start at C3 and end at B2 (not normalized)
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("C3:B2")]);
    }

    #[test]
    fn test_select_to_with_append() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        let mut selection = A1Selection::test_a1("A1");
        selection.select_to(2, 2, true, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

        // Test appending to existing selection
        selection.select_to(3, 3, true, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:C3")]);
    }

    #[test]
    fn test_table_selection() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::TEST)],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let merge_cells = MergeCells::default();

        let mut selection = A1Selection::test_a1_context("Table1", &context);
        selection.select_to(5, 5, true, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:E5")]);

        // Test table column selection
        let mut selection = A1Selection::test_a1_context("Table1[col2]", &context);
        selection.select_to(4, 6, true, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2:D6")]);
    }

    #[test]
    fn test_complex_selection_scenarios() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Test multiple discontinuous ranges
        let mut selection = A1Selection::test_a1("A1:B2,D4:E5");
        selection.select_to(6, 6, false, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("D4:F6")]);
    }

    #[test]
    fn test_unbounded_selection_edge_cases() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Test unbounded column selection
        let mut selection = A1Selection::test_a1("A:");
        selection.select_to(3, 5, false, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:C5")]);

        // Test unbounded row selection
        let mut selection = A1Selection::test_a1("1:");
        selection.select_to(4, 3, false, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:D3")]);

        // Test selection starting from unbounded
        let mut selection = A1Selection::test_a1(":");
        selection.select_to(2, 2, false, &context, &merge_cells);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
    }
}
