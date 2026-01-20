use crate::{
    CellValue, CodeCell, Pos, Rect, RefAdjust, SheetRect,
    a1::A1Selection,
    cell_values::CellValues,
    controller::GridController,
    grid::{
        SheetId,
        formats::SheetFormatUpdates,
        series::{SeriesOptions, find_auto_complete},
        sheet::borders::BordersUpdates,
    },
    util::maybe_reverse,
};
use anyhow::{Error, Result};
use itertools::Itertools;

use super::operation::Operation;

#[derive(PartialEq)]
pub enum ExpandDirection {
    Up,
    Down,
    Left,
    Right,
}

impl GridController {
    /// Extend and/or shrink the contents of initial_range to final_range by inferring patterns.
    ///
    /// initial_range: the range of cells to be expanded
    ///
    /// final_range: the range of cells to expand to
    ///
    /// cursor: the cursor position for the undo/redo stack
    #[function_timer::function_timer]
    pub fn autocomplete_operations(
        &mut self,
        sheet_id: SheetId,
        initial_range: Rect,
        final_range: Rect,
    ) -> Result<Vec<Operation>> {
        let mut initial_range = initial_range;
        let mut operations = vec![];
        let mut initial_down_range: Option<Rect> = None;
        let mut initial_up_range: Option<Rect> = None;

        let should_expand_up = final_range.min.y < initial_range.min.y;
        let should_expand_down = final_range.max.y > initial_range.max.y;
        let should_expand_left = final_range.min.x < initial_range.min.x;
        let should_expand_right = final_range.max.x > initial_range.max.x;

        let should_shrink_width = final_range.max.x < initial_range.max.x;
        let should_shrink_height = final_range.max.y < initial_range.max.y;

        // shrink width, from right to left
        if should_shrink_width {
            let delete_range = SheetRect::new_pos_span(
                (final_range.max.x + 1, final_range.min.y).into(),
                (initial_range.max.x, initial_range.max.y).into(),
                sheet_id,
            );
            let ops = self.shrink(delete_range);
            operations.extend(ops);
            initial_range.max.x = final_range.max.x;
        }

        // shrink height, from bottom to top
        if should_shrink_height {
            let delete_range = SheetRect::new_pos_span(
                (initial_range.min.x, final_range.max.y + 1).into(),
                (final_range.max.x, initial_range.max.y).into(),
                sheet_id,
            );
            let ops = self.shrink(delete_range);
            operations.extend(ops);
            initial_range.max.y = final_range.max.y;
        }

        // expand up
        if should_expand_up {
            let new_range = Rect::new_span(
                (initial_range.min.x, initial_range.min.y - 1).into(),
                (initial_range.max.x, final_range.min.y).into(),
            );
            let ops = self.expand_up(sheet_id, &initial_range, &new_range)?;
            operations.extend(ops);
            initial_up_range = Some(final_range);
        }

        // expand down
        if should_expand_down {
            let new_range = Rect::new_span(
                (initial_range.min.x, initial_range.max.y + 1).into(),
                (initial_range.max.x, final_range.max.y).into(),
            );
            let ops = self.expand_down(sheet_id, &initial_range, &new_range)?;
            operations.extend(ops);
            initial_down_range = Some(final_range);
        }

        // expand left
        if should_expand_left {
            let new_range = Rect::new_span(
                (final_range.min.x, initial_range.min.y).into(),
                (initial_range.min.x - 1, initial_range.max.y).into(),
            );

            let down_range = initial_down_range.map(|initial_down_range| {
                Rect::new_span(
                    (initial_down_range.min.x, initial_range.max.y + 1).into(),
                    (initial_range.min.x - 1, initial_down_range.max.y).into(),
                )
            });

            let up_range = initial_up_range.map(|initial_up_range| {
                Rect::new_span(
                    initial_up_range.min,
                    (initial_range.min.x - 1, initial_range.min.y - 1).into(),
                )
            });

            let ops =
                self.expand_left(sheet_id, &initial_range, &new_range, down_range, up_range)?;
            operations.extend(ops);
        }

        // expand right
        if should_expand_right {
            let new_range = Rect::new_span(
                (initial_range.max.x + 1, initial_range.max.y).into(),
                (final_range.max.x, initial_range.max.y).into(),
            );

            let down_range = initial_down_range.map(|initial_down_range| {
                Rect::new_span(
                    (initial_range.max.x + 1, initial_range.max.y + 1).into(),
                    initial_down_range.max,
                )
            });

            let up_range = initial_up_range.map(|initial_up_range| {
                Rect::new_span(
                    (initial_range.max.x + 1, initial_up_range.min.y).into(),
                    (initial_up_range.max.x, initial_range.min.y - 1).into(),
                )
            });

            let ops =
                self.expand_right(sheet_id, &initial_range, &new_range, down_range, up_range)?;
            operations.extend(ops);
        }

        Ok(operations)
    }

