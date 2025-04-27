use std::collections::HashMap;

use super::operation::Operation;
use crate::Pos;
use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::grid::CodeCellLanguage;
use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
use crate::{CellValue, SheetPos, a1::A1Selection};
use anyhow::{Result, bail};

impl GridController {
    /// Convert string to a cell_value and generate necessary operations
    /// TODO(ddimaria): remove this and reference CellValue::string_to_cell_value directly
    pub(super) fn string_to_cell_value(
        &self,
        value: &str,
        allow_code: bool,
    ) -> (CellValue, FormatUpdate) {
        CellValue::string_to_cell_value(value, allow_code)
    }

    /// Generate operations for a user-initiated change to a cell value
    pub fn set_cell_values_operations(
        &mut self,
        sheet_pos: SheetPos,
        values: Vec<Vec<String>>,
    ) -> Result<(Vec<Operation>, Vec<Operation>)> {
        let mut ops = vec![];
        let mut compute_code_ops = vec![];
        let mut data_table_ops = vec![];
        let existing_data_tables = self
            .a1_context()
            .tables()
            .filter(|table| {
                table.sheet_id == sheet_pos.sheet_id && table.language == CodeCellLanguage::Import
            })
            .map(|table| table.bounds)
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
                    let (cell_value, format_update) = CellValue::string_to_cell_value(&value, true);

                    let pos = Pos::new(sheet_pos.x + x as i64, sheet_pos.y + y as i64);
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

                        // expand the data table to the right if the cell
                        // value is touching the right edge
                        let (col, row) = sheet.expand_columns_and_rows(
                            &growing_data_tables,
                            current_sheet_pos,
                            value,
                        );

                        // if an expansion happened, adjust the size of the
                        // data table rect so that successive iterations
                        // continue to expand the data table.
                        if let Some((sheet_pos, col)) = col {
                            let entry = data_table_columns.entry(sheet_pos).or_default();

                            if !entry.contains(&col) {
                                // add the column to data_table_columns
                                entry.push(col);

                                let pos_to_check = Pos::new(sheet_pos.x, sheet_pos.y);

                                // adjust the size of the data table rect so that
                                // successive iterations continue to expand the data
                                // table.
                                growing_data_tables
                                    .iter_mut()
                                    .filter(|rect| rect.contains(pos_to_check))
                                    .for_each(|rect| {
                                        rect.max.x += 1;
                                    });
                            }
                        }

                        // expand the data table to the bottom if the cell
                        // value is touching the bottom edge
                        if let Some((sheet_pos, row)) = row {
                            let entry = data_table_rows.entry(sheet_pos).or_default();

                            // if an expansion happened, adjust the size of the
                            // data table rect so that successive iterations
                            // continue to expand the data table.
                            if !entry.contains(&row) {
                                // add the row to data_table_rows
                                entry.push(row);

                                let pos_to_check = Pos::new(sheet_pos.x, sheet_pos.y);

                                // adjust the size of the data table rect so that
                                // successive iterations continue to expand the data
                                // table.
                                growing_data_tables
                                    .iter_mut()
                                    .filter(|rect| rect.contains(pos_to_check))
                                    .for_each(|rect| {
                                        rect.max.y += 1;
                                    });
                            }
                        }
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

            if !data_table_columns.is_empty() {
                for (sheet_pos, columns) in data_table_columns {
                    data_table_ops.push(Operation::InsertDataTableColumns {
                        sheet_pos,
                        columns: columns.into_iter().map(|c| (c, None, None)).collect(),
                        swallow: true,
                        select_table: false,
                        copy_formats_from: None,
                        copy_formats: None,
                    });
                }
            }

            if !data_table_rows.is_empty() {
                for (sheet_pos, rows) in data_table_rows {
                    data_table_ops.push(Operation::InsertDataTableRows {
                        sheet_pos,
                        rows: rows.into_iter().map(|r| (r, None)).collect(),
                        swallow: true,
                        select_table: false,
                        copy_formats_from: None,
                        copy_formats: None,
                    });
                }
            }

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
            let rects =
                sheet.selection_to_rects(selection, false, force_table_bounds, &self.a1_context);

            // reverse the order to delete from right to left
            for rect in rects.into_iter().rev() {
                let sheet_pos = SheetPos::from((rect.min.x, rect.min.y, selection.sheet_id));
                let mut can_delete_column = false;

                if let Ok(data_table_pos) = sheet.first_data_table_within(sheet_pos.into()) {
                    if let Some(data_table) = sheet.data_table(data_table_pos.to_owned()) {
                        let mut data_table_rect =
                            data_table.output_rect(data_table_pos.to_owned(), false);
                        data_table_rect.min.y += data_table.y_adjustment(true);

                        let is_full_table_selected = rect.contains_rect(&data_table_rect);
                        let can_delete_table = is_full_table_selected || data_table.is_code();
                        let table_column_selection =
                            selection.table_column_selection(data_table.name(), self.a1_context());
                        can_delete_column = !is_full_table_selected
                            && table_column_selection.is_some()
                            && !data_table.is_code();

                        if can_delete_table {
                            ops.push(Operation::DeleteDataTable {
                                sheet_pos: data_table_pos.to_sheet_pos(sheet_pos.sheet_id),
                            });
                        } else if can_delete_column {
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
                                sheet_pos: data_table_pos.to_sheet_pos(sheet_pos.sheet_id),
                                columns,
                                flatten: false,
                                select_table: false,
                            });
                        } else {
                            ops.push(Operation::SetDataTableAt {
                                sheet_pos,
                                values: CellValues::new_blank(
                                    rect.width().min(
                                        (data_table_rect.max.x - sheet_pos.x + 1).max(1) as u32,
                                    ),
                                    rect.height().min(
                                        (data_table_rect.max.y - sheet_pos.y + 1).max(1) as u32,
                                    ),
                                ),
                            });
                        }
                    }
                }

