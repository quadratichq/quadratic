use crate::{
    cell_values::CellValues,
    controller::GridController,
    grid::{
        formats::SheetFormatUpdates,
        series::{find_auto_complete, SeriesOptions},
        sheet::borders::BordersUpdates,
        SheetId,
    },
    util::maybe_reverse,
    A1Selection, CellValue, Pos, Rect, SheetPos, SheetRect,
};
use anyhow::{Error, Result};
use itertools::Itertools;

use super::operation::Operation;

type AutoCompleteOperationsValuesPosResult =
    Result<(Vec<Operation>, Vec<(CellValue, Option<Pos>)>)>;

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
        ops.extend(self.delete_cells_operations(&selection));
        ops.extend(self.clear_format_borders_operations(&selection));
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
                    let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);

                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_row = SheetRect::new_pos_span(
                    (initial_range.min.x, y).into(),
                    (initial_range.max.x, y).into(),
                    sheet_id,
                );
                let target_row =
                    Rect::new_span((final_range.min.x, y).into(), (final_range.max.x, y).into());
                let (operations, cell_values) = self.apply_auto_complete(
                    sheet_id,
                    false,
                    &source_row.into(),
                    &target_row,
                    None,
                )?;
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
                    let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);

                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_row = SheetRect::new_pos_span(
                    (initial_range.min.x, y).into(),
                    (initial_range.max.x, y).into(),
                    sheet_id,
                );
                let target_row =
                    Rect::new_span((final_range.min.x, y).into(), (final_range.max.x, y).into());
                let (operations, cell_values) = self.apply_auto_complete(
                    sheet_id,
                    true,
                    &source_row.into(),
                    &target_row,
                    None,
                )?;
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
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let mut ops = initial_range
            .x_range()
            .rev()
            .map(|x| {
                // for each row, apply the formats to a block (x, initial_range.height) of new cells
                let height = initial_range.height() as usize;
                final_range.y_range().step_by(height).for_each(|y| {
                    let new_y = final_range.max.y.min(y + height as i64 - 1);
                    let start_pos = (x, initial_range.min.y).into();
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);

                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_col = SheetRect::new_pos_span(
                    (x, initial_range.min.y).into(),
                    (x, initial_range.max.y).into(),
                    sheet_id,
                );
                let target_col = Rect::new_span(
                    (x, initial_range.max.y + 1).into(),
                    (x, final_range.max.y).into(),
                );
                let (operations, _) = self.apply_auto_complete(
                    sheet_id,
                    false,
                    &source_col.into(),
                    &target_col,
                    None,
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

    fn expand_up(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
    ) -> Result<Vec<Operation>> {
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let mut ops = initial_range
            .x_range()
            .map(|x| {
                // for each row, apply the formats to a block (x, initial_range.height) of new cells
                let height = initial_range.height() as usize;
                final_range.y_range().rev().step_by(height).for_each(|y| {
                    let mut new_y = y - height as i64 + 1;
                    let start_pos: Pos = if new_y < final_range.min.y {
                        let start_pos = (x, initial_range.min.y + final_range.min.y - new_y).into();
                        new_y = final_range.min.y;
                        start_pos
                    } else {
                        (x, initial_range.min.y).into()
                    };
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    self.apply_formats(sheet_id, start_pos, format_rect, &mut formats);

                    self.apply_borders(sheet_id, start_pos, format_rect, &mut borders);
                });

                let source_col = SheetRect::new_pos_span(
                    (x, initial_range.min.y).into(),
                    (x, initial_range.max.y).into(),
                    sheet_id,
                );
                let target_col = Rect::new_span(
                    (x, initial_range.min.y - 1).into(),
                    (x, final_range.min.y).into(),
                );
                let (operations, _) = self.apply_auto_complete(
                    sheet_id,
                    true,
                    &source_col.into(),
                    &target_col,
                    None,
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

    fn expand_up_or_down_from_right(
        &mut self,
        sheet_id: SheetId,
        initial_range: &Rect,
        final_range: &Rect,
        values: &[(CellValue, Option<Pos>)],
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let height = values.len() as i64 / width;
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
                            .unwrap_or(&(CellValue::Blank, None))
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
                    &target_col,
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
        values: &[(CellValue, Option<Pos>)],
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();

        let height = values.len() as i64 / width;

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
                            .unwrap_or(&(CellValue::Blank, None))
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
                    &target_col,
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
        cell_values: Option<Vec<(CellValue, Option<Pos>)>>,
    ) -> AutoCompleteOperationsValuesPosResult {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return Err(Error::msg("Sheet not found"));
        };
        let values = if let Some(cell_values) = cell_values {
            cell_values
        } else {
            sheet.cell_values_pos_in_rect(initial_range, true)
        };

        let mut series = find_auto_complete(SeriesOptions {
            series: values,
            spaces: (final_range.width() * final_range.height()) as i32,
            negative,
        });

        // gather ComputeCode operations for any code cells
        let compute_code_ops = final_range
            .iter()
            .enumerate()
            .filter_map(|(i, Pos { x, y })| {
                if let Some((CellValue::Code(code_cell), original_pos)) = series.get_mut(i) {
                    if let Some(original_pos) = original_pos {
                        let sheet_map = self.grid.sheet_name_id_map();
                        code_cell.update_cell_references(
                            x - original_pos.x,
                            y - original_pos.y,
                            &sheet_id,
                            &sheet_map,
                        );
                        original_pos.x = x;
                        original_pos.y = y;
                    }
                    let sheet_pos = SheetPos::new(sheet_id, x, y);
                    Some(Operation::ComputeCode { sheet_pos })
                } else {
                    None
                }
            })
            .collect::<Vec<Operation>>();

        let values = CellValues::from_flat_array(
            final_range.width(),
            final_range.height(),
            series.iter().map(|(v, _)| v.to_owned()).collect(),
        );
        let sheet_pos = final_range.min.to_sheet_pos(sheet_id);
        let mut ops = vec![Operation::SetCellValues { sheet_pos, values }];

        // the compute code operations need to be applied after the cell values
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
