use crate::grid::formatting::CellFmtArray;
use crate::{grid::*, Array, CellValue, Rect, SheetPos, SheetRect};

use crate::controller::operations::operation::Operation;
use crate::controller::GridController;

impl GridController {
    /// Executes the given operation.
    pub fn execute_operation(&mut self, op: Operation) {
        match op.clone() {
            Operation::SetCellValues { sheet_rect, values } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_rect.sheet_id);

                // update individual cell values and collect old_values
                let old_values = sheet_rect
                    .iter()
                    .zip(values.clone().into_cell_values_vec())
                    .map(|(sheet_pos, value)| {
                        let old_value = sheet.set_cell_value(sheet_pos.into(), value);

                        // add html to summary if old value was of that type
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

                self.forward_operations.push(op);

                // create reverse_operation
                let old_values = Array::new_row_major(sheet_rect.size(), old_values)
                    .expect("error constructing array of old values for SetCells operation");
                self.reverse_operations.push(Operation::SetCellValues {
                    sheet_rect,
                    values: old_values,
                });

                self.cells_updated.insert(sheet_rect);
                self.sheets_with_dirty_bounds.insert(sheet_rect.sheet_id);
                self.summary.generate_thumbnail =
                    self.summary.generate_thumbnail || self.thumbnail_dirty_sheet_rect(sheet_rect);
                self.add_cell_sheets_modified_rect(&sheet_rect);
            }

            Operation::SetCodeCell {
                sheet_pos,
                code_cell_value,
            } => {
                let sheet_id = sheet_pos.sheet_id;
                let sheet = self.grid.sheet_mut_from_id(sheet_id);

                // find combine area
                let new_output_sheet_rect = code_cell_value
                    .as_ref()
                    .map(|code_cell_value| code_cell_value.output_rect())
                    .flatten();

                let old_code_cell_value =
                    sheet.set_code_cell_value(sheet_pos.into(), code_cell_value);

                self.forward_operations.push(op);

                // get range for changes to code_cell, including both new and old outputs
                let old_output_sheet_rect = old_code_cell_value
                    .as_ref()
                    .map(|code_cell_value| code_cell_value.output_rect())
                    .flatten();
                let sheet_rect = match (old_output_sheet_rect, new_output_sheet_rect) {
                    (Some(old), Some(new)) => old.union(&new),
                    (Some(old), None) => old,
                    (None, Some(new)) => new,
                    (None, None) => Rect::single_pos(sheet_pos.into()),
                }
                .to_sheet_rect(sheet_id);
                self.cells_updated.insert(sheet_rect);
                self.sheets_with_dirty_bounds.insert(sheet_rect.sheet_id);
                self.summary.generate_thumbnail =
                    self.summary.generate_thumbnail || self.thumbnail_dirty_sheet_rect(sheet_rect);
                self.add_cell_sheets_modified_rect(&sheet_rect);

                // let is_code_cell_empty = code_cell_value.is_none();
                // let sheet_id = sheet_pos.sheet_id;

                // // todo: all spill calculation should be moved to the code_cell operation function
                // let old_spill = sheet.get_spill(sheet_pos.into());
                // let old_code_cell_value = sheet.get_code_cell(sheet_pos.into()).cloned();
                // let final_code_cell_value;

                // // for compute, we keep the original cell output to avoid flashing of output (since values will be overridden once computation is complete)
                // let sheet = self.grid.sheet_mut_from_id(sheet_id);
                // if compute {
                //     if let Some(code_cell_value) = code_cell_value {
                //         let updated_code_cell_value =
                //             if let Some(old_code_cell_value) = &old_code_cell_value {
                //                 let mut updated_code_cell_value = code_cell_value.clone();
                //                 updated_code_cell_value.output = old_code_cell_value.output.clone();
                //                 updated_code_cell_value
                //             } else {
                //                 code_cell_value
                //             };
                //         sheet.set_code_cell_value(
                //             sheet_pos.into(),
                //             Some(updated_code_cell_value.clone()),
                //         );
                //         final_code_cell_value = Some(updated_code_cell_value);
                //     } else {
                //         sheet.set_code_cell_value(sheet_pos.into(), code_cell_value);
                //         self.fetch_code_cell_difference(
                //             sheet_pos,
                //             old_code_cell_value.clone(),
                //             None,
                //         );
                //         let sheet = self.grid.sheet_mut_from_id(sheet_id);
                //         sheet.set_code_cell_value(sheet_pos.into(), None);
                //         final_code_cell_value = None;
                //     }
                //     self.cells_to_compute.insert(sheet_pos);
                // } else {
                //     // need to update summary (cells_to_compute will be ignored)
                //     self.fetch_code_cell_difference(
                //         sheet_pos,
                //         old_code_cell_value.clone(),
                //         code_cell_value.clone(),
                //     );
                //     let sheet = self.grid.sheet_mut_from_id(sheet_id);
                //     sheet.set_code_cell_value(sheet_pos.into(), code_cell_value.clone());
                //     final_code_cell_value = code_cell_value;
                // }

                // // TODO(ddimaria): resolve comment from @HactarCE:
                // //
                // // Can we use SheetPos instead of CellSheetsModified? I'd like
                // // to avoid using String for sheet IDs as much as possible. If
                // // it's needed for JS interop, then let's impl Serialize and
                // // Deserialize on SheetId to make it serialize as a string.
                // self.add_cell_sheets_modified_rect(&sheet_pos.into());
                // self.summary.code_cells_modified.insert(sheet_id);

                // // check if a new code_cell causes a spill error in another code cell
                // if old_code_cell_value.is_none() && !is_code_cell_empty {
                //     if let Some(old_spill) = old_spill {
                //         if old_spill.to_sheet_pos(sheet_id) != sheet_pos {
                //             self.set_spill_error(old_spill.to_sheet_pos(sheet_id));
                //         }
                //     }
                // }

                // // check if deleting a code cell releases a spill
                // if is_code_cell_empty {
                //     self.update_code_cell_value_if_spill_error_released(sheet_pos);
                // }
                // self.forward_operations.push(Operation::SetCodeCell {
                //     sheet_pos,
                //     code_cell_value: final_code_cell_value,
                // });
                self.reverse_operations.push(Operation::SetCodeCell {
                    sheet_pos,
                    code_cell_value: old_code_cell_value,
                });

                self.sheets_with_dirty_bounds.insert(sheet_id);
            }

            Operation::SetSpill {
                spill_rect,
                code_cell_sheet_pos,
            } => {
                let sheet_id = spill_rect.sheet_id;
                assert!(
                    sheet_id == code_cell_sheet_pos.map(|p| p.sheet_id).unwrap_or(sheet_id),
                    "Expected spill_rect and code_cell_sheet_pos to have the same sheet_id in SetSpill operation"
                );

                let sheet = self.grid.sheet_mut_from_id(sheet_id);

                // remove all spills in rect and add reverse operation if needed
                spill_rect.iter().for_each(|sheet_pos| {
                    let old_spill =
                        sheet.set_spill(sheet_pos.into(), code_cell_sheet_pos.map(|p| p.into()));
                    self.reverse_operations.push(Operation::SetSpill {
                        spill_rect: SheetRect::single_sheet_pos(sheet_pos),
                        code_cell_sheet_pos: old_spill.map(|p| p.to_sheet_pos(sheet_id)),
                    });
                });

                self.forward_operations.push(op);
            }

            Operation::SetCellFormats { sheet_rect, attr } => {
                self.sheets_with_dirty_bounds.insert(sheet_rect.sheet_id);

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
                self.sheets_with_dirty_bounds.insert(sheet_rect.sheet_id);
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
        gc.execute_operation(operation);
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
