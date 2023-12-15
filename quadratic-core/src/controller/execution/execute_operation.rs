use crate::grid::formatting::CellFmtArray;
use crate::{grid::*, Array, CellValue, SheetPos};

use super::super::operations::operation::Operation;
use super::super::GridController;

impl GridController {
    /// Executes the given operation.
    pub fn execute_operation(&mut self, op: Operation, compute: bool) {
        match op {
            Operation::SetCellValues { sheet_rect, values } => {
                // todo: this should be moved to the update_bounds function
                self.sheets_with_changed_bounds.insert(sheet_rect.sheet_id);

                let sheet = self.grid.sheet_mut_from_id(sheet_rect.sheet_id);

                let size = sheet_rect.size();
                let old_values = sheet_rect
                    .iter()
                    .zip(values.clone().into_cell_values_vec())
                    .map(|(sheet_pos, value)| {
                        let old_value = sheet.set_cell_value(sheet_pos.into(), value);
                        if old_value
                            .as_ref()
                            .is_some_and(|cell_value| cell_value.is_html())
                        {
                            self.summary.html.insert(sheet_pos.sheet_id);
                        }
                        old_value
                    })
                    .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                    .collect();
                self.cells_updated.insert(sheet_rect);

                let old_values = Array::new_row_major(size, old_values)
                    .expect("error constructing array of old values for SetCells operation");

                self.add_cell_sheets_modified_rect(&sheet_rect);

                // todo: this should be moved to the code_cell operations function
                // check if override any code cells
                let sheet = self.grid.sheet_from_id(sheet_rect.sheet_id);
                let code_cells_to_delete = sheet
                    .code_cells
                    .iter()
                    .filter_map(|(pos, _)| {
                        let possible_delete = pos.to_sheet_pos(sheet.id);
                        if sheet_rect.contains(possible_delete) {
                            Some(possible_delete)
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<SheetPos>>();

                // todo: this should be moved to the code_cell operations function
                // remove the code cells
                let sheet_id = sheet.id;
                for sheet_pos in code_cells_to_delete {
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    let old_value = sheet.set_code_cell_value(sheet_pos.into(), None);
                    self.fetch_code_cell_difference(sheet_pos, old_value.clone(), None);
                    self.reverse_operations.push(Operation::SetCellCode {
                        sheet_pos,
                        code_cell_value: old_value,
                    });
                }

                // todo: this should be moved to the spills operations function
                // check for changes in spills
                for sheet_pos in sheet_rect.iter() {
                    let sheet = self.grid.sheet_from_id(sheet_pos.sheet_id);
                    // if there is a value, check if it caused a spill
                    if sheet.get_cell_value(sheet_pos.into()).is_some() {
                        self.check_spill(sheet_pos);
                    } else {
                        // otherwise check if it released a spill
                        self.update_code_cell_value_if_spill_error_released(sheet_pos);
                    }
                }

                // todo: this should be removed (forward operations should be generically added in the execute_operations function)
                self.forward_operations
                    .push(Operation::SetCellValues { sheet_rect, values });

                self.summary.generate_thumbnail =
                    self.summary.generate_thumbnail || self.thumbnail_dirty_sheet_rect(sheet_rect);

                self.reverse_operations.push(Operation::SetCellValues {
                    sheet_rect,
                    values: old_values,
                });
            }
            Operation::SetCellCode {
                sheet_pos,
                code_cell_value,
            } => {
                let is_code_cell_empty = code_cell_value.is_none();
                let sheet_id = sheet_pos.sheet_id;

                self.sheets_with_changed_bounds.insert(sheet_id);

                let sheet = self.grid.sheet_mut_from_id(sheet_id);

                // todo: all spill calculation should be moved to the code_cell operation function
                let old_spill = sheet.get_spill(sheet_pos.into());
                let old_code_cell_value = sheet.get_code_cell(sheet_pos.into()).cloned();
                let final_code_cell_value;

                // for compute, we keep the original cell output to avoid flashing of output (since values will be overridden once computation is complete)
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                if compute {
                    if let Some(code_cell_value) = code_cell_value {
                        let updated_code_cell_value =
                            if let Some(old_code_cell_value) = &old_code_cell_value {
                                let mut updated_code_cell_value = code_cell_value.clone();
                                updated_code_cell_value.output = old_code_cell_value.output.clone();
                                updated_code_cell_value
                            } else {
                                code_cell_value
                            };
                        sheet.set_code_cell_value(
                            sheet_pos.into(),
                            Some(updated_code_cell_value.clone()),
                        );
                        final_code_cell_value = Some(updated_code_cell_value);
                    } else {
                        sheet.set_code_cell_value(sheet_pos.into(), code_cell_value);
                        self.fetch_code_cell_difference(
                            sheet_pos,
                            old_code_cell_value.clone(),
                            None,
                        );
                        let sheet = self.grid.sheet_mut_from_id(sheet_id);
                        sheet.set_code_cell_value(sheet_pos.into(), None);
                        final_code_cell_value = None;
                    }
                    self.cells_to_compute.insert(sheet_pos);
                } else {
                    // need to update summary (cells_to_compute will be ignored)
                    self.fetch_code_cell_difference(
                        sheet_pos,
                        old_code_cell_value.clone(),
                        code_cell_value.clone(),
                    );
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    sheet.set_code_cell_value(sheet_pos.into(), code_cell_value.clone());
                    final_code_cell_value = code_cell_value;
                }

                // TODO(ddimaria): resolve comment from @HactarCE:
                //
                // Can we use SheetPos instead of CellSheetsModified? I'd like
                // to avoid using String for sheet IDs as much as possible. If
                // it's needed for JS interop, then let's impl Serialize and
                // Deserialize on SheetId to make it serialize as a string.
                self.add_cell_sheets_modified_rect(&sheet_pos.into());
                self.summary.code_cells_modified.insert(sheet_id);

                // check if a new code_cell causes a spill error in another code cell
                if old_code_cell_value.is_none() && !is_code_cell_empty {
                    if let Some(old_spill) = old_spill {
                        if old_spill.to_sheet_pos(sheet_id) != sheet_pos {
                            self.set_spill_error(old_spill.to_sheet_pos(sheet_id));
                        }
                    }
                }

                // check if deleting a code cell releases a spill
                if is_code_cell_empty {
                    self.update_code_cell_value_if_spill_error_released(sheet_pos);
                }
                self.forward_operations.push(Operation::SetCellCode {
                    sheet_pos,
                    code_cell_value: final_code_cell_value,
                });
                self.reverse_operations.push(Operation::SetCellCode {
                    sheet_pos,
                    code_cell_value: old_code_cell_value,
                });
            }

            Operation::SetCellFormats { sheet_rect, attr } => {
                self.sheets_with_changed_bounds.insert(sheet_rect.sheet_id);

                if let CellFmtArray::FillColor(_) = attr {
                    self.summary.fill_sheets_modified.push(sheet_rect.sheet_id);
                }

                // todo: this is too slow -- perhaps call this again when we have a better way of setting multiple formats within an array
                // or when we get rid of CellRefs (which I think is the reason this is slow)
                // summary.generate_thumbnail =
                //     summary.generate_thumbnail || self.thumbnail_dirty_region(region.clone());

                let old_attr = match attr.clone() {
                    CellFmtArray::Align(align) => CellFmtArray::Align(
                        self.set_cell_formats_for_type::<CellAlign>(&sheet_rect, align, true),
                    ),
                    CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
                        self.set_cell_formats_for_type::<CellWrap>(&sheet_rect, wrap, true),
                    ),
                    CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
                        self.set_cell_formats_for_type::<NumericFormat>(&sheet_rect, num_fmt, true),
                    ),
                    CellFmtArray::NumericDecimals(num_decimals) => CellFmtArray::NumericDecimals(
                        self.set_cell_formats_for_type::<NumericDecimals>(
                            &sheet_rect,
                            num_decimals,
                            true,
                        ),
                    ),
                    CellFmtArray::NumericCommas(num_commas) => CellFmtArray::NumericCommas(
                        self.set_cell_formats_for_type::<NumericCommas>(
                            &sheet_rect,
                            num_commas,
                            true,
                        ),
                    ),
                    CellFmtArray::Bold(bold) => CellFmtArray::Bold(
                        self.set_cell_formats_for_type::<Bold>(&sheet_rect, bold, true),
                    ),
                    CellFmtArray::Italic(italic) => CellFmtArray::Italic(
                        self.set_cell_formats_for_type::<Italic>(&sheet_rect, italic, true),
                    ),
                    CellFmtArray::TextColor(text_color) => CellFmtArray::TextColor(
                        self.set_cell_formats_for_type::<TextColor>(&sheet_rect, text_color, true),
                    ),
                    CellFmtArray::FillColor(fill_color) => {
                        self.summary.fill_sheets_modified.push(sheet_rect.sheet_id);
                        CellFmtArray::FillColor(self.set_cell_formats_for_type::<FillColor>(
                            &sheet_rect,
                            fill_color,
                            false,
                        ))
                    }
                    CellFmtArray::RenderSize(output_size) => {
                        self.summary.html.insert(sheet_rect.sheet_id);
                        CellFmtArray::RenderSize(self.set_cell_formats_for_type::<RenderSize>(
                            &sheet_rect,
                            output_size,
                            false,
                        ))
                    }
                };

                // todo: remove
                self.forward_operations
                    .push(Operation::SetCellFormats { sheet_rect, attr });

                self.reverse_operations.push(Operation::SetCellFormats {
                    sheet_rect,
                    attr: old_attr,
                });
            }

            Operation::SetBorders {
                sheet_rect,
                borders,
            } => {
                self.sheets_with_changed_bounds.insert(sheet_rect.sheet_id);
                self.summary
                    .border_sheets_modified
                    .push(sheet_rect.sheet_id);
                self.summary.generate_thumbnail =
                    self.summary.generate_thumbnail || self.thumbnail_dirty_sheet_rect(sheet_rect);

                let sheet = self.grid.sheet_mut_from_id(sheet_rect.sheet_id);

                let old_borders = sheet.set_region_borders(&sheet_rect.into(), borders.clone());

                // should be removed
                self.forward_operations.push(Operation::SetBorders {
                    sheet_rect,
                    borders,
                });
                self.reverse_operations.push(Operation::SetBorders {
                    sheet_rect,
                    borders: old_borders,
                });
            }
            Operation::AddSheet { sheet } => {
                // todo: need to handle the case where sheet.order overlaps another sheet order
                // this may happen after (1) delete a sheet; (2) MP update w/an added sheet; and (3) undo the deleted sheet
                let sheet_id = sheet.id;
                self.grid
                    .add_sheet(Some(sheet.clone()))
                    .expect("duplicate sheet name");
                self.summary.sheet_list_modified = true;
                self.summary.html.insert(sheet_id);
                self.forward_operations.push(Operation::AddSheet { sheet });
                self.reverse_operations
                    .push(Operation::DeleteSheet { sheet_id });
            }
            Operation::DeleteSheet { sheet_id } => {
                let deleted_sheet = self.grid.remove_sheet(sheet_id);
                self.summary.sheet_list_modified = true;
                self.forward_operations
                    .push(Operation::DeleteSheet { sheet_id });
                self.reverse_operations.push(Operation::AddSheet {
                    sheet: deleted_sheet,
                });
            }
            Operation::ReorderSheet { target, order } => {
                let old_first = self.grid.first_sheet_id();
                let sheet = self.grid.sheet_from_id(target);
                let original_order = sheet.order.clone();
                self.grid.move_sheet(target, order.clone());
                self.summary.sheet_list_modified = true;

                if old_first != self.grid.first_sheet_id() {
                    self.summary.generate_thumbnail = true;
                }
                self.forward_operations
                    .push(Operation::ReorderSheet { target, order });
                self.reverse_operations.push(Operation::ReorderSheet {
                    target,
                    order: original_order,
                });
            }
            Operation::SetSheetName { sheet_id, name } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_name = sheet.name.clone();
                sheet.name = name.clone();
                self.summary.sheet_list_modified = true;
                self.forward_operations
                    .push(Operation::SetSheetName { sheet_id, name });
                self.reverse_operations.push(Operation::SetSheetName {
                    sheet_id,
                    name: old_name,
                });
            }
            Operation::SetSheetColor { sheet_id, color } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_color = sheet.color.clone();
                sheet.color = color.clone();
                self.summary.sheet_list_modified = true;
                self.forward_operations
                    .push(Operation::SetSheetColor { sheet_id, color });
                self.reverse_operations.push(Operation::SetSheetColor {
                    sheet_id,
                    color: old_color,
                });
            }

            Operation::ResizeColumn {
                sheet_id,
                column,
                new_size,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                self.summary.offsets_modified.push(sheet.id);
                let old_size = sheet.offsets.set_column_width(column, new_size);
                self.summary.generate_thumbnail = self.summary.generate_thumbnail
                    || self.thumbnail_dirty_sheet_pos(SheetPos {
                        x: column,
                        y: 0,
                        sheet_id,
                    });
                self.forward_operations.push(Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size,
                });
                self.reverse_operations.push(Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size: old_size,
                });
            }

            Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_size = sheet.offsets.set_row_height(row, new_size);
                self.summary.offsets_modified.push(sheet.id);
                self.summary.generate_thumbnail = self.summary.generate_thumbnail
                    || self.thumbnail_dirty_sheet_pos(SheetPos {
                        x: 0,
                        y: row,
                        sheet_id,
                    });
                self.forward_operations.push(Operation::ResizeRow {
                    sheet_id,
                    row,
                    new_size,
                });
                self.reverse_operations.push(Operation::ResizeRow {
                    sheet_id,
                    row,
                    new_size: old_size,
                });
            }
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn execute(gc: &mut GridController, operation: Operation) {
        gc.transaction_in_progress = true;
        gc.execute_operation(operation, false);
    }

    #[test]
    fn test_execute_operation_set_sheet_color() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let color = Some("red".to_string());
        let operation = Operation::SetSheetColor {
            sheet_id,
            color: color.clone(),
        };

        assert_eq!(
            format!("{:?}", operation),
            format!(
                "SetSheetColor {{ sheet_id: SheetId {{ id: {} }}, color: Some(\"red\") }}",
                sheet_id
            )
        );

        execute(&mut gc, operation);
        assert_eq!(gc.grid.sheets()[0].color, color);
    }

    #[test]
    fn test_execute_operation_resize_column() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let x = 0;
        let new_size = 100.0;
        let operation = Operation::ResizeColumn {
            sheet_id,
            column: x,
            new_size,
        };

        assert_eq!(
            format!("{:?}", operation),
            format!(
                "ResizeColumn {{ sheet_id: SheetId {{ id: {} }}, column: {}, new_size: {:.1} }}",
                sheet_id, x, new_size
            )
        );

        execute(&mut gc, operation);
        let column_width = gc.grid.sheet_from_id(sheet_id).offsets.column_width(x);
        assert_eq!(column_width, new_size);
    }

    #[test]
    fn test_execute_operation_resize_row() {
        let mut gc = GridController::new();
        let sheet = &mut gc.grid_mut().sheets_mut()[0];
        let sheet_id = sheet.id;
        let row = 0;
        let new_size = 100.0;
        let operation = Operation::ResizeRow {
            sheet_id,
            row,
            new_size,
        };

        assert_eq!(
            format!("{:?}", operation),
            format!(
                "ResizeRow {{ sheet_id: SheetId {{ id: {} }}, row: {}, new_size: {:.1} }}",
                sheet_id, row, new_size
            )
        );

        execute(&mut gc, operation);
        let row_height = gc.grid.sheets()[0].offsets.row_height(row);
        assert_eq!(row_height, new_size);
    }
}
