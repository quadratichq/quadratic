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
        merge_cells: &MergeCells,
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

                    // Expand selection to include any partially overlapping merged cells
                    // while preserving the anchor (start) position as much as possible
                    if range.is_finite()
                        && let Some(rect) = range.to_rect()
                    {
                        let mut expanded_rect = rect;
                        super::helpers::expand_to_include_merge_cells(
                            &mut expanded_rect,
                            merge_cells,
                        );
                        if expanded_rect != rect {
                            // Preserve the direction of selection while expanding.
                            // The key is that start and end may not be normalized
                            // (start can be > end), and we need to preserve that
                            // relationship while including the expanded area.
                            let start_col = range.start.col();
                            let start_row = range.start.row();
                            let end_col = range.end.col();
                            let end_row = range.end.row();

                            // For each axis, determine the selection direction and
                            // expand appropriately. The start should expand in its
                            // direction (away from end), and end should expand in
                            // its direction (away from start).
                            let (new_start_col, new_end_col) = if end_col < start_col {
                                // Selecting left: start is right, end is left
                                (expanded_rect.max.x, expanded_rect.min.x)
                            } else if end_col > start_col {
                                // Selecting right: start is left, end is right
                                (expanded_rect.min.x, expanded_rect.max.x)
                            } else {
                                // Same column: expand end in both directions if needed
                                (
                                    start_col,
                                    if expanded_rect.min.x < start_col {
                                        expanded_rect.min.x
                                    } else {
                                        expanded_rect.max.x
                                    },
                                )
                            };

                            let (new_start_row, new_end_row) = if end_row < start_row {
                                // Selecting up: start is below, end is above
                                (expanded_rect.max.y, expanded_rect.min.y)
                            } else if end_row > start_row {
                                // Selecting down: start is above, end is below
                                (expanded_rect.min.y, expanded_rect.max.y)
                            } else {
                                // Same row: expand end in both directions if needed
                                (
                                    start_row,
                                    if expanded_rect.min.y < start_row {
                                        expanded_rect.min.y
                                    } else {
                                        expanded_rect.max.y
                                    },
                                )
                            };

                            range.start =
                                CellRefRangeEnd::new_relative_xy(new_start_col, new_start_row);
                            range.end =
                                CellRefRangeEnd::new_relative_xy(new_end_col, new_end_row);
                        }
                    }

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

    /// Tests that mouse drag selection expands to include merged cells.
    ///
    /// Scenario: Merged cell at C4:E6, start at D1, drag to E9.
    /// The selection should expand to C1:E9 to include the full merged cell.
    #[test]
    fn test_select_to_expands_for_merged_cells() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create merged cell C4:E6
        merge_cells.merge_cells(Rect::test_a1("C4:E6"));

        // Start at D1 (cursor at D1)
        let mut selection = A1Selection::test_a1("D1");
        assert_eq!(selection.cursor.x, 4); // D = column 4
        assert_eq!(selection.cursor.y, 1);

        // Drag to E9 (column 5, row 9)
        selection.select_to(5, 9, false, &context, &merge_cells);

        // Selection should expand to include the full merged cell C4:E6
        // Result should be C1:E9 (column C=3 to E=5, row 1 to 9)
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("C1:E9")],
            "Selection should expand to include merged cell, got: {:?}",
            selection.test_to_string()
        );
    }

    /// Tests that mouse drag selection expands when starting inside a merged cell.
    #[test]
    fn test_select_to_from_inside_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create merged cell B2:D4
        merge_cells.merge_cells(Rect::test_a1("B2:D4"));

        // Start at C3 (inside merged cell, cursor at C3)
        let mut selection = A1Selection::test_a1("C3");

        // Drag to F6
        selection.select_to(6, 6, false, &context, &merge_cells);

        // Selection should expand to include the full merged cell B2:D4
        // Result should be B2:F6
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("B2:F6")],
            "Selection should expand to include merged cell, got: {:?}",
            selection.test_to_string()
        );
    }

    /// Tests that mouse drag selection expands when ending inside a merged cell.
    #[test]
    fn test_select_to_ending_inside_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create merged cell D4:F6
        merge_cells.merge_cells(Rect::test_a1("D4:F6"));

        // Start at A1
        let mut selection = A1Selection::test_a1("A1");

        // Drag to E5 (inside merged cell)
        selection.select_to(5, 5, false, &context, &merge_cells);

        // Selection should expand to include the full merged cell D4:F6
        // Result should be A1:F6
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A1:F6")],
            "Selection should expand to include merged cell, got: {:?}",
            selection.test_to_string()
        );
    }

    /// Tests chained merge cell expansion (expanding to one merge cell reveals another).
    #[test]
    fn test_select_to_chained_merge_cells() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create two adjacent merged cells
        merge_cells.merge_cells(Rect::test_a1("C3:D4")); // First merge cell
        merge_cells.merge_cells(Rect::test_a1("E3:F4")); // Adjacent merge cell

        // Start at A1
        let mut selection = A1Selection::test_a1("A1");

        // Drag to C3 (corner of first merged cell)
        selection.select_to(3, 3, false, &context, &merge_cells);

        // Selection should expand to include first merged cell C3:D4
        // Result should be A1:D4
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A1:D4")],
            "Selection should expand to include first merged cell, got: {:?}",
            selection.test_to_string()
        );

        // Now drag to E3 (corner of second merged cell)
        selection.select_to(5, 3, false, &context, &merge_cells);

        // Selection should expand to include second merged cell E3:F4
        // Result should be A1:F4
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A1:F4")],
            "Selection should expand to include second merged cell, got: {:?}",
            selection.test_to_string()
        );
    }

    /// Tests that the anchor cell is preserved when selecting upward past merge cells.
    ///
    /// Scenario: Merged cell at A7:D8, start at D10, drag up past the merge cells.
    /// The selection anchor should remain at D10, not change to the merged cell.
    #[test]
    fn test_select_to_preserves_anchor_when_selecting_up_past_merge() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create merged cell A7:D8
        merge_cells.merge_cells(Rect::test_a1("A7:D8"));

        // Start at D10 (anchor at D10)
        let mut selection = A1Selection::test_a1("D10");
        assert_eq!(selection.cursor.x, 4); // D = column 4
        assert_eq!(selection.cursor.y, 10);

        // First drag up to D9 (below the merge cell) - anchor should be D10, end at D9
        selection.select_to(4, 9, false, &context, &merge_cells);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("D10:D9")],
            "Selection should be D10:D9, got: {:?}",
            selection.test_to_string()
        );

        // Now drag up to D7 (inside the merge cell)
        // Selection should expand to include the full merged cell A7:D8
        // The anchor (start) should remain at D10, end should be at A7
        selection.select_to(4, 7, false, &context, &merge_cells);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("D10:A7")],
            "Selection should be D10:A7 (preserving anchor), got: {:?}",
            selection.test_to_string()
        );

        // Drag up further to D5 (above the merge cell)
        // Selection should remain D10:A5 (preserving anchor at D10)
        selection.select_to(4, 5, false, &context, &merge_cells);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("D10:A5")],
            "Selection should be D10:A5 (preserving anchor), got: {:?}",
            selection.test_to_string()
        );
    }

    /// Tests that the anchor cell is preserved when selecting downward past merge cells.
    #[test]
    fn test_select_to_preserves_anchor_when_selecting_down_past_merge() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create merged cell A7:D8
        merge_cells.merge_cells(Rect::test_a1("A7:D8"));

        // Start at D5 (anchor at D5)
        let mut selection = A1Selection::test_a1("D5");

        // Drag down to D8 (inside the merge cell)
        // Selection should expand to include the full merged cell A7:D8
        // The anchor (start) should remain at D5
        selection.select_to(4, 8, false, &context, &merge_cells);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("D5:A8")],
            "Selection should be D5:A8 (preserving anchor), got: {:?}",
            selection.test_to_string()
        );
    }
}
