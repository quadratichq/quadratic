use crate::controller::{transaction_summary::TransactionSummary, GridController};
use crate::{grid::SheetId, Pos};
use anyhow::Result;

impl GridController {
    /// Imports a CSV file into the grid.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn import_csv(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let ops = self.import_csv_operations(sheet_id, file, file_name, insert_at)?;
        Ok(self.start_user_transaction(ops, cursor))
    }

    /// Imports an Excel file into the grid.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn import_excel(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let ops = self.import_excel_operations(sheet_id, file, file_name, insert_at)?;
        Ok(self.start_user_transaction(ops, cursor))
    }

    /// Imports a Parquet file into the grid.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn import_parquet(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let ops = self.import_parquet_operations(sheet_id, file, file_name, insert_at)?;
        Ok(self.start_user_transaction(ops, cursor))
    }
}

#[cfg(test)]
mod tests {

    use std::fs::File;
    use std::io::Read;

    use crate::{
        test_util::{assert_cell_value_row, print_table},
        Rect,
    };

    use super::*;

    const SIMPLE_CSV: &str = r#"city,region,country,population
Southborough,MA,United States,9686
Northbridge,MA,United States,14061
Westborough,MA,United States,29313
Marlborough,MA,United States,38334
Springfield,MA,United States,152227
Springfield,MO,United States,150443
Springfield,NJ,United States,14976
Springfield,OH,United States,64325
Springfield,OR,United States,56032
Concord,NH,United States,42605
"#;

    // const EXCEL_FILE: &str = "../quadratic-rust-shared/data/excel/temperature.xlsx";
    const EXCEL_FILE: &str = "../quadratic-rust-shared/data/excel/all_datatypes.xlsx";
    // const EXCEL_FILE: &str = "../quadratic-rust-shared/data/excel/financial_sample.xlsx";
    const PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/alltypes_plain.parquet";
    const MEDIUM_PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/lineitem.parquet";
    // const LARGE_PARQUET_FILE: &str =
    // "../quadratic-rust-shared/data/parquet/flights_1m.parquet";

    #[test]
    fn imports_a_simple_csv() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let _ =
            grid_controller.import_csv(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos, None);

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
    fn errors_on_an_empty_csv() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let result = grid_controller.import_csv(sheet_id, "".as_bytes(), "smallpop.csv", pos, None);
        assert!(result.is_err());
    }

    #[test]
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
        print!("{}", &result.unwrap().operations.unwrap().len());
        // assert!(result.is_ok())
    }

    #[test]
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
    fn imports_a_simple_excel_file() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let mut file = File::open(EXCEL_FILE).unwrap();
        let metadata = std::fs::metadata(EXCEL_FILE).expect("unable to read metadata");
        let mut buffer = vec![0; metadata.len() as usize];
        file.read(&mut buffer).expect("buffer overflow");

        let _ = grid_controller.import_excel(sheet_id, buffer, "temperature.xlsx", pos, None);

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
            0,
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
            1,
            vec![
                "",
                "Hello",
                "2016-10-20 0:00:00",
                "2400:00:00",
                "1.11",
                "1/1/2024 1:00 PM",
                "1",
                "",
                "TRUE",
                "Hello Bold",
                "Hello Red",
            ],
        );
    }

    #[test]
    fn imports_a_simple_parquet() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let mut file = File::open(PARQUET_FILE).unwrap();
        let metadata = std::fs::metadata(PARQUET_FILE).expect("unable to read metadata");
        let mut buffer = vec![0; metadata.len() as usize];
        file.read(&mut buffer).expect("buffer overflow");

        let _ =
            grid_controller.import_parquet(sheet_id, buffer, "alltypes_plain.parquet", pos, None);

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
            0,
            vec![
                "id",
                "bool_col",
                "tinyint_col",
                "smallint_col",
                "int_col",
                "bigint_col",
                "float_col",
                "double_col",
                "date_string_col",
                "string_col",
                "timestamp_col",
            ],
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            10,
            1,
            vec![
                "4",
                "TRUE",
                "0",
                "0",
                "0",
                "0",
                "0",
                "0",
                "03/01/09",
                "0",
                "2009-03-01 00:00:00",
            ],
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            10,
            8,
            vec![
                "1",
                "FALSE",
                "1",
                "1",
                "1",
                "10",
                "1.1",
                "10.1",
                "01/01/09",
                "1",
                "2009-01-01 00:01:00",
            ],
        );
    }

    #[test]
    fn imports_a_medium_parquet() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let mut file = File::open(MEDIUM_PARQUET_FILE).unwrap();
        let metadata = std::fs::metadata(MEDIUM_PARQUET_FILE).expect("unable to read metadata");
        let mut buffer = vec![0; metadata.len() as usize];
        file.read(&mut buffer).expect("buffer overflow");

        let _ = grid_controller.import_parquet(sheet_id, buffer, "lineitem.parquet", pos, None);

        print_table(
            &grid_controller,
            sheet_id,
            Rect::new_span(Pos { x: 8, y: 0 }, Pos { x: 15, y: 10 }),
        );
    }

    // #[test]
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
