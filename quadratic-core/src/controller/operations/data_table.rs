use super::operation::Operation;
use crate::{
    cellvalue::Import,
    controller::GridController,
    grid::{
        data_table::{column_header::DataTableColumnHeader, sort::DataTableSort},
        formats::SheetFormatUpdates,
        DataTable, DataTableKind,
    },
    Array, ArraySize, CellValue, Pos, SheetPos, SheetRect,
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

        Ok(vec![
            Operation::SwitchDataTableKind { sheet_pos, kind },
            Operation::SetCellValues {
                sheet_pos,
                values: cell_value.into(),
            },
        ])
    }

    pub fn grid_to_data_table_operations(&self, sheet_rect: SheetRect) -> Vec<Operation> {
        vec![Operation::GridToDataTable { sheet_rect }]
    }

    #[allow(clippy::too_many_arguments)]
    pub fn data_table_meta_operations(
        &self,
        sheet_pos: SheetPos,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_ui: Option<bool>,
        show_name: Option<bool>,
        show_columns: Option<bool>,
    ) -> Vec<Operation> {
        vec![Operation::DataTableMeta {
            sheet_pos,
            name,
            alternating_colors,
            columns,
            show_ui,
            show_name,
            show_columns,
            readonly: None,
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
            for index in columns_to_add {
                ops.push(Operation::InsertDataTableColumn {
                    sheet_pos,
                    index,
                    column_header: None,
                    values: None,
                    swallow: swallow_on_insert.unwrap_or(false),
                    select_table,
                });
            }
        }

        if let Some(columns_to_remove) = columns_to_remove {
            for index in columns_to_remove {
                ops.push(Operation::DeleteDataTableColumn {
                    sheet_pos,
                    index,
                    flatten: flatten_on_delete.unwrap_or(false),
                    select_table,
                });
            }
        }

        if let Some(rows_to_add) = rows_to_add {
            for index in rows_to_add {
                ops.push(Operation::InsertDataTableRow {
                    sheet_pos,
                    index,
                    values: None,
                    swallow: swallow_on_insert.unwrap_or(false),
                    select_table,
                });
            }
        }

        if let Some(rows_to_remove) = rows_to_remove {
            for index in rows_to_remove {
                ops.push(Operation::DeleteDataTableRow {
                    sheet_pos,
                    index,
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
        vec![Operation::SortDataTable { sheet_pos, sort }]
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

        let width = values[0].len();
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
        let name = self
            .grid
            .unique_data_table_name(&name, false, Some(sheet_pos));
        let mut data_table = DataTable::new(
            DataTableKind::Import(import.to_owned()),
            &name,
            cell_values.into(),
            false,
            first_row_is_header,
            true,
            None,
        );
        data_table.formats.apply_updates(&sheet_format_updates);
        drop(sheet_format_updates);

        ops.push(Operation::AddDataTable {
            sheet_pos,
            data_table,
            cell_value: CellValue::Import(import),
        });

        ops
    }
}

#[cfg(test)]
mod test {
    use crate::{
        cellvalue::Import,
        controller::{operations::operation::Operation, GridController},
        grid::{NumericFormat, NumericFormatKind},
        test_util::assert_display_cell_value,
        CellValue, SheetPos,
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
}
