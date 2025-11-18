use crate::{
    Pos,
    a1::{A1Context, A1Selection, CellRefRange, CellRefRangeEnd, ColRange},
    grid::sheet::merge_cells::MergeCells,
};

impl A1Selection {
    pub fn keyboard_select_to(
        &mut self,
        delta_x: i64,
        delta_y: i64,
        end_pos: &mut Pos,
        a1_context: &A1Context,
        merge_cells: &MergeCells,
    ) {
        // if the selection is empty, then we use the cursor as the starting point
        if self.ranges.is_empty() {
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        };

        // Calculate the size of the last range before any change
        let size_before = self
            .ranges
            .last()
            .and_then(|range| range.to_rect(a1_context))
            .map(|rect| rect.count())
            .unwrap_or(0);

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
                        if let Some((_start_col, _start_row)) = start {
                            // todo!
                            // *range = RefRangeBounds::new_relative(
                            //     start_col, start_row, delta_x, delta_y,
                            // );
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
                        range_converted.end = CellRefRangeEnd::new_relative_xy(delta_x, delta_y);
                        *last = CellRefRange::Sheet {
                            range: range_converted,
                        };
                    } else {
                        dbgjs!(
                            "Could not convert table range to ref range bounds in A1Selection::select_to"
                        );
                        // Update selection_end to track the target position
                        // todo!
                        // return Pos::new(delta_x, delta_y);
                    }
                }
                CellRefRange::Sheet { range } => {
                    // if range.start.row.is_unbounded() {
                    //     self.cursor.y = delta_y;
                    // }
                    // if range.start.col.is_unbounded() {
                    //     self.cursor.x = delta_x;
                    // }

                    range.end = CellRefRangeEnd::new_relative_xy(
                        (end_pos.x + delta_x).clamp(1, i64::MAX),
                        (end_pos.y + delta_y).clamp(1, i64::MAX),
                    );
                    *end_pos = Pos::new(range.end.col(), range.end.row());
                }
            };
        }

        // Calculate the size after adjustment and determine if it shrunk or grew
        let size_after = self
            .ranges
            .last()
            .and_then(|range| range.to_rect(a1_context))
            .map(|rect| rect.count())
            .unwrap_or(0);

        let last_range_grew = size_after > size_before;
        self.adjust_for_merged_cells(merge_cells, last_range_grew, end_pos);
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_keyboard_select_clockwise() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // start at D5
        let mut selection = A1Selection::test_a1("D5");
        let mut end = Pos::test_a1("D5");

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &mut end, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    end,
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        // clockwise
        assert_move(1, 0, "D5:E5", "E5");
        assert_move(1, 0, "D5:F5", "F5");
        assert_move(1, 0, "D5:G5", "G5");
        assert_move(0, 1, "D5:G6", "G6");
        assert_move(0, 1, "D5:G7", "G7");
        assert_move(0, 1, "D5:G8", "G8");
        assert_move(-1, 0, "D5:F8", "F8");
        assert_move(-1, 0, "D5:E8", "E8");
        assert_move(-1, 0, "D5:D8", "D8");
        assert_move(-1, 0, "D5:C8", "C8");
        assert_move(-1, 0, "D5:B8", "B8");
        assert_move(-1, 0, "D5:A8", "A8");
        assert_move(-1, 0, "D5:A8", "A8");
        assert_move(0, -1, "D5:A7", "A7");
        assert_move(0, -1, "D5:A6", "A6");
        assert_move(0, -1, "D5:A5", "A5");
        assert_move(0, -1, "D5:A4", "A4");
        assert_move(0, -1, "D5:A3", "A3");
        assert_move(0, -1, "D5:A2", "A2");
        assert_move(0, -1, "D5:A1", "A1");
        assert_move(0, -1, "D5:A1", "A1");
        assert_move(1, 0, "D5:B1", "B1");
        assert_move(1, 0, "D5:C1", "C1");
        assert_move(1, 0, "D5:D1", "D1");
        assert_move(1, 0, "D5:E1", "E1");
        assert_move(1, 0, "D5:F1", "F1");
        assert_move(1, 0, "D5:G1", "G1");
    }

    #[test]
    fn test_keyboard_select_counter_clockwise() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // start at D5
        let mut selection = A1Selection::test_a1("D5");
        let mut end = Pos::test_a1("D5");

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &mut end, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    end,
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        // counter-clockwise
        assert_move(-1, 0, "D5:C5", "C5");
        assert_move(-1, 0, "D5:B5", "B5");
        assert_move(-1, 0, "D5:A5", "A5");
        assert_move(-1, 0, "D5:A5", "A5");
        assert_move(0, -1, "D5:A4", "A4");
        assert_move(0, -1, "D5:A3", "A3");
        assert_move(0, -1, "D5:A2", "A2");
        assert_move(0, -1, "D5:A1", "A1");
        assert_move(0, -1, "D5:A1", "A1");
        assert_move(1, 0, "D5:B1", "B1");
        assert_move(1, 0, "D5:C1", "C1");
        assert_move(1, 0, "D5:D1", "D1");
        assert_move(1, 0, "D5:E1", "E1");
        assert_move(1, 0, "D5:F1", "F1");
        assert_move(1, 0, "D5:G1", "G1");
        assert_move(0, 1, "D5:G2", "G2");
        assert_move(0, 1, "D5:G3", "G3");
        assert_move(0, 1, "D5:G4", "G4");
        assert_move(0, 1, "D5:G5", "G5");
        assert_move(0, 1, "D5:G6", "G6");
        assert_move(0, 1, "D5:G7", "G7");
        assert_move(0, 1, "D5:G8", "G8");
        assert_move(-1, 0, "D5:F8", "F8");
        assert_move(-1, 0, "D5:E8", "E8");
        assert_move(-1, 0, "D5:D8", "D8");
    }

    #[test]
    fn test_keyboard_select_to_merge_cells() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E10"));

        let mut selection = A1Selection::test_a1("B7");
        let mut end = Pos::test_a1("B7");

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &mut end, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    end,
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        assert_move(1, 0, "B7:C7", "C7");
        assert_move(0, 1, "B7:E10", "E10");
    }
}
