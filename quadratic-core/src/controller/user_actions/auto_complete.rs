use crate::controller::{transaction_summary::TransactionSummary, GridController};
use crate::{grid::SheetId, Rect};
use anyhow::Result;

impl GridController {
    /// Extend and/or shrink the contents of selection to range by inferring patterns.
    ///
    /// selection: the range of cells to be expanded
    ///
    /// range: the range of cells to expand to
    ///
    /// cursor: the cursor position for the undo/redo stack
    pub fn autocomplete(
        &mut self,
        sheet_id: SheetId,
        selection: Rect,
        range: Rect,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let ops = self.autocomplete_operations(sheet_id, selection, range)?;
        Ok(self.start_user_transaction(ops, cursor))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        array,
        test_util::{
            assert_cell_format_bold_row, assert_cell_format_cell_fill_color_row, assert_cell_value,
            assert_cell_value_row, print_table,
        },
        Pos, SheetPos, SheetRect,
    };

    fn test_setup_rect(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec!["a", "h", "x", "g", "f", "z", "r", "b"];
        let bolds = vec![true, false, false, true, false, true, true, false];

        test_setup(selection, &vals, &bolds, &[])
    }

    fn test_setup_rect_horiz_series(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec![
            "8", "9", "10", "11", "10", "9", "8", "7", "Mon", "Tue", "Wed", "Thu", "May", "Jun",
            "Jul", "Aug", "32", "64", "128", "256",
        ];
        let bolds = vec![];

        test_setup(selection, &vals, &bolds, &[])
    }

    fn test_setup_rect_vert_series(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec!["1", "2", "3"];
        let bolds = vec![];

        test_setup(selection, &vals, &bolds, &[])
    }

    fn test_setup(
        selection: &Rect,
        vals: &[&str],
        bolds: &[bool],
        fill_colors: &[&str],
    ) -> (GridController, SheetId) {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let mut count = 0;

        for y in selection.y_range() {
            for x in selection.x_range() {
                let sheet_pos = SheetPos { x, y, sheet_id };
                grid_controller.set_cell_value(sheet_pos, vals[count].to_string(), None);

                if let Some(is_bold) = bolds.get(count) {
                    if *is_bold {
                        grid_controller.set_cell_bold(sheet_pos.into(), Some(true), None);
                    }
                }

                if let Some(fill_color) = fill_colors.get(count) {
                    grid_controller.set_cell_fill_color(
                        SheetRect::single_sheet_pos(sheet_pos),
                        Some(fill_color.to_lowercase()),
                        None,
                    );
                }

                count += 1;
            }
        }

        (grid_controller, sheet_id)
    }

    #[test]
    fn test_cell_values_in_rect() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (grid_controller, sheet_id) = test_setup_rect(&selected);
        let sheet = grid_controller.sheet(sheet_id);
        let result = sheet.cell_values_in_rect(&selected).unwrap();
        let expected = array![
            "a", "h", "x", "g";
            "f", "z", "r", "b";
        ];

