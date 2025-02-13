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
                });
            }
        }

        if let Some(columns_to_remove) = columns_to_remove {
            for index in columns_to_remove {
                ops.push(Operation::DeleteDataTableColumn {
                    sheet_pos,
                    index,
                    flatten: flatten_on_delete.unwrap_or(false),
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
                });
            }
        }

        if let Some(rows_to_remove) = rows_to_remove {
            for index in rows_to_remove {
                ops.push(Operation::DeleteDataTableRow {
                    sheet_pos,
                    index,
                    flatten: flatten_on_delete.unwrap_or(false),
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
        vec![Operation::DataTableFirstRowAsHeader {
            sheet_pos,
            first_row_is_header,
        }]
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
        let data_table = DataTable::new(
            DataTableKind::Import(import.to_owned()),
            &name,
            cell_values.into(),
            false,
            first_row_is_header,
            true,
            None,
        );

        ops.push(Operation::AddDataTable {
            sheet_pos,
            data_table,
            cell_value: CellValue::Import(import),
        });

        ops
    }
}

#[cfg(test)]
mod test {}
