use std::collections::HashMap;

use super::operation::Operation;
use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
use crate::grid::sheet::validations::validation::Validation;
use crate::grid::{DataTableKind, NumericFormatKind};
use crate::{CellValue, SheetPos, a1::A1Selection};
use crate::{Pos, Rect};
use anyhow::{Error, Result, bail};

impl GridController {
    /// Convert string to a cell_value and generate necessary operations
    /// TODO(ddimaria): remove this and reference CellValue::string_to_cell_value directly
    pub(super) fn string_to_cell_value(
        &self,
        value: &str,
        allow_code: bool,
    ) -> (CellValue, FormatUpdate) {
        CellValue::string_to_cell_value(value, allow_code, false)
    }

    /// Generate operations for a user-initiated change to a cell value
    pub fn set_cell_values_operations(
        &mut self,
        sheet_pos: SheetPos,
        values: Vec<Vec<String>>,

        // whether this was inputted directly by a user (which currently handles
        // percentage conversions differently)
        from_user_input: bool,
    ) -> Result<(Vec<Operation>, Vec<Operation>)> {
        let mut ops = vec![];
        let mut compute_code_ops = vec![];
        let mut data_table_ops = vec![];

        // move the cell values rect left and up by 1 to make adjacent tables intersect
        let cell_value_rect = Rect::from_numbers(
            sheet_pos.x - 1,
            sheet_pos.y - 1,
            values[0].len() as i64 + 1,
            values.len() as i64 + 1,
        );
        let existing_data_tables = self
            .a1_context_sheet_table_bounds(sheet_pos.sheet_id)
            .into_iter()
            .filter(|rect| rect.intersects(cell_value_rect))
            .collect::<Vec<_>>();

        let mut growing_data_tables = existing_data_tables.clone();

        if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
            let height = values.len();

            if height == 0 {
                bail!("[set_cell_values] Empty values");
            }

            let width = values[0].len();

            if width == 0 {
                bail!("[set_cell_values] Empty values");
            }

            let init_cell_values = || vec![vec![None; height]; width];
            let mut cell_values = init_cell_values();
            let mut data_table_cell_values = init_cell_values();
            let mut data_table_columns: HashMap<SheetPos, Vec<u32>> = HashMap::new();
            let mut data_table_rows: HashMap<SheetPos, Vec<u32>> = HashMap::new();
            let mut sheet_format_updates = SheetFormatUpdates::default();

            for (y, row) in values.into_iter().enumerate() {
                for (x, value) in row.into_iter().enumerate() {
                    let value = value.trim().to_string();
                    let pos = Pos::new(sheet_pos.x + x as i64, sheet_pos.y + y as i64);
                    let user_enter_percent = from_user_input
                        && sheet
                            .cell_format(pos)
                            .numeric_format
                            .is_some_and(|format| format.kind == NumericFormatKind::Percentage);

                    let (cell_value, format_update) =
                        CellValue::string_to_cell_value(&value, true, user_enter_percent);

                    let current_sheet_pos = SheetPos::from((pos, sheet_pos.sheet_id));

                    let is_code = matches!(cell_value, CellValue::Code(_));

                    let data_table_pos = existing_data_tables
                        .iter()
                        .find(|rect| rect.contains(pos))
                        .map(|rect| rect.min);

                    // (x,y) is within a data table
                    if let Some(data_table_pos) = data_table_pos {
                        let is_source_cell = sheet.is_source_cell(pos);
                        let is_formula_cell = sheet.is_formula_cell(pos);

                        // if the cell is a formula cell and the source cell, set the cell value (which will remove the data table)
                        if is_formula_cell && is_source_cell {
                            cell_values[x][y] = Some(cell_value);
                        } else {
                            data_table_cell_values[x][y] = Some(cell_value);

                            if !format_update.is_default() {
                                ops.push(Operation::DataTableFormats {
                                    sheet_pos: data_table_pos.to_sheet_pos(sheet_pos.sheet_id),
                                    formats: sheet.to_sheet_format_updates(
                                        sheet_pos,
                                        data_table_pos,
                                        format_update.to_owned(),
                                    )?,
                                });
                            }
                        }
                    }
                    // (x,y) is not within a data table
                    else {
                        cell_values[x][y] = Some(cell_value);

                        // expand the data table to the right or bottom if the
                        // cell value is touching the right or bottom edge
                        GridController::grow_data_table(
                            sheet,
                            &mut growing_data_tables,
                            &mut data_table_columns,
                            &mut data_table_rows,
                            current_sheet_pos,
                            value.is_empty(),
                        );
                    }

                    if !format_update.is_default() {
                        sheet_format_updates.set_format_cell(pos, format_update);
                    }

                    if is_code {
                        compute_code_ops.push(Operation::ComputeCode {
                            sheet_pos: current_sheet_pos,
                        });
                    }
                }
            }

            if data_table_cell_values != init_cell_values() {
                ops.push(Operation::SetDataTableAt {
                    sheet_pos,
                    values: data_table_cell_values.into(),
                });
            }

            if cell_values != init_cell_values() {
                ops.push(Operation::SetCellValues {
                    sheet_pos,
                    values: cell_values.into(),
                });
            }

            if !sheet_format_updates.is_default() {
                ops.push(Operation::SetCellFormatsA1 {
                    sheet_id: sheet_pos.sheet_id,
                    formats: sheet_format_updates,
                });
            }

            data_table_ops.extend(GridController::grow_data_table_operations(
                data_table_columns,
                data_table_rows,
            ));

            ops.extend(compute_code_ops);
        }

