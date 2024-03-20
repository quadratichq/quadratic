use std::str::FromStr;

use anyhow::{anyhow, bail, Result};
use arrow_array::cast::AsArray;
use arrow_array::Array;
use arrow_schema::{DataType, TimeUnit};
use bigdecimal::BigDecimal;
use bytes::Bytes;
use chrono::{TimeZone, Utc};
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
        file_name: &str,
        insert_at: Pos,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![] as Vec<Operation>;

        let set_cell_values_column = |num_rows: usize,
                                      row_index: usize,
                                      col_index: usize,
                                      values: Vec<CellValue>|
         -> Operation {
            Operation::SetCellValues {
                sheet_pos: (
                    insert_at.x + col_index as i64,
                    insert_at.y + (row_index * num_rows) as i64 + 1,
                    sheet_id,
                )
                    .into(),
                values: CellValues::from_flat_array(1, values.len() as u32, values),
            }
        };

        let bytes = Bytes::from(file);
        let builder = ParquetRecordBatchReaderBuilder::try_new(bytes).unwrap();

        // headers
        let metadata = builder.metadata();
        let fields = metadata.file_metadata().schema().get_fields();
        // println!("{:?}", fields);
        let headers: Vec<CellValue> = fields.iter().map(|f| f.name().into()).collect();
        ops.push(Operation::SetCellValues {
            sheet_pos: (insert_at.x, insert_at.y, sheet_id).into(),
            values: CellValues::from_flat_array(headers.len() as u32, 1, headers),
        });

        let reader = builder.build().map_err(|e| {
            dbgjs!(format!("Error reading parquet file {}: {}", file_name, e));
            anyhow!("Error reading parquet file {}", file_name)
        })?;

        for (row_index, batch) in reader.enumerate() {
            let batch = batch.map_err(|e| {
                dbgjs!(format!("Error reading parquet file {}: {}", file_name, e));
                anyhow!("Error reading parquet file {}", file_name)
            })?;

            // dbgjs!(format!("row_index: {}", row_index));

            let num_rows = batch.num_rows();
            let num_cols = batch.num_columns();

            for col_index in 0..num_cols {
                let col = batch.column(col_index);
                let array_data = col.to_data();

                // if row_index == 0 {
                //     println!("{:?}", array_data.data_type());
                // }

                match array_data.data_type() {
                    DataType::Int16 => {
                        for buffer in array_data.buffers() {
                            let data = buffer.typed_data::<i16>();
                            let values: Vec<CellValue> =
                                data.iter().map(|v| CellValue::Number(v.into())).collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Int32 => {
                        for buffer in array_data.buffers() {
                            let data = buffer.typed_data::<i32>();
                            let values: Vec<CellValue> =
                                data.iter().map(|v| CellValue::Number(v.into())).collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Int64 => {
                        for buffer in array_data.buffers() {
                            let data = buffer.typed_data::<i64>();
                            let values: Vec<CellValue> =
                                data.iter().map(|v| CellValue::Number(v.into())).collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Float32 => {
                        for buffer in array_data.buffers() {
                            let data = buffer.typed_data::<f32>();
                            let values: Vec<CellValue> = data
                                .iter()
                                .map(|v| {
                                    CellValue::Number(BigDecimal::from_str(&v.to_string()).unwrap())
                                })
                                .collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Float64 => {
                        for buffer in array_data.buffers() {
                            let data = buffer.typed_data::<f64>();
                            let values: Vec<CellValue> = data
                                .iter()
                                .map(|v| {
                                    CellValue::Number(BigDecimal::from_str(&v.to_string()).unwrap())
                                })
                                .collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Boolean => {
                        for _buffer in array_data.buffers() {
                            let values: Vec<CellValue> = (0..col.len())
                                .map(|index| CellValue::Logical(col.as_boolean().value(index)))
                                .collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }

                        for buffer in array_data.buffers() {
                            let data = buffer.to_vec();
                            let values: Vec<CellValue> =
                                data.iter().map(|v| CellValue::Logical(*v == 1)).collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Binary => {
                        for _buffer in array_data.buffers() {
                            let values: Vec<CellValue> = (0..col.len())
                                .map(|index| {
                                    CellValue::Text(
                                        std::str::from_utf8(&col.as_binary::<i32>().value(index))
                                            .unwrap()
                                            .into(),
                                    )
                                })
                                .collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Utf8 => {
                        for _buffer in array_data.buffers() {
                            let values: Vec<CellValue> = (0..col.len())
                                .map(|index| {
                                    CellValue::Text(col.as_string::<i32>().value(index).into())
                                        .into()
                                })
                                .collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Date32 => {
                        for buffer in array_data.buffers() {
                            let data = buffer.typed_data::<i32>();
                            let values: Vec<CellValue> = data
                                .iter()
                                .map(|v| {
                                    let timestamp = Utc
                                        .timestamp_millis(*v as i64)
                                        .format("%Y-%m-%d")
                                        .to_string();
                                    CellValue::Text(timestamp)
                                })
                                .collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    DataType::Timestamp(TimeUnit::Nanosecond, None) => {
                        for buffer in array_data.buffers() {
                            let data = buffer.typed_data::<i64>();
                            let values: Vec<CellValue> = data
                                .iter()
                                .map(|v| {
                                    let timestamp = Utc
                                        .timestamp_nanos(*v)
                                        .format("%Y-%m-%d %H:%M:%S")
                                        .to_string();
                                    CellValue::Text(timestamp)
                                })
                                .collect();
                            ops.push(set_cell_values_column(
                                num_rows, row_index, col_index, values,
                            ));
                        }
                    }
                    // unsupported data type
                    _ => {
                        // noop
                    }
                }
            }
        }

        Ok(ops)
    }
}
