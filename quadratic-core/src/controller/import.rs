use anyhow::{anyhow, bail, Result};
use bigdecimal::BigDecimal;
use itertools::Itertools;
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
        file: &str,
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let mut width = None;
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(file.as_bytes());
        let error = |message: String| anyhow!("Error parsing CSV file {}: {}", file_name, message);

        let values = reader
            .records()
            .into_iter()
            .enumerate()
            .map(|(index, record)| {
                let record = record.map_err(|e| error(format!("line {}: {}", index + 1, e)))?;
                width = Some(record.len() as u32);

                // convert the record into a vector of CellValues
                record
                    .iter()
                    .map(|value| {
                        Ok(if let Ok(number) = BigDecimal::from_str(value) {
                            CellValue::Number(number)
                        } else {
                            CellValue::Text(value.into())
                        })
                    })
                    .collect::<Result<Vec<CellValue>>>()
            })
            .collect::<Result<Vec<Vec<CellValue>>>>()?;

        if let Some(width) = width {
            let height = values.len() as u32 / width;
            let size = ArraySize::new_or_err(width, height).map_err(|e| error(e.to_string()))?;
            let array = values
                .into_iter()
                .flatten()
                .collect::<SmallVec<[CellValue; 1]>>();
            let values = Array::new_row_major(size, array).map_err(|e| error(e.to_string()))?;
            let rect = Rect::new_span(
                insert_at,
                Pos {
                    x: insert_at.x + (width as i64) - 1,
                    y: insert_at.y + (height as i64) - 1,
                },
            );
            let region = self.region(sheet_id, rect);
            let ops = vec![Operation::SetCellValues { region, values }];

            return Ok(self.transact_forward(ops, cursor));
        }

        bail!("CSV must have at least two columns")
    }
}

#[cfg(test)]
mod tests {
    use crate::{grid::Bold, CellValue, Rect};

    use super::*;
    use tabled::{
        builder::Builder,
        settings::Color,
        settings::{Modify, Style},
    };

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

    fn table(grid_controller: GridController, sheet_id: SheetId, range: &Rect) {
        let sheet = grid_controller.grid().sheet_from_id(sheet_id);
        let mut vals = vec![];
        let mut builder = Builder::default();
        let columns = (range.x_range())
            .map(|i| i.to_string())
            .collect::<Vec<String>>();
        let mut blank = vec!["".to_string()];
        blank.extend(columns.clone());
        builder.set_header(blank.into_iter());
        let mut bolds = vec![];
        let mut count_x = 0;
        let mut count_y = 0;

        range.y_range().for_each(|y| {
            vals.push(y.to_string());
            range.x_range().for_each(|x| {
                let pos: Pos = Pos { x, y };

                if sheet.get_formatting_value::<Bold>(pos).is_some() {
                    bolds.push((count_y + 1, count_x + 1));
                }

                vals.push(
                    sheet
                        .get_cell_value(pos)
                        .unwrap_or(CellValue::Blank)
                        .to_string(),
                );
                count_x += 1;
            });
            builder.push_record(vals.clone());
            vals.clear();
            count_x = 0;
            count_y += 1;
        });

        let mut table = builder.build();
        table.with(Style::modern());

        bolds.iter().for_each(|coords| {
            table.with(
                Modify::new((coords.0, coords.1))
                    .with(Color::BOLD)
                    .with(Color::FG_BRIGHT_RED),
            );
        });
        println!("\nsheet: {}\n{}", sheet.id, table);
    }

    #[test]
    fn import_simple_csv() {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let result = grid_controller
            .import_csv(sheet_id, SIMPLE_CSV, "smapppop.csc", pos, None)
            .unwrap();

        table(
            grid_controller,
            sheet_id,
            &result.cell_regions_modified[0].1,
        );
    }
}
