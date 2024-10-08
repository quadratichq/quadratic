use crate::{
    cell_values::CellValues,
    controller::GridController,
    grid::{
        formats::Formats,
        series::{find_auto_complete, SeriesOptions},
        sheet::borders::BorderStyleCellUpdates,
        SheetId,
    },
    selection::Selection,
    util::maybe_reverse_range,
    CellValue, Pos, Rect, SheetPos, SheetRect,
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
    /// Extend and/or shrink the contents of selection to range by inferring patterns.
    ///
    /// selection: the range of cells to be expanded
    ///
    /// range: the range of cells to expand to
    ///
    /// cursor: the cursor position for the undo/redo stack
    pub fn autocomplete_operations(
        &mut self,
        sheet_id: SheetId,
        selection: Rect,
        range: Rect,
    ) -> Result<Vec<Operation>> {
        let mut selection = selection;
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
            let delete_range = SheetRect::new_pos_span(
                (range.max.x + 1, range.min.y).into(),
                (selection.max.x, selection.max.y).into(),
                sheet_id,
            );
            let ops = self.shrink(delete_range);
            operations.extend(ops);
            selection.max.x = range.max.x;
        }

        // shrink height, from bottom to top
        if should_shrink_height {
            let delete_range = SheetRect::new_pos_span(
                (selection.min.x, range.max.y + 1).into(),
                (range.max.x, selection.max.y).into(),
                sheet_id,
            );
            let ops = self.shrink(delete_range);
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
                    (selection.min.x - 1, selection.min.y - 1).into(),
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

        Ok(operations)
    }

    /// Delete cell values and formats in a given range.
    fn shrink(&mut self, delete_range: SheetRect) -> Vec<Operation> {
        let mut ops = vec![];

        let selection = Selection::sheet_rect(delete_range);
        ops.extend(self.delete_cells_operations(&selection));
        ops.extend(self.clear_format_selection_operations(&selection));
        ops
    }

    /// Expand the selection to the right
    ///
    /// selection is range of cells to be expanded
    /// range is the target range
    /// down_range is the range below the target range
    /// up_range is the range above the target range
    fn expand_right(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        down_range: Option<Rect>,
        up_range: Option<Rect>,
    ) -> Result<Vec<Operation>> {
        let mut format_rects = vec![];
        let mut formats = Formats::default();

        let mut borders = BorderStyleCellUpdates::default();
        let mut border_rects = vec![];

        let mut values = vec![];

        let mut ops = selection
            .y_range()
            .map(|y| {
                // for each column, apply the formats to a block (selection.width, y) of new cells
                let width = selection.width() as usize;
                range.x_range().step_by(width).for_each(|x| {
                    let new_x = range.max.x.min(x + width as i64 - 1);
                    let start_pos = (selection.min.x, y).into();
                    let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                    self.apply_formats(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut format_rects,
                        &mut formats,
                    );

                    self.apply_borders(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut border_rects,
                        &mut borders,
                    );
                });

                let source_row = SheetRect::new_pos_span(
                    (selection.min.x, y).into(),
                    (selection.max.x, y).into(),
                    sheet_id,
                );
                let target_row = Rect::new_span((range.min.x, y).into(), (range.max.x, y).into());
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

        let formats_op = Operation::SetCellFormatsSelection {
            selection: Selection {
                sheet_id,
                rects: format_rects.into(),
                ..Default::default()
            },
            formats,
        };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersSelection {
            selection: Selection {
                sheet_id,
                rects: border_rects.into(),
                ..Default::default()
            },
            borders,
        };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_left(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        down_range: Option<Rect>,
        up_range: Option<Rect>,
    ) -> Result<Vec<Operation>> {
        let mut format_rects = vec![];
        let mut formats = Formats::default();

        let mut border_rects = vec![];
        let mut borders = BorderStyleCellUpdates::default();

        let mut values = vec![];

        let mut ops = selection
            .y_range()
            .map(|y| {
                // for each column, apply the formats to a block (selection.width, y) of new cells
                let width = selection.width() as usize;
                range.x_range().rev().step_by(width).for_each(|x| {
                    let mut new_x = x - width as i64 + 1;
                    let start_pos: Pos = if new_x < range.min.x {
                        let start_pos = (selection.min.x + range.min.x - new_x, y).into();
                        new_x = range.min.x;
                        start_pos
                    } else {
                        (selection.min.x, y).into()
                    };
                    let format_rect = Rect::new_span((x, y).into(), (new_x, y).into());
                    self.apply_formats(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut format_rects,
                        &mut formats,
                    );

                    self.apply_borders(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut border_rects,
                        &mut borders,
                    );
                });

                let source_row = SheetRect::new_pos_span(
                    (selection.min.x, y).into(),
                    (selection.max.x, y).into(),
                    sheet_id,
                );
                let target_row = Rect::new_span((range.min.x, y).into(), (range.max.x, y).into());
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

        let formats_op = Operation::SetCellFormatsSelection {
            selection: Selection {
                sheet_id,
                rects: format_rects.into(),
                ..Default::default()
            },
            formats,
        };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersSelection {
            selection: Selection {
                sheet_id,
                rects: border_rects.into(),
                ..Default::default()
            },
            borders,
        };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_down(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        let mut format_rects = vec![];
        let mut formats = Formats::default();

        let mut border_rects = vec![];
        let mut borders = BorderStyleCellUpdates::default();

        let mut ops = selection
            .x_range()
            .rev()
            .map(|x| {
                // for each row, apply the formats to a block (x, selection.height) of new cells
                let height = selection.height() as usize;
                range.y_range().step_by(height).for_each(|y| {
                    let new_y = range.max.y.min(y + height as i64 - 1);
                    let start_pos = (x, selection.min.y).into();
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    self.apply_formats(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut format_rects,
                        &mut formats,
                    );

                    self.apply_borders(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut border_rects,
                        &mut borders,
                    );
                });

                let source_col = SheetRect::new_pos_span(
                    (x, selection.min.y).into(),
                    (x, selection.max.y).into(),
                    sheet_id,
                );
                let target_col =
                    Rect::new_span((x, selection.max.y + 1).into(), (x, range.max.y).into());
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

        let formats_op = Operation::SetCellFormatsSelection {
            selection: Selection {
                sheet_id,
                rects: format_rects.into(),
                ..Default::default()
            },
            formats,
        };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersSelection {
            selection: Selection {
                sheet_id,
                rects: border_rects.into(),
                ..Default::default()
            },
            borders,
        };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_up(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
    ) -> Result<Vec<Operation>> {
        let mut format_rects = vec![];
        let mut formats = Formats::default();

        let mut border_rects = vec![];
        let mut borders = BorderStyleCellUpdates::default();

        let mut ops = selection
            .x_range()
            .map(|x| {
                // for each row, apply the formats to a block (x, selection.height) of new cells
                let height = selection.height() as usize;
                range.y_range().rev().step_by(height).for_each(|y| {
                    let mut new_y = y - height as i64 + 1;
                    let start_pos: Pos = if new_y < range.min.y {
                        let start_pos = (x, selection.min.y + range.min.y - new_y).into();
                        new_y = range.min.y;
                        start_pos
                    } else {
                        (x, selection.min.y).into()
                    };
                    let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                    self.apply_formats(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut format_rects,
                        &mut formats,
                    );

                    self.apply_borders(
                        sheet_id,
                        start_pos,
                        format_rect,
                        &mut border_rects,
                        &mut borders,
                    );
                });

                let source_col = SheetRect::new_pos_span(
                    (x, selection.min.y).into(),
                    (x, selection.max.y).into(),
                    sheet_id,
                );
                let target_col =
                    Rect::new_span((x, selection.min.y - 1).into(), (x, range.min.y).into());
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

        let formats_op = Operation::SetCellFormatsSelection {
            selection: Selection {
                sheet_id,
                rects: format_rects.into(),
                ..Default::default()
            },
            formats,
        };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersSelection {
            selection: Selection {
                sheet_id,
                rects: border_rects.into(),
                ..Default::default()
            },
            borders,
        };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_up_or_down_from_right(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        values: &[CellValue],
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let mut format_rects = vec![];
        let mut formats = Formats::default();

        let mut border_rects = vec![];
        let mut borders = BorderStyleCellUpdates::default();

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
                maybe_reverse_range(range.y_range(), direction == ExpandDirection::Up)
                    .step_by(height as usize)
                    .for_each(|y| {
                        let mut start_pos = (format_x, selection.min.y).into();
                        let new_y = if direction == ExpandDirection::Down {
                            range.max.y.min(y + height - 1)
                        } else {
                            // since the new_y is less than the range min, we need to
                            // adjust the format since this is ine reverse order
                            let calc_y = y - height + 1;
                            if calc_y < range.min.y {
                                start_pos =
                                    (format_x, selection.min.y + range.min.y - calc_y).into();
                                range.min.y
                            } else {
                                y - height + 1
                            }
                        };

                        let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                        self.apply_formats(
                            sheet_id,
                            start_pos,
                            format_rect,
                            &mut format_rects,
                            &mut formats,
                        );

                        self.apply_borders(
                            sheet_id,
                            start_pos,
                            format_rect,
                            &mut border_rects,
                            &mut borders,
                        );
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

        let formats_op = Operation::SetCellFormatsSelection {
            selection: Selection {
                sheet_id,
                rects: format_rects.into(),
                ..Default::default()
            },
            formats,
        };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersSelection {
            selection: Selection {
                sheet_id,
                rects: border_rects.into(),
                ..Default::default()
            },
            borders,
        };
        ops.push(borders_op);

        Ok(ops)
    }

    fn expand_up_or_down_from_left(
        &mut self,
        sheet_id: SheetId,
        selection: &Rect,
        range: &Rect,
        values: &[CellValue],
        width: i64,
        direction: ExpandDirection,
    ) -> Result<Vec<Operation>> {
        let mut format_rects = vec![];
        let mut formats = Formats::default();

        let mut border_rects = vec![];
        let mut borders = BorderStyleCellUpdates::default();

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
                maybe_reverse_range(range.y_range(), direction == ExpandDirection::Up)
                    .step_by(height as usize)
                    .for_each(|y| {
                        let mut start_pos = (format_x, selection.min.y).into();
                        let new_y = if direction == ExpandDirection::Down {
                            range.max.y.min(y + height - 1)
                        } else {
                            // since the new_y is less than the range min, we need to
                            // adjust the format since this is ine reverse order
                            let calc_y = y - height + 1;
                            if calc_y < range.min.y {
                                start_pos =
                                    (format_x, selection.min.y + range.min.y - calc_y).into();
                                range.min.y
                            } else {
                                y - height + 1
                            }
                        };

                        let format_rect = Rect::new_span((x, y).into(), (x, new_y).into());
                        self.apply_formats(
                            sheet_id,
                            start_pos,
                            format_rect,
                            &mut format_rects,
                            &mut formats,
                        );

                        self.apply_borders(
                            sheet_id,
                            start_pos,
                            format_rect,
                            &mut border_rects,
                            &mut borders,
                        );
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

        let formats_op = Operation::SetCellFormatsSelection {
            selection: Selection {
                sheet_id,
                rects: format_rects.into(),
                ..Default::default()
            },
            formats,
        };
        ops.push(formats_op);

        let borders_op = Operation::SetBordersSelection {
            selection: Selection {
                sheet_id,
                rects: border_rects.into(),
                ..Default::default()
            },
            borders,
        };
        ops.push(borders_op);

        Ok(ops)
    }

    /// Given an array of values, determine if a series exists and if so, apply it.
    fn apply_auto_complete(
        &mut self,
        sheet_id: SheetId,
        negative: bool,
        selection: &Rect,
        range: &Rect,
        cell_values: Option<Vec<CellValue>>,
    ) -> Result<(Vec<Operation>, Vec<CellValue>)> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return Err(Error::msg("Sheet not found"));
        };
        let values = if let Some(cell_values) = cell_values {
            cell_values
        } else {
            sheet
                .cell_values_in_rect(selection, true)?
                .into_cell_values_vec()
                .into_iter()
                .collect::<Vec<CellValue>>()
        };

        let series = find_auto_complete(SeriesOptions {
            series: values,
            spaces: (range.width() * range.height()) as i32,
            negative,
        });

        // gather ComputeCode operations for any code cells
        let compute_code_ops = range
            .iter()
            .enumerate()
            .filter(|(i, _)| matches!(series.get(*i), Some(CellValue::Code(_))))
            .map(|(_, Pos { x, y })| {
                let sheet_pos = SheetPos::new(sheet_id, x, y);
                Operation::ComputeCode { sheet_pos }
            })
            .collect::<Vec<Operation>>();

        let values = CellValues::from_flat_array(range.width(), range.height(), series.to_owned());
        let sheet_pos = range.min.to_sheet_pos(sheet_id);
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
        format_rects: &mut Vec<Rect>,
        formats: &mut Formats,
    ) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            format_rects.push(format_rect);
            for x in 0..format_rect.width() as i64 {
                for y in 0..format_rect.height() as i64 {
                    formats.push(
                        sheet
                            .format_cell(start_pos.x + x, start_pos.y + y, true)
                            .to_replace(),
                    );
                }
            }
        }
    }

    fn apply_borders(
        &self,
        sheet_id: SheetId,
        start_pos: Pos,
        border_rect: Rect,
        border_rects: &mut Vec<Rect>,
        borders: &mut BorderStyleCellUpdates,
    ) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            border_rects.push(border_rect);
            for x in 0..border_rect.width() as i64 {
                for y in 0..border_rect.height() as i64 {
                    borders.push(
                        sheet
                            .borders
                            .get(start_pos.x + x, start_pos.y + y)
                            .override_border(false),
                    );
                }
            }
        }
    }
}
