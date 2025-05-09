use super::operation::Operation;
use crate::{
    Array, ArraySize, CellValue, CopyFormats, Pos, SheetPos, SheetRect,
    cellvalue::Import,
    controller::GridController,
    grid::{
        DataTable, DataTableKind,
        data_table::{column_header::DataTableColumnHeader, sort::DataTableSort},
        formats::SheetFormatUpdates,
        unique_data_table_name,
    },
};

use anyhow::Result;

impl GridController {
    pub fn flatten_data_table_operations(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        vec![Operation::FlattenDataTable { sheet_pos }]
    }

    pub fn code_data_table_to_data_table_operations(
        &self,
        sheet_pos: SheetPos,
    ) -> Result<Vec<Operation>> {
        let import = Import::new("".into());
        let kind = DataTableKind::Import(import.to_owned());
        let cell_value = CellValue::Import(import);

        Ok(vec![Operation::SwitchDataTableKind {
            sheet_pos,
            kind,
            value: cell_value,
        }])
    }

    /// Collects all operations that would be needed to convert a grid to a data table.
    /// If a data table is found within the sheet_rect, it will not be added to the operations.
    pub fn grid_to_data_table_operations(&self, sheet_rect: SheetRect) -> Vec<Operation> {
        let mut ops = vec![];

        if let Some(sheet) = self.grid.try_sheet(sheet_rect.sheet_id) {
            let no_data_table = sheet.enforce_no_data_table_within_rect(sheet_rect.into());

            if no_data_table {
                ops.push(Operation::GridToDataTable { sheet_rect });
            }
        }

        ops
    }

    pub fn data_table_meta_operations(
        &self,
        sheet_pos: SheetPos,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_name: Option<Option<bool>>,
        show_columns: Option<Option<bool>>,
    ) -> Vec<Operation> {
        vec![Operation::DataTableOptionMeta {
            sheet_pos,
            name,
            alternating_colors,
            columns,
            show_name: show_name.map(|show_name| show_name.into()),
            show_columns: show_columns.map(|show_columns| show_columns.into()),
        }]
    }

    /// Inserts a column in the table. If swallow is true, then the column is inserted
    /// using the data that already exists on the sheet. Otherwise, copy_formats
    /// is checked and any formats and borders are taken from the source column.
    pub(crate) fn data_table_insert_columns_operations(
        &self,
        sheet_pos: SheetPos,
        columns: Vec<u32>,
        swallow: bool,
        copy_formats_from: Option<u32>,
        copy_formats: Option<CopyFormats>,
    ) -> Vec<Operation> {
        vec![Operation::InsertDataTableColumns {
            sheet_pos,
            columns: columns
                .into_iter()
                .map(|index| (index, None, None))
                .collect(),
            swallow,
            select_table: false,
            copy_formats_from,
            copy_formats,
        }]
    }

    /// Inserts a row in the table. If swallow is true, then the row is inserted
    /// using the data that already exists on the sheet. Otherwise, copy_formats
    /// is checked and any formats and borders are taken from the source row.
    pub(crate) fn data_table_insert_rows_operations(
        &self,
        sheet_pos: SheetPos,
        rows: Vec<u32>,
        swallow: bool,
        copy_formats_from: Option<u32>,
        copy_formats: Option<CopyFormats>,
    ) -> Vec<Operation> {
        vec![Operation::InsertDataTableRows {
            sheet_pos,
            rows: rows.into_iter().map(|index| (index, None)).collect(),
            swallow,
            select_table: false,
            copy_formats_from,
            copy_formats,
        }]
    }

