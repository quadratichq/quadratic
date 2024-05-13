use arrow::{
    array::{
        ArrayRef, BooleanArray, Float32Array, Float64Array, Int16Array, Int32Array, Int64Array,
        RecordBatch, StringArray, TimestampSecondArray,
    },
    datatypes::*,
};
use bytes::Bytes;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use futures_util::Future;
use parquet::arrow::ArrowWriter;
use sqlx::{database::HasValueRef, Column, Row};
use std::sync::Arc;

use self::{mysql_connection::MysqlConnection, postgres_connection::PostgresConnection};
use crate::vec_arrow_type_to_array_ref;
use crate::{error::Result, SharedError, Sql};

pub mod mysql_connection;
pub mod postgres_connection;

pub enum SqlConnection {
    Postgres(PostgresConnection),
    Mysql(MysqlConnection),
}

#[derive(Clone, Debug)]
pub enum ArrowType {
    Int16(i16),
    Int32(i32),
    Int64(i64),
    Float32(f32),
    Float64(f64),
    Utf8(String),
    Boolean(Option<bool>),
    Date32(NaiveDate),
    Date64(DateTime<Local>),
    Time32(NaiveTime),
    Time64(NaiveTime),
    Timestamp(NaiveDateTime),
    TimestampTz(DateTime<Local>),
    Void,
    Unsupported,
}

// impl From<ArrowType> for DataType {
//     fn from(value: ArrowType) -> Self {
//         match value {
//             ArrowType::Int16(_) => DataType::Int16,
//             ArrowType::Int32(_) => DataType::Int32,
//             ArrowType::Int64(_) => DataType::Int64,
//             ArrowType::Float32(_) => DataType::Float32,
//             ArrowType::Float64(_) => DataType::Float64,
//             ArrowType::Utf8(_) => DataType::Utf8,
//             ArrowType::Boolean(_) => DataType::Boolean,
//             ArrowType::Date32(_) => DataType::Date32,
//             ArrowType::Date64(_) => DataType::Date64,
//             ArrowType::Time32(_) => DataType::Time32(TimeUnit::Second),
//             ArrowType::Time64(_) => DataType::Time64(TimeUnit::Microsecond),
//             ArrowType::Timestamp(_) => DataType::Timestamp(TimeUnit::Nanosecond, None),
//             ArrowType::TimestampTz(_) => {
//                 DataType::Timestamp(TimeUnit::Nanosecond, Some("UTC".into()))
//             }
//             ArrowType::Void => DataType::Null,
//             ArrowType::Unsupported => DataType::Null,
//         }
//     }
// }

impl ArrowType {
    pub fn to_array_ref(values: Vec<ArrowType>) -> ArrayRef {
        match values[0] {
            ArrowType::Int16(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int16, i16, Int16Array, values)
            }
            ArrowType::Int32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int32, i32, Int32Array, values)
            }
            ArrowType::Int64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int64, i64, Int64Array, values)
            }
            ArrowType::Float32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Float32, f32, Float32Array, values)
            }
            ArrowType::Float64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Float64, f64, Float64Array, values)
            }
            ArrowType::Utf8(_) => {
                let converted = values
                    .iter()
                    .filter_map(|value| match value {
                        ArrowType::Utf8(value) => Some(value.as_str()),
                        _ => None,
                    })
                    .collect::<Vec<&str>>();

                Arc::new(StringArray::from_iter_values(converted)) as ArrayRef
            }
            ArrowType::Boolean(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Boolean, Option<bool>, BooleanArray, values)
            }
            // ArrowType::Date32(v) => Arc::new(Date32Array::from(vec![Some(v)])),
            // ArrowType::Date64(v) => Arc::new(Date64Array::from(vec![Some(v)])),
            // ArrowType::Time32(v) => Arc::new(Time32SecondArray::from(vec![Some(v)])),
            // ArrowType::Time64(v) => Arc::new(Time64MicrosecondArray::from(vec![Some(v)])),
            // ArrowType::Timestamp(v) => {
            //     let converted = values
            //         .iter()
            //         .filter_map(|value| match value {
            //             ArrowType::Timestamp(value) => Some(*value),
            //             _ => None,
            //         })
            //         .collect::<Vec<_>>();

            //     Arc::new(TimestampSecondArray::from_iter_values(converted)) as ArrayRef
            // }
            // {
            //     vec_arrow_type_to_array_ref!(
            //         ArrowType::Timestamp,
            //         NaiveDateTime,
            //         TimestampSecondArray,
            //         values
            //     )
            // }
            // ArrowType::TimestampTz(v) => Arc::new(TimestampMillisecondArray::from(vec![Some(v)])),
            // ArrowType::Void => Arc::new(NullArray::new(1)),
            // ArrowType::Unsupported => Arc::new(NullArray::new(1)),
            _ => Arc::new(StringArray::from_iter_values(["".to_string()])) as ArrayRef,
        }
    }
}

