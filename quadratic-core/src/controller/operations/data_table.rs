use super::operation::Operation;
use crate::{
    cellvalue::Import,
    controller::GridController,
    grid::{
        data_table::{column_header::DataTableColumnHeader, sort::DataTableSort},
        DataTableKind,
    },
    CellValue, SheetPos, SheetRect,
};

use anyhow::Result;

impl GridController {
    pub fn flatten_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::FlattenDataTable { sheet_pos }]
    }

    pub fn code_data_table_to_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        _cursor: Option<String>,
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

    pub fn grid_to_data_table_operations(
        &self,
        sheet_rect: SheetRect,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
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
        }]
    }

    pub fn data_table_mutations_operations(
        &self,
        sheet_pos: SheetPos,
        columns_to_add: Option<Vec<u32>>,
        columns_to_remove: Option<Vec<u32>>,
        rows_to_add: Option<Vec<u32>>,
        rows_to_remove: Option<Vec<u32>>,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        if let Some(columns_to_add) = columns_to_add {
            for index in columns_to_add {
                ops.push(Operation::InsertDataTableColumn {
                    sheet_pos,
                    index,
                    column_header: None,
                    values: None,
                });
            }
        }

        if let Some(columns_to_remove) = columns_to_remove {
            for index in columns_to_remove {
                ops.push(Operation::DeleteDataTableColumn { sheet_pos, index });
            }
        }

        if let Some(rows_to_add) = rows_to_add {
            for index in rows_to_add {
                ops.push(Operation::InsertDataTableRow {
                    sheet_pos,
                    index,
                    values: None,
                });
            }
        }

        if let Some(rows_to_remove) = rows_to_remove {
            for index in rows_to_remove {
                ops.push(Operation::DeleteDataTableRow { sheet_pos, index });
            }
        }

        ops
    }

    pub fn sort_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        sort: Option<Vec<DataTableSort>>,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::SortDataTable { sheet_pos, sort }]
    }

    pub fn data_table_first_row_as_header_operations(
        &self,
        sheet_pos: SheetPos,
        first_row_is_header: bool,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::DataTableFirstRowAsHeader {
            sheet_pos,
            first_row_is_header,
        }]
    }
}

#[cfg(test)]
mod test {}
