use std::collections::{HashMap, HashSet};

use super::operation::Operation;
use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::grid::formats::SheetFormatUpdates;
use crate::grid::sheet::validations::validation::Validation;
use crate::grid::{CodeCellLanguage, DataTableKind, NumericFormatKind};
use crate::{CellValue, SheetPos, a1::A1Selection};
use crate::{Pos, Rect};
use anyhow::{Error, Result, bail};

impl GridController {
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
        let moved_left_up_rect = Rect::from_numbers(
            sheet_pos.x - 1,
            sheet_pos.y - 1,
            values[0].len() as i64 + 1,
            values.len() as i64 + 1,
        );
        let mut data_tables_rects = vec![];
        if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
            data_tables_rects = sheet
                .data_tables_output_rects_intersect_rect(moved_left_up_rect, |_, data_table| {
                    !data_table.is_code()
                })
                .collect();
        }

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
                    if let Some(value) = value.strip_prefix("=") {
                        ops.extend(self.set_code_cell_operations(
                            pos.to_sheet_pos(sheet.id),
                            CodeCellLanguage::Formula,
                            value.to_string(),
                            None,
                        ));
                        continue;
                    }
                    let user_enter_percent = from_user_input
                        && sheet
                            .cell_format(pos)
                            .numeric_format
                            .is_some_and(|format| format.kind == NumericFormatKind::Percentage);

                    let (cell_value, format_update) =
                        CellValue::string_to_cell_value(&value, user_enter_percent);

                    let current_sheet_pos = SheetPos::from((pos, sheet_pos.sheet_id));

                    // todo: this needs to be updated...probably adding to data tables
                    let is_code = false;
                    let data_table_import_pos = sheet.data_table_import_pos_that_contains(pos);

                    // (x,y) is within a data table (import / editable)
                    if let Some(data_table_pos) = data_table_import_pos {
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
                    // (x,y) is not within a data table
                    else {
                        cell_values[x][y] = Some(cell_value);

                        // expand the data table to the right or bottom if the
                        // cell value is touching the right or bottom edge
                        GridController::grow_data_table(
                            sheet,
                            &mut data_tables_rects,
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

            // Expand each rect to include full merged cells
            let expanded_rects: Vec<Rect> = rects
                .into_iter()
                .map(|rect| {
                    let mut expanded = rect;

                    // Check all corner positions to find merged cells that might partially overlap
                    for pos in [
                        Pos {
                            x: rect.min.x,
                            y: rect.min.y,
                        },
                        Pos {
                            x: rect.max.x,
                            y: rect.min.y,
                        },
                        Pos {
                            x: rect.min.x,
                            y: rect.max.y,
                        },
                        Pos {
                            x: rect.max.x,
                            y: rect.max.y,
                        },
                    ] {
                        if let Some(merge_rect) = sheet.merge_cells.get_merge_cell_rect(pos) {
                            expanded = expanded.union(&merge_rect);
                        }
                    }

                    // Also get all merged cells fully contained in the rect
                    let merged_cells = sheet.merge_cells.get_merge_cells(expanded);
                    for merge_rect in merged_cells {
                        expanded = expanded.union(&merge_rect);
                    }

                    expanded
                })
                .collect();

            let rects = expanded_rects;
            // Track data tables already scheduled for deletion across all rects
            // to avoid duplicate DeleteDataTable operations
            let mut already_scheduled_for_deletion: HashSet<Pos> = HashSet::new();

            // reverse the order to delete from right to left
            for rect in rects.into_iter().rev() {
                let mut can_delete_column = false;
                let mut save_data_table_anchors = vec![];
                let mut delete_data_tables = vec![];

                for (_, data_table_pos, data_table) in sheet.data_tables_intersect_rect_sorted(rect)
                {
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
                        delete_data_tables.push(data_table_pos);
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
                    } else if !delete_data_tables.contains(&data_table_pos) {
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
                    // Combine positions to exclude: saved anchors, data tables being deleted in this rect,
                    // and data tables already scheduled for deletion from previous rects
                    // (DeleteDataTable handles deletion, so we don't need SetCellValues on those cells)
                    let positions_to_exclude: Vec<Pos> = save_data_table_anchors
                        .into_iter()
                        .chain(delete_data_tables.iter().copied())
                        .chain(already_scheduled_for_deletion.iter().copied())
                        .collect();

                    if positions_to_exclude.is_empty() {
                        ops.push(Operation::SetCellValues {
                            sheet_pos: SheetPos::new(selection.sheet_id, rect.min.x, rect.min.y),
                            values: CellValues::new_blank(rect.width(), rect.height()),
                        });
                    } else {
                        // remove all positions_to_exclude from the rect
                        // (which may result in multiple resulting rects)
                        let mut rects = vec![rect];
                        for pos in positions_to_exclude {
                            let mut next_rects = vec![];
                            for rect in rects {
                                let result = rect.subtract(Rect::single_pos(pos));
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
                                values: CellValues::new_blank(rect.width(), rect.height()),
                            });
                        }
                    }
                }

                // Only create DeleteDataTable operations for tables not already scheduled
                for data_table_pos in delete_data_tables {
                    if already_scheduled_for_deletion.insert(data_table_pos) {
                        ops.push(Operation::DeleteDataTable {
                            sheet_pos: data_table_pos.to_sheet_pos(selection.sheet_id),
                        });
                    }
                }

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
        let mut ops = self.delete_cells_operations(selection, force_table_bounds);
        // Skip RichText clearing because the cells are being deleted anyway.
        // If we don't skip, the RichText clearing operations would overwrite
        // the blank values set by delete_cells_operations.
        ops.extend(self.clear_format_borders_operations(selection, true, true));
        ops.extend(self.unmerge_cells_a1_selection_operations(selection.clone()));
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

        // todo: this is likely unnecessary as charts can currently only exist within DataTable outputs
        let handle_paste_table_in_import = |paste_table_in_import: &CellValue| {
            let cell_type = match paste_table_in_import {
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
                sheet.iter_data_tables_intersects_rect(rect)
            {
                // there is no pasting on top of code cell output
                if data_table.is_code() {
                    continue;
                }

                let data_table_pos = output_rect.min;

                let contains_source_cell = intersection_rect.contains(data_table_pos);
                if contains_source_cell {
                    continue;
                }

                let is_table_being_deleted = match (delete_value, selection) {
                    (true, Some(selection)) => {
                        start_pos.sheet_id == selection.sheet_id
                            && selection.contains_pos(data_table_pos, self.a1_context())
                    }
                    _ => false,
                };
                if is_table_being_deleted {
                    continue;
                }

                let columns_y = output_rect.min.y + if data_table.get_show_name() { 1 } else { 0 };

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
                    data_table_cell_values
                        .iter()
                        .flatten()
                        .find_map(|cell_value| {
                            cell_value
                                .as_ref()
                                .filter(|cv| cv.is_image() || cv.is_html())
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

                            if cell_value.is_image() || cell_value.is_html() {
                                return Err(Error::msg(handle_paste_table_in_import(&cell_value)));
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
    use crate::a1::A1Selection;
    use crate::cell_values::CellValues;
    use crate::controller::GridController;
    use crate::controller::operations::operation::Operation;
    use crate::grid::{CodeCellLanguage, SheetId};
    use crate::test_util::*;
    use crate::{CellValue, Pos, SheetPos, SheetRect};

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
            false,
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
    fn test_delete_cells_operations() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let sheet_pos = pos![sheet_id!A2];
        gc.set_cell_value(sheet_pos, "hello".to_string(), None, true);

        let sheet_pos_2 = pos![sheet_id!B2];
        gc.set_code_cell(
            sheet_pos_2,
            CodeCellLanguage::Formula,
            "5 + 5".to_string(),
            None,
            None,
            false,
        );

        let selection = A1Selection::from_rect(SheetRect::from_numbers(1, 2, 2, 1, sheet_id));
        let operations = gc.delete_cells_operations(&selection, false);
        let sheet_pos = pos![sheet_id!A2];

        // 1x1 formulas are stored as CellValue::Code, so they're deleted by SetCellValues
        // (not DeleteDataTable), meaning a single SetCellValues covers both A2 and B2
        assert_eq!(operations.len(), 1);
        assert_eq!(
            operations,
            vec![Operation::SetCellValues {
                sheet_pos,
                values: CellValues::new_blank(2, 1) // Covers A2:B2
            }]
        );
    }

    #[test]
    fn test_delete_columns() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let sheet_pos = pos![sheet_id!A2];
        gc.set_cell_value(sheet_pos, "hello".to_string(), None, true);

        let sheet_pos_2 = pos![sheet_id!B2];
        gc.set_code_cell(
            sheet_pos_2,
            CodeCellLanguage::Formula,
            "5 + 5".to_string(),
            None,
            None,
            false,
        );
        let selection = A1Selection::test_a1("A2:,B");
        let operations = gc.delete_cells_operations(&selection, false);

        // 1x1 formulas are stored as CellValue::Code, so they're deleted by SetCellValues
        // (not DeleteDataTable). Column B covers B1:B2 and row 2 covers A2:B2.
        assert_eq!(operations.len(), 2);
        assert_eq!(
            operations,
            vec![
                Operation::SetCellValues {
                    sheet_pos: SheetPos::new(sheet_id, 2, 1),
                    values: CellValues::new_blank(1, 2) // B1:B2
                },
                Operation::SetCellValues {
                    sheet_pos: SheetPos::new(sheet_id, 1, 2),
                    values: CellValues::new_blank(2, 1) // A2:B2
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
        gc.set_cell_values(sheet_pos, vec![vec!["a".to_string()]], None, false);
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        print_sheet(gc.sheet(sheet_id));
        assert_eq!(data_table.width(), 4);

        // add a cell to the bottom of the data table
        let sheet_pos = SheetPos::new(sheet_id, 1, 6);
        gc.set_cell_values(sheet_pos, vec![vec!["a".to_string()]], None, false);
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
        gc.delete_cells(&selection, None, false);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 5, vec!["", "", "5"]);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 6, vec!["", "", "8"]);

        gc.undo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 5, vec!["3", "4", "5"]);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 6, vec!["6", "7", "8"]);

        gc.redo(1, None, false);
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
        gc.delete_cells(&A1Selection::test_a1("A1:C4"), None, false);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["", "", "2"]);

        gc.undo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 1, 4, 2, vec!["", "0", "1", "2"]);

        gc.redo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["", "", "2"]);
    }

    #[test]
    fn test_delete_merged_cell_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set a value at B1
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            "test".to_string(),
            None,
            false,
        );

        // Merge cells B1:C2
        let merge_selection = crate::a1::A1Selection::test_a1_sheet_id("B1:C2", sheet_id);
        gc.merge_cells(merge_selection, None, false);

        // Verify the value exists at the anchor
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );

        // Delete with cursor on C2 (not the anchor B1)
        let delete_selection = crate::a1::A1Selection::test_a1_sheet_id("C2", sheet_id);
        gc.delete_cells(&delete_selection, None, false);

        // Value should be deleted from the entire merged cell
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(gc.sheet(sheet_id).display_value(Pos { x: 3, y: 2 }), None);

        // Undo should restore the value
        gc.undo(1, None, false);
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Text("test".to_string()))
        );
    }
}