#[macro_export]
macro_rules! vec_arrow_type_to_array_ref {
    ( $arrow_type_kind:path, $rust_kind:ty, $arrow_kind:ty, $values:ident ) => {{
        let converted = $values.iter().filter_map(|value| match value {
            $arrow_type_kind(value) => Some(*value),
            _ => None,
        });

        Arc::new(<$arrow_kind>::from_iter(converted)) as ArrayRef
    }};
}

// #[macro_export]
// macro_rules! impl_from_arrow_type {
//     ( $arrow_type_kind:tt, $rust_kind:ty, $arrow_kind:ty, $values:ident ) => {{
//         impl From<ArrowType> for rust_kind {
//             fn from(value: ArrowType) -> Self {
//                 match value {
//                     ArrowType::Int16(_) => DataType::Int16,
//     }};
// }

pub trait Connection {
    type Conn;
    type Row: Row;
    type Column: Column;

    // Connect to a database
    fn connect(&self) -> impl Future<Output = Result<Self::Conn>>;

    /// Generically query a database
    fn query(&self, pool: Self::Conn, sql: &str) -> impl Future<Output = Result<Vec<Self::Row>>>;

    // fn to_bytes(row: &Self::Row, index: usize) -> Bytes {
    //     let raw = row.try_get_raw(index).unwrap();
    //     Bytes::from(raw)
    // }

    /// Convert a database-specific column to an Arrow type
    fn to_arrow(
        row: &Self::Row,
        column: &<<Self::Row as sqlx::Row>::Database as sqlx::Database>::Column,
        index: usize,
    ) -> ArrowType;

    /// Default implementation of converting a vec of rows to a Parquet byte array
    ///
    /// This should work over any row/colmn SQLx vec
    fn to_parquet(data: Vec<Self::Row>) -> Result<Bytes>
    where
        Self::Row: Row,
        Self::Column: Column,
    {
        if data.is_empty() {
            return Err(SharedError::Sql(Sql::ParquetConversion(
                "No data to convert".to_string(),
            )));
        }

        let col_count = data[0].len();

        // transpose columns to rows, converting to Arrow types
        let mut transposed = vec![vec![]; col_count];

        data.iter().for_each(|row| {
            row.columns()
                .iter()
                .enumerate()
                .for_each(|(col_index, col)| {
                    let value = Self::to_arrow(row, col, col_index);
                    transposed[col_index].push(value);
                });
        });

        let file = Vec::new();
        let cols = transposed
            .into_iter()
            .map(|col| ArrowType::to_array_ref(col))
            .collect::<Vec<ArrayRef>>();

        println!("{:?}", cols);

        // headings
        let fields = data[0]
            .columns()
            .iter()
            .enumerate()
            .map(|(index, col)| {
                Field::new(
                    col.name().to_string(),
                    cols[index].data_type().to_owned(),
                    true,
                )
            })
            .collect::<Vec<Field>>();

        let schema = Schema::new(fields);

        let mut writer = ArrowWriter::try_new(file, Arc::new(schema.clone()), None)
            .map_err(|e| SharedError::Sql(Sql::ParquetConversion(e.to_string())))?;

        writer
            .write(&RecordBatch::try_new(Arc::new(schema.clone()), cols).unwrap())
            .map_err(|e| SharedError::Sql(Sql::ParquetConversion(e.to_string())))?;

        let parquet = writer
            .into_inner()
            .map_err(|e| SharedError::Sql(Sql::ParquetConversion(e.to_string())))?;

        Ok(parquet.into())
    }
}
