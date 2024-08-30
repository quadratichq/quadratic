use arrow::array::{
    ArrayRef, BooleanArray, Date32Array, Date64Array, Float32Array, Float64Array, Int16Array,
    Int32Array, Int64Array, Int8Array, StringArray, Time32SecondArray, TimestampMillisecondArray,
    UInt16Array, UInt32Array, UInt64Array, UInt8Array,
};
use bigdecimal::BigDecimal;
use chrono::{DateTime, Local, NaiveDateTime, NaiveTime, Timelike};
use serde_json::Value;
use uuid::Uuid;

use std::sync::Arc;

use crate::{
    vec_arrow_type_to_array_ref, vec_string_arrow_type_to_array_ref,
    vec_time_arrow_type_to_array_ref,
};

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
    BigDecimal(BigDecimal),
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
    Unsupported,
}

impl ArrowType {
    pub fn to_array_ref(values: Vec<ArrowType>) -> ArrayRef {
        // println!("to_array_ref: {:?}", values[0]);
        match values[0] {
            ArrowType::Int8(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int8, Int8Array, values)
            }
            ArrowType::Int16(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int16, Int16Array, values)
            }
            ArrowType::Int32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int32, Int32Array, values)
            }
            ArrowType::Int64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int64, Int64Array, values)
            }
            ArrowType::UInt8(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt8, UInt8Array, values)
            }
            ArrowType::UInt16(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt16, UInt16Array, values)
            }
            ArrowType::UInt32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt32, UInt32Array, values)
            }
            ArrowType::UInt64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::UInt64, UInt64Array, values)
            }
            ArrowType::Float32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Float32, Float32Array, values)
            }
            ArrowType::Float64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Float64, Float64Array, values)
            }
            ArrowType::BigDecimal(_) => {
                let converted = values.iter().filter_map(|value| match value {
                    ArrowType::BigDecimal(value) => (*value).to_string().parse::<f64>().ok(),
                    _ => None,
                });

                Arc::new(Float64Array::from_iter(converted)) as ArrayRef
            }
            ArrowType::Utf8(_) => vec_string_arrow_type_to_array_ref!(ArrowType::Utf8, values),
            ArrowType::Boolean(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Boolean, BooleanArray, values)
            }
            ArrowType::Date32(_) => {
                // let converted = values.iter().flat_map(|value| match value {
                //     ArrowType::Date32(value) => Some(*value),
                //     _ => None,
                // });

                // Arc::new(Date32Array::from_iter_values(converted)) as ArrayRef
                vec_arrow_type_to_array_ref!(ArrowType::Date32, Date32Array, values)
            }
            ArrowType::Date64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Date64, Date64Array, values)
            }
            ArrowType::Time32(_) | ArrowType::TimeTz(_) => {
                let converted = values.iter().flat_map(|value| match value {
                    ArrowType::Time32(value) => Some(value.num_seconds_from_midnight() as i32),
                    _ => None,
                });

                Arc::new(Time32SecondArray::from_iter_values(converted)) as ArrayRef
            }
            ArrowType::Timestamp(_) => {
                vec_time_arrow_type_to_array_ref!(values)
            }

            ArrowType::TimestampTz(_) => {
                vec_time_arrow_type_to_array_ref!(values)
            }
            ArrowType::Json(_) => vec_string_arrow_type_to_array_ref!(ArrowType::Json, values),
            ArrowType::Jsonb(_) => vec_string_arrow_type_to_array_ref!(ArrowType::Jsonb, values),
            ArrowType::Uuid(_) => vec_string_arrow_type_to_array_ref!(ArrowType::Uuid, values),
            // ArrowType::Void => Arc::new(NullArray::new(1)),
            ArrowType::Unsupported => Arc::new(StringArray::new_null(1)),
            _ => {
                tracing::trace!("Unsupported ArrowType: {:?}", values[0]);
                // Arc::new(NullArray::new(0))
                // Arc::new(StringArray::from_iter_values(["".to_string()])) as ArrayRef
                Arc::new(StringArray::new_null(1))
            }
        }
    }
}

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

#[macro_export]
macro_rules! vec_string_arrow_type_to_array_ref {
    ( $arrow_type_kind:path, $values:ident ) => {{
        let converted = $values.iter().filter_map(|value| match value {
            $arrow_type_kind(value) => Some(value.to_string()),
            _ => None,
        });

        Arc::new(<StringArray>::from_iter_values(converted)) as ArrayRef
    }};
}

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
