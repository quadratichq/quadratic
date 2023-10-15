use anyhow::{anyhow, bail, Result};

use super::{
    transaction_summary::TransactionSummary, transactions::TransactionType, GridController,
};
use crate::{controller::operations::Operation, grid::SheetId, Pos};

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
        let width = csv::ReaderBuilder::new().from_reader(file).headers()?.len() as u32;

        if width == 0 {
            bail!("empty files cannot be processed");
        }

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(file);

        let ops = reader
            .records()
            .enumerate()
            .map(|(row, record)| {
                // convert the record into a vector of Operations
                record
                    .map_err(|e| error(format!("line {}: {}", row + 1, e)))?
                    .iter()
                    .enumerate()
                    .map(|(col, value)| {
                        Ok(self.set_cell_value_operations(
                            sheet_id,
                            (insert_at.x + col as i64, insert_at.y + row as i64).into(),
                            value,
                        ))
                    })
                    .collect::<Result<Vec<Vec<Operation>>>>()
            })
            .collect::<Result<Vec<Vec<Vec<Operation>>>>>()?
            .into_iter()
            .flatten()
            .flatten()
            .collect::<Vec<Operation>>();

        Ok(self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal))
    }
}

#[cfg(test)]
mod tests {

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

    #[test]
    fn imports_a_simple_csv() {
        let mut grid_controller = GridController::new();
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
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let result = grid_controller.import_csv(sheet_id, "".as_bytes(), "smallpop.csv", pos, None);
        assert!(result.is_err());
    }
}
