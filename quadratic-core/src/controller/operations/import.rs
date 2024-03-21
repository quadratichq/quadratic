use anyhow::{anyhow, bail, Result};
use bytes::Bytes;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

use super::operation::Operation;
use crate::{cell_values::CellValues, controller::GridController, grid::SheetId, CellValue, Pos};

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

        let cell_values = CellValues::from(cell_values);
        ops.push(Operation::SetCellValues {
            sheet_pos: insert_at.to_sheet_pos(sheet_id),
            values: cell_values,
        });
        Ok(ops)
    }

    /// Imports a Parquet file into the grid.
    pub fn import_parquet_operations(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        _file_name: &str,
        insert_at: Pos,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![] as Vec<Operation>;

        // this is not expensive
        let bytes = Bytes::from(file);
        let builder = ParquetRecordBatchReaderBuilder::try_new(bytes)?;

        // headers
        let metadata = builder.metadata();
        let fields = metadata.file_metadata().schema().get_fields();
        let headers: Vec<CellValue> = fields.iter().map(|f| f.name().into()).collect();
        ops.push(Operation::SetCellValues {
            sheet_pos: (insert_at.x, insert_at.y, sheet_id).into(),
            values: CellValues::from_flat_array(headers.len() as u32, 1, headers),
        });

        let reader = builder.build()?;

        for (row_index, batch) in reader.enumerate() {
            let batch = batch?;
            let num_rows = batch.num_rows();
            let num_cols = batch.num_columns();

            for col_index in 0..num_cols {
                let col = batch.column(col_index);
                let values: CellValues = col.into();

                let operations = Operation::SetCellValues {
                    sheet_pos: (
                        insert_at.x + col_index as i64,
                        insert_at.y + (row_index * num_rows) as i64 + 1,
                        sheet_id,
                    )
                        .into(),
                    values,
                };
                ops.push(operations);
            }
        }

        Ok(ops)
    }
}
