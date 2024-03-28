use std::io::Cursor;

use anyhow::{anyhow, bail, Result};

use crate::{
    cell_values::CellValues, controller::GridController, grid::SheetId, CellValue, Pos, SheetPos,
};
use bytes::Bytes;
use calamine::{Data as ExcelData, Reader as ExcelReader, Xlsx, XlsxError};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

use super::operation::Operation;

const IMPORT_LINES_PER_OPERATION: u32 = 10000;

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
                if cfg!(target_family = "wasm") {
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_y,
                        height,
                        insert_at.x,
                        insert_at.y,
                        width,
                        height,
                    );
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

            if let Operation::AddSheet { sheet } = &add_sheet_operations[0] {
                let sheet_id = sheet.id;
                ops.extend(add_sheet_operations);

                let range = workbook
                    .worksheet_range(&sheet_name)
                    .map_err(|e: XlsxError| error(e.to_string()))?;
                let size = range.get_size();

                for row in range.rows() {
                    for col in row.iter() {
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
        file_name: &str,
        insert_at: Pos,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![] as Vec<Operation>;

        // this is not expensive
        let bytes = Bytes::from(file);
        let builder = ParquetRecordBatchReaderBuilder::try_new(bytes)?;

        // headers
        let metadata = builder.metadata();
        let total_size = metadata.file_metadata().num_rows() as u32;
        let fields = metadata.file_metadata().schema().get_fields();
        let headers: Vec<CellValue> = fields.iter().map(|f| f.name().into()).collect();
        let mut width = headers.len() as u32;

        ops.push(Operation::SetCellValues {
            sheet_pos: (insert_at.x, insert_at.y, sheet_id).into(),
            values: CellValues::from_flat_array(headers.len() as u32, 1, headers),
        });

        let reader = builder.build()?;

        let mut height = 0;
        let mut current_size = 0;
        for (row_index, batch) in reader.enumerate() {
            let batch = batch?;
            let num_rows = batch.num_rows();
            let num_cols = batch.num_columns();

            current_size += num_rows;
            width = width.max(num_cols as u32);
            height = height.max(num_rows as u32);

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

                // update the progress bar every time there's a new operation
                if cfg!(target_family = "wasm") {
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_size as u32,
                        total_size as u32,
                        insert_at.x,
                        insert_at.y,
                        width,
                        height,
                    );
                }
            }
        }

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
        assert_eq!(third_pos.y, 2 + IMPORT_LINES_PER_OPERATION as i64 * 2);

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
