use anyhow::Result;

use crate::Pos;
use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::grid::SheetId;

impl GridController {
    /// Imports a CSV file into the grid.
    ///
    /// Using `cursor` here also as a flag to denote import into new / existing file.
    #[allow(clippy::too_many_arguments)]
    pub fn import_csv(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
        delimiter: Option<u8>,
        header_is_first_row: Option<bool>,
    ) -> Result<()> {
        let ops = self.import_csv_operations(
            sheet_id,
            file,
            file_name,
            insert_at,
            delimiter,
            header_is_first_row,
        )?;
        if cursor.is_some() {
            self.start_user_transaction(ops, cursor, TransactionName::Import);
        } else {
            self.server_apply_transaction(ops, Some(TransactionName::Import));
        }

        Ok(())
    }

    /// Imports an Excel file into the grid.
    ///
    /// Using `cursor` here also as a flag to denote import into new / existing file.
    #[function_timer::function_timer]
    pub fn import_excel(
        &mut self,
        file: &[u8],
        file_name: &str,
        cursor: Option<String>,
    ) -> Result<()> {
        let ops = self.import_excel_operations(file, file_name)?;
        if cursor.is_some() {
            self.start_user_transaction(ops, cursor, TransactionName::Import);
        } else {
            self.server_apply_transaction(ops, Some(TransactionName::Import));
        }

        Ok(())
    }

    /// Imports a Parquet file into the grid.
    ///
    /// Using `cursor` here also as a flag to denote import into new / existing file.
    pub fn import_parquet(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<()> {
        let ops = self.import_parquet_operations(sheet_id, file, file_name, insert_at)?;
        if cursor.is_some() {
            self.start_user_transaction(ops, cursor, TransactionName::Import);
        } else {
            self.server_apply_transaction(ops, Some(TransactionName::Import));
        }

        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::str::FromStr;

    use crate::{
        CellValue, Rect, RunError, RunErrorMsg, Span,
        grid::{CodeCellLanguage, CodeCellValue},
        test_util::*,
        wasm_bindings::js::clear_js_calls,
    };

    use bigdecimal::BigDecimal;
    use chrono::{NaiveDate, NaiveDateTime};

    use crate::wasm_bindings::js::expect_js_call_count;

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
    // const SIMPLE_PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/simple.parquet";
    // const MEDIUM_PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/lineitem.parquet";
    // const LARGE_PARQUET_FILE: &str =
    // "../quadratic-rust-shared/data/parquet/flights_1m.parquet";

    pub(crate) fn simple_csv() -> (GridController, SheetId, Pos, &'static str) {
        simple_csv_at(Pos { x: 1, y: 1 })
    }

    pub(crate) fn simple_csv_at(pos: Pos) -> (GridController, SheetId, Pos, &'static str) {
        let csv_file = read_test_csv_file("simple.csv");
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let file_name = "simple.csv";

        gc.import_csv(
            sheet_id,
            csv_file.as_slice().to_vec(),
            file_name,
            pos,
            None,
            Some(b','),
            Some(true),
        )
        .unwrap();

        (gc, sheet_id, pos, file_name)
    }

    #[track_caller]
    pub(crate) fn assert_simple_csv<'a>(
        gc: &'a GridController,
        sheet_id: SheetId,
        pos: Pos,
        file_name: &'a str,
    ) -> (&'a GridController, SheetId, Pos, &'a str) {
        // data table should be at `pos`
        assert_eq!(
            gc.sheet(sheet_id)
                .data_table_pos_that_contains(&pos)
                .unwrap(),
            pos
        );

        let first_row = vec!["city", "region", "country", "population"];
        assert_cell_value_row(gc, sheet_id, pos.x, pos.x + 3, pos.y + 1, first_row);

        let last_row = vec!["Concord", "NH", "United States", "42605"];
        assert_cell_value_row(gc, sheet_id, pos.x, pos.x + 3, pos.y + 12, last_row);

        (gc, sheet_id, pos, file_name)
    }

    #[test]
    fn imports_a_simple_csv() {
        let (gc, sheet_id, pos, file_name) = simple_csv();

        assert_simple_csv(&gc, sheet_id, pos, file_name);
    }

    #[test]
    fn errors_on_an_empty_csv() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let result = grid_controller.import_csv(
            sheet_id,
            "".as_bytes().to_vec(),
            "smallpop.csv",
            pos,
            None,
            Some(b','),
            Some(false),
        );
        assert!(result.is_err());
    }

