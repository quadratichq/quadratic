use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::GridController;
use crate::{grid::SheetId, Pos};
use anyhow::Result;

impl GridController {
    /// Imports a CSV file into the grid.
    pub fn import_csv(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<()> {
        let ops = self.import_csv_operations(sheet_id, file, file_name, insert_at)?;
        self.start_user_transaction(ops, cursor, TransactionName::Import);
        Ok(())
    }

    /// Imports an Excel file into the grid.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn import_excel(&mut self, file: Vec<u8>, file_name: &str) -> Result<()> {
        let import_ops = self.import_excel_operations(file, file_name)?;
        self.server_apply_transaction(import_ops);

        // Rerun all code cells after importing Excel file
        // This is required to run compute cells in order
        let code_rerun_ops = self.rerun_all_code_cells_operations();
        self.server_apply_transaction(code_rerun_ops);
        Ok(())
    }

    /// Imports a Parquet file into the grid.
    pub fn import_parquet(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<()> {
        let ops = self.import_parquet_operations(sheet_id, file, file_name, insert_at)?;
        self.start_user_transaction(ops, cursor, TransactionName::Import);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        grid::{CodeCellLanguage, CodeRunResult},
        test_util::{assert_cell_value_row, print_table},
        wasm_bindings::js::clear_js_calls,
        CellValue, Rect, RunErrorMsg,
    };

    use serial_test::{parallel, serial};

    use super::*;

    fn read_test_csv_file(file_name: &str) -> Vec<u8> {
        let path = format!("../quadratic-rust-shared/data/csv/{file_name}");
        std::fs::read(path).unwrap_or_else(|_| panic!("test csv file not found {}", file_name))
    }

    // const EXCEL_FILE: &str = "../quadratic-rust-shared/data/excel/temperature.xlsx";
    const EXCEL_FILE: &str = "../quadratic-rust-shared/data/excel/basic.xlsx";
    const EXCEL_FUNCTIONS_FILE: &str =
        "../quadratic-rust-shared/data/excel/all_excel_functions.xlsx";
    // const EXCEL_FILE: &str = "../quadratic-rust-shared/data/excel/financial_sample.xlsx";
    const PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/all_supported_types.parquet";
    // const MEDIUM_PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/lineitem.parquet";
    // const LARGE_PARQUET_FILE: &str =
    // "../quadratic-rust-shared/data/parquet/flights_1m.parquet";

    #[test]
    #[parallel]
    fn imports_a_simple_csv() {
        let scv_file = read_test_csv_file("simple.csv");
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let _ =
            grid_controller.import_csv(sheet_id, scv_file.as_slice(), "smallpop.csv", pos, None);

        print_table(
            &grid_controller,
            sheet_id,
            Rect::new_span(pos, Pos { x: 3, y: 10 }),
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            3,
            0,
            vec!["city", "region", "country", "population"],
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            3,
            10,
            vec!["Concord", "NH", "United States", "42605"],
        );
    }

    #[test]
    #[parallel]
    fn errors_on_an_empty_csv() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let result = grid_controller.import_csv(sheet_id, "".as_bytes(), "smallpop.csv", pos, None);
        assert!(result.is_err());
    }

    #[test]
    #[serial]
    fn import_large_csv() {
        let mut gc = GridController::test();
        let mut csv = String::new();
        for _ in 0..10000 {
            for x in 0..10 {
                csv.push_str(&format!("{},", x));
            }
            csv.push_str("done,\n");
        }
        let result = gc.import_csv(
            gc.grid.sheets()[0].id,
            csv.as_bytes(),
            "large.csv",
            Pos { x: 0, y: 0 },
            None,
        );
        assert!(result.is_ok());
        clear_js_calls();
    }

    #[test]
    #[parallel]
    fn import_problematic_line() {
        let mut gc = GridController::test();
        let csv = "980E92207901934";
        let ops = gc
            .import_csv_operations(
                gc.grid.sheets()[0].id,
                csv.as_bytes(),
                "bad line",
                Pos { x: 0, y: 0 },
            )
            .unwrap();
        let op = &ops[0];
        serde_json::to_string(op).unwrap();
    }

