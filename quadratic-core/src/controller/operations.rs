use crate::{
    grid::{
        js_types::{JsRenderCellUpdate, JsRenderCellUpdateEnum},
        *,
    },
    values::IsBlank,
    Array, CellValue, Pos,
};

use super::{
    code_cell_update::update_code_cell_value,
    formatting::CellFmtArray,
    operation::Operation,
    transaction_summary::{OperationSummary, TransactionSummary},
    GridController,
};

impl GridController {
    /// Executes the given operation and returns the reverse operation.
    /// The only way to modify the internal state of the grid is through this function, with an operation.
    /// Operations must always return a reverse operation that can be used to undo the operation.
    pub fn execute_operation(
        &mut self,
        op: Operation,
        cells_to_compute: &mut Vec<CellRef>,
        summary: &mut TransactionSummary,
    ) -> Operation {
        let mut cells_deleted = vec![];

        let operation = match op {
            Operation::None => Operation::None,
            Operation::SetCellValues { region, values } => {
                let mut summary_set = vec![];

                let sheet = self.grid.sheet_mut_from_id(region.sheet);

                let size = region.size().expect("msg: error getting size of region");
                let old_values = region
                    .iter()
                    .zip(values.into_cell_values_vec())
                    .map(|(cell_ref, value)| {
                        let pos = sheet.cell_ref_to_pos(cell_ref)?;

                        if value.is_blank() {
                            cells_deleted.push(pos);
                            summary_set.push(JsRenderCellUpdate {
                                x: pos.x,
                                y: pos.y,
                                update: JsRenderCellUpdateEnum::Value(None),
                            });
                        } else {
                            // need to get numeric formatting to create display value if its type is a number
                            let (numeric_format, numeric_decimals) = match value.clone() {
                                CellValue::Number(_n) => {
                                    let numeric_format =
                                        sheet.get_formatting_value::<NumericFormat>(pos);
                                    let numeric_decimals =
                                        sheet.get_formatting_value::<NumericDecimals>(pos);
                                    (numeric_format, numeric_decimals)
                                }
                                _ => (None, None),
                            };
                            summary_set.push(JsRenderCellUpdate {
                                x: pos.x,
                                y: pos.y,
                                update: JsRenderCellUpdateEnum::Value(Some(
                                    value.to_display(numeric_format, numeric_decimals),
                                )),
                            });
                            cells_to_compute.push(cell_ref);
                        }

                        let response = sheet.set_cell_value(pos, value)?;
                        Some(response.old_value)
                    })
                    .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                    .collect();

                summary.operations.push(OperationSummary::SetCellValues(
                    sheet.id.to_string(),
                    summary_set,
                ));

                let old_values = Array::new_row_major(size, old_values)
                    .expect("error constructing array of old values for SetCells operation");
                // return reverse operation
                Operation::SetCellValues {
                    region,
                    values: old_values,
                }
            }
            Operation::SetCellCode {
                cell_ref,
                code_cell_value,
            } => {
                let mut reverse_operations = vec![];
                update_code_cell_value(
                    self,
                    cell_ref,
                    code_cell_value,
                    &mut None,
                    &mut reverse_operations,
                    summary,
                );
                cells_to_compute.push(cell_ref);
                reverse_operations[0].clone()
            }
            Operation::SetCellFormats { region, attr } => {
                if let CellFmtArray::FillColor(_) = attr {
                    summary.fill_sheets_modified.push(region.sheet);
                }

                let old_attr = match attr {
                    CellFmtArray::Align(align) => {
                        let sheet = self.grid.sheet_from_id(region.sheet);
                        let cells = region
                            .iter()
                            .enumerate()
                            .filter_map(|(i, cell_ref)| {
                                let x = sheet.get_column_index(cell_ref.column);
                                let y = sheet.get_row_index(cell_ref.row);
                                if let (Some(x), Some(y), Some(format)) = (x, y, align.get_at(i)) {
                                    Some(JsRenderCellUpdate {
                                        x,
                                        y,
                                        update: JsRenderCellUpdateEnum::Align(format.to_owned()),
                                    })
                                } else {
                                    None
                                }
                            })
                            .collect();
                        summary.operations.push(OperationSummary::SetCellFormats(
                            region.sheet.to_string(),
                            cells,
                        ));
                        CellFmtArray::Align(
                            self.set_cell_formats_for_type::<CellAlign>(&region, align),
                        )
                    }
                    CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
                        self.set_cell_formats_for_type::<CellWrap>(&region, wrap),
                    ),
                    CellFmtArray::NumericFormat(num_fmt) => {
                        // only add a summary for changes that impact value.to_string based on this formatting change
                        let sheet = self.grid.sheet_from_id(region.sheet);
                        let cells = region
                            .iter()
                            .enumerate()
                            .filter_map(|(i, cell_ref)| {
                                let x = sheet.get_column_index(cell_ref.column);
                                let y = sheet.get_row_index(cell_ref.row);
                                if let (Some(x), Some(y), Some(format)) = (x, y, num_fmt.get_at(i))
                                {
                                    sheet.get_cell_value(Pos { x, y }).map(|value| {
                                        let numeric_decimal = sheet
                                            .get_column(x)
                                            .and_then(|column| column.numeric_decimals.get(y));

                                        JsRenderCellUpdate {
                                            x,
                                            y,
                                            update: JsRenderCellUpdateEnum::Value(Some(
                                                value
                                                    .to_display(format.to_owned(), numeric_decimal),
                                            )),
                                        }
                                    })
                                } else {
                                    None
                                }
                            })
                            .collect();
                        summary.operations.push(OperationSummary::SetCellFormats(
                            region.sheet.to_string(),
                            cells,
                        ));
                        CellFmtArray::NumericFormat(
                            self.set_cell_formats_for_type::<NumericFormat>(&region, num_fmt),
                        )
                    }
                    CellFmtArray::NumericDecimals(num_decimals) => {
                        // only add a summary for changes that impact value.to_string based on this formatting change
                        let sheet = self.grid.sheet_from_id(region.sheet);
                        let cells = region
                            .iter()
                            .enumerate()
                            .filter_map(|(i, cell_ref)| {
                                let x = sheet.get_column_index(cell_ref.column);
                                let y = sheet.get_row_index(cell_ref.row);
                                if let (Some(x), Some(y), Some(format)) =
                                    (x, y, num_decimals.get_at(i))
                                {
                                    sheet.get_cell_value(Pos { x, y }).map(|value| {
                                        let numeric_format = sheet
                                            .get_column(x)
                                            .and_then(|column| column.numeric_format.get(y));

                                        JsRenderCellUpdate {
                                            x,
                                            y,
                                            update: JsRenderCellUpdateEnum::Value(Some(
                                                value.to_display(numeric_format, format.to_owned()),
                                            )),
                                        }
                                    })
                                } else {
                                    None
                                }
                            })
                            .collect();
                        summary.operations.push(OperationSummary::SetCellFormats(
                            region.sheet.to_string(),
                            cells,
                        ));
                        CellFmtArray::NumericDecimals(
                            self.set_cell_formats_for_type::<NumericDecimals>(
                                &region,
                                num_decimals,
                            ),
                        )
                    }
                    CellFmtArray::Bold(bold) => {
                        let sheet = self.grid.sheet_from_id(region.sheet);
                        let cells = region
                            .iter()
                            .enumerate()
                            .filter_map(|(i, cell_ref)| {
                                let x = sheet.get_column_index(cell_ref.column);
                                let y = sheet.get_row_index(cell_ref.row);
                                if let (Some(x), Some(y), Some(format)) = (x, y, bold.get_at(i)) {
                                    Some(JsRenderCellUpdate {
                                        x,
                                        y,
                                        update: JsRenderCellUpdateEnum::Bold(format.to_owned()),
                                    })
                                } else {
                                    None
                                }
                            })
                            .collect();
                        summary.operations.push(OperationSummary::SetCellFormats(
                            region.sheet.to_string(),
                            cells,
                        ));
                        CellFmtArray::Bold(self.set_cell_formats_for_type::<Bold>(&region, bold))
                    }
                    CellFmtArray::Italic(italic) => {
                        let sheet = self.grid.sheet_from_id(region.sheet);
                        let cells = region
                            .iter()
                            .enumerate()
                            .filter_map(|(i, cell_ref)| {
                                let x = sheet.get_column_index(cell_ref.column);
                                let y = sheet.get_row_index(cell_ref.row);
                                if let (Some(x), Some(y), Some(format)) = (x, y, italic.get_at(i)) {
                                    Some(JsRenderCellUpdate {
                                        x,
                                        y,
                                        update: JsRenderCellUpdateEnum::Italic(format.to_owned()),
                                    })
                                } else {
                                    None
                                }
                            })
                            .collect();
                        summary.operations.push(OperationSummary::SetCellFormats(
                            region.sheet.to_string(),
                            cells,
                        ));
                        CellFmtArray::Italic(
                            self.set_cell_formats_for_type::<Italic>(&region, italic),
                        )
                    }
                    CellFmtArray::TextColor(text_color) => {
                        let sheet = self.grid.sheet_from_id(region.sheet);
                        let cells = region
                            .iter()
                            .enumerate()
                            .filter_map(|(i, cell_ref)| {
                                let x = sheet.get_column_index(cell_ref.column);
                                let y = sheet.get_row_index(cell_ref.row);
                                if let (Some(x), Some(y), Some(format)) =
                                    (x, y, text_color.get_at(i))
                                {
                                    Some(JsRenderCellUpdate {
                                        x,
                                        y,
                                        update: JsRenderCellUpdateEnum::TextColor(
                                            format.to_owned(),
                                        ),
                                    })
                                } else {
                                    None
                                }
                            })
                            .collect();
                        summary.operations.push(OperationSummary::SetCellFormats(
                            region.sheet.to_string(),
                            cells,
                        ));
                        CellFmtArray::TextColor(
                            self.set_cell_formats_for_type::<TextColor>(&region, text_color),
                        )
                    }
                    CellFmtArray::FillColor(fill_color) => {
                        summary.fill_sheets_modified.push(region.sheet);
                        CellFmtArray::FillColor(
                            self.set_cell_formats_for_type::<FillColor>(&region, fill_color),
                        )
                    }
                };

                // return reverse operation
                Operation::SetCellFormats {
                    region,
                    attr: old_attr,
                }
            }
            Operation::AddSheet { sheet } => {
                // todo: need to handle the case where sheet.order overlaps another sheet order
                // this may happen after (1) delete a sheet; (2) MP update w/an added sheet; and (3) undo the deleted sheet
                let sheet_id = sheet.id;
                self.grid
                    .add_sheet(Some(sheet))
                    .expect("duplicate sheet name");
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::DeleteSheet { sheet_id }
            }
            Operation::DeleteSheet { sheet_id } => {
                let deleted_sheet = self.grid.remove_sheet(sheet_id);
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::AddSheet {
                    sheet: deleted_sheet,
                }
            }
            Operation::ReorderSheet { target, order } => {
                let sheet = self.grid.sheet_from_id(target);
                let original_order = sheet.order.clone();
                self.grid.move_sheet(target, order);

                // return reverse operation
                Operation::ReorderSheet {
                    target,
                    order: original_order,
                }
            }
            Operation::SetSheetName { sheet_id, name } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_name = sheet.name.clone();
                sheet.name = name;
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::SetSheetName {
                    sheet_id,
                    name: old_name,
                }
            }
            Operation::SetSheetColor { sheet_id, color } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_color = sheet.color.clone();
                sheet.color = color;
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::SetSheetColor {
                    sheet_id,
                    color: old_color,
                }
            }

            Operation::ResizeColumn {
                sheet_id,
                column,
                new_size,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                if let Some(x) = sheet.get_column_index(column) {
                    summary.offsets_modified.push(sheet.id);
                    let old_size = sheet.offsets.set_column_width(x, new_size);
                    Operation::ResizeColumn {
                        sheet_id,
                        column,
                        new_size: old_size,
                    }
                } else {
                    Operation::None
                }
            }

            Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                if let Some(y) = sheet.get_row_index(row) {
                    let old_size = sheet.offsets.set_row_height(y, new_size);
                    summary.offsets_modified.push(sheet.id);
                    Operation::ResizeRow {
                        sheet_id,
                        row,
                        new_size: old_size,
                    }
                } else {
                    Operation::None
                }
            }
        };
        operation
    }
}
