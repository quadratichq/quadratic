use crate::{
    controller::{active_transactions::transaction_name::TransactionName, GridController},
    grid::{
        data_table::column_header::DataTableColumnHeader, sort::DataTableSort, DataTableShowUI,
    },
    Pos, SheetPos, SheetRect,
};

use anyhow::{anyhow, Result};

impl GridController {
    /// Returns all data tables within the given sheet position.
    pub fn data_tables_within(&self, sheet_pos: SheetPos) -> Result<Vec<Pos>> {
        let sheet = self
            .try_sheet(sheet_pos.sheet_id)
            .ok_or_else(|| anyhow!("Sheet not found"))?;
        let pos = Pos::from(sheet_pos);

        sheet.data_tables_within(pos)
    }

    pub fn set_data_table_value(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
        cursor: Option<String>,
    ) {
        let ops = self.set_data_table_operations_at(sheet_pos, value);
        self.start_user_transaction(ops, cursor, TransactionName::SetDataTableAt);
    }

    pub fn flatten_data_table(&mut self, sheet_pos: SheetPos, cursor: Option<String>) {
        let ops = self.flatten_data_table_operations(sheet_pos, cursor.to_owned());
        self.start_user_transaction(ops, cursor, TransactionName::FlattenDataTable);
    }

    pub fn code_data_table_to_data_table(
        &mut self,
        sheet_pos: SheetPos,
        cursor: Option<String>,
    ) -> Result<()> {
        let ops = self.code_data_table_to_data_table_operations(sheet_pos, cursor.to_owned())?;
        self.start_user_transaction(ops, cursor, TransactionName::SwitchDataTableKind);

        Ok(())
    }

    pub fn grid_to_data_table(&mut self, sheet_rect: SheetRect, cursor: Option<String>) {
        let ops = self.grid_to_data_table_operations(sheet_rect, cursor.to_owned());
        self.start_user_transaction(ops, cursor, TransactionName::GridToDataTable);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn data_table_meta(
        &mut self,
        sheet_pos: SheetPos,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_header: Option<bool>,
        show_ui: Option<DataTableShowUI>,
        cursor: Option<String>,
    ) {
        let ops = self.data_table_meta_operations(
            sheet_pos,
            name,
            alternating_colors,
            columns,
            show_header,
            show_ui,
        );
        self.start_user_transaction(ops, cursor, TransactionName::DataTableMeta);
    }

    pub fn data_table_mutations(
        &mut self,
        sheet_pos: SheetPos,
        columns_to_add: Option<Vec<u32>>,
        columns_to_remove: Option<Vec<u32>>,
        rows_to_add: Option<Vec<u32>>,
        rows_to_remove: Option<Vec<u32>>,
        cursor: Option<String>,
    ) {
        let ops = self.data_table_mutations_operations(
            sheet_pos,
            columns_to_add,
            columns_to_remove,
            rows_to_add,
            rows_to_remove,
            cursor.to_owned(),
        );

        self.start_user_transaction(ops, cursor, TransactionName::DataTableMutations);
    }

    pub fn sort_data_table(
        &mut self,
        sheet_pos: SheetPos,
        sort: Option<Vec<DataTableSort>>,
        cursor: Option<String>,
    ) {
        let ops = self.sort_data_table_operations(sheet_pos, sort, cursor.to_owned());
        self.start_user_transaction(ops, cursor, TransactionName::GridToDataTable);
    }

    pub fn data_table_first_row_as_header(
        &mut self,
        sheet_pos: SheetPos,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) {
        let ops = self.data_table_first_row_as_header_operations(
            sheet_pos,
            first_row_is_header,
            cursor.to_owned(),
        );
        self.start_user_transaction(ops, cursor, TransactionName::DataTableFirstRowAsHeader);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        cellvalue::Import,
        controller::{user_actions::import::tests::simple_csv, GridController},
        grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind},
        test_util::{assert_cell_value, assert_data_table_cell_value_row, print_data_table},
        Array, CellValue, Pos, Rect, SheetPos, Value,
    };

    #[test]
    fn test_code_data_table_to_data_table() {
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed: Default::default(),
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1", "2", "3"]])),
            false,
            false,
            true,
            None,
        );

        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_tables.insert_full(pos, data_table);
        let code_cell_value = CodeCellValue {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
        };
        sheet.set_cell_value(pos, CellValue::Code(code_cell_value.clone()));
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let expected = vec!["1", "2", "3"];
        let import = Import::new("".into());

        // initial value
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 2, 0));
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 0, expected.clone());
        assert_cell_value(
            &gc,
            sheet_id,
            0,
            0,
            CellValue::Code(code_cell_value.clone()),
        );

        gc.code_data_table_to_data_table(sheet_pos, None).unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 2, 0));
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 0, expected.clone());
        assert_cell_value(&gc, sheet_id, 0, 0, CellValue::Import(import.clone()));

        // undo, the value should be a code run data table again
        gc.undo(None);
        assert_cell_value(&gc, sheet_id, 0, 0, CellValue::Code(code_cell_value));

        // redo, the value should be a data table
        gc.redo(None);
        assert_cell_value(&gc, sheet_id, 0, 0, CellValue::Import(import));
    }

    #[test]
    #[serial_test::parallel]
    fn test_insert_data_table_column_and_row() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 10);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 4);

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let columns_to_add = Some(vec![4]);
        let columns_to_remove = None;
        let rows_to_add = Some(vec![11]);
        let rows_to_remove = None;
        let cursor = None;
        gc.data_table_mutations(
            sheet_pos,
            columns_to_add,
            columns_to_remove,
            rows_to_add,
            rows_to_remove,
            cursor,
        );

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 11);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 5);

        gc.undo(None);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 10);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 4);

        gc.redo(None);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 11);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 5);

        // let data_table = sheet.data_table_mut(data_table_pos).unwrap();
        // data_table.insert_column(0, "Column 1".into());
        // data_table.insert_row(0, vec!["1", "2", "3"]);
    }
}