    #[test]
    #[parallel]
    fn imports_a_simple_excel_file() {
        let mut grid_controller = GridController::test_blank();
        let pos = Pos { x: 0, y: 0 };
        let file: Vec<u8> = std::fs::read(EXCEL_FILE).expect("Failed to read file");
        let _ = grid_controller.import_excel(file, "basic.xlsx");
        let sheet_id = grid_controller.grid.sheets()[0].id;

        print_table(
            &grid_controller,
            sheet_id,
            Rect::new_span(pos, Pos { x: 10, y: 10 }),
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            10,
            1,
            vec![
                "Empty",
                "String",
                "DateTimeIso",
                "DurationIso",
                "Float",
                "DateTime",
                "Int",
                "Error",
                "Bool",
                "Bold",
                "Red",
            ],
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            10,
            2,
            vec![
                "",
                "Hello",
                "2016-10-20 00:00:00",
                "",
                "1.1",
                "2024-01-01 13:00:00",
                "1",
                "",
                "TRUE",
                "Hello Bold",
                "Hello Red",
            ],
        );
    }

    #[test]
    #[parallel]
    fn import_all_excel_functions() {
        let mut grid_controller = GridController::test_blank();
        let pos = Pos { x: 0, y: 0 };
        let file: Vec<u8> = std::fs::read(EXCEL_FUNCTIONS_FILE).expect("Failed to read file");
        let _ = grid_controller.import_excel(file, "all_excel_functions.xlsx");
        let sheet_id = grid_controller.grid.sheets()[0].id;

        print_table(
            &grid_controller,
            sheet_id,
            Rect::new_span(pos, Pos { x: 10, y: 10 }),
        );

        let sheet = grid_controller.grid.try_sheet(sheet_id).unwrap();
        let (y_start, y_end) = sheet.column_bounds(0, true).unwrap();
        assert_eq!(y_start, 1);
        assert_eq!(y_end, 512);
        for y in y_start..=y_end {
            let pos = Pos { x: 0, y };
            // all cells should be formula code cells
            let code_cell = sheet.cell_value(pos).unwrap();
            match &code_cell {
                CellValue::Code(code_cell_value) => {
                    assert_eq!(code_cell_value.language, CodeCellLanguage::Formula);
                }
                _ => panic!("expected code cell"),
            }

            // all code cells should have valid function names,
            // valid functions may not be implemented yet
            let code_run = sheet.code_run(pos).unwrap();
            if let CodeRunResult::Err(error) = &code_run.result {
                if error.msg == RunErrorMsg::BadFunctionName {
                    panic!("expected valid function name")
                }
            }
        }
    }