    #[test]
    fn import_large_csv() {
        clear_js_calls();

        let mut gc = GridController::test();
        let mut csv = String::new();

        for _ in 0..10000 {
            for x in 0..10 {
                csv.push_str(&format!("{},", x));
            }
            csv.push_str("done,\n");
        }

        gc.import_csv(
            gc.grid.sheets()[0].id,
            csv.as_bytes().to_vec(),
            "large.csv",
            Pos { x: 0, y: 0 },
            None,
            Some(b','),
            Some(false),
        )
        .unwrap();

        expect_js_call_count("jsImportProgress", 1, true);
    }

    #[test]
    fn import_problematic_line() {
        let mut gc = GridController::test();
        let csv = "980E92207901934";
        let ops = gc
            .import_csv_operations(
                gc.grid.sheets()[0].id,
                csv.as_bytes().to_vec(),
                "bad line",
                Pos { x: 0, y: 0 },
                Some(b','),
                Some(false),
            )
            .unwrap();
        let op = &ops[0];
        serde_json::to_string(op).unwrap();
    }

    #[test]
    fn imports_a_simple_excel_file() {
        let mut gc = GridController::new_blank();
        let file: Vec<u8> = std::fs::read(EXCEL_FILE).expect("Failed to read file");
        let _ = gc.import_excel(&file, "basic.xlsx", Some("".to_string()));
        let sheet_id = gc.grid.sheets()[0].id;

        assert_cell_value_row(
            &gc,
            sheet_id,
            1,
            11,
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

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value((2, 2).into()).unwrap(),
            CellValue::Text("Hello".into())
        );
        assert_eq!(
            sheet.cell_value((3, 2).into()).unwrap(),
            CellValue::Date(NaiveDate::parse_from_str("2016-10-20", "%Y-%m-%d").unwrap())
        );
        assert_eq!(
            sheet.cell_value((5, 2).into()).unwrap(),
            CellValue::Number(BigDecimal::from_str("1.1").unwrap())
        );
        assert_eq!(
            sheet.cell_value((6, 2).into()).unwrap(),
            CellValue::DateTime(
                NaiveDateTime::parse_from_str("2024-01-01 13:00", "%Y-%m-%d %H:%M").unwrap()
            )
        );
        assert_eq!(
            sheet.cell_value((7, 2).into()).unwrap(),
            CellValue::Number(BigDecimal::from_str("1").unwrap())
        );
        assert_eq!(
            sheet.cell_value((8, 2).into()).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "0/0".to_string()
            })
        );
        assert_eq!(
            sheet.display_value((8, 2).into()).unwrap(),
            CellValue::Error(Box::new(RunError {
                msg: RunErrorMsg::DivideByZero,
                span: Some(Span { start: 0, end: 3 })
            }))
        );
        assert_eq!(
            sheet.cell_value((9, 2).into()).unwrap(),
            CellValue::Logical(true)
        );
        assert_eq!(
            sheet.cell_value((10, 2).into()).unwrap(),
            CellValue::Text("Hello Bold".into())
        );
        assert_eq!(
            sheet.cell_value((11, 2).into()).unwrap(),
            CellValue::Text("Hello Red".into())
        );

        expect_js_call_count("jsTransactionStart", 4, false);
        expect_js_call_count("jsTransactionEnd", 4, false);

        // doesn't appear to import the bold or red formatting yet
        // assert_eq!(
        //     sheet.format_cell(9, 2, false),
        //     Format {
        //         bold: Some(true),
        //         ..Default::default()
        //     }
        // );
        // assert_eq!(
        //     sheet.format_cell(10, 2, false),
        //     Format {
        //         text_color: Some("red".to_string()),
        //         ..Default::default()
        //     }
        // );
    }

    #[test]
    fn import_all_excel_functions() {
        let mut gc = GridController::new_blank();
        let file: Vec<u8> = std::fs::read(EXCEL_FUNCTIONS_FILE).expect("Failed to read file");
        let _ = gc.import_excel(&file, "all_excel_functions.xlsx", None);
        let sheet_id = gc.grid.sheets()[0].id;

        print_table_at(&gc, sheet_id, pos![A1]);

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        let (y_start, y_end) = sheet.column_bounds(1, true).unwrap();
        assert_eq!(y_start, 1);
        assert_eq!(y_end, 512);
        for y in y_start..=y_end {
            let pos = Pos { x: 1, y };
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
            let code_run = sheet.data_table_at(&pos).unwrap().code_run().unwrap();
            if let Some(error) = &code_run.error {
                if error.msg == RunErrorMsg::BadFunctionName {
                    panic!("expected valid function name")
                }
            }
        }
    }

    #[test]
    fn imports_a_simple_parquet() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = pos![A1];
        let file_name = "alltypes_plain.parquet";
        let file: Vec<u8> = std::fs::read(PARQUET_FILE).expect("Failed to read file");
        let _result = grid_controller.import_parquet(sheet_id, file, file_name, pos, None);

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            1,
            23,
            2,
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
            1,
            23,
            3,
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
                "2024-05-08 19:49:07.236",              // timestamp
                "2024-05-08 19:49:07.236",              // timestamptz
                "2024-05-08",                           // date
                "19:49:07",                             // time
                "19:49:07",                             // timetz
                "",                                     // interval
                "4599689c-7048-47dc-abf7-f7e9ee636578", // uuid
                "{\"a\":\"b\"}",                        // json
                "{\"a\":\"b\"}",                        // jsonb
                "",                                     // xml
            ],
        );
    }

    // The following tests run too slowly to be included in the test suite:

    // #[test]    // fn imports_a_medium_parquet() {
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

    //     expect_js_call_count("jsHashesRenderCells", 33026, true);
    // }

    #[test]
    fn should_import_with_title_header_only() {
        let file_name = "title_row.csv";
        let csv_file = read_test_csv_file(file_name);
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = pos![A1];

        gc.import_csv(
            sheet_id,
            csv_file.as_slice().to_vec(),
            file_name,
            pos,
            None,
            Some(b','),
            Some(false),
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.rendered_value(pos![A1]).unwrap(), "title_row.csv");
        assert_eq!(sheet.rendered_value(pos![A2]).unwrap(), "Column 1");
        assert_eq!(sheet.rendered_value(pos![A3]).unwrap(), "Sample report");
        assert_eq!(sheet.rendered_value(pos![A5]).unwrap(), "c1");
        assert_eq!(sheet.rendered_value(pos![B5]).unwrap(), " c2");
        assert_eq!(sheet.rendered_value(pos![C5]).unwrap(), " Sample column3");
    }

    #[test]
    fn should_import_with_title_header_and_empty_first_row() {
        let file_name = "title_row_empty_first.csv";
        let csv_file = read_test_csv_file(file_name);
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_csv(
            sheet_id,
            csv_file.as_slice().to_vec(),
            file_name,
            pos,
            None,
            Some(b','),
            Some(false),
        )
        .unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new_span(pos, Pos { x: 3, y: 4 }));

        assert_cell_value_row(&gc, sheet_id, 0, 2, 2, vec!["Sample report ", "", ""]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 4, vec!["c1", " c2", " Sample column3"]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 7, vec!["7", "8", "9"]);
    }

    #[test]
    fn should_import_utf16_with_invalid_characters() {
        let file_name = "encoding_issue.csv";
        let csv_file = read_test_csv_file(file_name);

        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 1, y: 1 };

        gc.import_csv(
            sheet_id,
            csv_file.as_slice().to_vec(),
            file_name,
            pos,
            None,
            Some(b','),
            None,
        )
        .unwrap();

        print_first_sheet(&gc);

        assert_cell_value_row(
            &gc,
            sheet_id,
            1,
            3,
            2,
            vec!["issue", " test", " value\u{feff}"],
        );
        assert_cell_value_row(
            &gc,
            sheet_id,
            1,
            3,
            3,
            vec!["0", "1", " Inv\u{feff}alid\u{feff}"],
        );
        assert_cell_value_row(&gc, sheet_id, 1, 3, 4, vec!["0", "2", " Valid"]);
    }

    // #[test]    // fn imports_a_large_parquet() {
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

    #[test]
    fn test_import_kaggle_csv() {
        let file_name = "kaggle_top_100_dataset.csv";
        let csv_file = read_test_csv_file(file_name);

        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.import_csv(sheet_id, csv_file, file_name, pos![A1], None, None, None)
            .unwrap();
        assert_display_cell_value(&gc, sheet_id, 1, 2, "Dataset_Name");
        assert_display_cell_value(&gc, sheet_id, 1, 101, "Pima Indians Diabetes Database");
    }
}
