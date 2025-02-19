use std::str::FromStr;

use bigdecimal::BigDecimal;

use super::operation::Operation;
use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
use crate::grid::{CodeCellLanguage, CodeCellValue, NumericFormat, NumericFormatKind};
use crate::Pos;
use crate::{a1::A1Selection, CellValue, SheetPos};

// when a number's decimal is larger than this value, then it will treat it as text (this avoids an attempt to allocate a huge vector)
// there is an unmerged alternative that might be interesting: https://github.com/declanvk/bigdecimal-rs/commit/b0a2ea3a403ddeeeaeef1ddfc41ff2ae4a4252d6
// see original issue here: https://github.com/akubera/bigdecimal-rs/issues/108
const MAX_BIG_DECIMAL_SIZE: usize = 10000000;

impl GridController {
    /// Convert string to a cell_value and generate necessary operations
    pub(super) fn string_to_cell_value(
        &self,
        value: &str,
        allow_code: bool,
    ) -> (CellValue, FormatUpdate) {
        let mut format_update = FormatUpdate::default();

        let cell_value = if value.is_empty() {
            CellValue::Blank
        } else if let Some((currency, number)) = CellValue::unpack_currency(value) {
            format_update = FormatUpdate {
                numeric_format: Some(Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(currency),
                })),
                ..Default::default()
            };

            if value.contains(',') {
                format_update.numeric_commas = Some(Some(true));
            }

            // We no longer automatically set numeric decimals for
            // currency; instead, we handle changes in currency decimal
            // length by using 2 if currency is set by default.

            CellValue::Number(number)
        } else if let Some(bool) = CellValue::unpack_boolean(value) {
            bool
        } else if let Ok(bd) = BigDecimal::from_str(&CellValue::strip_commas(value)) {
            if (bd.fractional_digit_count().unsigned_abs() as usize) > MAX_BIG_DECIMAL_SIZE {
                CellValue::Text(value.into())
            } else {
                if value.contains(',') {
                    format_update = FormatUpdate {
                        numeric_commas: Some(Some(true)),
                        ..Default::default()
                    };
                }
                CellValue::Number(bd)
            }
        } else if let Some(percent) = CellValue::unpack_percentage(value) {
            format_update = FormatUpdate {
                numeric_format: Some(Some(NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                })),
                ..Default::default()
            };
            CellValue::Number(percent)
        } else if let Some(time) = CellValue::unpack_time(value) {
            time
        } else if let Some(date) = CellValue::unpack_date(value) {
            date
        } else if let Some(date_time) = CellValue::unpack_date_time(value) {
            date_time
        } else if let Some(duration) = CellValue::unpack_duration(value) {
            duration
        } else if let Some(code) = value.strip_prefix("=") {
            if allow_code {
                CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code: code.to_string(),
                })
            } else {
                CellValue::Text(code.to_string())
            }
        } else {
            CellValue::Text(value.into())
        };

        (cell_value, format_update)
    }

    /// Generate operations for a user-initiated change to a cell value
    pub fn set_cell_value_operations(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        // strip whitespace
        let value = value.trim();

        // convert the string to a cell value and generate necessary operations
        let (cell_value, format_update) = self.string_to_cell_value(value, true);

        let is_code = matches!(cell_value, CellValue::Code(_));

        ops.push(Operation::SetCellValues {
            sheet_pos,
            values: CellValues::from(cell_value),
        });

        if !format_update.is_default() {
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: sheet_pos.sheet_id,
                formats: SheetFormatUpdates::from_selection(
                    &A1Selection::from_single_cell(sheet_pos),
                    format_update,
                ),
            });
        }

        if is_code {
            ops.push(Operation::ComputeCode { sheet_pos });
        }

        ops
    }

    /// Generate operations for a user-initiated change to a cell value
    pub fn set_cell_values_operations(
        &mut self,
        sheet_pos: SheetPos,
        values: Vec<Vec<String>>,
    ) -> Vec<Operation> {
        let mut ops = vec![];
        let mut compute_code_ops = vec![];

        let height = values.len();
        if height == 0 {
            dbgjs!("[set_cell_values] Empty values");
            return ops;
        }

        let width = values[0].len();
        if width == 0 {
            dbgjs!("[set_cell_values] Empty values");
            return ops;
        }

        let mut cell_values = CellValues::new(width as u32, height as u32);
        let mut sheet_format_updates = SheetFormatUpdates::default();

        for (y, row) in values.iter().enumerate() {
            for (x, value) in row.iter().enumerate() {
                let (cell_value, format_update) = self.string_to_cell_value(value, true);

                let is_code = matches!(cell_value, CellValue::Code(_));

                cell_values.set(x as u32, y as u32, cell_value);

                let pos = Pos {
                    x: sheet_pos.x + x as i64,
                    y: sheet_pos.y + y as i64,
                };

                if !format_update.is_default() {
                    sheet_format_updates.set_format_cell(pos, format_update);
                }

                if is_code {
                    compute_code_ops.push(Operation::ComputeCode {
                        sheet_pos: pos.to_sheet_pos(sheet_pos.sheet_id),
                    });
                }
            }
        }

        ops.push(Operation::SetCellValues {
            sheet_pos,
            values: cell_values,
        });

        if !sheet_format_updates.is_default() {
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: sheet_pos.sheet_id,
                formats: sheet_format_updates,
            });
        }

        ops.extend(compute_code_ops);

        ops
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
            let rects = sheet.selection_to_rects(selection, false, force_table_bounds);

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
                        let can_delete_table = is_full_table_selected || data_table.readonly;
                        let table_column_selection = selection.table_column_selection(
                            &data_table.name.to_display(),
                            self.a1_context(),
                        );
                        can_delete_column = !is_full_table_selected
                            && table_column_selection.is_some()
                            && !data_table.readonly;

                        if can_delete_table {
                            ops.push(Operation::DeleteDataTable {
                                sheet_pos: data_table_pos.to_sheet_pos(sheet_pos.sheet_id),
                            });
                        } else if can_delete_column {
                            // adjust for hidden columns, reverse the order to delete from right to left
                            (rect.min.x..=rect.max.x)
                                .map(|x| {
                                    // account for hidden columns
                                    data_table.get_column_index_from_display_index(
                                        (x - data_table_rect.min.x) as u32,
                                    )
                                })
                                .rev()
                                .for_each(|index| {
                                    ops.push(Operation::DeleteDataTableColumn {
                                        sheet_pos: data_table_pos.to_sheet_pos(sheet_pos.sheet_id),
                                        index,
                                        flatten: false,
                                        select_table: false,
                                    });
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
    use crate::controller::operations::operation::Operation;
    use crate::controller::GridController;
    use crate::grid::{CodeCellLanguage, CodeCellValue, SheetId};
    use crate::{a1::A1Selection, CellValue, SheetPos, SheetRect};

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
}
