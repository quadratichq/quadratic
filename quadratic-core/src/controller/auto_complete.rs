use anyhow::{anyhow, Result};

use super::{
    formatting::CellFmtArray, operations::Operation, transactions::TransactionSummary,
    GridController,
};
use crate::{
    grid::{
        series::{find_auto_complete, SeriesOptions},
        RegionRef, Sheet, SheetId,
    },
    Array, CellValue, Pos, Rect,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExpandDirection {
    Up,
    Down,
    Left,
    Right,
}

impl GridController {
    pub fn expand(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        range: Rect,
        shrink_horizontal: Option<i64>,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let mut ops = vec![];

        // expand up
        if range.min.y < rect.min.y {
            let new_range = Rect::new_span(
                (rect.min.x, rect.min.y - 1).into(),
                (shrink_horizontal.unwrap_or(rect.max.x), range.min.y).into(),
            );

            ops.extend(self.expand_height(sheet_id, ExpandDirection::Up, &rect, &new_range)?);
        }

        // expand down
        if range.max.y > rect.max.y {
            let new_range = Rect::new_span(
                (rect.min.x, rect.max.y + 1).into(),
                (shrink_horizontal.unwrap_or(rect.max.x), range.max.y).into(),
            );

            ops.extend(self.expand_height(sheet_id, ExpandDirection::Down, &rect, &new_range)?);
        }

        // expand left
        if range.min.x < rect.min.x {
            let reverse = range.max.y < rect.max.y;
            let min_y = if !reverse { range.min.y } else { range.min.y };
            let max_y = if !reverse { range.max.y } else { rect.max.y };
            let new_range =
                Rect::new_span((rect.min.x - 1, min_y).into(), (range.min.x, max_y).into());

            ops.extend(self.expand_width(sheet_id, ExpandDirection::Left, &rect, &new_range)?);
        }

        // expand right
        if range.max.x > rect.max.x {
            let reverse = range.min.y < rect.min.y;
            let min_y = if !reverse { rect.min.y } else { rect.max.y };
            let max_y = if !reverse { range.max.y } else { range.min.y };
            let new_range =
                Rect::new_span((rect.max.x + 1, min_y).into(), (range.max.x, max_y).into());

            ops.extend(self.expand_width(sheet_id, ExpandDirection::Right, &rect, &new_range)?);
        }

        Ok(self.transact_forward(ops, cursor))
    }

    // Apply the block of formats below the selection in increments of the
    // selected rectangle (i.e. if the selection is 2 x 2 and the range is
    // to 10 height, apply 4 blocks of format).
    pub fn expand_height(
        &mut self,
        sheet_id: SheetId,
        direction: ExpandDirection,
        rect: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        // get all values in the rect to set all values in the range
        let mut format_ops = vec![];
        let negative = direction == ExpandDirection::Up;

        let mut ops = rect
            .x_range()
            .flat_map(|x| {
                let source_col = Rect::new_span((x, rect.min.y).into(), (x, rect.max.y).into());
                let target_col = if !negative {
                    Rect::new_span((x, rect.max.y + 1).into(), (x, range.max.y).into())
                } else {
                    Rect::new_span((x, rect.min.y - 1).into(), (x, range.min.y).into())
                };
                let formats = self.get_all_cell_formats(sheet_id, source_col);
                let height = rect.y_range().count();

                if !negative {
                    range.y_range().step_by(height).for_each(|y| {
                        let new_y = y + height as i64 - 1;
                        let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                        format_ops
                            .extend(apply_formats(self.region(sheet_id, format_rect), &formats));
                    });
                } else {
                    range.y_range().rev().step_by(height).for_each(|y| {
                        let new_y = y - height as i64 + 1;
                        let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                        format_ops
                            .extend(apply_formats(self.region(sheet_id, format_rect), &formats));
                    });
                }

                self.apply_values(sheet_id, negative, &source_col, &target_col)
            })
            .flatten()
            .collect::<Vec<_>>();

        ops.extend(format_ops);
        Ok(ops)
    }

    // Apply the column of formats to the right of the selection in
    // increments of the column (i.e. if the selection is 2 x 2 and
    // the range is to 10 wide, apply 4 columns of format).
    pub fn expand_width(
        &mut self,
        sheet_id: SheetId,
        direction: ExpandDirection,
        rect: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        // get all values in the rect to set all values in the range
        let mut format_ops = vec![];
        let negative = direction == ExpandDirection::Left;
        let reverse = range.min.y < rect.min.y;
        let height = rect.height() as i64;

        let mut ops = range
            .y_range()
            .rev()
            .flat_map(|y| {
                let new_y = if !reverse {
                    ((y - range.min.y + height) % height) + rect.min.y
                } else {
                    (y - rect.max.y - height) % height + rect.max.y
                };

                let source_row = if !reverse {
                    Rect::new_span((rect.min.x, new_y).into(), (rect.max.x, new_y).into())
                } else {
                    Rect::new_span((rect.min.x, new_y).into(), (rect.max.x, new_y).into())
                };

                let target_row = if !negative {
                    Rect::new_span((rect.max.x + 1, y).into(), (range.max.x, y).into())
                } else {
                    Rect::new_span((rect.min.x - 1, y).into(), (range.min.x, y).into())
                };

                let formats = self.get_all_cell_formats(sheet_id, source_row);
                let width = rect.x_range().count();

                if !negative {
                    range.x_range().step_by(width).for_each(|x| {
                        let new_x = x + width as i64 - 1;
                        let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                        format_ops
                            .extend(apply_formats(self.region(sheet_id, format_rect), &formats));
                    });
                } else {
                    // formats.reverse();
                    range.x_range().rev().step_by(width).for_each(|x| {
                        let new_x = x - width as i64 + 1;
                        let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                        format_ops
                            .extend(apply_formats(self.region(sheet_id, format_rect), &formats));
                    });
                }

                self.apply_values(sheet_id, negative, &source_row, &target_row)
            })
            .flatten()
            .collect::<Vec<_>>();

        ops.extend(format_ops);
        Ok(ops)
    }

    pub fn apply_values(
        &mut self,
        sheet_id: SheetId,
        negative: bool,
        rect: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        let sheet = self.sheet(sheet_id);
        let selection_values = cell_values_in_rect(&rect, &sheet)?;
        let series = find_auto_complete(SeriesOptions {
            series: selection_values
                .clone()
                .into_cell_values_vec()
                .into_iter()
                .collect::<Vec<CellValue>>(),
            spaces: (range.width() * range.height()) as i32,
            negative,
        });

        let array = Array::new_row_major(range.size(), series.into())
            .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", range.size(), e))?;

        Ok(self.set_cells_operations(sheet_id, range.min, array))
    }
}

/// Apply formats to a given region.
///
/// TODO(ddimaria): this funcion is sufficiently generic that it could be moved
/// TODO(ddimaria): we could remove the clones below by modifying the Operation
/// calls to accept references since they don't mutate the region.
pub fn apply_formats(region: RegionRef, formats: &Vec<CellFmtArray>) -> Vec<Operation> {
    formats
        .iter()
        .map(|format| Operation::SetCellFormats {
            region: region.clone(),
            attr: format.clone(),
        })
        .collect()
}

/// Add the cell values to an Array for the given Rect.
///
/// TODO(ddimaria): determine if this should go in the cell.rs file or equiv
/// TODO(ddimaria): is this necessary as it's more performant to just pluck the data from the sheet direclty
pub fn cell_values_in_rect(&rect: &Rect, sheet: &Sheet) -> Result<Array> {
    let values = rect
        .y_range()
        .map(|y| {
            rect.x_range()
                .map(|x| {
                    sheet
                        .get_cell_value(Pos { x, y })
                        .unwrap_or_else(|| CellValue::Blank)
                })
                .collect::<Vec<CellValue>>()
        })
        .flatten()
        .collect();

    Array::new_row_major(rect.size(), values)
        .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", rect.size(), e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        array,
        test_util::{assert_cell_format_bold_row, assert_cell_value_row, table},
    };

    fn test_setup_rect(rect: &Rect) -> (GridController, SheetId) {
        let vals = vec!["a", "h", "x", "g", "f", "z", "r", "b"];
        let bolds = vec![true, false, false, true, false, true, true, false];

        test_setup(rect, &vals, &bolds)
    }

    fn test_setup_rect_series(rect: &Rect) -> (GridController, SheetId) {
        let vals = vec![
            "8", "9", "10", "11", "10", "9", "8", "7", "Mon", "Tue", "Wed", "Thu", "May", "Jun",
            "Jul", "Aug", "32", "64", "128", "256",
        ];
        let bolds = vec![];

        test_setup(rect, &vals, &bolds)
    }

    fn test_setup(
        selection: &Rect,
        vals: &Vec<&str>,
        bolds: &Vec<bool>,
    ) -> (GridController, SheetId) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let mut count = 0;

        selection.y_range().for_each(|y| {
            selection.x_range().for_each(|x| {
                let pos = Pos { x, y };
                grid_controller.set_cell_value(sheet_id, pos, vals[count].to_string(), None);

                if let Some(is_bold) = bolds.get(count) {
                    if *is_bold {
                        grid_controller.set_cell_bold(
                            sheet_id,
                            Rect::single_pos(pos),
                            Some(true),
                            None,
                        );
                    }
                }

                count += 1;
            });
        });

        (grid_controller.clone(), sheet_id)
    }

    #[test]
    fn test_cell_values_in_rect() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (grid_controller, sheet_id) = test_setup_rect(&selected);
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let result = cell_values_in_rect(&selected, &sheet).unwrap();
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
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        table(grid.clone(), sheet_id, &range);

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
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        table(grid.clone(), sheet_id, &range);

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
        let range: Rect = Rect::new_span(Pos { x: 2, y: -7 }, Pos { x: 5, y: -7 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        table(grid.clone(), sheet_id, &range);

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
    fn test_expand_down_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(selected.min, Pos { x: 10, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        // table(grid.clone(), sheet_id, &range);

        let expected = vec!["a", "h", "x", "g", "a", "h", "x", "g", "a"];
        let expected_bold = vec![true, false, false, true, true, false, false, true, true];

        assert_cell_value_row(&grid, sheet_id, 2, 10, 2, expected.clone());
        assert_cell_value_row(&grid, sheet_id, 2, 10, 10, expected);
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 2, expected_bold.clone());
        assert_cell_format_bold_row(&grid, sheet_id, 2, 10, 10, expected_bold);
    }

    #[test]
    fn test_expand_up_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 3 });
        let range: Rect = Rect::new_span(selected.min, Pos { x: 10, y: -7 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        table(grid.clone(), sheet_id, &range);

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
        let range: Rect = Rect::new_span(selected.min, Pos { x: -7, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        table(grid.clone(), sheet_id, &range);

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
        let range: Rect = Rect::new_span(selected.min, Pos { x: -7, y: -7 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        // table(grid.clone(), sheet_id, &range);

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
    fn test_series_down_and_right() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 9, y: 10 });
        let (mut grid, sheet_id) = test_setup_rect_series(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        table(grid.clone(), sheet_id, &range);

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
    fn test_series_up_and_right() {
        // let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        // let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 9, y: 10 });
        // let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        // let range: Rect = Rect::new_span(Pos { x: -8, y: -8 }, Pos { x: 5, y: 6 });
        let selected: Rect = Rect::new_span(Pos { x: 6, y: 15 }, Pos { x: 9, y: 19 });
        let range: Rect = Rect::new_span(Pos { x: 6, y: 12 }, Pos { x: 15, y: 19 });
        let (mut grid, sheet_id) = test_setup_rect_series(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        // let range: Rect = Rect::new_span(selected.max, range.min);
        table(grid.clone(), sheet_id, &range);

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
    fn test_series_up_and_left() {
        // let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        // let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 9, y: 10 });
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 6 });
        let range: Rect = Rect::new_span(Pos { x: -4, y: -8 }, Pos { x: 5, y: 6 });
        let (mut grid, sheet_id) = test_setup_rect_series(&selected);
        grid.expand(sheet_id, selected, range, None, None).unwrap();

        // let range: Rect = Rect::new_span(selected.max, range.min);
        table(grid.clone(), sheet_id, &range);

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
}
