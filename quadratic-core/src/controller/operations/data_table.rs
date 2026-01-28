use std::collections::HashMap;

use super::operation::Operation;
use crate::{
    Array, ArraySize, CellValue, ClearOption, CopyFormats, Pos, Rect, SheetPos, SheetRect,
    cellvalue::Import,
    controller::GridController,
    grid::{
        DataTable, DataTableKind, Sheet,
        data_table::{column_header::DataTableColumnHeader, sort::DataTableSort},
        formats::SheetFormatUpdates,
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

        Ok(vec![Operation::SwitchDataTableKind { sheet_pos, kind }])
    }

    /// Collects all operations that would be needed to convert a grid to a data table.
    /// If a data table is found within the sheet_rect, it will not be added to the operations.
    pub fn grid_to_data_table_operations(
        &self,
        sheet_rect: SheetRect,
        table_name: Option<String>,
        first_row_is_header: bool,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        if let Some(sheet) = self.grid.try_sheet(sheet_rect.sheet_id) {
            let no_data_table = sheet.enforce_no_data_table_within_rect(sheet_rect.into())?;

            if no_data_table {
                ops.push(Operation::GridToDataTable { sheet_rect });

                if first_row_is_header {
                    ops.push(Operation::DataTableFirstRowAsHeader {
                        sheet_pos: sheet_rect.into(),
                        first_row_is_header: true,
                    });
                }
                if let Some(table_name) = table_name {
                    ops.push(Operation::DataTableOptionMeta {
                        sheet_pos: sheet_rect.into(),
                        name: Some(table_name),
                        alternating_colors: None,
                        columns: None,
                        show_name: None,
                        show_columns: None,
                    });
                }
            }
        }

        Ok(ops)
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

        if let Some(columns_to_add) = columns_to_add
            && !columns_to_add.is_empty()
        {
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

        if let Some(columns_to_remove) = columns_to_remove
            && !columns_to_remove.is_empty()
        {
            ops.push(Operation::DeleteDataTableColumns {
                sheet_pos,
                columns: columns_to_remove,
                flatten: flatten_on_delete.unwrap_or(false),
                select_table,
            });
        }

        if let Some(rows_to_add) = rows_to_add
            && !rows_to_add.is_empty()
        {
            ops.push(Operation::InsertDataTableRows {
                sheet_pos,
                rows: rows_to_add.into_iter().map(|index| (index, None)).collect(),
                swallow: swallow_on_insert.unwrap_or(false),
                select_table,
                copy_formats_from: None,
                copy_formats: None,
            });
        }

        if let Some(rows_to_remove) = rows_to_remove
            && !rows_to_remove.is_empty()
        {
            ops.push(Operation::DeleteDataTableRows {
                sheet_pos,
                rows: rows_to_remove,
                flatten: flatten_on_delete.unwrap_or(false),
                select_table,
            });
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
            Operation::DataTableOptionMeta {
                sheet_pos,
                name: None,
                alternating_colors: None,
                columns: None,
                show_name: None,
                show_columns: Some(ClearOption::Some(true)),
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

                let (cell_value, format_update) = CellValue::string_to_cell_value(value, false);

                if let Err(e) = cell_values.set(x as u32, y as u32, cell_value, false) {
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
        let mut data_table = DataTable::new(
            DataTableKind::Import(import),
            &name,
            cell_values.into(),
            first_row_is_header,
            Some(true),
            Some(true),
            None,
        );
        data_table
            .formats
            .get_or_insert_default()
            .apply_updates(&sheet_format_updates);
        drop(sheet_format_updates);

        ops.push(Operation::SetDataTable {
            sheet_pos,
            data_table: Some(data_table),
            index: usize::MAX,
            ignore_old_data_table: true,
        });

        ops
    }

    /// Expands a data table to the right or bottom if the cell value is
    /// touching the right or bottom edge.
    pub fn grow_data_table(
        sheet: &Sheet,
        data_tables: &mut [Rect],
        data_table_columns: &mut HashMap<SheetPos, Vec<u32>>,
        data_table_rows: &mut HashMap<SheetPos, Vec<u32>>,
        current_sheet_pos: SheetPos,
        value_is_empty: bool,
    ) {
        // expand the data table to the right or bottom if the cell value is
        // touching the right or bottom edge
        let (col, row) =
            sheet.expand_columns_and_rows(data_tables, current_sheet_pos, value_is_empty);

        // if an expansion happened, adjust the size of the data table rect
        // so that successive iterations continue to expand the data table.
        if let Some((sheet_pos, col)) = col {
            let entry = data_table_columns.entry(sheet_pos).or_default();

            if !entry.contains(&col) {
                // add the column to data_table_columns
                entry.push(col);

                let pos_to_check = Pos::new(sheet_pos.x, sheet_pos.y);

                // adjust the size of the data table rect so that successive
                // iterations continue to expand the data table.
                data_tables
                    .iter_mut()
                    .filter(|rect| rect.contains(pos_to_check))
                    .for_each(|rect| {
                        rect.max.x += 1;
                    });
            }
        }

        // expand the data table to the bottom if the cell value is touching
        // the bottom edge
        if let Some((sheet_pos, row)) = row {
            let entry = data_table_rows.entry(sheet_pos).or_default();

            // if an expansion happened, adjust the size of the data table rect
            // so that successive iterations continue to expand the data table.
            if !entry.contains(&row) {
                // add the row to data_table_rows
                entry.push(row);

                let pos_to_check = Pos::new(sheet_pos.x, sheet_pos.y);

                // adjust the size of the data table rect so that successive
                // iterations continue to expand the data table.
                data_tables
                    .iter_mut()
                    .filter(|rect| rect.contains(pos_to_check))
                    .for_each(|rect| {
                        rect.max.y += 1;
                    });
            }
        }
    }

    /// Returns operations to grow a data table to the right or bottom if the
    /// cell value is touching the right or bottom edge.
    pub fn grow_data_table_operations(
        data_table_columns: HashMap<SheetPos, Vec<u32>>,
        data_table_rows: HashMap<SheetPos, Vec<u32>>,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        if !data_table_columns.is_empty() {
            for (sheet_pos, columns) in data_table_columns {
                ops.push(Operation::InsertDataTableColumns {
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
                ops.push(Operation::InsertDataTableRows {
                    sheet_pos,
                    rows: rows.into_iter().map(|r| (r, None)).collect(),
                    swallow: true,
                    select_table: false,
                    copy_formats_from: None,
                    copy_formats: None,
                });
            }
        }

        ops
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, SheetPos, SheetRect,
        cellvalue::Import,
        controller::{
            GridController, active_transactions::transaction_name::TransactionName,
            operations::operation::Operation,
        },
        grid::{CodeCellLanguage, DataTableKind, NumericFormat, NumericFormatKind},
        test_util::*,
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
        let ops = gc.add_data_table_operations(sheet_pos, name.clone(), values, true);
        assert_eq!(ops.len(), 1);

        match &ops[0] {
            Operation::SetDataTable {
                data_table,
                ignore_old_data_table,
                ..
            } => {
                let data_table = data_table.as_ref().unwrap();
                assert!(data_table.header_is_first_row);
                assert_eq!(data_table.name, name.as_str().into());
                assert_eq!(data_table.kind, DataTableKind::Import(Import::new(name)));
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
                    data_table
                        .formats
                        .as_ref()
                        .unwrap()
                        .numeric_format
                        .get((1, 2).into()),
                    Some(NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol: Some("$".into()),
                    })
                );
                assert_eq!(
                    data_table
                        .formats
                        .as_ref()
                        .unwrap()
                        .numeric_commas
                        .get((2, 2).into()),
                    Some(true)
                );
                assert!(ignore_old_data_table);
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
        let values = vec![
            vec!["header 1".into(), "header 2".into()],
            vec!["$123".into(), "123,456.00".into()],
        ];

        gc.set_cell_values(sheet_pos, values, None, false);
        print_table_in_rect(&gc, sheet_id, sheet_rect.into());

        let ops = gc
            .grid_to_data_table_operations(sheet_rect, None, false)
            .unwrap();
        gc.start_user_ai_transaction(ops, None, TransactionName::GridToDataTable, false);

        // check that the data table is in the sheet
        assert_import(&gc, sheet_pos, "Table1", 2, 4);
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 1);

        // undo the operation
        gc.undo(1, None, false);

        // convert one of the cells to a formula
        let formula_pos = SheetPos::new(sheet_id, 1, 2);
        gc.set_code_cell(
            formula_pos,
            CodeCellLanguage::Formula,
            "=1+1".into(),
            None,
            None,
            false,
        );
        // 1x1 formulas are stored as CellValue::Code, not DataTable
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 0);
        assert!(matches!(
            gc.sheet(sheet_id).cell_value(pos![A2]),
            Some(CellValue::Code(_))
        ));

        let ops = gc.grid_to_data_table_operations(sheet_rect, None, false);
        assert!(ops.is_err());

        // there should still be no DataTables (the formula is CellValue::Code)
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 0);
    }
}