    #[allow(clippy::too_many_arguments)]
    pub fn data_table_mutations_operations(
        &self,
        sheet_pos: SheetPos,
        select_table: bool,
        columns_to_add: Option<Vec<u32>>,
        columns_to_remove: Option<Vec<u32>>,
        rows_to_add: Option<Vec<u32>>,
        rows_to_remove: Option<Vec<u32>>,
        flatten_on_delete: Option<bool>,
        swallow_on_insert: Option<bool>,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        if let Some(columns_to_add) = columns_to_add {
            if !columns_to_add.is_empty() {
                ops.push(Operation::InsertDataTableColumns {
                    sheet_pos,
                    columns: columns_to_add
                        .into_iter()
                        .map(|index| (index, None, None))
                        .collect(),
                    swallow: swallow_on_insert.unwrap_or(false),
                    select_table,
                    copy_formats_from: None,
                    copy_formats: None,
                });
            }
        }

        if let Some(columns_to_remove) = columns_to_remove {
            if !columns_to_remove.is_empty() {
                ops.push(Operation::DeleteDataTableColumns {
                    sheet_pos,
                    columns: columns_to_remove,
                    flatten: flatten_on_delete.unwrap_or(false),
                    select_table,
                });
            }
        }

        if let Some(rows_to_add) = rows_to_add {
            if !rows_to_add.is_empty() {
                ops.push(Operation::InsertDataTableRows {
                    sheet_pos,
                    rows: rows_to_add.into_iter().map(|index| (index, None)).collect(),
                    swallow: swallow_on_insert.unwrap_or(false),
                    select_table,
                    copy_formats_from: None,
                    copy_formats: None,
                });
            }
        }

        if let Some(rows_to_remove) = rows_to_remove {
            if !rows_to_remove.is_empty() {
                ops.push(Operation::DeleteDataTableRows {
                    sheet_pos,
                    rows: rows_to_remove,
                    flatten: flatten_on_delete.unwrap_or(false),
                    select_table,
                });
            }
        }

        ops
    }

