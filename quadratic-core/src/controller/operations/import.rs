use anyhow::{anyhow, bail, Result};

use crate::{cell_values::CellValues, controller::GridController, grid::SheetId, Pos, SheetPos};

use super::operation::Operation;

const IMPORT_LINES_PER_OPERATION: u32 = 100000;

impl GridController {
    /// Imports a CSV file into the grid.
    pub fn import_csv_operations(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
    ) -> Result<Vec<Operation>> {
        let error = |message: String| anyhow!("Error parsing CSV file {}: {}", file_name, message);
        let width = csv::ReaderBuilder::new().from_reader(file).headers()?.len() as u32;

        if width == 0 {
            bail!("Empty CSV files cannot be processed");
        }

        // first get the total number of lines so we can provide progress
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(file);
        let height = reader.records().count() as u32;

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(file);

        // then create operations using MAXIMUM_IMPORT_LINES to break up the SetCellValues operations
        let mut ops = vec![] as Vec<Operation>;
        let mut cell_values = CellValues::new(width, height as u32);
        let mut current_y = 0;
        let mut y: u32 = 0;
        for entry in reader.records() {
            match entry {
                Err(e) => return Err(error(format!("line {}: {}", current_y + y + 1, e))),
                Ok(record) => {
                    for (x, value) in record.iter().enumerate() {
                        let (operations, cell_value) = self.string_to_cell_value(
                            SheetPos {
                                x: insert_at.x + x as i64,
                                y: insert_at.y + current_y as i64 + y as i64,
                                sheet_id,
                            },
                            value,
                        );
                        ops.extend(operations);
                        cell_values.set(x as u32, y, cell_value);
                    }
                }
            }
            y += 1;
            if y >= IMPORT_LINES_PER_OPERATION {
                ops.push(Operation::SetCellValues {
                    sheet_pos: SheetPos {
                        x: insert_at.x,
                        y: insert_at.y + current_y as i64,
                        sheet_id,
                    },
                    values: cell_values,
                });
                current_y = current_y + y;
                y = 0;
                let h = (height - current_y).min(IMPORT_LINES_PER_OPERATION);
                cell_values = CellValues::new(width, h);

                // update the progress bar every time there's a new operation
                if !cfg!(test) {
                    crate::wasm_bindings::js::jsProgress(file_name, current_y, height);
                }
            }
        }

        // finally add the final operation
        ops.push(Operation::SetCellValues {
            sheet_pos: SheetPos {
                x: insert_at.x,
                y: insert_at.y + current_y as i64,
                sheet_id,
            },
            values: cell_values,
        });
        Ok(ops)
    }
}

#[cfg(test)]
mod test {
    use crate::CellValue;

    use super::*;

    #[test]
    fn imports_a_simple_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        const SIMPLE_CSV: &str =
            "city,region,country,population\nSouthborough,MA,United States,a lot of people";

        let ops = gc.import_csv_operations(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos);
        assert_eq!(ops.as_ref().unwrap().len(), 1);
        assert_eq!(
            ops.unwrap()[0],
            Operation::SetCellValues {
                sheet_pos: SheetPos {
                    x: 0,
                    y: 0,
                    sheet_id
                },
                values: CellValues::from(vec![
                    vec!["city", "Southborough"],
                    vec!["region", "MA"],
                    vec!["country", "United States"],
                    vec!["population", "a lot of people"]
                ]),
            }
        );
    }

    #[test]
    fn imports_a_long_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 1, y: 2 };

        let mut csv = String::new();
        for i in 0..IMPORT_LINES_PER_OPERATION * 2 + 150 {
            csv.push_str(&format!("city{},MA,United States,{}\n", i, i * 1000));
        }

        let ops = gc.import_csv_operations(sheet_id, csv.as_bytes(), "long.csv", pos);
        assert_eq!(ops.as_ref().unwrap().len(), 3);
        let first_pos = match ops.as_ref().unwrap()[0] {
            Operation::SetCellValues { sheet_pos, .. } => sheet_pos,
            _ => panic!("Expected SetCellValues operation"),
        };
        let second_pos = match ops.as_ref().unwrap()[1] {
            Operation::SetCellValues { sheet_pos, .. } => sheet_pos,
            _ => panic!("Expected SetCellValues operation"),
        };
        let third_pos = match ops.as_ref().unwrap()[2] {
            Operation::SetCellValues { sheet_pos, .. } => sheet_pos,
            _ => panic!("Expected SetCellValues operation"),
        };
        assert_eq!(first_pos.x, 1);
        assert_eq!(second_pos.x, 1);
        assert_eq!(third_pos.x, 1);
        assert_eq!(first_pos.y, 2);
        assert_eq!(second_pos.y, 2 + IMPORT_LINES_PER_OPERATION as i64);
        assert_eq!(third_pos.y, 2 + IMPORT_LINES_PER_OPERATION as i64 * 2 + 150);

        let first_values = match ops.as_ref().unwrap()[0] {
            Operation::SetCellValues { ref values, .. } => values,
            _ => panic!("Expected SetCellValues operation"),
        };
        assert_eq!(
            first_values.get(0, 0),
            Some(&CellValue::Text("city0".into()))
        );
    }
}