    #[test]
    #[parallel]
    fn imports_a_simple_parquet() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let file: Vec<u8> = std::fs::read(PARQUET_FILE).expect("Failed to read file");
        let _ = grid_controller.import_parquet(sheet_id, file, "alltypes_plain.parquet", pos, None);

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            22,
            0,
            vec![
                "id",
                "text",
                "varchar",
                "char",
                "name",
                "bool",
                "bytea",
                "int2",
                "int4",
                "int8",
                "float4",
                "float8",
                "numeric",
                "timestamp",
                "timestamptz",
                "date",
                "time",
                "timetz",
                "interval",
                "uuid",
                "json",
                "jsonb",
                "xml",
            ],
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            22,
            1,
            vec![
                "1",                                    // id
                "a",                                    // text
                "b",                                    // varchar
                "c",                                    // char
                "d",                                    // name
                "TRUE",                                 // bool
                "",                                     // bytea
                "1",                                    // int2
                "2",                                    // int4
                "3",                                    // int8
                "1.1",                                  // float4
                "2.2",                                  // float8
                "3.3",                                  // numeric
                "2024-05-08 19:49:07",                  // timestamp
                "2024-05-08 19:49:07",                  // timestamptz
                "2024-05-08",                           // date
                "00:01:11",                             // time
                "00:01:11",                             // timetz
                "",                                     // interval
                "4599689c-7048-47dc-abf7-f7e9ee636578", // uuid
                "{\"a\":\"b\"}",                        // json
                "{\"a\":\"b\"}",                        // jsonb
                "",                                     // xml
            ],
        );
    }

    // The following tests run too slowly to be included in the test suite:

    // #[test]#[parallel]
    // fn imports_a_medium_parquet() {
    //     let mut grid_controller = GridController::test();
    //     let sheet_id = grid_controller.grid.sheets()[0].id;
    //     let pos = Pos { x: 0, y: 0 };
    //     let mut file = File::open(MEDIUM_PARQUET_FILE).unwrap();
    //     let metadata = std::fs::metadata(MEDIUM_PARQUET_FILE).expect("unable to read metadata");
    //     let mut buffer = vec![0; metadata.len() as usize];
    //     file.read_exact(&mut buffer).expect("buffer overflow");

    //     let _ = grid_controller.import_parquet(sheet_id, buffer, "lineitem.parquet", pos, None);

    //      print_table(
    //          &grid_controller,
    //          sheet_id,
    //          Rect::new_span(Pos { x: 8, y: 0 }, Pos { x: 15, y: 10 }),
    //      );

    //     expect_js_call_count("jsRenderCellSheets", 33026, true);
    // }

    #[test]
    #[parallel]
    fn should_import_with_title_header() {
        let scv_file = read_test_csv_file("title_row.csv");
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_csv(sheet_id, scv_file.as_slice(), "test.csv", pos, None)
            .expect("import_csv");

        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 3, y: 4 }));

        assert_cell_value_row(&gc, sheet_id, 0, 2, 0, vec!["Sample report ", "", ""]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 2, vec!["c1", " c2", " Sample column3"]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 5, vec!["7", "8", "9"]);
    }

    #[test]
    #[parallel]
    fn should_import_with_title_header_and_empty_first_row() {
        let scv_file = read_test_csv_file("title_row_empty_first.csv");
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_csv(sheet_id, scv_file.as_slice(), "test.csv", pos, None)
            .expect("import_csv");

        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 3, y: 4 }));

        assert_cell_value_row(&gc, sheet_id, 0, 2, 0, vec!["Sample report ", "", ""]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 2, vec!["c1", " c2", " Sample column3"]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 5, vec!["7", "8", "9"]);
    }

    #[test]
    #[parallel]
    fn should_import_utf16_with_invalid_characters() {
        let scv_file = read_test_csv_file("encoding_issue.csv");

        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_csv(sheet_id, scv_file.as_slice(), "test.csv", pos, None)
            .expect("import_csv");

        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 2, y: 3 }));

        assert_cell_value_row(&gc, sheet_id, 0, 2, 0, vec!["issue", " test", " value"]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 1, vec!["0", " 1", " Invalid"]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 2, vec!["0", " 2", " Valid"]);
    }

    // #[test]#[parallel]
    // fn imports_a_large_parquet() {
    //     let mut grid_controller = GridController::test();
    //     let sheet_id = grid_controller.grid.sheets()[0].id;
    //     let pos = Pos { x: 0, y: 0 };
    //     let mut file = File::open(LARGE_PARQUET_FILE).unwrap();
    //     let metadata = std::fs::metadata(LARGE_PARQUET_FILE).expect("unable to read metadata");
    //     let mut buffer = vec![0; metadata.len() as usize];
    //     file.read(&mut buffer).expect("buffer overflow");

    //     let _ = grid_controller.import_parquet(sheet_id, buffer, "flights_1m.parquet", pos, None);

    //     print_table(
    //         &grid_controller,
    //         sheet_id,
    //         Rect::new_span(pos, Pos { x: 6, y: 10 }),
    //     );
    // }
}
