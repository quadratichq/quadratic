#[cfg(test)]
use crate::number::decimal_from_str;

#[cfg(test)]
use crate::{
    Array, ArraySize, CellValue, SheetPos,
    cellvalue::Import,
    grid::Grid,
    grid::SheetId,
    grid::column_header::DataTableColumnHeader,
    grid::{CodeCellLanguage, CodeRun},
    grid::{DataTable, DataTableKind},
    viewport::ViewportBuffer,
};

#[cfg(test)]
use super::{
    GridController, active_transactions::transaction_name::TransactionName,
    operations::operation::Operation,
};

#[cfg(test)]
impl GridController {
    // create a new gc for testing purposes with a viewport buffer
    pub fn test_with_viewport_buffer() -> Self {
        let mut gc = Self::from_grid(Grid::test(), 0);
        gc.viewport_buffer = Some(ViewportBuffer::default());
        gc
    }

    pub fn test_set_code_run_array_2d(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        w: u32,
        h: u32,
        n: Vec<&str>,
    ) {
        let array_size = ArraySize::new(w, h).unwrap();
        let mut array = Array::new_empty(array_size);
        for (i, s) in n.iter().enumerate() {
            if !s.is_empty() {
                let value = if let Ok(bd) = decimal_from_str(s) {
                    CellValue::Number(bd)
                } else {
                    CellValue::Text(s.to_string())
                };
                array.set(i as u32 % w, i as u32 / w, value, false).unwrap();
            }
        }

        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "code".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table1",
            array.into(),
            false,
            Some(false),
            Some(false),
            None,
        );

        let op = Operation::SetDataTable {
            sheet_pos: SheetPos::new(sheet_id, x, y),
            data_table: Some(data_table),
            index: usize::MAX,
            ignore_old_data_table: true,
        };
        self.start_user_ai_transaction(vec![op], None, TransactionName::Unknown, false);
    }

    pub fn test_set_data_table(
        &mut self,
        sheet_pos: SheetPos,
        w: u32,
        h: u32,
        header_is_first_row: bool,
        show_name: Option<bool>,
        show_columns: Option<bool>,
    ) {
        let array = Array::new_empty(ArraySize::new(w, h).unwrap());
        let data_table = DataTable::new(
            DataTableKind::Import(Import {
                file_name: "test".to_string(),
            }),
            "Table1",
            array.into(),
            header_is_first_row,
            show_name,
            show_columns,
            None,
        );

        let op = Operation::SetDataTable {
            sheet_pos,
            data_table: Some(data_table),
            index: usize::MAX,
            ignore_old_data_table: true,
        };
        self.start_user_ai_transaction(vec![op], None, TransactionName::Unknown, false);
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
        self.start_user_ai_transaction(vec![op], None, TransactionName::Unknown, false);
    }

    pub fn test_data_table_update_meta(
        &mut self,
        sheet_pos: SheetPos,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_name: Option<bool>,
        show_columns: Option<bool>,
    ) {
        let op = Operation::DataTableOptionMeta {
            sheet_pos,
            name: None,
            alternating_colors: None,
            columns,
            show_name: show_name.map(|show_name| Some(show_name).into()),
            show_columns: show_columns.map(|show_columns| Some(show_columns).into()),
        };
        self.start_user_ai_transaction(vec![op], None, TransactionName::Unknown, false);
    }
}
