use super::operation::Operation;
use crate::{
    cellvalue::Import,
    controller::GridController,
    grid::{
        data_table::{column::DataTableColumn, sort::DataTableSort},
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

    pub fn data_table_meta_operations(
        &self,
        sheet_pos: SheetPos,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns: Option<Vec<DataTableColumn>>,
        show_header: Option<bool>,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::DataTableMeta {
            sheet_pos,
            name,
            alternating_colors,
            columns,
            show_header,
        }]
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