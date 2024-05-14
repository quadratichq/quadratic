use arrow::{
    array::{
        ArrayRef, BooleanArray, Date32Array, Date64Array, Float32Array, Float64Array, Int16Array,
        Int32Array, Int64Array, RecordBatch, StringArray, Time32SecondArray,
        TimestampMillisecondArray,
    },
    datatypes::*,
};
use bytes::Bytes;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use futures_util::Future;
use parquet::arrow::ArrowWriter;
use sqlx::{Column, Row};
use std::sync::Arc;
use uuid::Uuid;

use self::{mysql_connection::MysqlConnection, postgres_connection::PostgresConnection};
use crate::{error::Result, SharedError, Sql};
use crate::{vec_arrow_type_to_array_ref, vec_time_arrow_type_to_array_ref};

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
    Boolean(bool),
    Date32(i32),
    Date64(i64),
    Time32(i32),
    Time64(i64),
    Timestamp(NaiveDateTime),
    TimestampTz(DateTime<Local>),
    // Parquet supports Uuid, but Arrow does not
    Uuid(Uuid),
    Void,
    Unsupported,
}

impl ArrowType {
    pub fn to_array_ref(values: Vec<ArrowType>) -> ArrayRef {
        match values[0] {
            ArrowType::Int16(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int16, Int16Array, values)
            }
            ArrowType::Int32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int32, Int32Array, values)
            }
            ArrowType::Int64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Int64, Int64Array, values)
            }
            ArrowType::Float32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Float32, Float32Array, values)
            }
            ArrowType::Float64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Float64, Float64Array, values)
            }
            ArrowType::Utf8(_) => {
                let converted = values.iter().filter_map(|value| match value {
                    ArrowType::Utf8(value) => Some(value.as_str()),
                    _ => None,
                });

                Arc::new(StringArray::from_iter_values(converted)) as ArrayRef
            }
            ArrowType::Boolean(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Boolean, BooleanArray, values)
            }
            ArrowType::Date32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Date32, Date32Array, values)
            }
            ArrowType::Date64(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Date64, Date64Array, values)
            }
            ArrowType::Time32(_) => {
                vec_arrow_type_to_array_ref!(ArrowType::Time32, Time32SecondArray, values)
            }
            // ArrowType::Time32(v) => Arc::new(Time32SecondArray::from(vec![Some(v)])),
            // ArrowType::Time64(v) => Arc::new(Time64MicrosecondArray::from(vec![Some(v)])),
            ArrowType::Timestamp(_) => {
                vec_time_arrow_type_to_array_ref!(
                    ArrowType::Timestamp,
                    TimestampMillisecondArray,
                    values
                )
            }
            ArrowType::TimestampTz(_) => {
                vec_time_arrow_type_to_array_ref!(
                    ArrowType::Timestamp,
                    TimestampMillisecondArray,
                    values
                )
            }
            ArrowType::Uuid(_) => {
                let converted = values.iter().filter_map(|value| match value {
                    ArrowType::Uuid(value) => Some(value.to_string()),
                    _ => None,
                });

                Arc::new(StringArray::from_iter_values(converted)) as ArrayRef
            }
            // ArrowType::Void => Arc::new(NullArray::new(1)),
            // ArrowType::Unsupported => Arc::new(NullArray::new(1)),
            _ => {
                println!("Unsupported ArrowType: {:?}", values[0]);
                Arc::new(StringArray::from_iter_values(["".to_string()])) as ArrayRef
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
macro_rules! vec_time_arrow_type_to_array_ref {
    ( $arrow_type_kind:path, $arrow_kind:ty, $values:ident ) => {{
        let converted = $values.iter().map(|value| match value {
            $arrow_type_kind(value) => Some(value.and_utc().timestamp_millis()),
            _ => None,
        });

        Arc::new(<$arrow_kind>::from_iter(converted)) as ArrayRef
    }};
}

pub trait Connection {
    type Conn;
    type Row: Row;
    type Column: Column;

    // Connect to a database
    fn connect(&self) -> impl Future<Output = Result<Self::Conn>>;

    /// Generically query a database
    fn query(&self, pool: Self::Conn, sql: &str) -> impl Future<Output = Result<Vec<Self::Row>>>;

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

        for (index, col) in cols.iter().enumerate() {
            println!(
                "{} ({}) = {:?}",
                fields[index].name(),
                fields[index].data_type(),
                col
            );
        }

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
