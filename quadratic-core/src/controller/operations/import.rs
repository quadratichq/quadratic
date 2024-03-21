use std::str::FromStr;

use anyhow::{anyhow, bail, Result};
use arrow_array::{cast::AsArray, Array, ArrayRef};
use arrow_buffer::ArrowNativeType;
use arrow_data::ArrayData;
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
                let array_data = col.to_data();

                let cell_values = match array_data.data_type() {
                    DataType::Int8 => parquet_int_to_cell_values::<i8>(&array_data),
                    DataType::Int16 => parquet_int_to_cell_values::<i16>(&array_data),
                    DataType::Int32 => parquet_int_to_cell_values::<i32>(&array_data),
                    DataType::Int64 => parquet_int_to_cell_values::<i64>(&array_data),
                    DataType::UInt8 => parquet_int_to_cell_values::<u8>(&array_data),
                    DataType::UInt16 => parquet_int_to_cell_values::<u16>(&array_data),
                    DataType::UInt32 => parquet_int_to_cell_values::<u32>(&array_data),
                    DataType::UInt64 => parquet_int_to_cell_values::<u64>(&array_data),
                    DataType::Float16 => parquet_float_to_cell_values::<half::f16>(&array_data),
                    DataType::Float32 => parquet_float_to_cell_values::<f32>(&array_data),
                    DataType::Float64 => parquet_float_to_cell_values::<f64>(&array_data),
                    DataType::Boolean => parquet_bool_to_cell_values(&col, &array_data),
                    DataType::Binary => parquet_binary_to_cell_values(&col, &array_data),
                    DataType::Utf8 => parquet_utf8_to_cell_values(&col, &array_data),
                    DataType::Date32 => parquet_date_to_cell_values::<i32>(&array_data),
                    DataType::Date64 => parquet_date_to_cell_values::<i64>(&array_data),
                    DataType::Time32(TimeUnit::Millisecond) => {
                        parquet_time_to_cell_values::<i32>(&array_data)
                    }
                    DataType::Time64(TimeUnit::Millisecond) => {
                        parquet_time_to_cell_values::<i64>(&array_data)
                    }
                    DataType::Timestamp(TimeUnit::Nanosecond, _) => {
                        parquet_timestamp_to_cell_values(&array_data)
                    }
                    // unsupported data type
                    _ => vec![],
                };

                let operations = Operation::SetCellValues {
                    sheet_pos: (
                        insert_at.x + col_index as i64,
                        insert_at.y + (row_index * num_rows) as i64 + 1,
                        sheet_id,
                    )
                        .into(),
                    values: CellValues::from_flat_array(1, cell_values.len() as u32, cell_values),
                };
                ops.push(operations);
            }
        }

        Ok(ops)
    }
}

fn parquet_int_to_cell_values<T>(array_data: &ArrayData) -> Vec<CellValue>
where
    T: ArrowNativeType,
    T: Into<BigDecimal>,
{
    let mut values = vec![];

    for buffer in array_data.buffers() {
        let data = buffer.typed_data::<T>();
        values.extend(
            data.iter()
                .map(|v| CellValue::Number((*v).into()))
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn parquet_float_to_cell_values<T>(array_data: &ArrayData) -> Vec<CellValue>
where
    T: ArrowNativeType,
    T: ToString,
{
    let mut values = vec![];

    for buffer in array_data.buffers() {
        let data = buffer.typed_data::<T>();
        values.extend(
            data.iter()
                .map(|v| {
                    CellValue::Number(BigDecimal::from_str(&v.to_string()).unwrap_or(0.into()))
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn parquet_bool_to_cell_values(col: &ArrayRef, array_data: &ArrayData) -> Vec<CellValue> {
    let mut values = vec![];

    for _buffer in array_data.buffers() {
        values.extend(
            (0..col.len())
                .map(|index| CellValue::Logical(col.as_boolean().value(index)))
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn parquet_binary_to_cell_values(col: &ArrayRef, array_data: &ArrayData) -> Vec<CellValue> {
    let mut values = vec![];

    for _buffer in array_data.buffers() {
        values.extend(
            (0..col.len())
                .map(|index| {
                    CellValue::Text(
                        std::str::from_utf8(&col.as_binary::<i32>().value(index))
                            .unwrap_or("")
                            .into(),
                    )
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn parquet_utf8_to_cell_values(col: &ArrayRef, array_data: &ArrayData) -> Vec<CellValue> {
    let mut values = vec![];

    for _buffer in array_data.buffers() {
        values.extend(
            (0..col.len())
                .map(|index| CellValue::Text(col.as_string::<i32>().value(index).into()).into())
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn parquet_date_to_cell_values<T>(array_data: &ArrayData) -> Vec<CellValue>
where
    T: ArrowNativeType,
    T: Into<i64>,
{
    let mut values = vec![];

    for buffer in array_data.buffers() {
        let data = buffer.typed_data::<T>();
        values.extend(
            data.iter()
                .map(|v| {
                    let timestamp = Utc
                        .timestamp_millis((*v).into())
                        .format("%Y-%m-%d")
                        .to_string();
                    CellValue::Text(timestamp)
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn parquet_time_to_cell_values<T>(array_data: &ArrayData) -> Vec<CellValue>
where
    T: ArrowNativeType,
    T: Into<i64>,
{
    let mut values = vec![];

    for buffer in array_data.buffers() {
        let data = buffer.typed_data::<T>();
        values.extend(
            data.iter()
                .map(|v| {
                    let timestamp = Utc
                        .timestamp_millis((*v).into())
                        .format("%H:%M:%S")
                        .to_string();
                    CellValue::Text(timestamp)
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn parquet_timestamp_to_cell_values(array_data: &ArrayData) -> Vec<CellValue> {
    let mut values = vec![];

    for buffer in array_data.buffers() {
        let data = buffer.typed_data::<i64>();
        values.extend(
            data.iter()
                .map(|v| {
                    let timestamp = Utc
                        .timestamp_nanos(*v)
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string();
                    CellValue::Text(timestamp)
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}