        assert_eq!(result, expected);
    }

    #[test]
    fn test_expand_left_only() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let range: Rect = Rect::new_span(Pos { x: -3, y: 1 }, Pos { x: 5, y: 2 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: -3, y: 1 }, Pos { x: 5, y: 2 }),
        );

        let expected = vec!["g", "a", "h", "x", "g", "a", "h", "x", "g"];
        let expected_bold = vec![true, true, false, false, true, true, false, false, true];
        assert_cell_value_row(&grid, sheet_id, -3, 5, 1, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, -3, 5, 1, expected_bold.clone());

        let expected = vec!["b", "f", "z", "r", "b", "f", "z", "r", "b"];
        let expected_bold = vec![false, false, true, true, false, false, true, true, false];
        assert_cell_format_bold_row(&grid, sheet_id, -3, 5, 2, expected_bold);
        assert_cell_value_row(&grid, sheet_id, -3, 5, 2, expected);
    }

    #[test]
    fn test_expand_right_only() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 10, y: 2 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        let summary = grid.autocomplete(sheet_id, selected, range, None).unwrap();
        println!("{:?}", summary);

        print_table(&grid, sheet_id, range);

        let expected = vec!["a", "h", "x", "g", "a", "h", "x", "g", "a"];
        let expected_bold = vec![true, false, false, true, true, false, false, true, true];
        assert_cell_value_row(&grid, sheet_id, 2, 10, 1, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 1, expected_bold.clone());

        let expected = vec!["f", "z", "r", "b", "f", "z", "r", "b", "f"];
        let expected_bold = vec![false, true, true, false, false, true, true, false, false];
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 2, expected_bold);
        assert_cell_value_row(&grid, sheet_id, 2, 10, 2, expected);
    }

    #[test]
    fn test_expand_up_only() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: -7 }, Pos { x: 5, y: 2 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

        let expected = vec!["a", "h", "x", "g"];
        let expected_bold = vec![true, false, false, true];
        assert_cell_value_row(&grid, sheet_id, 2, 5, -7, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, -7, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, -5, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, -5, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, -1, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, -1, expected_bold.clone());

        let expected = vec!["f", "z", "r", "b"];
        let expected_bold = vec![false, true, true, false];
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, -6, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, -6, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, -4, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, -4, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, 0, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, 0, expected.clone());
    }

    #[test]
    fn test_expand_down_only() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

        let expected = vec!["a", "h", "x", "g"];
        let expected_bold = vec![true, false, false, true];
        assert_cell_value_row(&grid, sheet_id, 2, 5, 1, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, 1, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, 5, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, 5, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, 9, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, 9, expected_bold.clone());

        let expected = vec!["f", "z", "r", "b"];
        let expected_bold = vec![false, true, true, false];
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, 2, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, 2, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, 6, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, 6, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 5, 10, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 5, 10, expected.clone());
    }

    #[test]
    fn test_expand_down_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(selected.min, Pos { x: 14, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

        let expected = vec!["a", "h", "x", "g", "a", "h", "x", "g", "a"];
        let expected_bold = vec![true, false, false, true, true, false, false, true, true];

        assert_cell_value_row(&grid, sheet_id, 2, 10, 2, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 10, 10, expected);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 2, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 10, expected_bold);
    }

    #[test]
    fn test_expand_formatting_only() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let vals = vec!["", "", "", "", "", "", "", ""];
        let fill_colors = vec![
            "white", "red", "blue", "green", "yellow", "white", "red", "blue",
        ];

        // down + right
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors);
        let range: Rect = Rect::new_span(selected.min, Pos { x: 7, y: 6 });
        grid.autocomplete(sheet_id, selected, range, None).unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 9, y: 8 });
        print_table(&grid, sheet_id, range_over);

        let expected = vec!["white", "red", "blue", "green", "white", "red"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 4, expected);
        let expected = vec!["yellow", "white", "red", "blue", "yellow", "white"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 5, expected);
        let expected = vec!["white", "red", "blue", "green", "white", "red"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 6, expected);

        // up + right
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors);
        let range: Rect = Rect::new_span(Pos { x: 2, y: -1 }, Pos { x: 7, y: 3 });
        grid.autocomplete(sheet_id, selected, range, None).unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: 0, y: -3 }, Pos { x: 9, y: 5 });
        print_table(&grid, sheet_id, range_over);

        let expected = vec!["yellow", "white", "red", "blue", "yellow", "white"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 1, expected);
        let expected = vec!["white", "red", "blue", "green", "white", "red"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 0, expected);
        let expected = vec!["yellow", "white", "red", "blue", "yellow", "white"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, -1, expected);

        // down + left
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors);
        let range: Rect = Rect::new_span(Pos { x: 1, y: 6 }, selected.max);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 7, y: 8 });
        print_table(&grid, sheet_id, range_over);

        let expected = vec!["green", "white", "red", "blue", "green"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 4, expected);
        let expected = vec!["blue", "yellow", "white", "red", "blue"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 5, expected);
        let expected = vec!["green", "white", "red", "blue", "green"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 6, expected);

        // up + left
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors);
        let range: Rect = Rect::new_span(Pos { x: 1, y: -1 }, selected.max);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: -1, y: -3 }, Pos { x: 7, y: 5 });
        print_table(&grid, sheet_id, range_over);

        let expected = vec!["blue", "yellow", "white", "red", "blue"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 1, expected);
        let expected = vec!["green", "white", "red", "blue", "green"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 2, expected);
        let expected = vec!["blue", "yellow", "white", "red", "blue"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 3, expected);
    }

    #[test]
    fn test_expand_up_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: -7 }, Pos { x: 10, y: 3 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: 2, y: 3 }, Pos { x: 10, y: -7 }),
        );

        let expected = vec!["f", "z", "r", "b", "f", "z", "r", "b", "f"];
        let expected_bold = vec![false, true, true, false, false, true, true, false, false];

        assert_cell_value_row(&grid, sheet_id, 2, 10, -7, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 10, 3, expected);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, -7, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 3, expected_bold);
    }

    #[test]
    fn test_expand_down_and_left() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: -7, y: 20 }, Pos { x: 5, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: -7, y: 2 }, Pos { x: 5, y: 10 }),
        );

        let expected = vec![
            "g", "a", "h", "x", "g", "a", "h", "x", "g", "a", "h", "x", "g",
        ];
        let expected_bold = vec![
            true, true, false, false, true, true, false, false, true, true, false, false, true,
        ];

        assert_cell_value_row(&grid, sheet_id, -7, 5, 2, expected.clone());
        assert_cell_value_row(&grid, sheet_id, -7, 5, 10, expected);
        assert_cell_format_bold_row(&grid, sheet_id, -7, 5, 2, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, -7, 5, 10, expected_bold);
    }

    #[test]
    fn test_expand_up_and_left() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: -7, y: -7 }, selected.max);
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, Rect::new_span(range.min, selected.max));

        let expected = vec![
            "b", "f", "z", "r", "b", "f", "z", "r", "b", "f", "z", "r", "b",
        ];
        let expected_bold = vec![
            false, false, true, true, false, false, true, true, false, false, true, true, false,
        ];

        assert_cell_value_row(&grid, sheet_id, -7, 5, -7, expected.clone());
        assert_cell_value_row(&grid, sheet_id, -7, 5, 3, expected);
        assert_cell_format_bold_row(&grid, sheet_id, -7, 5, -7, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, -7, 5, 3, expected_bold);
    }

    #[test]
    fn test_expand_horizontal_series_down_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 9, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect_horiz_series(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

        let expected = vec!["8", "9", "10", "11", "12", "13", "14", "15"];
        assert_cell_value_row(&grid, sheet_id, 2, 9, 2, expected);

        let expected = vec!["10", "9", "8", "7", "6", "5", "4", "3"];
        assert_cell_value_row(&grid, sheet_id, 2, 9, 3, expected);

        let expected = vec!["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];
        assert_cell_value_row(&grid, sheet_id, 2, 9, 4, expected);

        let expected = vec!["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        assert_cell_value_row(&grid, sheet_id, 2, 9, 5, expected);

        let expected = vec!["32", "64", "128", "256", "512", "1024", "2048", "4096"];
        assert_cell_value_row(&grid, sheet_id, 2, 9, 6, expected);
    }

    #[test]
    fn test_expand_horizontal_series_up_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 6, y: 15 }, Pos { x: 9, y: 19 });
        let range: Rect = Rect::new_span(Pos { x: 6, y: 12 }, Pos { x: 15, y: 19 });
        let (mut grid, sheet_id) = test_setup_rect_horiz_series(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

        let expected = vec!["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];
        assert_cell_value_row(&grid, sheet_id, 6, 15, 12, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 6, 15, 17, expected);

        let expected = vec!["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        assert_cell_value_row(&grid, sheet_id, 6, 15, 13, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 6, 15, 18, expected.clone());

        let expected = vec!["32", "64", "128", "256", "512", "1024", "2048", "4096"];
        assert_cell_value_row(&grid, sheet_id, 6, 15, 14, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 6, 15, 19, expected.clone());

        let expected = vec!["8", "9", "10", "11", "12", "13", "14", "15"];
        assert_cell_value_row(&grid, sheet_id, 6, 15, 15, expected.clone());

        let expected = vec!["10", "9", "8", "7", "6", "5", "4", "3"];
        assert_cell_value_row(&grid, sheet_id, 6, 15, 16, expected.clone());
    }

    #[test]
    fn test_expand_horizontal_series_up_and_left() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        let range: Rect = Rect::new_span(Pos { x: -4, y: -8 }, Pos { x: 5, y: 6 });
        let (mut grid, sheet_id) = test_setup_rect_horiz_series(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

        let expected = vec!["2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
        assert_cell_value_row(&grid, sheet_id, -4, 5, -8, expected.clone());
        assert_cell_value_row(&grid, sheet_id, -4, 5, -3, expected.clone());

        let expected = vec!["16", "15", "14", "13", "12", "11", "10", "9", "8", "7"];
        assert_cell_value_row(&grid, sheet_id, -4, 5, -7, expected.clone());
        assert_cell_value_row(&grid, sheet_id, -4, 5, -2, expected.clone());

        let expected = vec![
            "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu",
        ];
        assert_cell_value_row(&grid, sheet_id, -4, 5, -6, expected.clone());
        assert_cell_value_row(&grid, sheet_id, -4, 5, -1, expected.clone());

        let expected = vec![
            "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
        ];
        assert_cell_value_row(&grid, sheet_id, -4, 5, -5, expected.clone());
        assert_cell_value_row(&grid, sheet_id, -4, 5, 0, expected.clone());

        let expected = vec!["0.5", "1", "2", "4", "8", "16", "32", "64", "128", "256"];
        assert_cell_value_row(&grid, sheet_id, -4, 5, -4, expected.clone());
        assert_cell_value_row(&grid, sheet_id, -4, 5, 1, expected.clone());
    }

    #[test]
    fn test_expand_vertical_series_down_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 2, y: 4 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 9, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect_vert_series(&selected);
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

        assert_cell_value(&grid, sheet_id, 3, 5, "4");
        assert_cell_value(&grid, sheet_id, 3, 6, "5");
        assert_cell_value(&grid, sheet_id, 3, 7, "6");
    }

    #[test]
    fn test_shrink_width() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 7 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);

        // first, fully expand
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 4, y: 7 });
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 12, y: 12 }),
        );

        let expected_full = vec!["a", "h", "x", "", "", "", "", "", ""];
        let expected_empty = vec!["", "", "", "", "", "", "", "", ""];
        let expected_bold_1 = vec![true, false, false, false, false, false, false, false, false];
        let expected_bold_2 = vec![
            false, false, false, false, false, false, false, false, false,
        ];

        assert_cell_value_row(&grid, sheet_id, 2, 10, 2, expected_full);
        assert_cell_value_row(&grid, sheet_id, 2, 10, 8, expected_empty);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 2, expected_bold_1.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 6, expected_bold_1);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 8, expected_bold_2);
    }

    #[test]
    fn test_shrink_height() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 7 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);

        // first, fully expand
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 5 });
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 12, y: 12 }),
        );

        let expected_full = vec!["a", "h", "x", "g", "a", "h", "x", "g", "a"];
        let expected_empty = vec!["", "", "", "", "", "", "", "", ""];
        let expected_bold_full = vec![true, false, false, true, true, false, false, true, true];
        let expected_bold_empty = vec![false, false, false, false, false, false, false, false];

        assert_cell_value_row(&grid, sheet_id, 2, 10, 2, expected_full);
        assert_cell_value_row(&grid, sheet_id, 2, 10, 6, expected_empty);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 2, expected_bold_full);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 6, expected_bold_empty);
    }

    #[test]
    fn test_shrink_width_and_height() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 7 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);

        // first, fully expand
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 5 });
        grid.autocomplete(sheet_id, selected, range, None).unwrap();

        print_table(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 12, y: 12 }),
        );

        let expected_full = vec!["a", "h", "x", "g", "", "", "", "", ""];
        let expected_empty = vec!["", "", "", "", "", "", "", "", ""];
        let expected_bold_full = vec![true, false, false, true, false, false, false, false, false];
        let expected_bold_empty = vec![false, false, false, false, false, false, false, false];

        assert_cell_value_row(&grid, sheet_id, 2, 10, 2, expected_full);
        assert_cell_value_row(&grid, sheet_id, 2, 10, 6, expected_empty);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 2, expected_bold_full);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 6, expected_bold_empty);
    }

    #[test]
    fn test_autocomplete_sheet_id_not_found() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 7 });
        let (mut grid, _) = test_setup_rect(&selected);

        let result = grid.autocomplete(SheetId::new(), selected, range, None);
        assert!(result.is_err());
    }
}
