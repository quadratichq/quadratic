use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::{Rect, grid::SheetId};
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
        initial_range: Rect,
        final_range: Rect,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<()> {
        let ops = self.autocomplete_operations(sheet_id, initial_range, final_range)?;
        self.start_user_ai_transaction(ops, cursor, TransactionName::Autocomplete, is_ai);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        CellValue, Pos, SheetPos, SheetRect,
        a1::A1Selection,
        array,
        controller::user_actions::import::tests::simple_csv,
        grid::{
            CodeCellLanguage, CodeRun,
            sheet::borders::{BorderSelection, BorderStyle},
        },
        test_util::*,
    };

    fn test_setup_rect(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec!["a", "h", "x", "g", "f", "z", "r", "b"];
        let bolds = vec![true, false, false, true, false, true, true, false];

        test_setup(selection, &vals, &bolds, &[], &[])
    }

    fn test_setup_rect_horiz_series(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec![
            "8", "9", "10", "11", "10", "9", "8", "7", "Mon", "Tue", "Wed", "Thu", "May", "Jun",
            "Jul", "Aug", "32", "64", "128", "256",
        ];
        let bolds = vec![];

        test_setup(selection, &vals, &bolds, &[], &[])
    }

    fn test_setup_rect_vert_series(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec!["1", "2", "3"];
        let bolds = vec![];

        test_setup(selection, &vals, &bolds, &[], &[])
    }

    fn test_setup(
        selection: &Rect,
        vals: &[&str],
        bolds: &[bool],
        fill_colors: &[&str],
        code_cells: &[CodeRun],
    ) -> (GridController, SheetId) {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let mut count = 0;

        for y in selection.y_range() {
            for x in selection.x_range() {
                let sheet_pos = SheetPos { x, y, sheet_id };
                if let Some(cell_value) = vals.get(count) {
                    grid_controller.set_cell_value(sheet_pos, cell_value.to_string(), None, false);
                }

                if let Some(is_bold) = bolds.get(count)
                    && *is_bold
                {
                    grid_controller
                        .set_bold(
                            &A1Selection::from_single_cell(sheet_pos),
                            Some(true),
                            None,
                            false,
                        )
                        .unwrap();
                }

                if let Some(fill_color) = fill_colors.get(count) {
                    grid_controller
                        .set_fill_color(
                            &A1Selection::from_single_cell(sheet_pos),
                            Some(fill_color.to_lowercase()),
                            None,
                            false,
                        )
                        .unwrap();
                }

                if let Some(code_cell) = code_cells.get(count) {
                    grid_controller.set_code_cell(
                        sheet_pos,
                        code_cell.language.clone(),
                        code_cell.code.clone(),
                        None,
                        None,
                        false,
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
        let result = sheet.cell_values_in_rect(&selected, false).unwrap();
        let expected = array![
            "a", "h", "x", "g";
            "f", "z", "r", "b";
        ];

        assert_eq!(result, expected);
    }

    #[test]
    fn test_expand_code_cell() {
        let selected: Rect = Rect::test_a1("A1:A2");
        let range: Rect = Rect::test_a1("A1:J10");
        let code_1 = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "SUM(A1)".into(),
            ..Default::default()
        };
        let code_2 = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "ABS(A2)".into(),
            ..Default::default()
        };
        let (mut grid, sheet_id) =
            test_setup(&selected, &[], &[], &[], &[code_1.clone(), code_2.clone()]);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        assert_code_cell_value(&grid, sheet_id, 1, 1, "SUM(A1)");
        assert_code_cell_value(&grid, sheet_id, 10, 1, "SUM(J1)");
        assert_code_cell_value(&grid, sheet_id, 1, 9, "SUM(A9)");
        assert_code_cell_value(&grid, sheet_id, 1, 2, "ABS(A2)");
        assert_code_cell_value(&grid, sheet_id, 10, 2, "ABS(J2)");
        assert_code_cell_value(&grid, sheet_id, 2, 10, "ABS(B10)");
    }

    #[test]
    fn test_expand_formula_with_display_values() {
        // Test case: data in A2:A5 of 1,2,3,4. Formula in C2 of SUM(A2:A3).
        // Expand it to C2:D5. Check code values and cell values in new cells.
        let mut grid = GridController::test();
        let sheet_id = grid.sheet_ids()[0];

        // Set up source data: A2=1, A3=2, A4=3, A5=4
        for row in 2..=5 {
            grid.set_cell_value(
                SheetPos {
                    x: 1,
                    y: row,
                    sheet_id,
                },
                (row - 1).to_string(),
                None,
                false,
            );
        }

        // Create a formula in C2: SUM(A2:A3)
        grid.set_code_cell(
            SheetPos {
                x: 3,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "SUM(A2:A3)".to_string(),
            None,
            None,
            false,
        );

        // Check the initial formula works: SUM(1, 2) = 3
        assert_code_cell_value(&grid, sheet_id, 3, 2, "SUM(A2:A3)");
        assert_display_cell_value(&grid, sheet_id, 3, 2, "3");

        // Autocomplete the formula from C2 to C2:D5
        let selected = Rect::test_a1("C2");
        let range = Rect::test_a1("C2:D5");
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        // Check that formulas are correct
        // Column C (x=3): formulas should adjust row references
        assert_code_cell_value(&grid, sheet_id, 3, 2, "SUM(A2:A3)");
        assert_code_cell_value(&grid, sheet_id, 3, 3, "SUM(A3:A4)");
        assert_code_cell_value(&grid, sheet_id, 3, 4, "SUM(A4:A5)");
        assert_code_cell_value(&grid, sheet_id, 3, 5, "SUM(A5:A6)");

        // Column D (x=4): formulas should adjust both row and column references
        assert_code_cell_value(&grid, sheet_id, 4, 2, "SUM(B2:B3)");
        assert_code_cell_value(&grid, sheet_id, 4, 3, "SUM(B3:B4)");
        assert_code_cell_value(&grid, sheet_id, 4, 4, "SUM(B4:B5)");
        assert_code_cell_value(&grid, sheet_id, 4, 5, "SUM(B5:B6)");

        // Check that display values are correct (the computed results)
        // Column C: SUM(A2:A3)=3, SUM(A3:A4)=5, SUM(A4:A5)=7, SUM(A5:A6)=4 (A6 is empty=0)
        assert_display_cell_value(&grid, sheet_id, 3, 2, "3"); // SUM(1,2) = 3
        assert_display_cell_value(&grid, sheet_id, 3, 3, "5"); // SUM(2,3) = 5
        assert_display_cell_value(&grid, sheet_id, 3, 4, "7"); // SUM(3,4) = 7
        assert_display_cell_value(&grid, sheet_id, 3, 5, "4"); // SUM(4,0) = 4

        // Column D: B column is empty, so all sums should be 0
        assert_display_cell_value(&grid, sheet_id, 4, 2, "0");
        assert_display_cell_value(&grid, sheet_id, 4, 3, "0");
        assert_display_cell_value(&grid, sheet_id, 4, 4, "0");
        assert_display_cell_value(&grid, sheet_id, 4, 5, "0");
    }

    #[test]
    fn test_expand_left_only() {
        let selected: Rect = Rect::new_span(Pos { x: 12, y: 11 }, Pos { x: 15, y: 12 });
        let range: Rect = Rect::new_span(Pos { x: 7, y: 11 }, Pos { x: 15, y: 12 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: 7, y: 11 }, Pos { x: 15, y: 12 }),
        );

        let expected = vec!["g", "a", "h", "x", "g", "a", "h", "x", "g"];
        let expected_bold = vec![true, true, false, false, true, true, false, false, true];
        assert_cell_value_row(&grid, sheet_id, 7, 15, 11, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 7, 15, 11, expected_bold.clone());

        let expected = vec!["b", "f", "z", "r", "b", "f", "z", "r", "b"];
        let expected_bold = vec![false, false, true, true, false, false, true, true, false];
        assert_cell_format_bold_row(&grid, sheet_id, 7, 15, 12, expected_bold);
        assert_cell_value_row(&grid, sheet_id, 7, 15, 12, expected);
    }

    #[test]
    fn test_expand_right_only() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 10, y: 2 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);

        print_table_from_grid(&grid, sheet_id, range);

        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

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
        let selected: Rect = Rect::new_span(Pos { x: 12, y: 11 }, Pos { x: 15, y: 12 });
        let range: Rect = Rect::new_span(Pos { x: 12, y: 3 }, Pos { x: 15, y: 12 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

        let expected = vec!["a", "h", "x", "g"];
        let expected_bold = vec![true, false, false, true];
        assert_cell_value_row(&grid, sheet_id, 12, 15, 3, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 12, 15, 3, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 12, 15, 5, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 12, 15, 5, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 12, 15, 11, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 12, 15, 11, expected_bold.clone());

        let expected = vec!["f", "z", "r", "b"];
        let expected_bold = vec![false, true, true, false];
        assert_cell_format_bold_row(&grid, sheet_id, 12, 15, 4, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 12, 15, 4, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 12, 15, 6, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 12, 15, 6, expected.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 12, 15, 10, expected_bold.clone());
        assert_cell_value_row(&grid, sheet_id, 12, 15, 10, expected.clone());
    }

    #[test]
    fn test_expand_down_only() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

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
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

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
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors, &[]);
        let range: Rect = Rect::new_span(selected.min, Pos { x: 7, y: 6 });
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 9, y: 8 });
        print_table_from_grid(&grid, sheet_id, range_over);

        let expected = vec!["white", "red", "blue", "green", "white", "red"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 4, expected);
        let expected = vec!["yellow", "white", "red", "blue", "yellow", "white"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 5, expected);
        let expected = vec!["white", "red", "blue", "green", "white", "red"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 6, expected);

        // up + right
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors, &[]);
        let range: Rect = Rect::new_span(Pos { x: 2, y: -1 }, Pos { x: 7, y: 3 });
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: 0, y: -3 }, Pos { x: 9, y: 5 });
        print_table_from_grid(&grid, sheet_id, range_over);

        let expected = vec!["yellow", "white", "red", "blue", "yellow", "white"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 1, expected);
        let expected = vec!["white", "red", "blue", "green", "white", "red"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 2, expected);
        let expected = vec!["yellow", "white", "red", "blue", "yellow", "white"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 2, 7, 3, expected);

        // down + left
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors, &[]);
        let range: Rect = Rect::new_span(Pos { x: 1, y: 6 }, selected.max);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 7, y: 8 });
        print_table_from_grid(&grid, sheet_id, range_over);

        let expected = vec!["green", "white", "red", "blue", "green"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 4, expected);
        let expected = vec!["blue", "yellow", "white", "red", "blue"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 5, expected);
        let expected = vec!["green", "white", "red", "blue", "green"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 6, expected);

        // up + left
        let (mut grid, sheet_id) = test_setup(&selected, &vals, &[], &fill_colors, &[]);
        let range: Rect = Rect::new_span(Pos { x: 1, y: -1 }, selected.max);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();
        let range_over: Rect = Rect::new_span(Pos { x: -1, y: -3 }, Pos { x: 7, y: 5 });
        print_table_from_grid(&grid, sheet_id, range_over);

        let expected = vec!["blue", "yellow", "white", "red", "blue"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 1, expected);
        let expected = vec!["green", "white", "red", "blue", "green"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 2, expected);
        let expected = vec!["blue", "yellow", "white", "red", "blue"];
        assert_cell_format_cell_fill_color_row(&grid, sheet_id, 1, 5, 3, expected);
    }

    #[test]
    fn test_expand_up_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 12, y: 12 }, Pos { x: 15, y: 13 });
        let range: Rect = Rect::new_span(Pos { x: 12, y: 3 }, Pos { x: 20, y: 13 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: 12, y: 13 }, Pos { x: 20, y: 3 }),
        );

        let expected = vec!["f", "z", "r", "b", "f", "z", "r", "b", "f"];
        let expected_bold = vec![false, true, true, false, false, true, true, false, false];

        assert_cell_value_row(&grid, sheet_id, 12, 20, 3, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 12, 20, 13, expected);
        assert_cell_format_bold_row(&grid, sheet_id, 12, 20, 3, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 12, 20, 13, expected_bold);
    }

    #[test]
    fn test_expand_down_and_left() {
        let selected: Rect = Rect::new_span(Pos { x: 12, y: 12 }, Pos { x: 15, y: 13 });
        let range: Rect = Rect::new_span(Pos { x: 3, y: 30 }, Pos { x: 15, y: 20 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(
            &grid,
            sheet_id,
            Rect::new_span(Pos { x: 3, y: 12 }, Pos { x: 15, y: 20 }),
        );

        let expected = vec![
            "g", "a", "h", "x", "g", "a", "h", "x", "g", "a", "h", "x", "g",
        ];
        let expected_bold = vec![
            true, true, false, false, true, true, false, false, true, true, false, false, true,
        ];

        assert_cell_value_row(&grid, sheet_id, 3, 15, 12, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 3, 15, 20, expected);
        assert_cell_format_bold_row(&grid, sheet_id, 3, 15, 12, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 3, 15, 20, expected_bold);
    }

    #[test]
    fn test_expand_up_and_left() {
        let selected: Rect = Rect::new_span(Pos { x: 12, y: 12 }, Pos { x: 15, y: 13 });
        let range: Rect = Rect::new_span(Pos { x: 3, y: 3 }, selected.max);
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, Rect::new_span(range.min, selected.max));

        let expected = vec![
            "b", "f", "z", "r", "b", "f", "z", "r", "b", "f", "z", "r", "b",
        ];
        let expected_bold = vec![
            false, false, true, true, false, false, true, true, false, false, true, true, false,
        ];

        assert_cell_value_row(&grid, sheet_id, 3, 15, 3, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 3, 15, 13, expected);
        assert_cell_format_bold_row(&grid, sheet_id, 3, 15, 3, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 3, 15, 13, expected_bold);
    }

    #[test]
    fn test_expand_horizontal_series_down_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 9, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect_horiz_series(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

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
        let range: Rect = Rect::new_span(Pos { x: 6, y: 12 }, Pos { x: 13, y: 19 });
        let (mut grid, sheet_id) = test_setup_rect_horiz_series(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

        let expected = vec!["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];
        assert_cell_value_row(&grid, sheet_id, 6, 13, 12, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 6, 13, 17, expected);

        let expected = vec!["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        assert_cell_value_row(&grid, sheet_id, 6, 13, 13, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 6, 13, 18, expected.clone());

        let expected = vec!["32", "64", "128", "256", "512", "1024", "2048", "4096"];
        assert_cell_value_row(&grid, sheet_id, 6, 13, 14, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 6, 13, 19, expected.clone());

        let expected = vec!["8", "9", "10", "11", "12", "13", "14", "15"];
        assert_cell_value_row(&grid, sheet_id, 6, 13, 15, expected.clone());

        let expected = vec!["10", "9", "8", "7", "6", "5", "4", "3"];
        assert_cell_value_row(&grid, sheet_id, 6, 13, 16, expected.clone());
    }

    #[test]
    fn test_expand_horizontal_series_up_and_left() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        let range: Rect = Rect::new_span(Pos { x: -4, y: -8 }, Pos { x: 5, y: 6 });
        let (mut grid, sheet_id) = test_setup_rect_horiz_series(&selected);
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

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
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

        assert_display_cell_value(&grid, sheet_id, 3, 5, "4");
        assert_display_cell_value(&grid, sheet_id, 3, 6, "5");
        assert_display_cell_value(&grid, sheet_id, 3, 7, "6");
    }

    #[test]
    fn test_shrink_width() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 7 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);

        // first, fully expand
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 4, y: 7 });
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(
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
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 5 });
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(
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
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 5 });
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(
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

        let result = grid.autocomplete(SheetId::new(), selected, range, None, false);
        assert!(result.is_err());
    }

    #[test]
    fn expand_right_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::from_rect(SheetRect::new(1, 1, 3, 3, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.autocomplete(
            sheet_id,
            Rect::new(1, 1, 3, 3),
            Rect::new(1, 1, 5, 3),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);

        assert_eq!(sheet.borders.finite_bounds(), Some(Rect::new(1, 1, 5, 3)));
    }

    #[test]
    fn test_expand_left_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("C1:F1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.autocomplete(
            sheet_id,
            Rect::test_a1("C1:F1"),
            Rect::test_a1("A1:F1"),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);

        assert_eq!(sheet.borders.finite_bounds(), Some(Rect::test_a1("A1:F1")));
    }

    #[test]
    fn test_expand_up_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A3:A6"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.autocomplete(
            sheet_id,
            Rect::test_a1("A3:A6"),
            Rect::test_a1("A1:A6"),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);

        assert_eq!(sheet.borders.finite_bounds(), Some(Rect::test_a1("A1:A6")));
    }

    #[test]
    fn test_expand_down_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:A3"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.autocomplete(
            sheet_id,
            Rect::test_a1("A1:A3"),
            Rect::test_a1("A1:A5"),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.finite_bounds(), Some(Rect::test_a1("A1:A5")));
    }

    #[test]
    fn autocomplete_update_code_cell_references_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos = pos![C3];
        let sheet_pos = pos.to_sheet_pos(sheet_id);
        let set_code_cell = |gc: &mut GridController, code: &str| {
            gc.set_code_cell(
                sheet_pos,
                CodeCellLanguage::Python,
                code.to_string(),
                None,
                None,
                false,
            );
        };
        let autocomplete = |gc: &mut GridController| {
            gc.autocomplete(
                sheet_id,
                Rect::new(3, 3, 3, 4),
                Rect::new(3, 3, 4, 4),
                None,
                false,
            )
            .unwrap();
        };

        // relative references, expect to increment by 1
        let base = r#"q.cells("A1:B2", first_row_header=True)"#;
        set_code_cell(&mut gc, base);
        autocomplete(&mut gc);
        let expected = r#"q.cells("B1:C2", first_row_header=True)"#;
        assert_code_language(
            &gc,
            pos![sheet_id!D3],
            CodeCellLanguage::Python,
            expected.to_string(),
        );

        // start over
        gc.undo(2, None, false);

        // absolute column references, expect no change
        let base = r#"q.cells("$A:$B", first_row_header=True)"#;
        set_code_cell(&mut gc, base);
        autocomplete(&mut gc);
        assert_code_language(
            &gc,
            pos![sheet_id!D3],
            CodeCellLanguage::Python,
            base.to_string(),
        );

        // start over
        gc.undo(2, None, false);

        println!("** relative column references, expect no change");

        // relative column references, expect no change
        let base = r#"q.cells("A:B", first_row_header=True)"#;
        set_code_cell(&mut gc, base);
        autocomplete(&mut gc);
        assert_code_language(
            &gc,
            pos![sheet_id!D3],
            CodeCellLanguage::Python,
            base.to_string(),
        );
    }

    #[test]
    fn autocomplete_update_code_cell_references_javascript() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![sheet_id!C4],
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1:B2");"#.to_string(),
            None,
            None,
            false,
        );

        gc.autocomplete(
            sheet_id,
            Rect::new(3, 3, 3, 4),
            Rect::new(3, 3, 4, 4),
            None,
            false,
        )
        .unwrap();

        assert_code_language(
            &gc,
            pos![sheet_id!D4],
            CodeCellLanguage::Javascript,
            r#"return q.cells("B1:C2");"#.to_string(),
        );
    }

    #[test]
    fn test_expand_down_and_right_in_and_outside_of_data_table() {
        let (mut grid, sheet_id, _, _) = simple_csv();
        let pos = pos![A3];
        let selected: Rect = Rect::new_span(pos, pos);
        let range: Rect = Rect::new_span(selected.min, Pos { x: 6, y: 14 });
        grid.autocomplete(sheet_id, selected, range, None, false)
            .unwrap();

        print_table_from_grid(&grid, sheet_id, range);

        let expected = vec![
            "Southborough",
            "Southborough",
            "Southborough",
            "Southborough",
            "Southborough",
            "Southborough",
        ];

        // validate rows 4-14
        // data table is in rows 1 - 12, 4 columns wide
        // autocomplete expanded beyond the data table: right 2 columns, down 2 rows
        for y in 4..=14 {
            assert_cell_value_row(&grid, sheet_id, 1, 6, y, expected.clone());
        }
    }

    #[test]
    fn test_autocomplete_preserves_data_table_properties() {
        // Test that autocomplete preserves data table properties like
        // show_name, alternating_colors, etc.
        // Note: 1x1 formulas are stored as CellValue::Code, so we use a multi-cell
        // array formula to test DataTable property preservation.
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a formula code cell with multi-cell output (1x2 array)
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "{1;2}".to_string(), // 1x2 array output
            None,
            None,
            false,
        );

        // Customize the data table properties
        let sheet = gc.sheet_mut(sheet_id);
        let (data_table, _) = sheet
            .data_tables
            .modify_data_table_at(&pos![A1], |dt| {
                dt.show_name = Some(false);
                dt.alternating_colors = false;
                Ok(())
            })
            .unwrap();

        // Verify original properties are set
        assert_eq!(data_table.show_name, Some(false));
        assert!(!data_table.alternating_colors);

        // Autocomplete the formula to B1
        gc.autocomplete(
            sheet_id,
            Rect::test_a1("A1:A2"),
            Rect::test_a1("A1:B2"),
            None,
            false,
        )
        .unwrap();

        // Verify the autocompleted cell has the same properties
        let sheet = gc.sheet(sheet_id);
        let autocompleted_dt = sheet.data_table_at(&pos![B1]).unwrap();

        assert_eq!(
            autocompleted_dt.show_name,
            Some(false),
            "show_name should be preserved during autocomplete"
        );
        assert!(
            !autocompleted_dt.alternating_colors,
            "alternating_colors should be preserved during autocomplete"
        );

        // Also verify the formula was correctly adjusted
        let code_run = autocompleted_dt.code_run().unwrap();
        assert_eq!(code_run.code, "{1;2}"); // Formula doesn't have references to adjust
    }

    #[test]
    fn test_autocomplete_preserves_python_data_table_properties() {
        // Test that autocomplete preserves data table properties for Python cells
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a Python code cell
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Python,
            "q.cells('B1')".to_string(),
            None,
            None,
            false,
        );

        // Customize the data table properties
        let sheet = gc.sheet_mut(sheet_id);
        let (data_table, _) = sheet
            .data_tables
            .modify_data_table_at(&pos![A1], |dt| {
                dt.show_name = Some(false);
                dt.show_columns = Some(false);
                dt.alternating_colors = false;
                Ok(())
            })
            .unwrap();

        // Verify original properties are set
        assert_eq!(data_table.show_name, Some(false));
        assert_eq!(data_table.show_columns, Some(false));
        assert!(!data_table.alternating_colors);

        // Autocomplete the Python cell to B1
        gc.autocomplete(
            sheet_id,
            Rect::test_a1("A1"),
            Rect::test_a1("A1:B1"),
            None,
            false,
        )
        .unwrap();

        // Verify the autocompleted cell has the same properties
        let sheet = gc.sheet(sheet_id);
        let autocompleted_dt = sheet.data_table_at(&pos![B1]).unwrap();

        assert_eq!(
            autocompleted_dt.show_name,
            Some(false),
            "show_name should be preserved during Python autocomplete"
        );
        assert_eq!(
            autocompleted_dt.show_columns,
            Some(false),
            "show_columns should be preserved during Python autocomplete"
        );
        assert!(
            !autocompleted_dt.alternating_colors,
            "alternating_colors should be preserved during Python autocomplete"
        );

        // Verify the code reference was adjusted (quotes may change to double quotes)
        let code_run = autocompleted_dt.code_run().unwrap();
        assert_eq!(code_run.code, r#"q.cells("C1")"#);
    }

    #[test]
    fn test_autocomplete_preserves_javascript_data_table_properties() {
        // Test that autocomplete preserves data table properties for JavaScript cells
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a JavaScript code cell
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Javascript,
            r#"return q.cells("B1");"#.to_string(),
            None,
            None,
            false,
        );

        // Customize the data table properties
        let sheet = gc.sheet_mut(sheet_id);
        let (data_table, _) = sheet
            .data_tables
            .modify_data_table_at(&pos![A1], |dt| {
                dt.show_name = Some(false);
                dt.show_columns = Some(false);
                dt.alternating_colors = false;
                Ok(())
            })
            .unwrap();

        // Verify original properties are set
        assert_eq!(data_table.show_name, Some(false));
        assert_eq!(data_table.show_columns, Some(false));
        assert!(!data_table.alternating_colors);

        // Autocomplete the JavaScript cell to B1
        gc.autocomplete(
            sheet_id,
            Rect::test_a1("A1"),
            Rect::test_a1("A1:B1"),
            None,
            false,
        )
        .unwrap();

        // Verify the autocompleted cell has the same properties
        let sheet = gc.sheet(sheet_id);
        let autocompleted_dt = sheet.data_table_at(&pos![B1]).unwrap();

        assert_eq!(
            autocompleted_dt.show_name,
            Some(false),
            "show_name should be preserved during JavaScript autocomplete"
        );
        assert_eq!(
            autocompleted_dt.show_columns,
            Some(false),
            "show_columns should be preserved during JavaScript autocomplete"
        );
        assert!(
            !autocompleted_dt.alternating_colors,
            "alternating_colors should be preserved during JavaScript autocomplete"
        );

        // Verify the code reference was adjusted
        let code_run = autocompleted_dt.code_run().unwrap();
        assert_eq!(code_run.code, r#"return q.cells("C1");"#);
    }

    #[test]
    fn test_autocomplete_cell_value_code() {
        // Test that CellValue::Code cells (1x1 formulas) are properly autocompleted
        // with adjusted references instead of just copying display values
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up some source data
        gc.set_cell_value(pos![sheet_id!A1], "10".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "20".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "100".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!B2], "200".to_string(), None, false);

        // Create a 1x1 formula at C1 which should be stored as CellValue::Code
        gc.set_code_cell(
            pos![sheet_id!C1],
            CodeCellLanguage::Formula,
            "A1+1".to_string(),
            None,
            None,
            false,
        );

        // Verify it's stored as CellValue::Code (not a DataTable)
        let sheet = gc.sheet(sheet_id);
        assert!(
            matches!(sheet.cell_value_ref(pos![C1]), Some(CellValue::Code(_))),
            "1x1 formula should be stored as CellValue::Code"
        );

        // Verify there's no DataTable at C1
        assert!(
            sheet.data_table_at(&pos![C1]).is_none(),
            "There should be no DataTable for a 1x1 formula"
        );

        // Autocomplete C1 to C1:D2
        gc.autocomplete(
            sheet_id,
            Rect::test_a1("C1"),
            Rect::test_a1("C1:D2"),
            None,
            false,
        )
        .unwrap();

        // Verify all positions have code cells with adjusted references
        assert_code_cell_value(&gc, sheet_id, 3, 1, "A1+1"); // C1 - original
        assert_code_cell_value(&gc, sheet_id, 4, 1, "B1+1"); // D1 - column shifted
        assert_code_cell_value(&gc, sheet_id, 3, 2, "A2+1"); // C2 - row shifted
        assert_code_cell_value(&gc, sheet_id, 4, 2, "B2+1"); // D2 - both shifted

        // Verify the display values are computed correctly
        assert_display_cell_value(&gc, sheet_id, 3, 1, "11"); // A1(10)+1 = 11
        assert_display_cell_value(&gc, sheet_id, 4, 1, "101"); // B1(100)+1 = 101
        assert_display_cell_value(&gc, sheet_id, 3, 2, "21"); // A2(20)+1 = 21
        assert_display_cell_value(&gc, sheet_id, 4, 2, "201"); // B2(200)+1 = 201
    }

    #[test]
    fn test_autocomplete_cell_value_code_mixed_with_values() {
        // Test that CellValue::Code cells work alongside regular values in autocomplete
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set up source data in columns D, E (far from the autocomplete area)
        gc.set_cell_value(pos![sheet_id!D2], "5".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!E2], "10".to_string(), None, false);

        // A1 has a regular value, A2 has a 1x1 formula (CellValue::Code)
        gc.set_cell_value(pos![sheet_id!A1], "Hello".to_string(), None, false);
        gc.set_code_cell(
            pos![sheet_id!A2],
            CodeCellLanguage::Formula,
            "D2*2".to_string(),
            None,
            None,
            false,
        );

        // Autocomplete A1:A2 to A1:B2
        gc.autocomplete(
            sheet_id,
            Rect::test_a1("A1:A2"),
            Rect::test_a1("A1:B2"),
            None,
            false,
        )
        .unwrap();

        // A1 and B1 should have regular values (autocompleted)
        assert_display_cell_value(&gc, sheet_id, 1, 1, "Hello");
        assert_display_cell_value(&gc, sheet_id, 2, 1, "Hello");

        // A2 should still be the original formula
        assert_code_cell_value(&gc, sheet_id, 1, 2, "D2*2");
        assert_display_cell_value(&gc, sheet_id, 1, 2, "10"); // D2(5)*2 = 10

        // B2 should be an autocompleted formula with adjusted reference
        assert_code_cell_value(&gc, sheet_id, 2, 2, "E2*2");
        assert_display_cell_value(&gc, sheet_id, 2, 2, "20"); // E2(10)*2 = 20
    }
}
