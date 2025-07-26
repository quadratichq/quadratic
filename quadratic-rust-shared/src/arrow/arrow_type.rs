//! Arrow types
//!
//! Arrow types that are used in the application and are used to convert
//! between Arrow and Quadratic types

use arrow::{
    array::{
        ArrayRef, BooleanArray, Date32Array, Date64Array, Float32Array, Float64Array, Int8Array,
        Int16Array, Int32Array, Int64Array, StringArray, Time32SecondArray,
        TimestampMillisecondArray, UInt8Array, UInt16Array, UInt32Array, UInt64Array,
    },
    datatypes::{DataType, TimeUnit},
};
use chrono::{DateTime, Local, NaiveDateTime, NaiveTime, Timelike};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use serde_json::Value;
use uuid::Uuid;

use std::sync::Arc;

use crate::{
    vec_arrow_type_to_array_ref, vec_string_arrow_type_to_array_ref,
    vec_time_arrow_type_to_array_ref,
};

/// Arrow types that are used in the application and are used to convert
/// between Arrow and Quadratic types
#[derive(Clone, Debug, PartialEq)]
pub enum ArrowType {
    Int8(i8),
    Int16(i16),
    Int32(i32),
    Int64(i64),
    UInt8(u8),
    UInt16(u16),
    UInt32(u32),
    UInt64(u64),
    Float32(f32),
    Float64(f64),
    Decimal(Decimal),
    Utf8(String),
    Boolean(bool),
    Date32(i32),
    Date64(i64),
    Time32(NaiveTime),
    Time64(i64),
    TimeTz(NaiveTime),
    Timestamp(NaiveDateTime),
    TimestampTz(DateTime<Local>),
    Uuid(Uuid), // Parquet supports Uuid, but Arrow does not
    Json(Value),
    Jsonb(Value),
    Void,
    Null,
    Unsupported,
}

impl ArrowType {
    /// Convert an ArrowType to it's underlying Arrow DataType
    pub fn data_type(&self) -> DataType {
        match self {
            ArrowType::Int8(_) => DataType::Int8,
            ArrowType::Int16(_) => DataType::Int16,
            ArrowType::Int32(_) => DataType::Int32,
            ArrowType::Int64(_) => DataType::Int64,
            ArrowType::UInt8(_) => DataType::UInt8,
            ArrowType::UInt16(_) => DataType::UInt16,
            ArrowType::UInt32(_) => DataType::UInt32,
            ArrowType::UInt64(_) => DataType::UInt64,
            ArrowType::Float32(_) => DataType::Float32,
            ArrowType::Float64(_) => DataType::Float64,
            ArrowType::Decimal(_) => DataType::Decimal256(10, 2),
            ArrowType::Utf8(_) => DataType::Utf8,
            ArrowType::Boolean(_) => DataType::Boolean,
            ArrowType::Date32(_) => DataType::Date32,
            ArrowType::Date64(_) => DataType::Date64,
            ArrowType::Time32(_) => DataType::Time32(TimeUnit::Second),
            ArrowType::Time64(_) => DataType::Time64(TimeUnit::Microsecond),
            ArrowType::TimeTz(_) => DataType::Time64(TimeUnit::Microsecond),
            ArrowType::Timestamp(_) => DataType::Timestamp(TimeUnit::Millisecond, None),
            ArrowType::TimestampTz(_) => DataType::Timestamp(TimeUnit::Millisecond, None),
            ArrowType::Uuid(_) => DataType::Utf8,
            ArrowType::Json(_) => DataType::Utf8,
            ArrowType::Jsonb(_) => DataType::Utf8,
            ArrowType::Unsupported => DataType::Utf8,
            ArrowType::Null => DataType::Null,
            ArrowType::Void => DataType::Null,
        }
    }

    // Search values of a column to find the first non-null value to derive
    // the arrow data type
    pub fn first_data_type(values: &[ArrowType]) -> DataType {
        values
            .iter()
            .find(|value| value != &&ArrowType::Null)
            .map_or(DataType::Null, |value| value.data_type())
    }

