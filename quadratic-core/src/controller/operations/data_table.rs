use super::operation::Operation;
use crate::{controller::GridController, SheetPos, SheetRect};

impl GridController {
    pub fn flatten_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::FlattenDataTable { sheet_pos }]
    }

    pub fn grid_to_data_table_operations(
        &self,
        sheet_rect: SheetRect,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::GridToDataTable { sheet_rect }]
    }

    pub fn update_data_table_name_operations(
        &self,
        sheet_pos: SheetPos,
        name: String,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::UpdateDataTableName { sheet_pos, name }]
    }

    pub fn sort_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        column_index: u32,
        sort_order: String,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::SortDataTable {
            sheet_pos,
            column_index,
            sort_order,
        }]
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