    /// Delete cell values and formats in a given range.
    fn shrink(&mut self, delete_rect: SheetRect) -> Vec<Operation> {
        let mut ops = vec![];
        let selection = A1Selection::from_rect(delete_rect);
        ops.extend(self.delete_cells_operations(&selection, false));
        // Skip RichText clearing because the cells are being deleted
        ops.extend(self.clear_format_borders_operations(&selection, false, true));
        ops
    }

    /// Expand the initial_range to the right
    ///
    /// initial_range is range of cells to be expanded
    /// final_range is the target range
    /// down_range is the range below the target range
    /// up_range is the range above the target range
    fn expand_right(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
        down_range: Option<Rect>,
        up_range: Option<Rect>,
    ) -> Result<Vec<Operation>> {
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();
        let mut values = vec![];

        let mut ops = initial_range
            .y_range()
            .map(|y| {
                // for each column, apply the formats to a block (initial_range.width, y) of new cells
                let width = initial_range.width() as usize;
                final_range.x_range().step_by(width).for_each(|x| {
                    let new_x = final_range.max.x.min(x + width as i64 - 1);
                    let start_pos = (initial_range.min.x, y).into();
                    let format_rect = Rect::new(x, y, new_x, y);
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);

                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_row = Rect::new(initial_range.min.x, y, initial_range.max.x, y);
                let target_row = Rect::new(final_range.min.x, y, final_range.max.x, y);
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
                initial_range,
                &down_range,
                &values,
                final_range.width() as i64,
                ExpandDirection::Down,
            )?);
        }

        if let Some(up_range) = up_range {
            ops.extend(self.expand_up_or_down_from_right(
                sheet_id,
                initial_range,
                &up_range,
                &values,
                final_range.width() as i64,
                ExpandDirection::Up,
            )?);
        }

        let formats_op = Operation::SetCellFormatsA1 { sheet_id, formats };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersA1 { sheet_id, borders };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_left(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
        down_range: Option<Rect>,
        up_range: Option<Rect>,
    ) -> Result<Vec<Operation>> {
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();
        let mut values = vec![];

        let mut ops = initial_range
            .y_range()
            .map(|y| {
                // for each column, apply the formats to a block (initial_range.width, y) of new cells
                let width = initial_range.width() as usize;
                final_range.x_range().rev().step_by(width).for_each(|x| {
                    let mut new_x = x - width as i64 + 1;
                    let start_pos: Pos = if new_x < final_range.min.x {
                        let start_pos = (initial_range.min.x + final_range.min.x - new_x, y).into();
                        new_x = final_range.min.x;
                        start_pos
                    } else {
                        (initial_range.min.x, y).into()
                    };
                    let format_rect = Rect::new(x, y, new_x, y);
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);
                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_row = Rect::new(initial_range.min.x, y, initial_range.max.x, y);
                let target_row = Rect::new(final_range.min.x, y, final_range.max.x, y);
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
                initial_range,
                &down_range,
                &values,
                final_range.width() as i64,
                ExpandDirection::Down,
            )?);
        }

        if let Some(up_range) = up_range {
            ops.extend(self.expand_up_or_down_from_left(
                sheet_id,
                initial_range,
                &up_range,
                &values,
                final_range.width() as i64,
                ExpandDirection::Up,
            )?);
        }

        let formats_op = Operation::SetCellFormatsA1 { sheet_id, formats };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersA1 { sheet_id, borders };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_down(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
    ) -> Result<Vec<Operation>> {
        let height = initial_range.height() as usize;
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let mut ops = initial_range
            .x_range()
            .rev()
            .map(|x| {
                // for each row, apply the formats to a block (x, initial_range.height) of new cells
                final_range.y_range().step_by(height).for_each(|y| {
                    let new_y = final_range.max.y.min(y + height as i64 - 1);
                    let start_pos = (x, initial_range.min.y).into();
                    let format_rect = Rect::new(x, y, x, new_y);
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);
                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_col = Rect::new(x, initial_range.min.y, x, initial_range.max.y);
                let target_col = Rect::new(x, initial_range.max.y + 1, x, final_range.max.y);
                let (operations, _) =
                    self.apply_auto_complete(sheet_id, false, &source_col, &target_col, None)?;

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        let formats_op = Operation::SetCellFormatsA1 { sheet_id, formats };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersA1 { sheet_id, borders };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_up(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
    ) -> Result<Vec<Operation>> {
        let height = initial_range.height() as usize;
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let mut ops = initial_range
            .x_range()
            .map(|x| {
                // for each row, apply the formats to a block (x, initial_range.height) of new cells
                final_range.y_range().rev().step_by(height).for_each(|y| {
                    let mut new_y = y - height as i64 + 1;
                    let start_pos: Pos = if new_y < final_range.min.y {
                        let start_pos = (x, initial_range.min.y + final_range.min.y - new_y).into();
                        new_y = final_range.min.y;
                        start_pos
                    } else {
                        (x, initial_range.min.y).into()
                    };
                    let format_rect = Rect::new(x, y, x, new_y);
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);
                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_col = Rect::new(x, initial_range.min.y, x, initial_range.max.y);
                let target_col = Rect::new(x, initial_range.min.y - 1, x, final_range.min.y);
                let (operations, _) =
                    self.apply_auto_complete(sheet_id, true, &source_col, &target_col, None)?;

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        let formats_op = Operation::SetCellFormatsA1 { sheet_id, formats };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersA1 { sheet_id, borders };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_up_or_down_from_right(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
        values: &[CellValue],
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let height = values.len() as i64 / width;
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let mut ops = final_range
            .x_range()
            .enumerate()
            .map(|(index, x)| {
                let target_col =
                    Rect::new_span((x, final_range.min.y).into(), (x, final_range.max.y).into());

                let vals = (0..height)
                    .map(|i| {
                        let array_index = (index as i64 + (i * width)) as usize;
                        values
                            .get(array_index)
                            .unwrap_or(&CellValue::Blank)
                            .to_owned()
                    })
                    .collect::<Vec<_>>();

                let format_x =
                    initial_range.min.x + (x - initial_range.min.x) % initial_range.width() as i64;
                maybe_reverse(final_range.y_range(), direction == ExpandDirection::Up)
                    .step_by(height as usize)
                    .for_each(|y| {
                        let mut start_pos = (format_x, initial_range.min.y).into();
                        let new_y = if direction == ExpandDirection::Down {
                            final_range.max.y.min(y + height - 1)
                        } else {
                            // since the new_y is less than the range min, we need to
                            // adjust the format since this is ine reverse order
                            let calc_y = y - height + 1;
                            if calc_y < final_range.min.y {
                                start_pos =
                                    (format_x, initial_range.min.y + final_range.min.y - calc_y)
                                        .into();
                                final_range.min.y
                            } else {
                                y - height + 1
                            }
                        };

                        let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                        self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);

                        self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                    });

                let (operations, _) = self.apply_auto_complete(
                    sheet_id,
                    direction == ExpandDirection::Up,
                    initial_range,
                    &target_col,
                    Some(vals),
                )?;

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        let formats_op = Operation::SetCellFormatsA1 { sheet_id, formats };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersA1 { sheet_id, borders };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_up_or_down_from_left(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
        values: &[CellValue],
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let height = values.len() as i64 / width;
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let mut ops = final_range
            .x_range()
            .rev()
            .enumerate()
            .map(|(index, x)| {
                let target_col = if direction == ExpandDirection::Down {
                    Rect::new_span((x, final_range.min.y).into(), (x, final_range.max.y).into())
                } else {
                    Rect::new_span(
                        (x, initial_range.min.y - 1).into(),
                        (x, final_range.min.y).into(),
                    )
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

                let format_x = initial_range.max.x - (index as i64 % initial_range.width() as i64);
                maybe_reverse(final_range.y_range(), direction == ExpandDirection::Up)
                    .step_by(height as usize)
                    .for_each(|y| {
                        let mut start_pos = (format_x, initial_range.min.y).into();
                        let new_y = if direction == ExpandDirection::Down {
                            final_range.max.y.min(y + height - 1)
                        } else {
                            // since the new_y is less than the range min, we need to
                            // adjust the format since this is ine reverse order
                            let calc_y = y - height + 1;
                            if calc_y < final_range.min.y {
                                start_pos =
                                    (format_x, initial_range.min.y + final_range.min.y - calc_y)
                                        .into();
                                final_range.min.y
                            } else {
                                y - height + 1
                            }
                        };

                        let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                        self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);

                        self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                    });

                let (operations, _) = self.apply_auto_complete(
                    sheet_id,
                    direction == ExpandDirection::Up,
                    initial_range,
                    &target_col,
                    Some(vals),
                )?;

                Ok(operations)
            })
            .flatten_ok()
            .collect::<Result<Vec<Operation>>>()?;

        let formats_op = Operation::SetCellFormatsA1 { sheet_id, formats };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersA1 { sheet_id, borders };
        ops.push(borders_op);

        Ok(ops)
    }

    /// Given an array of values, determine if a series exists and if so, apply it.
    fn apply_auto_complete(
        &mut self,
        sheet_id: SheetId,
        negative: bool,
        initial_range: &Rect,
        final_range: &Rect,
        cell_values: Option<Vec<CellValue>>,
    ) -> Result<(Vec<Operation>, Vec<CellValue>)> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return Err(Error::msg("Sheet not found"));
        };
        let context = self.a1_context();

        let mut ops = vec![];

        let values = match cell_values {
            Some(cell_values) => cell_values,
            None => sheet.cell_values_pos_in_rect(initial_range),
        };
        let series = find_auto_complete(SeriesOptions {
            series: values,
            spaces: (final_range.width() * final_range.height()) as i32,
            negative,
        });
        let sheet_pos = final_range.min.to_sheet_pos(sheet_id);
        let mut cells = CellValues::default();
        let cell_values_ops = self.cell_values_operations(
            None,
            sheet_pos,
            Pos::new(0, 0),
            &mut cells,
            CellValues::from_flat_array(final_range.width(), final_range.height(), series.clone()),
            false,
        )?;
        if !cells.is_empty() {
            ops.push(Operation::SetCellValues {
                sheet_pos,
                values: cells,
            });
        }
        ops.extend(cell_values_ops);

        // gather SetDataTable and ComputeCode operations for any code cells
        let mut data_table_ops = vec![];
        let mut compute_code_ops = vec![];
        let data_tables_in_rect = sheet.data_tables_and_cell_values_in_rect(
            initial_range,
            false,
            context,
            None,
            &mut None,
            &mut None,
        );

        // Collect CellValue::Code cells from the initial range
        let code_cells_in_rect: Vec<(Pos, CodeCell)> = initial_range
            .iter()
            .filter_map(|pos| {
                if let Some(CellValue::Code(code_cell)) = sheet.cell_value_ref(pos) {
                    Some((pos, (**code_cell).clone()))
                } else {
                    None
                }
            })
            .collect();

        let initial_range_width = initial_range.width() as usize;
        let initial_range_height = initial_range.height() as usize;
        for final_x in final_range.x_range().step_by(initial_range_width) {
            for final_y in final_range.y_range().step_by(initial_range_height) {
                let dx = final_x - initial_range.min.x;
                let dy = final_y - initial_range.min.y;

                // Handle DataTables
                for (original_pos, data_table) in data_tables_in_rect.iter() {
                    let final_pos = original_pos.translate(dx, dy, i64::MIN, i64::MIN);
                    if !final_range.contains(final_pos) {
                        continue;
                    }

                    let mut data_table = data_table.to_owned();

                    let final_sheet_pos = final_pos.to_sheet_pos(sheet_id);

                    if let Some(code_run) = data_table.code_run_mut() {
                        code_run.adjust_references(
                            sheet_id,
                            context,
                            original_pos.to_sheet_pos(sheet_id),
                            RefAdjust {
                                sheet_id: None,
                                relative_only: true,
                                dx,
                                dy,
                                x_start: 0,
                                y_start: 0,
                            },
                        );
                        // Use SetComputeCode with template to preserve presentation properties
                        compute_code_ops.push(Operation::SetComputeCode {
                            sheet_pos: final_sheet_pos,
                            language: code_run.language.clone(),
                            code: code_run.code.clone(),
                            template: Some((&data_table).into()),
                        });
                    } else {
                        // Non-code data tables use SetDataTable
                        data_table_ops.push(Operation::SetDataTable {
                            sheet_pos: final_sheet_pos,
                            data_table: Some(data_table),
                            index: usize::MAX,
                            ignore_old_data_table: true,
                        });
                    }
                }

                // Handle CellValue::Code cells
                for (original_pos, code_cell) in code_cells_in_rect.iter() {
                    let final_pos = original_pos.translate(dx, dy, i64::MIN, i64::MIN);
                    if !final_range.contains(final_pos) {
                        continue;
                    }

                    let mut code_run = code_cell.code_run.clone();
                    code_run.adjust_references(
                        sheet_id,
                        context,
                        original_pos.to_sheet_pos(sheet_id),
                        RefAdjust {
                            sheet_id: None,
                            relative_only: true,
                            dx,
                            dy,
                            x_start: 0,
                            y_start: 0,
                        },
                    );

                    let final_sheet_pos = final_pos.to_sheet_pos(sheet_id);
                    compute_code_ops.push(Operation::SetComputeCode {
                        sheet_pos: final_sheet_pos,
                        language: code_run.language.clone(),
                        code: code_run.code.clone(),
                        template: None,
                    });
                }
            }
        }

        ops.extend(data_table_ops);
        ops.extend(compute_code_ops);

        Ok((ops, series))
    }

    fn apply_formats(
        &self,
        sheet_id: SheetId,
        start_pos: Pos,
        format_rect: Rect,
        formats: &mut SheetFormatUpdates,
    ) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            for (x, x_pos) in format_rect.x_range().enumerate() {
                for (y, y_pos) in format_rect.y_range().enumerate() {
                    let source_pos = Pos::new(start_pos.x + x as i64, start_pos.y + y as i64);
                    let target_pos = Pos::new(x_pos, y_pos);

                    formats.set_format_cell(target_pos, sheet.formats.format(source_pos).into());
                }
            }
        }
    }

    fn apply_borders(
        &self,
        sheet_id: SheetId,
        start_pos: Pos,
        border_rect: Rect,
        borders: &mut BordersUpdates,
    ) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            for (x, x_pos) in border_rect.x_range().enumerate() {
                for (y, y_pos) in border_rect.y_range().enumerate() {
                    let source_pos = Pos::new(start_pos.x + x as i64, start_pos.y + y as i64);
                    let target_pos = Pos::new(x_pos, y_pos);

                    borders.set_style_cell(
                        target_pos,
                        sheet
                            .borders
                            .get_style_cell_override_border(source_pos, false),
                    );
                }
            }
        }
    }
}
