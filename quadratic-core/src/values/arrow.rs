use arrow_array::{cast::AsArray, Array, ArrayRef};
use arrow_buffer::ArrowNativeType;
use arrow_data::ArrayData;
use arrow_schema::{DataType, TimeUnit};
use bigdecimal::BigDecimal;
use chrono::{LocalResult, TimeZone, Utc};

use crate::{cell_values::CellValues, CellValue};

pub fn arrow_col_to_cell_value_vec(array: &ArrayRef) -> Vec<CellValue> {
    let data_type = array.data_type();
    let array_data = array.to_data();

    match data_type {
        DataType::Int8 => arrow_int_to_cell_values::<i8>(array_data),
        DataType::Int16 => arrow_int_to_cell_values::<i16>(array_data),
        DataType::Int32 => arrow_int_to_cell_values::<i32>(array_data),
        DataType::Int64 => arrow_int_to_cell_values::<i64>(array_data),
        DataType::UInt8 => arrow_int_to_cell_values::<u8>(array_data),
        DataType::UInt16 => arrow_int_to_cell_values::<u16>(array_data),
        DataType::UInt32 => arrow_int_to_cell_values::<u32>(array_data),
        DataType::UInt64 => arrow_int_to_cell_values::<u64>(array_data),
        DataType::Float16 => arrow_float_to_cell_values::<half::f16>(array_data),
        DataType::Float32 => arrow_float_to_cell_values::<f32>(array_data),
        DataType::Float64 => arrow_float_to_cell_values::<f64>(array_data),
        DataType::Boolean => arrow_bool_to_cell_values(array),
        DataType::Binary => arrow_binary_to_cell_values(array),
        DataType::Utf8 => arrow_utf8_to_cell_values(array),
        DataType::Date32 => arrow_date_to_cell_values::<i32>(array_data),
        DataType::Date64 => arrow_date_to_cell_values::<i64>(array_data),
        DataType::Time32(TimeUnit::Millisecond) => arrow_time_to_cell_values::<i32>(array_data),
        DataType::Time64(TimeUnit::Millisecond) => arrow_time_to_cell_values::<i64>(array_data),
        DataType::Timestamp(TimeUnit::Nanosecond, _) => arrow_timestamp_to_cell_values(array_data),
        // unsupported data type
        _ => vec![],
    }
}

impl From<&ArrayRef> for CellValues {
    fn from(array: &ArrayRef) -> Self {
        let values = arrow_col_to_cell_value_vec(array);

        CellValues::from_flat_array(1, values.len() as u32, values)
    }
}

fn arrow_int_to_cell_values<T>(array_data: ArrayData) -> Vec<CellValue>
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

fn arrow_float_to_cell_values<T>(array_data: ArrayData) -> Vec<CellValue>
where
    T: ArrowNativeType,
    T: ToString,
{
    let mut values = vec![];

    for buffer in array_data.buffers() {
        let data = buffer.typed_data::<T>();
        values.extend(
            data.iter()
                .map(|v| CellValue::unpack_str_float(&v.to_string(), CellValue::Blank))
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn arrow_bool_to_cell_values(col: &ArrayRef) -> Vec<CellValue> {
    let mut values = vec![];

    values.extend(
        (0..col.len())
            .map(|index| CellValue::Logical(col.as_boolean().value(index)))
            .collect::<Vec<CellValue>>(),
    );

    values
}

fn arrow_binary_to_cell_values(col: &ArrayRef) -> Vec<CellValue> {
    let mut values = vec![];

    values.extend(
        (0..col.len())
            .map(|index| {
                CellValue::Text(
                    std::str::from_utf8(col.as_binary::<i32>().value(index))
                        .unwrap_or("")
                        .into(),
                )
            })
            .collect::<Vec<CellValue>>(),
    );

    values
}

fn arrow_utf8_to_cell_values(col: &ArrayRef) -> Vec<CellValue> {
    let mut values = vec![];

    values.extend(
        (0..col.len())
            .map(|index| CellValue::Text(col.as_string::<i32>().value(index).into()))
            .collect::<Vec<CellValue>>(),
    );

    values
}

fn arrow_date_to_cell_values<T>(array_data: ArrayData) -> Vec<CellValue>
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
                    let timestamp = match Utc.timestamp_millis_opt((*v).into()) {
                        LocalResult::Single(timestamp) => timestamp.format("%Y-%m-%d").to_string(),
                        _ => "".into(),
                    };
                    CellValue::Text(timestamp)
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn arrow_time_to_cell_values<T>(array_data: ArrayData) -> Vec<CellValue>
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
                    let timestamp = match Utc.timestamp_millis_opt((*v).into()) {
                        LocalResult::Single(timestamp) => timestamp.format("%H:%M:%S").to_string(),
                        _ => "".into(),
                    };
                    // TODO(ddimaria): convert to Instant when they're implement
                    CellValue::Text(timestamp)
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn arrow_timestamp_to_cell_values(array_data: ArrayData) -> Vec<CellValue> {
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
                    // TODO(ddimaria): convert to Instant when they're implement
                    CellValue::Text(timestamp)
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}