        Ok((ops, data_table_ops))
    }

    /// Generates and returns the set of operations to delete the values and code in a Selection
    /// Does not commit the operations or create a transaction.
    ///
    /// If force_table_bounds is true, then the operations will be generated for the table bounds even if the selection is not within a table.
    pub fn delete_cells_operations(
        &self,
        selection: &A1Selection,
        force_table_bounds: bool,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(selection.sheet_id) {
            let rects = sheet.selection_to_rects(
                selection,
                false,
                force_table_bounds,
                true,
                &self.a1_context,
            );

            // reverse the order to delete from right to left
            for rect in rects.into_iter().rev() {
                let mut can_delete_column = false;
                let mut save_data_table_anchors = vec![];
                let mut delete_data_tables = vec![];
                let mut data_tables_automatically_deleted = vec![];

                for (_, data_table_pos, data_table) in sheet.data_tables_intersect_rect(rect) {
                    let data_table_full_rect =
                        data_table.output_rect(data_table_pos.to_owned(), false);
                    let mut data_table_rect = data_table_full_rect;
                    data_table_rect.min.y += data_table.y_adjustment(true);

                    let is_full_table_selected = rect.contains_rect(&data_table_rect);
                    let can_delete_table = is_full_table_selected || data_table.is_code();
                    let table_column_selection =
                        selection.table_column_selection(data_table.name(), self.a1_context());
                    can_delete_column = !is_full_table_selected
                        && table_column_selection.is_some()
                        && !data_table.is_code();

                    // we also delete a data table if it is not fully
                    // selected but any cell in the name ui is selected
                    if !is_full_table_selected
                                 && data_table.get_show_name()
                                // the selection intersects the name ui row
                                && rect.intersects(Rect::new(
                                    data_table_full_rect.min.x,
                                    data_table_full_rect.min.y,
                                    data_table_full_rect.max.x,
                                    data_table_full_rect.min.y,
                                ))
                                // but the selection does not contain the
                                // top-left cell (as it will automatically
                                // delete it in that case)
                                && !rect.contains(data_table_full_rect.min)
                    {
                        delete_data_tables.push(data_table_pos);
                    }

                    // if a data table is not fully selected and there
                    // is no name ui, then we delete its contents and
                    // save its anchor
                    if !is_full_table_selected
                        && !data_table.get_show_name()
                        && rect.contains(data_table_pos)
                        && matches!(data_table.kind, DataTableKind::Import(_))
                    {
                        save_data_table_anchors.push(data_table_pos);
                    }
                    if can_delete_table {
                        // we don't need to manually delete the table as
                        // the SetCellValues operation below will do
                        // this properly
                        data_tables_automatically_deleted.push(data_table_pos);
                    }
                    if can_delete_column {
                        // adjust for hidden columns, reverse the order to delete from right to left
                        let columns = (rect.min.x..=rect.max.x)
                            .map(|x| {
                                // account for hidden columns
                                data_table.get_column_index_from_display_index(
                                    (x - data_table_rect.min.x) as u32,
                                    true,
                                )
                            })
                            .rev()
                            .collect();
                        ops.push(Operation::DeleteDataTableColumns {
                            sheet_pos: data_table_pos.to_sheet_pos(selection.sheet_id),
                            columns,
                            flatten: false,
                            select_table: false,
                        });
                    } else if !delete_data_tables.contains(&data_table_pos)
                        && !data_tables_automatically_deleted.contains(&data_table_pos)
                    {
                        // find the intersection of the selection rect and the data table rect
                        if let Some(intersection) = rect.intersection(&data_table_rect) {
                            ops.push(Operation::SetDataTableAt {
                                sheet_pos: intersection.min.to_sheet_pos(selection.sheet_id),
                                values: CellValues::new_blank(
                                    intersection.width(),
                                    intersection.height(),
                                ),
                            });
                        }
                    }
                }

                if !can_delete_column {
                    if save_data_table_anchors.is_empty() {
                        ops.push(Operation::SetCellValues {
                            sheet_pos: SheetPos::new(selection.sheet_id, rect.min.x, rect.min.y),
                            values: CellValues::new(rect.width(), rect.height()),
                        });
                    } else {
                        // remove all saved_data_table_anchors from the rect
                        // (which may result in multiple resulting rects)
                        let mut rects = vec![rect];
                        for data_table_pos in save_data_table_anchors {
                            let mut next_rects = vec![];
                            for rect in rects {
                                let result = rect.subtract(Rect::single_pos(data_table_pos));
                                next_rects.extend(result);
                            }
                            rects = next_rects;
                        }

                        // set the cell values for each of the resulting rects
                        for rect in rects {
                            ops.push(Operation::SetCellValues {
                                sheet_pos: SheetPos::new(
                                    selection.sheet_id,
                                    rect.min.x,
                                    rect.min.y,
                                ),
                                values: CellValues::new(rect.width(), rect.height()),
                            });
                        }
                    }
                }

                delete_data_tables.iter().for_each(|data_table_pos| {
                    ops.push(Operation::DeleteDataTable {
                        sheet_pos: data_table_pos.to_sheet_pos(selection.sheet_id),
                    });
                });

                // need to update the selection if a table was deleted (since we
                // can no longer use the table ref)
                if selection.has_table_refs() {
                    let replaced = selection.replace_table_refs(self.a1_context());
                    ops.push(Operation::SetCursorA1 {
                        selection: replaced,
                    });
                }
            }
        }

        ops.extend(self.delete_validations_operations(selection));

        ops
    }

    pub fn delete_validations_operations(&self, selection: &A1Selection) -> Vec<Operation> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(selection.sheet_id) {
            for validation in sheet.validations.validations.iter() {
                if let Some(selection) = validation
                    .selection
                    .delete_selection(selection, &self.a1_context)
                {
                    if selection != validation.selection {
                        ops.push(Operation::SetValidation {
                            validation: Validation {
                                selection,
                                ..validation.clone()
                            },
                        });
                    }
                } else {
                    ops.push(Operation::RemoveValidation {
                        sheet_id: validation.selection.sheet_id,
                        validation_id: validation.id,
                    });
                }
            }
        }
        ops
    }

    /// Generates and returns the set of operations to clear the formatting in a sheet_rect
    pub fn delete_values_and_formatting_operations(
        &mut self,
        selection: &A1Selection,
        force_table_bounds: bool,
    ) -> Vec<Operation> {
        let mut ops = self.clear_format_borders_operations(selection);
        ops.extend(self.delete_cells_operations(selection, force_table_bounds));
        ops
    }

    // Replace values in the data table with the
    // intersection of the data table and `values`.
    // Otherwise, add to `cell_values`.
    //
    // If `delete_value` is true, then the values in `values` are
    // deleted from `cell_values`.
    pub fn cell_values_operations(
        &self,
        selection: Option<&A1Selection>,
        start_pos: SheetPos,
        cell_value_pos: Pos,
        cell_values: &mut CellValues,
        mut values: CellValues,
        delete_value: bool,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        let handle_paste_table_in_import = |paste_table_in_import: &CellValue| {
            let cell_type = match paste_table_in_import {
                CellValue::Code(_) => "code",
                CellValue::Import(_) => "table",
                CellValue::Image(_) => "chart",
                CellValue::Html(_) => "chart",
                _ => "unknown",
            };

            let message = format!("Cannot place {cell_type} within a table");

            #[cfg(any(target_family = "wasm", test))]
            {
                let severity = crate::grid::js_types::JsSnackbarSeverity::Error;
                crate::wasm_bindings::js::jsClientMessage(message.to_owned(), severity.to_string());
            }

            message
        };

        if let Some(sheet) = self.try_sheet(start_pos.sheet_id) {
            let rect =
                Rect::from_numbers(start_pos.x, start_pos.y, values.w as i64, values.h as i64);

            for (output_rect, mut intersection_rect, data_table) in
                sheet.iter_code_output_intersects_rect(rect)
            {
                let contains_source_cell = intersection_rect.contains(output_rect.min);

                let is_table_being_deleted = match (delete_value, selection) {
                    (true, Some(selection)) => {
                        start_pos.sheet_id == selection.sheet_id
                            && selection.contains_pos(output_rect.min, self.a1_context())
                    }
                    _ => false,
                };

                // there is no pasting on top of code cell output
                if !data_table.is_code() && !contains_source_cell && !is_table_being_deleted {
                    let columns_y =
                        output_rect.min.y + if data_table.get_show_name() { 1 } else { 0 };

                    let contains_header = data_table.get_show_columns()
                        && intersection_rect.y_range().contains(&columns_y);

                    if data_table.get_show_columns() {
                        intersection_rect.min.y = intersection_rect.min.y.max(columns_y + 1);
                    }

                    let adjusted_rect = Rect::from_numbers(
                        intersection_rect.min.x - start_pos.x,
                        intersection_rect.min.y - start_pos.y,
                        intersection_rect.width() as i64,
                        intersection_rect.height() as i64,
                    );

                    // pull the values from `values`, replacing
                    // the values in `values` with CellValue::Blank
                    let data_table_cell_values = values.get_rect(adjusted_rect);

                    let paste_table_in_import =
                        data_table_cell_values.iter().flatten().find(|cell_value| {
                            cell_value.is_code()
                                || cell_value.is_import()
                                || cell_value.is_image()
                                || cell_value.is_html()
                        });

                    if let Some(paste_table_in_import) = paste_table_in_import {
                        return Err(Error::msg(handle_paste_table_in_import(
                            paste_table_in_import,
                        )));
                    }

                    if let (Some(mut headers), true) =
                        (data_table.column_headers.to_owned(), contains_header)
                    {
                        let y = columns_y - start_pos.y;

                        for x in intersection_rect.x_range() {
                            let column_index = data_table.get_column_index_from_display_index(
                                u32::try_from(x - output_rect.min.x).unwrap_or(0),
                                true,
                            );

                            if let Some(header) = headers.get_mut(column_index as usize) {
                                let safe_x = u32::try_from(x - start_pos.x).unwrap_or(0);
                                let safe_y = u32::try_from(y).unwrap_or(0);

                                let cell_value =
                                    values.remove(safe_x, safe_y).unwrap_or(CellValue::Blank);

                                if cell_value.is_code()
                                    || cell_value.is_import()
                                    || cell_value.is_image()
                                    || cell_value.is_html()
                                {
                                    return Err(Error::msg(handle_paste_table_in_import(
                                        &cell_value,
                                    )));
                                }

                                header.name = cell_value;
                            }
                        }

                        let sheet_pos = output_rect.min.to_sheet_pos(start_pos.sheet_id);
                        ops.push(Operation::DataTableOptionMeta {
                            sheet_pos,
                            name: None,
                            alternating_colors: None,
                            columns: Some(headers.to_vec()),
                            show_name: None,
                            show_columns: None,
                        });
                    }

                    let sheet_pos = intersection_rect.min.to_sheet_pos(start_pos.sheet_id);
                    ops.push(Operation::SetDataTableAt {
                        sheet_pos,
                        values: CellValues::from(data_table_cell_values),
                    });
                }
            }
        }

        for (x, y, value) in values.into_owned_iter() {
            cell_values.set(
                cell_value_pos.x as u32 + x,
                cell_value_pos.y as u32 + y,
                value,
            );
        }

        Ok(ops)
    }
}

