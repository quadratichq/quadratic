use std::sync::Arc;

use anyhow::Result;
use arrow_array::{
    cast::AsArray,
    types::{Date32Type, Date64Type},
    Array, ArrayRef,
};
use arrow_buffer::ArrowNativeType;
use arrow_data::ArrayData;
use arrow_schema::{DataType, TimeUnit};
use bigdecimal::BigDecimal;
use chrono::{NaiveDate, TimeZone, Utc};

use crate::{cell_values::CellValues, CellValue};

use super::time::map_local_result;

fn i32_naive_date(value: i32) -> NaiveDate {
    Date32Type::to_naive_date(value)
}

fn i64_naive_date(value: i64) -> NaiveDate {
    Date64Type::to_naive_date(value)
}

pub fn arrow_col_to_cell_value_vec(array: &ArrayRef) -> Result<Vec<CellValue>> {
    let data_type = array.data_type();
    let array_data = array.to_data();
    dbgjs!(format!("Converting arrow type: {}", data_type));

    match data_type {
        DataType::Int8 => Ok(arrow_int_to_cell_values::<i8>(array_data)),
        DataType::Int16 => Ok(arrow_int_to_cell_values::<i16>(array_data)),
        DataType::Int32 => Ok(arrow_int_to_cell_values::<i32>(array_data)),
        DataType::Int64 => Ok(arrow_int_to_cell_values::<i64>(array_data)),
        DataType::UInt8 => Ok(arrow_int_to_cell_values::<u8>(array_data)),
        DataType::UInt16 => Ok(arrow_int_to_cell_values::<u16>(array_data)),
        DataType::UInt32 => Ok(arrow_int_to_cell_values::<u32>(array_data)),
        DataType::UInt64 => Ok(arrow_int_to_cell_values::<u64>(array_data)),
        DataType::Float16 => Ok(arrow_float_to_cell_values::<half::f16>(array_data)),
        DataType::Float32 => Ok(arrow_float_to_cell_values::<f32>(array_data)),
        DataType::Float64 => Ok(arrow_float_to_cell_values::<f64>(array_data)),
        DataType::Boolean => Ok(arrow_bool_to_cell_values(array)),
        DataType::Binary => Ok(arrow_binary_to_cell_values(array)),
        DataType::Utf8 => Ok(arrow_utf8_to_cell_values(array)),
        DataType::Date32 => Ok(arrow_date_to_cell_values::<i32>(
            array_data,
            &i32_naive_date,
        )),
        DataType::Date64 => Ok(arrow_date_to_cell_values::<i64>(
            array_data,
            &i64_naive_date,
        )),
        DataType::Time32(unit) => {
            arrow_time_unit_to_cell_values::<i32>(array_data, unit, "%H:%M:%S", &None)
        }
        DataType::Time64(unit) => {
            arrow_time_unit_to_cell_values::<i64>(array_data, unit, "%H:%M:%S", &None)
        }
        DataType::Timestamp(unit, extra) => {
            arrow_time_unit_to_cell_values::<i64>(array_data, unit, "%Y-%m-%d %H:%M:%S", extra)
        }
        // unsupported data type
        _ => {
            dbgjs!(format!(
                "Unlandled arrow type: {:?} => {:?}",
                data_type, array_data
            ));
            Ok(vec![])
        }
    }
}

impl TryFrom<&ArrayRef> for CellValues {
    type Error = anyhow::Error;

    fn try_from(array: &ArrayRef) -> Result<Self, Self::Error> {
        let values = arrow_col_to_cell_value_vec(array)?;

        Ok(CellValues::from_flat_array(1, values.len() as u32, values))
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

fn arrow_date_to_cell_values<T>(
    array_data: ArrayData,
    conversion_fn: &dyn Fn(T) -> NaiveDate,
) -> Vec<CellValue>
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
                    let timestamp = conversion_fn(*v).format("%Y-%m-%d").to_string();
                    CellValue::Text(timestamp)
                })
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn arrow_time_unit_to_cell_values<T>(
    array_data: ArrayData,
    time_unit: &TimeUnit,
    format: &str,
    _extra: &Option<Arc<str>>,
) -> Result<Vec<CellValue>>
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
                    let timestamp = match time_unit {
                        TimeUnit::Nanosecond => Utc.timestamp_nanos((*v).into()).format(format),
                        TimeUnit::Microsecond => {
                            map_local_result(Utc.timestamp_micros((*v).into()))?.format(format)
                        }
                        TimeUnit::Millisecond => {
                            map_local_result(Utc.timestamp_millis_opt((*v).into()))?.format(format)
                        }
                        TimeUnit::Second => {
                            map_local_result(Utc.timestamp_millis_opt((*v).into()))?.format(format)
                        }
                    };

                    // TODO(ddimaria): convert to Instant when they're implement
                    Ok(CellValue::Text(timestamp.to_string()))
                })
                .collect::<Result<Vec<CellValue>>>()?,
        );
    }

    Ok(values)
}