    pub fn sort_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        sort: Option<Vec<DataTableSort>>,
    ) -> Vec<Operation> {
        vec![Operation::SortDataTable {
            sheet_pos,
            sort,
            display_buffer: None,
        }]
    }

    pub fn data_table_first_row_as_header_operations(
        &self,
        sheet_pos: SheetPos,
        first_row_is_header: bool,
    ) -> Vec<Operation> {
        vec![
            Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header,
            },
            Operation::DataTableMeta {
                sheet_pos,
                name: None,
                alternating_colors: None,
                columns: None,
                show_ui: None,
                show_name: None,
                show_columns: Some(true),
                readonly: None,
            },
        ]
    }

    pub fn add_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        name: String,
        values: Vec<Vec<String>>,
        first_row_is_header: bool,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        let height = values.len();
        if height == 0 {
            dbgjs!("[set_cell_values] Empty values");
            return ops;
        }

        let width = values.iter().map(|row| row.len()).max().unwrap_or(0);
        if width == 0 {
            dbgjs!("[set_cell_values] Empty values");
            return ops;
        }

        let Ok(array_size) = ArraySize::try_from((width as u32, height as u32)) else {
            return ops;
        };

        let mut cell_values = Array::new_empty(array_size);
        let mut sheet_format_updates = SheetFormatUpdates::default();

        for (y, row) in values.iter().enumerate() {
            for (x, value) in row.iter().enumerate() {
                let value = value.trim();

                let (cell_value, format_update) = self.string_to_cell_value(value, false);

                if let Err(e) = cell_values.set(x as u32, y as u32, cell_value) {
                    dbgjs!(format!(
                        "[add_data_table_operations] Error setting cell value: {}",
                        e
                    ));
                    return ops;
                }

                if !format_update.is_default() {
                    let pos = Pos {
                        x: x as i64 + 1,
                        y: y as i64 + 1,
                    };
                    sheet_format_updates.set_format_cell(pos, format_update);
                }
            }
        }

        let import = Import::new(name.to_owned());
        let name = unique_data_table_name(&name, false, Some(sheet_pos), self.a1_context());
        let mut data_table = DataTable::new(
            DataTableKind::Import(import.to_owned()),
            &name,
            cell_values.into(),
            false,
            first_row_is_header,
            Some(true),
            Some(true),
            None,
        );
        data_table.formats.apply_updates(&sheet_format_updates);
        drop(sheet_format_updates);

        ops.push(Operation::AddDataTable {
            sheet_pos,
            data_table,
            cell_value: CellValue::Import(import),
            index: None,
        });

        ops
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, Rect, SheetPos, SheetRect,
        cellvalue::Import,
        controller::{
            GridController, active_transactions::transaction_name::TransactionName,
            operations::operation::Operation,
        },
        grid::{CodeCellLanguage, NumericFormat, NumericFormatKind},
        test_util::{assert_cell_value, assert_display_cell_value, print_table_in_rect},
    };

    #[test]
    fn test_add_data_table_operations() {
        let gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet_pos = SheetPos::new(sheet_id, 1, 1);
        let name = "test".to_string();
        let values = vec![
            vec!["header 1".into(), "header 2".into()],
            vec!["$123".into(), "123,456.00".into()],
        ];
        let ops = gc.add_data_table_operations(sheet_pos, name.to_owned(), values, true);
        assert_eq!(ops.len(), 1);

        let import = Import::new(name.to_owned());
        let cell_value = CellValue::Import(import.to_owned());
        assert_display_cell_value(&gc, sheet_id, 1, 1, &cell_value.to_string());

        match &ops[0] {
            Operation::AddDataTable {
                data_table,
                cell_value,
                ..
            } => {
                assert!(data_table.header_is_first_row);
                assert_eq!(data_table.name, name.into());
                assert_eq!(cell_value, &CellValue::Import(import));
                assert_eq!(data_table.column_headers.as_ref().unwrap().len(), 2);
                assert_eq!(
                    data_table.column_headers.as_ref().unwrap()[0].name,
                    "header 1".into()
                );
                assert_eq!(
                    data_table.column_headers.as_ref().unwrap()[1].name,
                    "header 2".into()
                );
                // values are 0 based
                assert_eq!(
                    data_table.value.get(0, 0).unwrap(),
                    &CellValue::Text("header 1".into())
                );
                assert_eq!(
                    data_table.value.get(1, 0).unwrap(),
                    &CellValue::Text("header 2".into())
                );
                assert_eq!(
                    data_table.value.get(0, 1).unwrap(),
                    &CellValue::Number(123.into())
                );
                assert_eq!(
                    data_table.value.get(1, 1).unwrap(),
                    &CellValue::Number(123456.into())
                );
                // formats are 1 based
                assert_eq!(
                    data_table.formats.numeric_format.get((1, 2).into()),
                    Some(NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol: Some("$".into()),
                    })
                );
                assert_eq!(
                    data_table.formats.numeric_commas.get((2, 2).into()),
                    Some(true)
                );
            }
            _ => panic!("Expected AddDataTable operation"),
        }
    }

    #[test]
    fn test_grid_to_data_table_operations() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet_pos = SheetPos::new(sheet_id, 1, 1);
        let sheet_rect = SheetRect::new(1, 1, 2, 2, sheet_id);
        let data_table_rect = Rect::new(1, 1, 2, 4);
        let values = vec![
            vec!["header 1".into(), "header 2".into()],
            vec!["$123".into(), "123,456.00".into()],
        ];

        gc.set_cell_values(sheet_pos, values, None);
        print_table_in_rect(&gc, sheet_id, sheet_rect.into());

        let ops = gc.grid_to_data_table_operations(sheet_rect);
        gc.start_user_transaction(ops, None, TransactionName::GridToDataTable);

        let import = Import::new("Table1".into());
        let cell_value = CellValue::Import(import.to_owned());

        print_table_in_rect(&gc, sheet_id, data_table_rect);

        // check that the data table is in the sheet
        assert_cell_value(&gc, sheet_id, 1, 1, cell_value.clone());
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 1);

        // undo the operation
        gc.undo(None);

        // convert one of the cells to a formula
        let formula_pos = SheetPos::new(sheet_id, 1, 2);
        gc.set_code_cell(formula_pos, CodeCellLanguage::Formula, "=1+1".into(), None);
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 1);

        print_table_in_rect(&gc, sheet_id, sheet_rect.into());

        let ops = gc.grid_to_data_table_operations(sheet_rect);

        // no operations should be needed since the formula data table is in
        // the selection
        assert_eq!(ops.len(), 0);

        gc.start_user_transaction(ops, None, TransactionName::GridToDataTable);

        // there should still be just 1 data table
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 1);

        print_table_in_rect(&gc, sheet_id, data_table_rect);
    }
}
