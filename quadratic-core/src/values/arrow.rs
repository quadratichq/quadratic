use std::sync::Arc;

use anyhow::Result;
use arrow_array::{
    Array, ArrayRef,
    cast::AsArray,
    types::{Date32Type, Date64Type},
};
use arrow_buffer::ArrowNativeType;
use arrow_data::ArrayData;
use arrow_schema::{DataType, TimeUnit};
use chrono::{NaiveDate, NaiveTime, TimeDelta, TimeZone, Utc};
use rust_decimal::Decimal;

use crate::{CellValue, cell_values::CellValues};

use super::time::map_local_result;

fn i32_naive_date(value: i32) -> NaiveDate {
    Date32Type::to_naive_date(value)
}

fn i64_naive_date(value: i64) -> NaiveDate {
    Date64Type::to_naive_date(value)
}

pub(crate) fn arrow_col_to_cell_value_vec(array: &ArrayRef) -> Result<Vec<CellValue>> {
    let data_type = array.data_type();
    let array_data = array.to_data();

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
        DataType::Time32(unit) => arrow_time_unit_to_cell_values::<i32>(array_data, unit),
        DataType::Time64(unit) => arrow_time_unit_to_cell_values::<i64>(array_data, unit),
        DataType::Timestamp(unit, extra) => arrow_timestamp_to_cell_value(array_data, unit, extra),
        // unsupported data type
        _ => {
            dbgjs!(format!(
                "Unhandled arrow type: {:?} => {:?}",
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
    T: Into<Decimal>,
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
                .map(|v| CellValue::Date(conversion_fn(*v)))
                .collect::<Vec<CellValue>>(),
        );
    }

    values
}

fn arrow_time_unit_to_cell_values<T>(
    array_data: ArrayData,
    time_unit: &TimeUnit,
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
                    let nt = NaiveTime::MIN;
                    let time_result = match time_unit {
                        TimeUnit::Second => {
                            nt.overflowing_add_signed(TimeDelta::seconds((*v).into())).0
                        }
                        TimeUnit::Millisecond => {
                            nt.overflowing_add_signed(TimeDelta::milliseconds((*v).into()))
                                .0
                        }
                        TimeUnit::Microsecond => {
                            nt.overflowing_add_signed(TimeDelta::microseconds((*v).into()))
                                .0
                        }
                        TimeUnit::Nanosecond => {
                            nt.overflowing_add_signed(TimeDelta::nanoseconds((*v).into()))
                                .0
                        }
                    };

                    Ok(CellValue::Time(time_result))
                })
                .collect::<Result<Vec<CellValue>>>()?,
        );
    }

    Ok(values)
}

fn arrow_timestamp_to_cell_value(
    array_date: ArrayData,
    unit: &TimeUnit,
    _extra: &Option<Arc<str>>,
) -> Result<Vec<CellValue>> {
    let mut values = vec![];

    for buffer in array_date.buffers() {
        let data = buffer.typed_data::<i64>();
        values.extend(
            data.iter()
                .map(|v| {
                    let dt = match unit {
                        TimeUnit::Nanosecond => Utc.timestamp_nanos(*v),
                        TimeUnit::Microsecond => map_local_result(Utc.timestamp_micros(*v))?,
                        TimeUnit::Millisecond => map_local_result(Utc.timestamp_millis_opt(*v))?,
                        TimeUnit::Second => map_local_result(Utc.timestamp_millis_opt(*v))?,
                    };
                    let naive_dt = dt.naive_utc();
                    Ok(CellValue::DateTime(naive_dt))
                })
                .collect::<Result<Vec<CellValue>>>()?,
        );
    }

    Ok(values)
}