#[cfg(test)]
mod test {
    use crate::cell_values::CellValues;
    use crate::controller::GridController;
    use crate::controller::operations::operation::Operation;
    use crate::grid::{CodeCellLanguage, CodeCellValue, NumericFormat, NumericFormatKind, SheetId};
    use crate::number::decimal_from_str;
    use crate::test_util::*;
    use crate::{CellValue, SheetPos, SheetRect, a1::A1Selection};

    #[test]
    fn test() {
        let mut client = GridController::test();
        let sheet_id = SheetId::TEST;
        client.sheet_mut(client.sheet_ids()[0]).id = sheet_id;
        client.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".to_string(),
            None,
        );
        let operations = client.last_transaction().unwrap().operations.clone();

        let values = CellValues::from(CellValue::Text("hello".to_string()));
        assert_eq!(
            operations,
            vec![Operation::SetCellValues {
                sheet_pos: SheetPos {
                    x: 1,
                    y: 2,
                    sheet_id: SheetId::TEST
                },
                values
            }]
        );
    }

    #[test]
    fn boolean_to_cell_value() {
        let gc = GridController::test();

        let (value, format_update) = gc.string_to_cell_value("true", true);
        assert_eq!(value, true.into());
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("false", true);
        assert_eq!(value, false.into());
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("TRUE", true);
        assert_eq!(value, true.into());
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("FALSE", true);
        assert_eq!(value, false.into());
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("tRue", true);
        assert_eq!(value, true.into());
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("FaLse", true);
        assert_eq!(value, false.into());
        assert!(format_update.is_default());
    }

    #[test]
    fn number_to_cell_value() {
        let gc = GridController::test();

        let (value, format_update) = gc.string_to_cell_value("123", true);
        assert_eq!(value, 123.into());
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("123.45", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123.45").unwrap())
        );
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("123,456.78", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456.78").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        let (value, format_update) = gc.string_to_cell_value("123,456,789.01", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456789.01").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        // currency with comma
        let (value, format_update) = gc.string_to_cell_value("$123,456", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // parentheses with comma
        let (value, format_update) = gc.string_to_cell_value("(123,456)", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        // parentheses with -ve
        let (value, format_update) = gc.string_to_cell_value("(-123,456)", true);
        assert_eq!(value, CellValue::Text("(-123,456)".to_string()));
        assert!(format_update.is_default());

        // currency with a space
        let (value, format_update) = gc.string_to_cell_value("$ 123,456", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with a space and -ve outside
        let (value, format_update) = gc.string_to_cell_value("- $ 123,456", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with a space and -ve inside
        let (value, format_update) = gc.string_to_cell_value("$ -123,456", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with parentheses outside
        let (value, format_update) = gc.string_to_cell_value("($ 123,456)", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with parentheses inside
        let (value, format_update) = gc.string_to_cell_value("$(123,456)", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with parentheses and space
        let (value, format_update) = gc.string_to_cell_value("$ ( 123,456)", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // parentheses with -ve
        let (value, format_update) = gc.string_to_cell_value("(-$123,456)", true);
        assert_eq!(value, CellValue::Text("(-$123,456)".to_string()));
        assert!(format_update.is_default());

        // percent with a space
        let (value, format_update) = gc.string_to_cell_value("123456 %", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("1234.56").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            }))
        );

        // percent with a comma
        let (value, format_update) = gc.string_to_cell_value("123,456%", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("1234.56").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            }))
        );
    }

    #[test]
    fn formula_to_cell_value() {
        let gc = GridController::test();

        let (value, _) = gc.string_to_cell_value("=1+1", true);
        assert_eq!(
            value,
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "1+1".to_string(),
            })
        );

        let (value, _) = gc.string_to_cell_value("=1/0", true);
        assert_eq!(
            value,
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "1/0".to_string(),
            })
        );

        let (value, _) = gc.string_to_cell_value("=A1+A2", true);
        assert_eq!(
            value,
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "A1+A2".to_string(),
            })
        );

        let (value, _) = gc.string_to_cell_value("=A1+A2", false);
        assert_eq!(value, CellValue::Text("A1+A2".to_string()));
    }

    #[test]
    fn test_problematic_number() {
        let gc = GridController::test();
        let value = "980E92207901934";
        let (cell_value, _) = gc.string_to_cell_value(value, true);
        assert_eq!(cell_value.to_string(), value.to_string());
    }

    #[test]
    fn test_delete_cells_operations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        gc.set_cell_value(sheet_pos, "hello".to_string(), None);

        let sheet_pos_2 = SheetPos {
            x: 2,
            y: 2,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos_2,
            CodeCellLanguage::Formula,
            "5 + 5".to_string(),
            None,
            None,
        );

        let selection = A1Selection::from_rect(SheetRect::from_numbers(1, 2, 2, 1, sheet_id));
        let operations = gc.delete_cells_operations(&selection, false);
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };

        assert_eq!(operations.len(), 1);
        assert_eq!(
            operations,
            vec![Operation::SetCellValues {
                sheet_pos,
                values: CellValues::new(2, 1)
            },]
        );
    }

    #[test]
    fn test_delete_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        gc.set_cell_value(sheet_pos, "hello".to_string(), None);

        let sheet_pos_2 = SheetPos {
            x: 2,
            y: 2,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos_2,
            CodeCellLanguage::Formula,
            "5 + 5".to_string(),
            None,
            None,
        );
        let selection = A1Selection::test_a1("A2:,B");
        let operations = gc.delete_cells_operations(&selection, false);

        assert_eq!(operations.len(), 2);
        assert_eq!(
            operations,
            vec![
                Operation::SetCellValues {
                    sheet_pos: SheetPos::new(sheet_id, 2, 1),
                    values: CellValues::new(1, 2)
                },
                Operation::SetCellValues {
                    sheet_pos: SheetPos::new(sheet_id, 1, 2),
                    values: CellValues::new(2, 1)
                },
            ]
        );
    }

    #[test]
    fn test_set_cell_values_next_to_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        print_sheet(gc.sheet(sheet_id));
        assert_eq!(data_table.width(), 3);
        assert_eq!(data_table.height(false), 5);

        // add a cell to the right of the data table
        let sheet_pos = SheetPos::new(sheet_id, 4, 3);
        gc.set_cell_values(sheet_pos, vec![vec!["a".to_string()]], None);
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        print_sheet(gc.sheet(sheet_id));
        assert_eq!(data_table.width(), 4);

        // add a cell to the bottom of the data table
        let sheet_pos = SheetPos::new(sheet_id, 1, 6);
        gc.set_cell_values(sheet_pos, vec![vec!["a".to_string()]], None);
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        print_sheet(gc.sheet(sheet_id));
        assert_eq!(data_table.height(false), 6);
    }

    #[test]
    fn test_delete_cells_within_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![b2], 3, 3);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 5, vec!["3", "4", "5"]);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 6, vec!["6", "7", "8"]);

        let selection = A1Selection::test_a1("A5:C7");
        gc.delete_cells(&selection, None);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 5, vec!["", "", "5"]);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 6, vec!["", "", "8"]);

        gc.undo(None);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 5, vec!["3", "4", "5"]);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 6, vec!["6", "7", "8"]);

        gc.redo(None);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 5, vec!["", "", "5"]);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 6, vec!["", "", "8"]);
    }

    #[test]
    fn test_delete_cells_from_data_table_without_ui() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // create a data table without ui
        test_create_data_table_no_ui(&mut gc, sheet_id, pos![B2], 3, 3);
        assert_cell_value_row(&gc, sheet_id, 1, 4, 2, vec!["", "0", "1", "2"]);

        // should delete part of the first row of the data table
        gc.delete_cells(&A1Selection::test_a1("A1:C4"), None);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["", "", "2"]);

        gc.undo(None);
        assert_cell_value_row(&gc, sheet_id, 1, 4, 2, vec!["", "0", "1", "2"]);

        gc.redo(None);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["", "", "2"]);
    }
}
