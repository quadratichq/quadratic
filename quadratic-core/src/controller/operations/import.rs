use std::io::Cursor;

use anyhow::{anyhow, bail, Result};
use bytes::Bytes;
use calamine::{Data as ExcelData, Reader as ExcelReader, Xlsx, XlsxError};
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

    /// Imports an Excel file into the grid.
    pub fn import_excel_operations(
        &mut self,
        file: Vec<u8>,
        file_name: &str,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![] as Vec<Operation>;
        let insert_at = Pos::default();
        let mut cell_values = vec![];
        let error =
            |message: String| anyhow!("Error parsing Excel file {}: {}", file_name, message);

        let cursor = Cursor::new(file);
        let mut workbook: Xlsx<_> =
            ExcelReader::new(cursor).map_err(|e: XlsxError| error(e.to_string()))?;
        let sheets = workbook.sheet_names().to_owned();

        for sheet_name in sheets {
            // add the sheet
            let add_sheet_operations = self.add_sheet_operations(Some(sheet_name.to_owned()));
            // TODO(ddimaria): remove this clone
            if let Operation::AddSheet { sheet } = add_sheet_operations[0].clone() {
                let sheet_id = sheet.id;
                ops.extend(add_sheet_operations);

                let range = workbook
                    .worksheet_range(&sheet_name)
                    .map_err(|e: XlsxError| error(e.to_string()))?;
                let size: (usize, usize) = range.get_size();

                for row in range.rows() {
                    for (_col_index, col) in row.into_iter().enumerate() {
                        let cell_value = match col {
                            ExcelData::Empty => CellValue::Blank,
                            ExcelData::String(value) => CellValue::Text(value.to_string()),
                            ExcelData::DateTimeIso(ref value) => CellValue::Text(value.to_string()),
                            ExcelData::DurationIso(ref value) => CellValue::Text(value.to_string()),
                            ExcelData::Float(ref value) => {
                                CellValue::unpack_str_float(&value.to_string(), CellValue::Blank)
                            }
                            // TODO(ddimaria): implement when implementing Instant
                            // ExcelData::DateTime(ref value) => match value.is_datetime() {
                            //     true => value.as_datetime().map_or_else(
                            //         || CellValue::Blank,
                            //         |v| CellValue::Instant(v.into()),
                            //     ),
                            //     false => CellValue::Text(value.to_string()),
                            // },
                            // TODO(ddimaria): remove when implementing Instant
                            ExcelData::DateTime(ref value) => match value.is_datetime() {
                                true => value.as_datetime().map_or_else(
                                    || CellValue::Blank,
                                    |v| CellValue::Text(v.to_string()),
                                ),
                                false => CellValue::Text(value.to_string()),
                            },
                            ExcelData::Int(ref value) => {
                                CellValue::unpack_str_float(&value.to_string(), CellValue::Blank)
                            }
                            ExcelData::Error(_) => CellValue::Blank,
                            ExcelData::Bool(value) => CellValue::Logical(*value),
                        };

                        cell_values.push(cell_value);
                    }
                }

                let values = CellValues::from_flat_array(size.1 as u32, size.0 as u32, cell_values);
                let operations = Operation::SetCellValues {
                    sheet_pos: (insert_at.x, insert_at.y, sheet_id).into(),
                    values,
                };
                ops.push(operations);

                // empty cell values for each sheet
                cell_values = vec![];
            }
        }

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
