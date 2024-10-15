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
}

#[cfg(test)]
mod test {}
