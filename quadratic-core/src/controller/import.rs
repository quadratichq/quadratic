use anyhow::{anyhow, Result};
use bigdecimal::BigDecimal;
use smallvec::SmallVec;
use std::str::FromStr;

use crate::{
    controller::operations::Operation, grid::SheetId, Array, ArraySize, CellValue, Pos, Rect,
};

use super::{transactions::TransactionSummary, GridController};

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
            return Err(error("empty files cannot be processed".into()));
        }

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(file);

        let values = reader
            .records()
            .into_iter()
            .enumerate()
            .map(|(index, record)| {
                let record = record.map_err(|e| error(format!("line {}: {}", index + 1, e)))?;

                // convert the record into a vector of CellValues
                record
                    .iter()
                    .map(|value| {
                        // TODO(ddimaria): Replace with a standard converter once it's in place
                        Ok(if let Ok(number) = BigDecimal::from_str(value) {
                            CellValue::Number(number)
                        } else {
                            CellValue::Text(value.into())
                        })
                    })
                    .collect::<Result<SmallVec<[CellValue; 1]>>>()
            })
            .collect::<Result<Vec<SmallVec<[CellValue; 1]>>>>()?
            .into_iter()
            .flatten()
            .collect::<SmallVec<[CellValue; 1]>>();

        let height = values.len() as u32 / width;
        let size = ArraySize::new_or_err(width, height).map_err(|e| error(e.to_string()))?;
        let values = Array::new_row_major(size, values).map_err(|e| error(e.to_string()))?;
        let rect = Rect::new_span(
            insert_at,
            Pos {
                x: insert_at.x + (width as i64) - 1,
                y: insert_at.y + (height as i64) - 1,
            },
        );
        let region = self.region(sheet_id, rect);
        let ops = vec![Operation::SetCellValues { region, values }];

        Ok(self.transact_forward(ops, cursor))
    }
}

#[cfg(test)]
mod tests {

    use crate::test_util::{assert_cell_value_row, table};

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

        grid_controller
            .import_csv(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos, None)
            .unwrap();

        table(
            grid_controller.clone(),
            sheet_id,
            &Rect::new_span(pos, Pos { x: 3, y: 10 }),
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
