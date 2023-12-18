use anyhow::{anyhow, bail, Result};

use crate::{controller::GridController, grid::SheetId, Array, CellValue, Pos, SheetRect};

use super::operation::Operation;

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
            bail!("empty files cannot be processed");
        }

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(file);

        let mut ops = vec![] as Vec<Operation>;

        let cell_values = reader
            .records()
            .enumerate()
            .flat_map(|(row, record)| {
                // convert the record into a vector of Operations
                record
                    .map_err(|e| error(format!("line {}: {}", row + 1, e)))?
                    .iter()
                    .enumerate()
                    .map(|(col, value)| {
                        let (operations, cell_value) = self.string_to_cell_value(
                            (insert_at.x + col as i64, insert_at.y + row as i64, sheet_id).into(),
                            value,
                        );
                        ops.extend(operations);
                        Ok(cell_value)
                    })
                    .collect::<Result<Vec<CellValue>>>()
            })
            .collect::<Vec<Vec<CellValue>>>();

        let array = Array::from(cell_values);

        let sheet_rect = SheetRect::new_pos_span(
            insert_at,
            (
                insert_at.x + array.width() as i64 - 1,
                insert_at.y + array.height() as i64 - 1,
            )
                .into(),
            sheet_id,
        );

        ops.push(Operation::SetCellValues {
            sheet_rect,
            values: array,
        });
        Ok(ops)
    }
}
