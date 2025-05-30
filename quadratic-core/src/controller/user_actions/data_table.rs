use crate::{
    CopyFormats, Pos, SheetPos, SheetRect,
    controller::{GridController, active_transactions::transaction_name::TransactionName},
    grid::{DataTable, data_table::column_header::DataTableColumnHeader, sort::DataTableSort},
};

use anyhow::Result;

impl GridController {
    /// Gets a data table based on a sheet position.
    pub fn data_table(&self, sheet_pos: SheetPos) -> Option<&DataTable> {
        if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
            sheet.data_table(sheet_pos.into())
        } else {
            None
        }
    }

    /// Returns all data tables within the given sheet position.
    pub fn data_tables_within(&self, sheet_pos: SheetPos) -> Result<Vec<Pos>> {
        let sheet = self.try_sheet_result(sheet_pos.sheet_id)?;
        let pos = Pos::from(sheet_pos);

        sheet.data_tables_within(pos)
    }

    pub fn flatten_data_table(&mut self, sheet_pos: SheetPos, cursor: Option<String>) {
        let ops = self.flatten_data_table_operations(sheet_pos);
        self.start_user_transaction(ops, cursor, TransactionName::FlattenDataTable);
    }

    pub fn code_data_table_to_data_table(
        &mut self,
        sheet_pos: SheetPos,
        cursor: Option<String>,
    ) -> Result<()> {
        let ops = self.code_data_table_to_data_table_operations(sheet_pos)?;
        self.start_user_transaction(ops, cursor, TransactionName::SwitchDataTableKind);

        Ok(())
    }

    pub fn grid_to_data_table(
        &mut self,
        sheet_rect: SheetRect,
        table_name: Option<String>,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) {
        let ops = self.grid_to_data_table_operations(sheet_rect, table_name, first_row_is_header);
        self.start_user_transaction(ops, cursor, TransactionName::GridToDataTable);
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
    ) {
        let ops = self.data_table_meta_operations(
            sheet_pos,
            name,
            alternating_colors,
            columns,
            show_name,
            show_columns,
        );
        self.start_user_transaction(ops, cursor, TransactionName::DataTableMeta);
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
        self.start_user_transaction(ops, cursor, TransactionName::DataTableMutations);
    }

    pub fn data_table_insert_columns(
        &mut self,
        sheet_pos: SheetPos,
        columns: Vec<u32>,
        swallow: bool,
        copy_formats_from: Option<u32>,
        copy_formats: Option<CopyFormats>,
        cursor: Option<String>,
    ) {
        let ops = self.data_table_insert_columns_operations(
            sheet_pos,
            columns,
            swallow,
            copy_formats_from,
            copy_formats,
        );
        self.start_user_transaction(ops, cursor, TransactionName::DataTableMutations);
    }

    pub fn data_table_insert_rows(
        &mut self,
        sheet_pos: SheetPos,
        rows: Vec<u32>,
        swallow: bool,
        copy_formats_from: Option<u32>,
        copy_formats: Option<CopyFormats>,
        cursor: Option<String>,
    ) {
        let ops = self.data_table_insert_rows_operations(
            sheet_pos,
            rows,
            swallow,
            copy_formats_from,
            copy_formats,
        );
        self.start_user_transaction(ops, cursor, TransactionName::DataTableMutations);
    }

    pub fn sort_data_table(
        &mut self,
        sheet_pos: SheetPos,
        sort: Option<Vec<DataTableSort>>,
        cursor: Option<String>,
    ) {
        let ops = self.sort_data_table_operations(sheet_pos, sort);
        self.start_user_transaction(ops, cursor, TransactionName::GridToDataTable);
    }

    pub fn data_table_first_row_as_header(
        &mut self,
        sheet_pos: SheetPos,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) {
        let ops = self.data_table_first_row_as_header_operations(sheet_pos, first_row_is_header);
        self.start_user_transaction(ops, cursor, TransactionName::DataTableFirstRowAsHeader);
    }

    pub fn add_data_table(
        &mut self,
        sheet_pos: SheetPos,
        name: String,
        values: Vec<Vec<String>>,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) {
        let ops = self.add_data_table_operations(sheet_pos, name, values, first_row_is_header);
        self.start_user_transaction(ops, cursor, TransactionName::DataTableAddDataTable);
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        Array, CellValue, Pos, Rect, SheetPos, Value,
        a1::A1Selection,
        cellvalue::Import,
        controller::{
            GridController,
            transaction_types::{JsCellValueResult, JsCodeResult},
            user_actions::import::tests::simple_csv,
        },
        grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind},
        test_create_data_table,
        test_util::*,
        wasm_bindings::js::{clear_js_calls, expect_js_call},
    };

    #[test]
    fn test_code_data_table_to_data_table() {
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
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
            Some(true),
            Some(true),
            None,
        );

        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_tables.insert_sorted(pos, data_table);
        let code_cell_value = CodeCellValue {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
        };
        sheet.set_cell_value(pos, CellValue::Code(code_cell_value.clone()));
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let expected = vec!["1", "2", "3"];
        let import = Import::new("".into());

        // initial value
        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 2, 1));
        assert_cell_value_row(&gc, sheet_id, 0, 2, 2, expected.clone());
        assert_cell_value(
            &gc,
            sheet_id,
            0,
            0,
            CellValue::Code(code_cell_value.clone()),
        );

        gc.code_data_table_to_data_table(sheet_pos, None).unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 2, 2));
        assert_cell_value_row(&gc, sheet_id, 0, 2, 2, expected.clone());
        assert_cell_value(&gc, sheet_id, 0, 0, CellValue::Import(import.clone()));

        // undo, the value should be a code run data table again
        gc.undo(None);
        assert_cell_value(&gc, sheet_id, 0, 0, CellValue::Code(code_cell_value));

        // redo, the value should be a data table
        gc.redo(None);
        assert_cell_value(&gc, sheet_id, 0, 0, CellValue::Import(import));
    }

    #[test]
    fn test_data_table_meta_change_table_name() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let pos_code_cell = Pos { x: 10, y: 10 };
        let sheet_pos_code_cell = SheetPos::from((pos_code_cell, sheet_id));
        let old_name = gc.sheet(sheet_id).data_table(pos).unwrap().name.clone();
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
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("1".into(), 2)),
            ..Default::default()
        });

        let cell_value = gc.sheet(sheet_id).cell_value(pos_code_cell);
        let code_cell_value = CodeCellValue::new_python(old_code.into());
        assert_eq!(cell_value, Some(CellValue::Code(code_cell_value)));

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
        );

        let updated_name = gc.sheet(sheet_id).data_table(pos).unwrap().name.clone();
        assert_eq!(updated_name.to_display(), new_name);

        let cell_value = gc.sheet(sheet_id).cell_value(pos_code_cell);
        let code_cell_value = CodeCellValue::new_python(new_code.into());
        assert_eq!(cell_value, Some(CellValue::Code(code_cell_value)));
    }

    #[test]
    fn test_data_table_meta_change_column_name() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let pos_code_cell = Pos { x: 10, y: 10 };
        let sheet_pos_code_cell = SheetPos::from((pos_code_cell, sheet_id));
        let column_headers = gc
            .sheet(sheet_id)
            .data_table(pos)
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
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("1".into(), 2)),
            ..Default::default()
        });

        let cell_value = gc.sheet(sheet_id).cell_value(pos_code_cell);
        let code_cell_value = CodeCellValue::new_python(old_code.into());
        assert_eq!(cell_value, Some(CellValue::Code(code_cell_value)));

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
        );

        let updated_name = gc
            .sheet(sheet_id)
            .data_table(pos)
            .unwrap()
            .column_headers
            .as_ref()
            .unwrap()[0]
            .name
            .clone();
        assert_eq!(updated_name.to_string(), new_name);

        let cell_value = gc.sheet(sheet_id).cell_value(pos_code_cell);
        let code_cell_value = CodeCellValue::new_python(new_code.into());
        assert_eq!(cell_value, Some(CellValue::Code(code_cell_value)));
    }

    #[test]
    fn test_insert_data_table_column_and_row() {
        clear_js_calls();

        let (mut gc, sheet_id, pos, file_name) = simple_csv();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 11);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 4);

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
        );

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 12);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 5);

        gc.undo(None);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 11);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 4);

        gc.redo(None);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 5, 15));
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().height(true), 12);
        assert_eq!(gc.sheet(sheet_id).data_table(pos).unwrap().width(), 5);

        expect_js_call(
            "jsSetCursor",
            serde_json::to_string(&A1Selection::table(sheet_pos, file_name)).unwrap(),
            true,
        );

        // let data_table = sheet.data_table_mut(data_table_pos).unwrap();
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
        );

        // Verify the first data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table(pos![A1]).unwrap();

            // Check basic properties
            assert_eq!(data_table.name, "Table_1".into());
            assert!(data_table.header_is_first_row);
            assert_eq!(
                data_table.value,
                Value::Array(Array::from(vec![
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
                ]))
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
            SheetPos::from((pos![D1], sheet_id)),
            "Test value".into(),
            None,
        );

        gc.add_data_table(
            SheetPos::from((pos![D1], sheet_id)),
            "Table 2".to_string(),
            values_no_header.to_owned(),
            false,
            None,
        );

        // Verify the second data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table(pos![D1]).unwrap();

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
        gc.undo(None);
        {
            let sheet = gc.sheet(sheet_id);
            assert_eq!(
                sheet.cell_value(pos![D1]),
                Some(CellValue::Text("Test value".into()))
            );
            assert!(sheet.data_table(pos![D1]).is_none());
        }

        gc.redo(None);
        {
            let sheet = gc.sheet(sheet_id);
            assert!(sheet.cell_value(pos![D1]).is_some());
            assert!(sheet.data_table(pos![D1]).is_some());
        }

        // overwrite second data table with a new data table
        let table_3_values = vec![vec!["Z".into(), "Y".into()], vec!["X".into(), "W".into()]];
        gc.add_data_table(
            SheetPos::from((pos![D1], sheet_id)),
            "Table 3".to_string(),
            table_3_values.to_owned(),
            false,
            None,
        );
        // Verify the third data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table(pos![D1]).unwrap();

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
        gc.undo(None);
        // Verify the second data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table(pos![D1]).unwrap();

            // Check basic properties
            // assert_eq!(data_table.name, "Table_2".into());
            assert!(!data_table.header_is_first_row);
            assert_eq!(data_table.value, Value::Array(values_no_header.into()));

            // Check that column headers are automatically generated
            let headers = data_table.column_headers.as_ref().unwrap();
            assert_eq!(headers.len(), 2);
            assert_eq!(headers[0].name, "Column 1".into());
            assert_eq!(headers[1].name, "Column 2".into());
        }

        // redo, the third data table should be back
        gc.redo(None);
        // Verify the third data table
        {
            let sheet = gc.sheet(sheet_id);
            let data_table = sheet.data_table(pos![D1]).unwrap();

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

        assert_eq!(gc.data_table(pos![sheet_id!A1]), Some(&dt));
        assert!(gc.data_table(pos![sheet_id!A2]).is_none());
    }
}
