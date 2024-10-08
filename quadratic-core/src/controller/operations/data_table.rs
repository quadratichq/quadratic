use super::operation::Operation;
use crate::{controller::GridController, SheetPos};

impl GridController {
    pub fn flatten_data_table_operations(
        &self,
        sheet_pos: SheetPos,
        _cursor: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::FlattenDataTable { sheet_pos }]
    }
}

#[cfg(test)]
mod test {}
