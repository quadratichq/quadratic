#[cfg(test)]
use crate::{
    cellvalue::Import,
    grid::column_header::DataTableColumnHeader,
    grid::Grid,
    grid::{DataTable, DataTableKind},
    viewport::ViewportBuffer,
    Array, ArraySize, CellValue, SheetPos, Value,
};

#[cfg(test)]
use super::{
    active_transactions::transaction_name::TransactionName, operations::operation::Operation,
    GridController,
};

#[cfg(test)]
impl GridController {
    // create a new gc for testing purposes with a viewport buffer
    pub fn test_with_viewport_buffer() -> Self {
        let mut gc = Self::from_grid(Grid::test(), 0);
        gc.viewport_buffer = Some(ViewportBuffer::default());
        gc
    }

    pub fn new_blank() -> Self {
        Self::from_grid(Grid::new_blank(), 0)
    }

    pub fn test_set_data_table(
        &mut self,
        sheet_pos: SheetPos,
        w: u32,
        h: u32,
        header_is_first_row: bool,
        show_ui: bool,
    ) {
        let cell_value = CellValue::Import(Import {
            file_name: "test".to_string(),
        });
        let value = Value::Array(Array::new_empty(ArraySize::new(w, h).unwrap()));
        let data_table = DataTable::new(
            DataTableKind::Import(Import {
                file_name: "test".to_string(),
            }),
            "Table1",
            value,
            false,
            header_is_first_row,
            show_ui,
            None,
        );

        let op = Operation::AddDataTable {
            sheet_pos,
            data_table,
            cell_value,
        };
        self.start_user_transaction(vec![op], None, TransactionName::Unknown);
    }

    pub fn test_data_table_first_row_as_header(
        &mut self,
        sheet_pos: SheetPos,
        first_row_is_header: bool,
    ) {
        let op = Operation::DataTableFirstRowAsHeader {
            sheet_pos,
            first_row_is_header,
        };
        self.start_user_transaction(vec![op], None, TransactionName::Unknown);
    }

    pub fn test_data_table_update_meta(
        &mut self,
        sheet_pos: SheetPos,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_ui: Option<bool>,
        show_name: Option<bool>,
        show_columns: Option<bool>,
    ) {
        let op = Operation::DataTableMeta {
            sheet_pos,
            name: None,
            alternating_colors: None,
            columns,
            show_ui,
            show_name,
            show_columns,
            readonly: None,
        };
        self.start_user_transaction(vec![op], None, TransactionName::Unknown);
    }
}
