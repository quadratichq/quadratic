use anyhow::{anyhow, Result};
use bigdecimal::BigDecimal;
use csv::StringRecord;
use std::str::FromStr;

use crate::{
    controller::operations::Operation, grid::SheetId, Array, ArraySize, CellValue, Pos, Rect,
};

use super::{transactions::TransactionSummary, GridController};

impl GridController {
    pub fn import_csv(
        &mut self,
        sheet_id: SheetId,
        file: &str,
        insert_at: Pos,
    ) -> Result<TransactionSummary> {
        let mut reader = csv::Reader::from_reader(file.as_bytes());
        let headers = reader.headers()?.clone();
        let width = headers.len() as u32;
        let height = reader.records().into_iter().count() as u32;

        if let Some(size) = ArraySize::new(width, height) {
            let mut values = Array::new_empty(size);

            reader
                .into_records()
                .into_iter()
                .enumerate()
                .for_each(|(y, record)| {
                    record.iter().enumerate().for_each(|(x, value)| {
                        let cell_value = if let Ok(number) = BigDecimal::from_str(value.as_slice())
                        {
                            CellValue::Number(number)
                        } else {
                            CellValue::Text(value.as_slice().into())
                        };

                        values.set(x as u32, y as u32, cell_value).unwrap();
                    });
                });

            let rect = Rect::new_span(
                insert_at,
                Pos {
                    x: insert_at.x + (values.width() as i64) - 1,
                    y: insert_at.y + (values.height() as i64) - 1,
                },
            );
            let region = self.region(sheet_id, rect);
            let ops = vec![Operation::SetCellValues { region, values }];

            return Ok(self.transact_forward(ops, None));
        }

        Err(anyhow!("CSV file is empty"))
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
            .import_csv(sheet_id, SIMPLE_CSV, pos)
            .unwrap();

        let range = Rect {
            min: pos,
            max: Pos { x: 10, y: 10 },
        };
        table(grid_controller, sheet_id, &range);
    }
}
