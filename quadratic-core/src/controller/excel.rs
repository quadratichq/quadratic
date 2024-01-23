use std::{collections::HashMap, io::Cursor};

use anyhow::{anyhow, bail, Result};

use super::{
    transaction_summary::TransactionSummary, GridController,
};
use crate::{grid::SheetId, Pos};

use calamine::{open_workbook_auto_from_rs, DataType, Range, Reader, Sheets};
use std::io::Write;

fn open_file(bytes: Vec<u8>) -> std::result::Result<Sheets<Cursor<Vec<u8>>>, String> {
    let file = std::io::Cursor::new(bytes);
    open_workbook_auto_from_rs(file).map_err(|e| e.to_string())
}

fn read_excel_sheet(
    range: &Range<DataType>,
    separator: char,
) -> std::io::Result<Vec<u8>> {
    let mut dest = std::io::Cursor::new(vec![]);

    let n = range.get_size().1 - 1;
    for r in range.rows() {
        for (i, c) in r.iter().enumerate() {
            match *c {
                DataType::Empty => Ok(()),
                DataType::String(ref s)
                | DataType::DateTimeIso(ref s)
                | DataType::DurationIso(ref s) => write!(dest, "{}", s),
                DataType::Float(ref f) | DataType::DateTime(ref f) | DataType::Duration(ref f) => {
                    write!(dest, "{}", f)
                }
                DataType::Int(ref i) => write!(dest, "{}", i),
                DataType::Error(ref e) => write!(dest, "{:?}", e),
                DataType::Bool(ref b) => write!(dest, "{}", b),
            }?;
            if i != n {
                write!(dest, "{}", separator)?;
            }
        }
        write!(dest, "\r\n")?;
    }
    Ok(dest.into_inner())
}

impl GridController {
    // returns map<sheet name, csv bytes>
    pub fn convert_excel_to_csv(
        file_name: &str,
        excel_bytes: Vec<u8>,
    ) -> Result<HashMap<String, Vec<u8>>> {
        let error = |msg: String| anyhow!("Error parsing Excel file {}: {}", file_name, msg);
        let mut sheets_result = HashMap::new();
        let mut xl = open_file(excel_bytes).map_err(|e| error(format!("Unable to open: {}", e)))?;

        for sheet_name in xl.sheet_names() {
            if let Ok(range) = xl.worksheet_range(&sheet_name) {
                let bytes = read_excel_sheet(&range, ',')
                    .map_err(|e| error(format!("Open sheet {} failed: {}", sheet_name, e)))?;

                sheets_result.insert(sheet_name, bytes);
            }
        }

        Ok(sheets_result)
    }

    /// Imports a Excel file as CSV.
    /// Returns a [`TransactionSummary`].
    pub fn import_excel_as_csv(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let parsed = GridController::convert_excel_to_csv(file_name, file.to_vec())?;

        if let Some((_sheet_name, bytes)) = parsed.into_iter().next() {
            return self.import_csv(sheet_id, &bytes, file_name, insert_at, cursor)
        }

        bail!("File is empty")
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        test_util::{assert_cell_value_row, print_table},
        Rect,
    };

    use super::*;

    fn read_test_excel_file(file_name: &str) -> Vec<u8> {
        let path = format!("./tests/excel_impot/{file_name}");
        std::fs::read(path).expect(&format!("test excel file not found {}", file_name))
    }

    #[test]
    fn imports_a_simple_csv() {
        let excel_file = read_test_excel_file("file_example.xls");
        let parsed = GridController::convert_excel_to_csv("test", excel_file).unwrap();
        let bytes = parsed.get("Sheet1").expect("Valid Sheet1");

        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_csv(sheet_id, bytes, "t.csv", pos, None).unwrap();
        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 8, y: 10 }));

        assert_cell_value_row(
            &gc,
            sheet_id,
            0,
            3,
            0,
            vec!["0", "First Name", "Last Name", "Gender"],
        );
    }

    #[test]
    fn imports_excel_as_csv() {
        let excel_file = read_test_excel_file("file_example.xls");
        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_excel_as_csv(sheet_id, excel_file.as_slice(), "t.xls", pos, None).unwrap();
        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 8, y: 10 }));

        assert_cell_value_row(
            &gc,
            sheet_id,
            0,
            8,
            1,
            vec!["1", "Dulce", "Abril", "Female", "United States", "32", "15/10/2017", "1562", ""],
        );

    }
}
