use anyhow::{anyhow, bail, Result};

use super::{
    transaction_summary::TransactionSummary, transactions::TransactionType, GridController,
};
use crate::{controller::operation::Operation, grid::SheetId, Array, CellValue, Pos};

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
        let error = |message: String| anyhow!("Error parsing CSV file {}: {}", file_name, message);
        let file = match String::from_utf8_lossy(file) {
            std::borrow::Cow::Borrowed(_) => file,
            std::borrow::Cow::Owned(_) => {
                if let Some(ut16) = read_utf16(file) {
                    let x: String = ut16.chars().filter(|&c| c.is_ascii()).collect();
                    return self.import_csv(sheet_id, x.as_bytes(), file_name, insert_at, cursor);
                }
                file
            }
        };

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .flexible(true)
            .from_reader(file);

        let width = reader.headers()?.len() as u32;
        if width == 0 {
            bail!("empty files cannot be processed");
        }

        let mut ops = vec![] as Vec<Operation>;

        let cell_values = reader
            .records()
            .enumerate()
            .flat_map(|(row, record)| {
                // convert the record into a vector of Operations
                let record = record.map_err(|e| error(format!("line {}: {}", row + 1, e)))?;

                record
                    .iter()
                    .enumerate()
                    .map(|(col, value)| {
                        Ok(self.string_to_cell_value(
                            sheet_id,
                            (insert_at.x + col as i64, insert_at.y + row as i64).into(),
                            value,
                            &mut ops,
                        ))
                    })
                    .collect::<Result<Vec<CellValue>>>()
            })
            .collect::<Vec<Vec<CellValue>>>();

        let array = Array::from(cell_values);

        let rect = crate::Rect::new_span(
            insert_at,
            (
                insert_at.x + array.width() as i64 - 1,
                insert_at.y + array.height() as i64 - 1,
            )
                .into(),
        );

        ops.push(Operation::SetCellValues {
            region: self.region(sheet_id, rect),
            values: array,
        });

        Ok(self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal))
    }
}

fn read_utf16(bytes: &[u8]) -> Option<String> {
    let (front, slice, back) = unsafe { bytes.align_to::<u16>() };
    if front.is_empty() && back.is_empty() {
        String::from_utf16(slice).ok()
    } else {
        None
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        test_util::{assert_cell_value_row, print_table},
        Rect,
    };

    use super::*;

    fn read_test_csv_file(file_name: &str) -> Vec<u8> {
        let path = format!("./tests/csv_import/{file_name}");
        std::fs::read(path).expect(&format!("test csv file not found {}", file_name))
    }

    #[test]
    fn should_import_utf16_with_invalid_characters() {
        let scv_file = read_test_csv_file("encoding_issue.csv");

        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_csv(sheet_id, scv_file.as_slice(), "test.csv", pos, None)
            .expect("import_csv");

        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 2, y: 3 }));

        assert_cell_value_row(&gc, sheet_id, 0, 2, 0, vec!["issue", "test", "value"]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 1, vec!["0", "1", "Invalid"]);
        assert_cell_value_row(&gc, sheet_id, 0, 2, 2, vec!["0", "2", "Valid"]);
    }

    #[test]
    fn should_import_with_title_header() {
        let scv_file = read_test_csv_file("title_row.csv");

        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        gc.import_csv(sheet_id, scv_file.as_slice(), "test.csv", pos, None)
            .expect("import_csv");

        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 3, y: 4 }));

        assert_cell_value_row(&gc, sheet_id, 0, 2, 0, vec!["Sample report", "", ""]);

        assert_cell_value_row(
            &gc,
            sheet_id,
            0,
            2,
            2,
            vec!["Sample column1", "Sample column2", "Sample column3"],
        );

        assert_cell_value_row(&gc, sheet_id, 0, 2, 5, vec!["7", "8", "9"]);
    }

    #[test]
    fn imports_a_simple_csv() {
        let scv_file = read_test_csv_file("simple.csv");
        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let _ = gc.import_csv(sheet_id, scv_file.as_slice(), "smallpop.csv", pos, None);

        print_table(&gc, sheet_id, Rect::new_span(pos, Pos { x: 3, y: 10 }));

        assert_cell_value_row(
            &gc,
            sheet_id,
            0,
            3,
            0,
            vec!["city", "region", "country", "population"],
        );

        assert_cell_value_row(
            &gc,
            sheet_id,
            0,
            3,
            10,
            vec!["Concord", "NH", "United States", "42605"],
        );
    }

    #[test]
    fn errors_on_an_empty_csv() {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let result = grid_controller.import_csv(sheet_id, "".as_bytes(), "smallpop.csv", pos, None);
        assert!(result.is_err());
    }
}