                if !can_delete_column {
                    ops.push(Operation::SetCellValues {
                        sheet_pos,
                        values: CellValues::new(rect.width(), rect.height()),
                    });
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
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::cell_values::CellValues;
    use crate::controller::GridController;
    use crate::controller::operations::operation::Operation;
    use crate::controller::user_actions::import::tests::simple_csv;
    use crate::grid::{CodeCellLanguage, CodeCellValue, NumericFormat, NumericFormatKind, SheetId};
    use crate::{CellValue, SheetPos, SheetRect, a1::A1Selection};
    use crate::{Rect, print_table_sheet};

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
            CellValue::Number(BigDecimal::from_str("123.45").unwrap())
        );
        assert!(format_update.is_default());

        let (value, format_update) = gc.string_to_cell_value("123,456.78", true);
        assert_eq!(
            value,
            CellValue::Number(BigDecimal::from_str("123456.78").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        let (value, format_update) = gc.string_to_cell_value("123,456,789.01", true);
        assert_eq!(
            value,
            CellValue::Number(BigDecimal::from_str("123456789.01").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        // currency with comma
        let (value, format_update) = gc.string_to_cell_value("$123,456", true);
        assert_eq!(
            value,
            CellValue::Number(BigDecimal::from_str("123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("-123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("-123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("-123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("-123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("-123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("-123456").unwrap())
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
            CellValue::Number(BigDecimal::from_str("1234.56").unwrap())
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
            CellValue::Number(BigDecimal::from_str("1234.56").unwrap())
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
    fn problematic_number() {
        let gc = GridController::test();
        let value = "980E92207901934";
        let (cell_value, _) = gc.string_to_cell_value(value, true);
        assert_eq!(cell_value.to_string(), value.to_string());
    }

    #[test]
    fn delete_cells_operations() {
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
        );
        let selection = A1Selection::from_rect(SheetRect::from_numbers(1, 2, 2, 1, sheet_id));
        let operations = gc.delete_cells_operations(&selection, false);
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let values = CellValues::new(2, 1);

        assert_eq!(operations.len(), 1);
        assert_eq!(
            operations,
            vec![Operation::SetCellValues { sheet_pos, values },]
        );
    }

    #[test]
    fn delete_columns() {
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
    fn test_set_cell_values_operations() {
        // let mut gc = GridController::test();
        let (mut gc, _, _, _) = simple_csv();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 13,
            sheet_id,
        };

        let values = vec![vec!["a".to_string()]];
        let (ops, data_table_ops) = gc.set_cell_values_operations(sheet_pos, values).unwrap();
        println!("{:?}", ops);
        println!("{:?}", data_table_ops);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        print_table_sheet(sheet, Rect::from_numbers(1, 1, 4, 14), true);
    }
}
