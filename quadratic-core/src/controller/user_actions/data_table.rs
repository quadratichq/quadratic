use crate::{
    CopyFormats, SheetPos, SheetRect,
    controller::{GridController, active_transactions::transaction_name::TransactionName},
    grid::{
        CodeRun, DataTable, data_table::column_header::DataTableColumnHeader, sort::DataTableSort,
    },
};

use anyhow::Result;

impl GridController {
    /// Gets a data table based on a sheet position.
    pub fn data_table_at(&self, sheet_pos: SheetPos) -> Option<&DataTable> {
        if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
            sheet.data_table_at(&sheet_pos.into())
        } else {
            None
        }
    }

    /// Gets a code run based on a sheet position.
    /// This checks both CellValue::Code in columns and DataTable in data_tables.
    pub fn code_run_at(&self, sheet_pos: &SheetPos) -> Option<&CodeRun> {
        self.try_sheet(sheet_pos.sheet_id)
            .and_then(|sheet| sheet.code_run_at(&(*sheet_pos).into()))
    }

    pub fn flatten_data_table(&mut self, sheet_pos: SheetPos, cursor: Option<String>, is_ai: bool) {
        let ops = self.flatten_data_table_operations(sheet_pos);
        self.start_user_ai_transaction(ops, cursor, TransactionName::FlattenDataTable, is_ai);
    }

    pub fn code_data_table_to_data_table(
        &mut self,
        sheet_pos: SheetPos,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<()> {
        let ops = self.code_data_table_to_data_table_operations(sheet_pos)?;
        self.start_user_ai_transaction(ops, cursor, TransactionName::SwitchDataTableKind, is_ai);

        Ok(())
    }

    pub fn grid_to_data_table(
        &mut self,
        sheet_rect: SheetRect,
        table_name: Option<String>,
        first_row_is_header: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<()> {
        let ops =
            self.grid_to_data_table_operations(sheet_rect, table_name, first_row_is_header)?;

        self.start_user_ai_transaction(ops, cursor, TransactionName::GridToDataTable, is_ai);

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn data_table_meta(
        &mut self,
        sheet_pos: SheetPos,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_name: Option<Option<bool>>,
        show_columns: Option<Option<bool>>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.data_table_meta_operations(
            sheet_pos,
            name,
            alternating_colors,
            columns,
            show_name,
            show_columns,
        );
        self.start_user_ai_transaction(ops, cursor, TransactionName::DataTableMeta, is_ai);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn data_table_mutations(
        &mut self,
        sheet_pos: SheetPos,
        select_table: bool,
        columns_to_add: Option<Vec<u32>>,
        columns_to_remove: Option<Vec<u32>>,
        rows_to_add: Option<Vec<u32>>,
        rows_to_remove: Option<Vec<u32>>,
        flatten_on_delete: Option<bool>,
        swallow_on_insert: Option<bool>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.data_table_mutations_operations(
            sheet_pos,
            select_table,
            columns_to_add,
            columns_to_remove,
            rows_to_add,
            rows_to_remove,
            flatten_on_delete,
            swallow_on_insert,
        );
        self.start_user_ai_transaction(ops, cursor, TransactionName::DataTableMutations, is_ai);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn data_table_insert_columns(
        &mut self,
        sheet_pos: SheetPos,
        columns: Vec<u32>,
        swallow: bool,
        copy_formats_from: Option<u32>,
        copy_formats: Option<CopyFormats>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.data_table_insert_columns_operations(
            sheet_pos,
            columns,
            swallow,
            copy_formats_from,
            copy_formats,
        );
        self.start_user_ai_transaction(ops, cursor, TransactionName::DataTableMutations, is_ai);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn data_table_insert_rows(
        &mut self,
        sheet_pos: SheetPos,
        rows: Vec<u32>,
        swallow: bool,
        copy_formats_from: Option<u32>,
        copy_formats: Option<CopyFormats>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.data_table_insert_rows_operations(
            sheet_pos,
            rows,
            swallow,
            copy_formats_from,
            copy_formats,
        );
        self.start_user_ai_transaction(ops, cursor, TransactionName::DataTableMutations, is_ai);
    }

    pub fn sort_data_table(
        &mut self,
        sheet_pos: SheetPos,
        sort: Option<Vec<DataTableSort>>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.sort_data_table_operations(sheet_pos, sort);
        self.start_user_ai_transaction(ops, cursor, TransactionName::GridToDataTable, is_ai);
    }

    pub fn data_table_first_row_as_header(
        &mut self,
        sheet_pos: SheetPos,
        first_row_is_header: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.data_table_first_row_as_header_operations(sheet_pos, first_row_is_header);
        self.start_user_ai_transaction(
            ops,
            cursor,
            TransactionName::DataTableFirstRowAsHeader,
            is_ai,
        );
    }

    pub fn add_data_table(
        &mut self,
        sheet_pos: SheetPos,
        name: String,
        values: Vec<Vec<String>>,
        first_row_is_header: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.add_data_table_operations(sheet_pos, name, values, first_row_is_header);
        self.start_user_ai_transaction(ops, cursor, TransactionName::DataTableAddDataTable, is_ai);
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        Array, CellValue, Pos, SheetPos, Value,
        a1::A1Selection,
        cellvalue::Import,
        controller::{
            GridController,
            transaction_types::{JsCellValueResult, JsCodeResult},
            user_actions::import::tests::simple_csv,
        },
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
        test_create_data_table,
        test_util::*,
        wasm_bindings::js::{clear_js_calls, expect_js_call},
    };

    #[test]
    fn test_code_data_table_to_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet_pos = pos![sheet_id!A1];

        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
            formula_ast: None,
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed: Default::default(),
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1", "2", "3"]])),
            false,
            Some(true),
            Some(true),
            None,
        );

        test_create_raw_data_table(&mut gc, sheet_pos, data_table.clone());

        // initial value
        let expected = vec!["1", "2", "3"];
        assert_cell_value_row(&gc, sheet_id, 1, 3, 3, expected.clone());

        assert_code_language(
            &gc,
            sheet_pos,
            CodeCellLanguage::Javascript,
            "return [1,2,3]".to_string(),
        );

        gc.code_data_table_to_data_table(sheet_pos, None, false)
            .unwrap();

        assert_cell_value_row(&gc, sheet_id, 1, 3, 3, expected.clone());

        let data_table = gc.data_table_at(sheet_pos).unwrap();
        assert_eq!(
            data_table.kind,
            DataTableKind::Import(Import::new("".into()))
        );

        // undo, the value should be a code run data table again
        gc.undo(1, None, false);
        assert_code_language(
            &gc,
            sheet_pos,
            CodeCellLanguage::Javascript,
            "return [1,2,3]".to_string(),
        );

        // redo, the value should be a data table
        gc.redo(1, None, false);
        let data_table = gc.data_table_at(sheet_pos).unwrap();
        assert_eq!(
            data_table.kind,
            DataTableKind::Import(Import::new("".into()))
        );
    }

    #[test]
    fn test_data_table_meta_change_table_name() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let pos_code_cell = Pos { x: 10, y: 10 };
        let sheet_pos_code_cell = SheetPos::from((pos_code_cell, sheet_id));
        let old_name = gc
            .sheet(sheet_id)
            .data_table_at(&pos)
            .unwrap()
            .name
            .to_owned();
        let new_name = "New_Table".to_string();
        let old_code = r#"q.cells("simple.csv[city]")"#;
        let new_code = r#"q.cells("New_Table[city]")"#;

        assert_eq!(old_name.to_display(), "simple.csv");

        // create a code cell with a table reference
        gc.set_code_cell(
            sheet_pos_code_cell,
            CodeCellLanguage::Python,
            old_code.to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("1".into(), 2)),
            ..Default::default()
        });

        assert_code_language(
            &gc,
            sheet_pos_code_cell,
            CodeCellLanguage::Python,
            old_code.to_string(),
        );

        // change the data table name
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let cursor = None;
        gc.data_table_meta(
            sheet_pos,
            Some(new_name.clone()),
            None,
            None,
            None,
            None,
            cursor,
            false,
        );

        let updated_name = gc
            .sheet(sheet_id)
            .data_table_at(&pos)
            .unwrap()
            .name
            .to_owned();
        assert_eq!(updated_name.to_display(), new_name);

        assert_code_language(
            &gc,
            sheet_pos_code_cell,
            CodeCellLanguage::Python,
            new_code.to_string(),
        );
    }

    #[test]
    fn test_data_table_meta_change_column_name() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let pos_code_cell = Pos { x: 10, y: 10 };
        let sheet_pos_code_cell = SheetPos::from((pos_code_cell, sheet_id));
        let column_headers = gc
            .sheet(sheet_id)
            .data_table_at(&pos)
            .unwrap()
            .column_headers
            .clone();
        let old_name = column_headers.as_ref().unwrap()[0].name.clone();
        let new_name = "city_new".to_string();
        let old_code = r#"q.cells("simple.csv[city]")"#;
        let new_code = r#"q.cells("simple.csv[city_new]")"#;

        assert_eq!(old_name.to_string(), "city");

        // create a code cell with a table reference
        gc.set_code_cell(
            sheet_pos_code_cell,
            CodeCellLanguage::Python,
            old_code.to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("1".into(), 2)),
            ..Default::default()
        });

        assert_code_language(
            &gc,
            sheet_pos_code_cell,
            CodeCellLanguage::Python,
            old_code.to_string(),
        );

        // change the data table name
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let cursor = None;
        let mut new_column_headers = column_headers.as_ref().unwrap().clone();
        new_column_headers[0].name = CellValue::Text(new_name.clone());
        gc.data_table_meta(
            sheet_pos,
            None,
            None,
            Some(new_column_headers),
            None,
            None,
            cursor,
            false,
        );

        let updated_name = gc
            .sheet(sheet_id)
            .data_table_at(&pos)
            .unwrap()
            .column_headers
            .as_ref()
            .unwrap()[0]
            .name
            .clone();
        assert_eq!(updated_name.to_string(), new_name);

        assert_code_language(
            &gc,
            sheet_pos_code_cell,
            CodeCellLanguage::Python,
            new_code.to_string(),
        );
    }

    #[test]
    fn test_insert_data_table_column_and_row() {
        clear_js_calls();

        let (mut gc, sheet_id, pos, file_name) = simple_csv();

        assert_eq!(
            gc.sheet(sheet_id).data_table_at(&pos).unwrap().height(true),
            11
        );
        assert_eq!(gc.sheet(sheet_id).data_table_at(&pos).unwrap().width(), 4);

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let select_table = true;
        let columns_to_add = Some(vec![4]);
        let columns_to_remove = None;
        let rows_to_add = Some(vec![11]);
        let rows_to_remove = None;
        let flatten_on_delete = Some(true);
        let swallow_on_insert = Some(true);
        let cursor = None;
        gc.data_table_mutations(
            sheet_pos,
            select_table,
            columns_to_add,
            columns_to_remove,
            rows_to_add,
            rows_to_remove,
            flatten_on_delete,
            swallow_on_insert,
            cursor,
            false,
        );

        assert_eq!(
            gc.sheet(sheet_id).data_table_at(&pos).unwrap().height(true),
            12
        );
        assert_eq!(gc.sheet(sheet_id).data_table_at(&pos).unwrap().width(), 5);

        gc.undo(1, None, false);
        assert_eq!(
            gc.sheet(sheet_id).data_table_at(&pos).unwrap().height(true),
            11
        );
        assert_eq!(gc.sheet(sheet_id).data_table_at(&pos).unwrap().width(), 4);

        gc.redo(1, None, false);
        assert_eq!(
            gc.sheet(sheet_id).data_table_at(&pos).unwrap().height(true),
            12
        );
        assert_eq!(gc.sheet(sheet_id).data_table_at(&pos).unwrap().width(), 5);

        expect_js_call(
            "jsSetCursor",
            serde_json::to_string(&A1Selection::table(sheet_pos, file_name)).unwrap(),
            true,
        );

        // let data_table = sheet.data_table_mut_at(&data_table_pos).unwrap();
        // data_table.insert_column(0, "Column 1".into());
        // data_table.insert_row(0, vec!["1", "2", "3"]);
    }

    #[test]
    fn test_add_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Data table with headers
        let values = vec![
            vec!["Column 1".into(), "Column 2".into(), "Column 3".into()],
            vec!["1".into(), "2".into(), "3".into()],
            vec!["4".into(), "5".into(), "6".into()],
        ];

        gc.add_data_table(
            SheetPos::from((pos![A1], sheet_id)),
            "Table 1".to_string(),
            values.to_owned(),
            true,
            None,
            false,
        );

        // Verify the first data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table_at(&pos![A1]).unwrap();

            // Check basic properties
            assert_eq!(data_table.name, "Table_1".into());
            assert!(data_table.header_is_first_row);
            assert_eq!(
                data_table.value,
                Array::from(vec![
                    vec![
                        CellValue::Text("Column 1".into()),
                        CellValue::Text("Column 2".into()),
                        CellValue::Text("Column 3".into()),
                    ],
                    vec![
                        CellValue::Number(1.into()),
                        CellValue::Number(2.into()),
                        CellValue::Number(3.into()),
                    ],
                    vec![
                        CellValue::Number(4.into()),
                        CellValue::Number(5.into()),
                        CellValue::Number(6.into()),
                    ],
                ])
                .into()
            );

            // Check column headers
            let headers = data_table.column_headers.as_ref().unwrap();
            assert_eq!(headers.len(), 3);
            assert_eq!(headers[0].name, "Column 1".into());
            assert_eq!(headers[1].name, "Column 2".into());
            assert_eq!(headers[2].name, "Column 3".into());
        }

        // Data table without headers
        let values_no_header = vec![vec!["A".into(), "B".into()], vec!["C".into(), "D".into()]];

        gc.set_cell_value(
            SheetPos::from((pos![E1], sheet_id)),
            "Test value".into(),
            None,
            false,
        );

        assert_table_count(&gc, sheet_id, 1);

        gc.add_data_table(
            SheetPos::from((pos![E1], sheet_id)),
            "Table 2".to_string(),
            values_no_header.to_owned(),
            false,
            None,
            false,
        );

        // Verify the second data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table_at(&pos![E1]).unwrap();

            // Check basic properties
            assert_eq!(data_table.name, "Table_2".into());
            assert!(!data_table.header_is_first_row);
            assert_eq!(
                data_table.value,
                Value::Array(values_no_header.to_owned().into())
            );

            // Check that column headers are automatically generated
            let headers = data_table.column_headers.as_ref().unwrap();
            assert_eq!(headers.len(), 2);
            assert_eq!(headers[0].name, "Column 1".into());
            assert_eq!(headers[1].name, "Column 2".into());
        }

        // Test undo/redo functionality
        gc.undo(1, None, false);
        {
            let sheet = gc.sheet(sheet_id);
            assert_eq!(
                sheet.cell_value(pos![E1]),
                Some(CellValue::Text("Test value".into()))
            );
            assert!(sheet.data_table_at(&pos![E1]).is_none());
            assert_table_count(&gc, sheet_id, 1);
        }

        gc.redo(1, None, false);
        {
            let sheet = gc.sheet(sheet_id);
            assert!(sheet.data_table_at(&pos![E1]).is_some());
        }

        // overwrite second data table with a new data table
        let table_3_values = vec![vec!["Z".into(), "Y".into()], vec!["X".into(), "W".into()]];
        gc.add_data_table(
            SheetPos::from((pos![E1], sheet_id)),
            "Table 3".to_string(),
            table_3_values.to_owned(),
            false,
            None,
            false,
        );
        // Verify the third data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table_at(&pos![E1]).unwrap();

            // Check basic properties
            assert_eq!(data_table.name, "Table_3".into());
            assert!(!data_table.header_is_first_row);
            assert_eq!(
                data_table.value,
                Value::Array(table_3_values.to_owned().into())
            );

            // Check that column headers are automatically generated
            let headers = data_table.column_headers.as_ref().unwrap();
            assert_eq!(headers.len(), 2);
            assert_eq!(headers[0].name, "Column 1".into());
            assert_eq!(headers[1].name, "Column 2".into());
        }

        // undo, the third data table should be gone, second data table should be back
        gc.undo(1, None, false);
        // Verify the second data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table_at(&pos![E1]).unwrap();

            // Check basic properties
            assert_eq!(data_table.name, "Table_2".into());
            assert!(!data_table.header_is_first_row);
            assert_eq!(data_table.value, Value::Array(values_no_header.into()));

            // Check that column headers are automatically generated
            let headers = data_table.column_headers.as_ref().unwrap();
            assert_eq!(headers.len(), 2);
            assert_eq!(headers[0].name, "Column 1".into());
            assert_eq!(headers[1].name, "Column 2".into());
        }

        // redo, the third data table should be back
        gc.redo(1, None, false);
        // Verify the third data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table_at(&pos![E1]).unwrap();

            // Check basic properties
            assert_eq!(data_table.name, "Table_3".into());
            assert!(!data_table.header_is_first_row);
            assert_eq!(data_table.value, Value::Array(table_3_values.into()));

            // Check that column headers are automatically generated
            let headers = data_table.column_headers.as_ref().unwrap();
            assert_eq!(headers.len(), 2);
            assert_eq!(headers[0].name, "Column 1".into());
            assert_eq!(headers[1].name, "Column 2".into());
        }
    }

    #[test]
    fn test_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let dt = test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);

        assert_eq!(gc.data_table_at(pos![sheet_id!A1]), Some(&dt));
        assert!(gc.data_table_at(pos![sheet_id!A2]).is_none());
    }

    #[test]
    fn test_data_table_delete_rows() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["0", "1"]);

        gc.data_table_mutations(
            pos![sheet_id!A1],
            false,
            None,
            None,
            None,
            Some(vec![2]),
            None,
            None,
            None,
            false,
        );
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["2", "3"]);

        gc.undo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["0", "1"]);

        gc.redo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["2", "3"]);
    }

    #[test]
    fn test_data_table_delete_all_rows() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["0", "1"]);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 4, vec!["2", "3"]);

        gc.data_table_mutations(
            pos![sheet_id!A1],
            false,
            None,
            None,
            None,
            Some(vec![2, 3]),
            None,
            None,
            None,
            false,
        );
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["", ""]);

        gc.undo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["0", "1"]);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 4, vec!["2", "3"]);

        gc.redo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 1, 2, 3, vec!["", ""]);
    }
}
