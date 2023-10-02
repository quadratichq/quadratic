use anyhow::{anyhow, Result};
use itertools::Itertools;

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

#[derive(PartialEq)]
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
        mut selection: Rect,
        range: Rect,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let mut operations = vec![];
        let mut initial_down_range: Option<Rect> = None;
        let mut initial_up_range: Option<Rect> = None;

        let should_expand_up = range.min.y < selection.min.y;
        let should_expand_down = range.max.y > selection.max.y;
        let should_expand_left = range.min.x < selection.min.x;
        let should_expand_right = range.max.x > selection.max.x;

        let should_shrink_width = range.max.x < selection.max.x;
        let should_shrink_height = range.max.y < selection.max.y;

        // shrink width, from right to left
        if should_shrink_width {
            let delete_range = Rect::new_span(
                (range.max.x + 1, range.min.y).into(),
                (selection.max.x, selection.max.y).into(),
            );
            let ops = self.shrink(sheet_id, delete_range);
            operations.extend(ops);
            selection.max.x = range.max.x;
        }

        // shrink height, from bottom to top
        if should_shrink_height {
            let delete_range = Rect::new_span(
                (selection.min.x, range.max.y + 1).into(),
                (range.max.x, selection.max.y).into(),
            );
            let ops = self.shrink(sheet_id, delete_range);
            operations.extend(ops);
            selection.max.y = range.max.y;
        }

        // expand up
        if should_expand_up {
            let new_range = Rect::new_span(
                (selection.min.x, selection.min.y - 1).into(),
                (selection.max.x, range.min.y).into(),
            );
            let ops = self.expand_up(sheet_id, &selection, &new_range)?;
            operations.extend(ops);
            initial_up_range = Some(range);
        }

        // expand down
        if should_expand_down {
            let new_range = Rect::new_span(
                (selection.min.x, selection.max.y + 1).into(),
                (selection.max.x, range.max.y).into(),
            );
            let ops = self.expand_down(sheet_id, &selection, &new_range)?;
            operations.extend(ops);
            initial_down_range = Some(range);
        }
        // expand left
        if should_expand_left {
            let new_range = Rect::new_span(
                (range.min.x, selection.min.y).into(),
                (selection.min.x - 1, selection.max.y).into(),
            );

            let down_range = initial_down_range.map(|initial_down_range| {
                Rect::new_span(
                    (initial_down_range.min.x, selection.max.y + 1).into(),
                    (selection.min.x - 1, initial_down_range.max.y).into(),
                )
            });

            let up_range = initial_up_range.map(|initial_up_range| {
                Rect::new_span(
                    initial_up_range.min,
                    (selection.min.x - 1, initial_up_range.max.y).into(),
                )
            });

            let ops = self.expand_left(sheet_id, &selection, &new_range, down_range, up_range)?;
            operations.extend(ops);
        }

        // expand right
        if should_expand_right {
            let new_range = Rect::new_span(
                (selection.max.x + 1, selection.max.y).into(),
                (range.max.x, selection.max.y).into(),
            );

            let down_range = initial_down_range.map(|initial_down_range| {
                Rect::new_span(
                    (selection.max.x + 1, selection.max.y + 1).into(),
                    initial_down_range.max,
                )
            });

            let up_range = initial_up_range.map(|initial_up_range| {
                Rect::new_span(
                    (selection.max.x + 1, initial_up_range.min.y).into(),
                    (initial_up_range.max.x, selection.min.y - 1).into(),
                )
            });

            let ops = self.expand_right(sheet_id, &selection, &new_range, down_range, up_range)?;
            operations.extend(ops);
        }

        Ok(self.transact_forward(operations, cursor))
    }

    /// Delete cell values and formats in a given range.
    pub fn shrink(&mut self, sheet_id: SheetId, delete_range: Rect) -> Vec<Operation> {
        let mut ops = vec![];

        ops.extend(self.delete_cell_values_operations(sheet_id, delete_range));
        ops.extend(self.clear_formatting_operations(sheet_id, delete_range));
        ops
    }

    pub fn expand_right(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        down_range: Option<Rect>,
        up_range: Option<Rect>,
    ) -> Result<Vec<Operation>> {
        let mut format_ops = vec![];
        let mut values = vec![];
        let mut formats = vec![];
        let mut ops = selection
            .y_range()
            .map(|y| {
                let source_row =
                    Rect::new_span((selection.min.x, y).into(), (selection.max.x, y).into());
                let target_row = Rect::new_span((range.min.x, y).into(), (range.max.x, y).into());
                let format = self.get_all_cell_formats(sheet_id, source_row);
                let width = selection.width() as usize;

                // for each column, apply the formats to a block (selection.width, y) of new cells
                range.x_range().step_by(width).for_each(|x| {
                    let new_x = x + width as i64 - 1;
                    let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                    format_ops.extend(apply_formats(self.region(sheet_id, format_rect), &format));
                });

                formats.push(format);
                let (operations, cell_values) =
                    self.apply_auto_complete(sheet_id, false, &source_row, &target_row, None)?;
                values.extend(cell_values);

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        if let Some(down_range) = down_range {
            ops.extend(self.expand_up_or_down_from_right(
                sheet_id,
                selection,
                &down_range,
                &values,
                range.width() as i64,
                ExpandDirection::Down,
            )?);
        }

        if let Some(up_range) = up_range {
            ops.extend(self.expand_up_or_down_from_right(
                sheet_id,
                selection,
                &up_range,
                &values,
                range.width() as i64,
                ExpandDirection::Up,
            )?);
        }

        ops.extend(format_ops);
        Ok(ops)
    }

    pub fn expand_left(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        down_range: Option<Rect>,
        up_range: Option<Rect>,
    ) -> Result<Vec<Operation>> {
        let mut format_ops = vec![];
        let mut values = vec![];
        let mut formats = vec![];
        let mut ops = selection
            .y_range()
            .map(|y| {
                let source_row =
                    Rect::new_span((selection.min.x, y).into(), (selection.max.x, y).into());
                let target_row = Rect::new_span((range.min.x, y).into(), (range.max.x, y).into());
                let format = self.get_all_cell_formats(sheet_id, source_row);
                let width = selection.width() as usize;

                // for each column, apply the formats to a block (selection.width, y) of new cells
                range.x_range().rev().step_by(width).for_each(|x| {
                    let new_x = x - width as i64 + 1;
                    let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                    format_ops.extend(apply_formats(self.region(sheet_id, format_rect), &format));
                });

                formats.extend(format);
                let (operations, cell_values) =
                    self.apply_auto_complete(sheet_id, true, &source_row, &target_row, None)?;
                values.extend(cell_values);

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        if let Some(down_range) = down_range {
            ops.extend(self.expand_up_or_down_from_left(
                sheet_id,
                selection,
                &down_range,
                &values,
                range.width() as i64,
                ExpandDirection::Down,
            )?);
        }

        if let Some(up_range) = up_range {
            ops.extend(self.expand_up_or_down_from_left(
                sheet_id,
                selection,
                &up_range,
                &values,
                range.width() as i64,
                ExpandDirection::Up,
            )?);
        }

        ops.extend(format_ops);
        Ok(ops)
    }

    pub fn expand_down(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        let mut format_ops = vec![];
        let mut values = vec![];
        let mut formats = vec![];
        let mut ops = selection
            .x_range()
            .rev()
            .map(|x| {
                let source_col =
                    Rect::new_span((x, selection.min.y).into(), (x, selection.max.y).into());
                let target_col =
                    Rect::new_span((x, selection.max.y + 1).into(), (x, range.max.y).into());
                let format = self.get_all_cell_formats(sheet_id, source_col);
                let height = selection.height() as usize;

                // for each row, apply the formats to a block (x, selection.height) of new cells
                range.y_range().step_by(height).for_each(|y| {
                    let new_y = y + height as i64 - 1;
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    format_ops.extend(apply_formats(self.region(sheet_id, format_rect), &format));
                });

                formats.extend(format);
                let (operations, cell_values) =
                    self.apply_auto_complete(sheet_id, false, &source_col, &target_col, None)?;
                values.extend(cell_values);

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        ops.extend(format_ops);
        Ok(ops)
    }

    pub fn expand_up(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        let mut format_ops = vec![];
        let mut values = vec![];
        let mut formats = vec![];
        let mut ops = selection
            .x_range()
            .map(|x| {
                let source_col =
                    Rect::new_span((x, selection.min.y).into(), (x, selection.max.y).into());
                let target_col =
                    Rect::new_span((x, selection.min.y - 1).into(), (x, range.min.y).into());
                let format = self.get_all_cell_formats(sheet_id, source_col);
                let height = selection.height() as usize;

                // for each row, apply the formats to a block (x, selection.height) of new cells
                range.y_range().rev().step_by(height).for_each(|y| {
                    let new_y = y - height as i64 + 1;
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    format_ops.extend(apply_formats(self.region(sheet_id, format_rect), &format));
                });

                formats.extend(format);
                let (operations, cell_values) =
                    self.apply_auto_complete(sheet_id, true, &source_col, &target_col, None)?;
                values.extend(cell_values);

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        ops.extend(format_ops);
        Ok(ops)
    }

    pub fn expand_up_or_down_from_right(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        values: &Vec<CellValue>,
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let mut format_ops = vec![];
        let height = values.len() as i64 / width;

        let mut ops = range
            .x_range()
            .enumerate()
            .map(|(index, x)| {
                let target_col = Rect::new_span((x, range.min.y).into(), (x, range.max.y).into());

                let vals = (0..height)
                    .map(|i| {
                        let array_index = (index as i64 + (i * width)) as usize;
                        values
                            .get(array_index)
                            .unwrap_or(&CellValue::Blank)
                            .to_owned()
                    })
                    .collect::<Vec<_>>();

                let format_x = selection.min.x + (x - selection.min.x) % selection.width() as i64;
                let format_source_rect = Rect::new_span(
                    (format_x, selection.min.y).into(),
                    (format_x, selection.max.y).into(),
                );
                let format = self.get_all_cell_formats(sheet_id, format_source_rect);

                range.y_range().step_by(height as usize).for_each(|y| {
                    let new_y = if direction == ExpandDirection::Down {
                        y + height - 1
                    } else {
                        y - height - 1
                    };
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    format_ops.extend(apply_formats(self.region(sheet_id, format_rect), &format));
                });

                let (operations, _) = self.apply_auto_complete(
                    sheet_id,
                    direction == ExpandDirection::Up,
                    &target_col,
                    &target_col,
                    Some(vals),
                )?;

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        ops.extend(format_ops);

        Ok(ops)
    }

    pub fn expand_up_or_down_from_left(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        values: &Vec<CellValue>,
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let mut format_ops = vec![];
        let height = values.len() as i64 / width;

        let mut ops = range
            .x_range()
            .rev()
            .enumerate()
            .map(|(index, x)| {
                let target_col = if direction == ExpandDirection::Down {
                    Rect::new_span((x, range.min.y).into(), (x, range.max.y).into())
                } else {
                    Rect::new_span((x, selection.min.y - 1).into(), (x, range.min.y).into())
                };

                let vals = (0..height)
                    .map(|i| {
                        let array_index = (i * width) + width - index as i64 - 1;
                        values
                            .get(array_index as usize)
                            .unwrap_or(&CellValue::Blank)
                            .to_owned()
                    })
                    .collect::<Vec<_>>();

                let format_x = selection.max.x - (index as i64 % selection.width() as i64);
                let format_source_rect = Rect::new_span(
                    (format_x, selection.min.y).into(),
                    (format_x, selection.max.y).into(),
                );
                let format = self.get_all_cell_formats(sheet_id, format_source_rect);

                range.y_range().step_by(height as usize).for_each(|y| {
                    let new_y = if direction == ExpandDirection::Down {
                        y + height - 1
                    } else {
                        y - height - 1
                    };
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    format_ops.extend(apply_formats(self.region(sheet_id, format_rect), &format));
                });

                let (operations, _) = self.apply_auto_complete(
                    sheet_id,
                    direction == ExpandDirection::Up,
                    &target_col,
                    &target_col,
                    Some(vals),
                )?;

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        ops.extend(format_ops);

        Ok(ops)
    }

    /// Gven an array of values, determine if a series exists and if so, apply it.
    pub fn apply_auto_complete(
        &mut self,
        sheet_id: SheetId,
        negative: bool,
        selection: &Rect,
        range: &Rect,
        cell_values: Option<Vec<CellValue>>,
    ) -> Result<(Vec<Operation>, Vec<CellValue>)> {
        let sheet = self.sheet(sheet_id);
        let values = if let Some(cell_values) = cell_values {
            cell_values
        } else {
            cell_values_in_rect(selection, sheet)?
                .into_cell_values_vec()
                .into_iter()
                .collect::<Vec<CellValue>>()
        };

        let series = find_auto_complete(SeriesOptions {
            series: values,
            spaces: (range.width() * range.height()) as i32,
            negative,
        });

        let array = Array::new_row_major(range.size(), series.to_owned().into())
            .map_err(|e| anyhow!("Could not create array of size {:?}: {:?}", range.size(), e))?;

        let ops = self.set_cells_operations(sheet_id, range.min, array);

        Ok((ops, series))
    }
}

/// Apply formats to a given region.
///
/// TODO(ddimaria): this funcion is sufficiently generic that it could be moved
/// TODO(ddimaria): we could remove the clones below by modifying the Operation
/// calls to accept references since they don't mutate the region.
pub fn apply_formats(region: RegionRef, formats: &[CellFmtArray]) -> Vec<Operation> {
    formats
        .iter()
        .map(|format| Operation::SetCellFormats {
            region: region.clone(),
            attr: format.clone(),
        })
        .collect()
}

/// In a given rect, collect all cell values into an array.
///
/// TODO(ddimaria): determine if this should go in the cell.rs file or equiv
/// TODO(ddimaria): is this necessary as it's more performant to just pluck the data from the sheet direclty
pub fn cell_values_in_rect(&selection: &Rect, sheet: &Sheet) -> Result<Array> {
    let values = selection
        .y_range()
        .flat_map(|y| {
            selection
                .x_range()
                .map(|x| {
                    sheet
                        .get_cell_value(Pos { x, y })
                        .unwrap_or_else(|| CellValue::Blank)
                })
                .collect::<Vec<CellValue>>()
        })
        .collect();

    Array::new_row_major(selection.size(), values).map_err(|e| {
        anyhow!(
            "Could not create array of size {:?}: {:?}",
            selection.size(),
            e
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        array,
        test_util::{
            assert_cell_format_bold_row, assert_cell_value, assert_cell_value_row, print_table,
        },
    };

    fn test_setup_rect(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec!["a", "h", "x", "g", "f", "z", "r", "b"];
        let bolds = vec![true, false, false, true, false, true, true, false];

        test_setup(selection, &vals, &bolds)
    }

    fn test_setup_rect_horiz_series(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec![
            "8", "9", "10", "11", "10", "9", "8", "7", "Mon", "Tue", "Wed", "Thu", "May", "Jun",
            "Jul", "Aug", "32", "64", "128", "256",
        ];
        let bolds = vec![];

        test_setup(selection, &vals, &bolds)
    }

    fn test_setup_rect_vert_series(selection: &Rect) -> (GridController, SheetId) {
        let vals = vec!["1", "2", "3"];
        let bolds = vec![];

        test_setup(selection, &vals, &bolds)
    }

    fn test_setup(selection: &Rect, vals: &[&str], bolds: &[bool]) -> (GridController, SheetId) {
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

        (grid_controller, sheet_id)
    }

    #[test]
    fn test_cell_values_in_rect() {
        let selected: Rect = Rect::new_span(Pos { x: -1, y: 0 }, Pos { x: 2, y: 1 });
        let (grid_controller, sheet_id) = test_setup_rect(&selected);
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let result = cell_values_in_rect(&selected, sheet).unwrap();
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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

        print_table(&grid, sheet_id, range);

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
        let range: Rect = Rect::new_span(Pos { x: 2, y: -7 }, Pos { x: 10, y: 3 });
        let (mut grid, sheet_id) = test_setup_rect(&selected);
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 4, y: 7 });
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 10, y: 5 });
        grid.expand(sheet_id, selected, range, None).unwrap();

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
        grid.expand(sheet_id, selected, range, None).unwrap();

        // then, shrink
        let selected = range;
        let range: Rect = Rect::new_span(Pos { x: 2, y: 2 }, Pos { x: 5, y: 5 });
        grid.expand(sheet_id, selected, range, None).unwrap();

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
}