    /// Convert a vector of ArrowType to an Arrow ArrayRef
    pub fn to_array_ref(values: Vec<ArrowType>) -> ArrayRef {
        let data_type = ArrowType::first_data_type(&values);

        match data_type {
            DataType::Int8 => {
                vec_arrow_type_to_array_ref!(ArrowType::Int8, Int8Array, values)
            }
            DataType::Int16 => {
                vec_arrow_type_to_array_ref!(ArrowType::Int16, Int16Array, values)
            }
            DataType::Int32 => {
                vec_arrow_type_to_array_ref!(ArrowType::Int32, Int32Array, values)
            }
            DataType::Int64 => {
                vec_arrow_type_to_array_ref!(ArrowType::Int64, Int64Array, values)
            }
            DataType::UInt8 => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt8, UInt8Array, values)
            }
            DataType::UInt16 => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt16, UInt16Array, values)
            }
            DataType::UInt32 => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt32, UInt32Array, values)
            }
            DataType::UInt64 => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt64, UInt64Array, values)
            }
            DataType::Decimal256(_precision, _scale) => {
                let converted = values.iter().filter_map(|value| match value {
                    ArrowType::Decimal(value) => value.to_f64(),
                    _ => None,
                });

                Arc::new(Float64Array::from_iter(converted)) as ArrayRef
            }
            DataType::Float16 => {
                vec_arrow_type_to_array_ref!(ArrowType::Float32, Float32Array, values)
            }
            DataType::Float32 => {
                vec_arrow_type_to_array_ref!(ArrowType::Float32, Float32Array, values)
            }
            DataType::Float64 => {
                vec_arrow_type_to_array_ref!(ArrowType::Float64, Float64Array, values)
            }
            // DataType::Decimal => {
            //     let converted = values.iter().filter_map(|value| match value {
            //         ArrowType::Decimal(value) => (*value).to_string().parse::<f64>().ok(),
            //         _ => None,
            //     });

            //     Arc::new(Float64Array::from_iter(converted)) as ArrayRef
            // }
            DataType::Utf8 => vec_string_arrow_type_to_array_ref!(values),
            DataType::Boolean => {
                vec_arrow_type_to_array_ref!(ArrowType::Boolean, BooleanArray, values)
            }
            DataType::Date32 => {
                // let converted = values.iter().flat_map(|value| match value {
                //     ArrowType::Date32(value) => Some(*value),
                //     _ => None,
                // });

                // Arc::new(Date32Array::from_iter_values(converted)) as ArrayRef
                vec_arrow_type_to_array_ref!(ArrowType::Date32, Date32Array, values)
            }
            DataType::Date64 => {
                vec_arrow_type_to_array_ref!(ArrowType::Date64, Date64Array, values)
            }
            DataType::Time32(TimeUnit::Second) | DataType::Time64(TimeUnit::Microsecond) => {
                let converted = values.iter().flat_map(|value| match value {
                    ArrowType::Time32(value) => Some(value.num_seconds_from_midnight() as i32),
                    _ => None,
                });

                Arc::new(Time32SecondArray::from_iter_values(converted)) as ArrayRef
            }
            DataType::Timestamp(TimeUnit::Millisecond, None) => {
                vec_time_arrow_type_to_array_ref!(values)
            }
            // ArrowType::Void => Arc::new(NullArray::new(1)),
            // ArrowType::Void => Arc::new(StringArray::from([' '])),
            // generic null for any arrow type
            DataType::Null => Arc::new(StringArray::new_null(values.len())),
            _ => {
                tracing::trace!("Unsupported ArrowType: {:?}", values[0]);
                // Arc::new(NullArray::new(0))
                // Arc::new(StringArray::from_iter_values(["".to_string()])) as ArrayRef
                Arc::new(StringArray::new_null(values.len()))
            }
        }
    }
}

/// Convert a vector of ArrowType to an Arrow ArrayRef
#[macro_export]
macro_rules! vec_arrow_type_to_array_ref {
    ( $arrow_type_kind:path, $arrow_kind:ty, $values:ident ) => {{
        let converted = $values.iter().map(|value| match value {
            $arrow_type_kind(value) => Some(*value),
            _ => None,
        });

        Arc::new(<$arrow_kind>::from_iter(converted)) as ArrayRef
    }};
}

/// Convert a vector of ArrowType strings to an Arrow ArrayRef
#[macro_export]
macro_rules! vec_string_arrow_type_to_array_ref {
    ( $values:ident ) => {{
        let converted = $values
            .iter()
            .map(|value| match value {
                ArrowType::Utf8(value) => Some(value.to_string()),
                ArrowType::Json(value) => Some(value.to_string()),
                ArrowType::Jsonb(value) => Some(value.to_string()),
                ArrowType::Uuid(value) => Some(value.to_string()),
                _ => None,
            })
            .collect::<Vec<_>>();

        Arc::new(<StringArray>::from(converted)) as ArrayRef
    }};
}

/// Convert a vector of ArrowType timestamp types to an Arrow ArrayRef
#[macro_export]
macro_rules! vec_time_arrow_type_to_array_ref {
    ( $values:ident ) => {{
        let converted = $values.iter().map(|value| match value {
            ArrowType::Timestamp(value) => Some(value.and_utc().timestamp_millis()),
            ArrowType::TimestampTz(value) => Some(value.timestamp_millis()),
            _ => None,
        });

        Arc::new(<TimestampMillisecondArray>::from_iter(converted)) as ArrayRef
    }};
}
