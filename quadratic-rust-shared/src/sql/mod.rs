use arrow::{
    array::{
        ArrayRef, BooleanArray, Date32Array, Date64Array, Float32Array, Float64Array, Int16Array,
        Int32Array, Int64Array, Int8Array, RecordBatch, StringArray, Time32SecondArray,
        TimestampMillisecondArray, UInt16Array, UInt32Array, UInt64Array, UInt8Array,
    },
    datatypes::{Schema as ArrowSchema, *},
};
use async_trait::async_trait;
use bigdecimal::BigDecimal;
use bytes::Bytes;
use chrono::{DateTime, Local, NaiveDateTime, NaiveTime, Timelike};
use parquet::arrow::ArrowWriter;
use serde::Serialize;
use serde_json::Value;
use sqlx::{Column, Row};
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;

use self::{mysql_connection::MySqlConnection, postgres_connection::PostgresConnection};
use crate::error::Result;
use crate::{
    vec_arrow_type_to_array_ref, vec_string_arrow_type_to_array_ref,
    vec_time_arrow_type_to_array_ref,
};

pub mod mysql_connection;
pub mod postgres_connection;

pub enum SqlConnection {
    Postgres(PostgresConnection),
    Mysql(MySqlConnection),
}

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

#[derive(Debug, Serialize, PartialEq)]
pub struct SchemaColumn {
    pub name: String,
    pub r#type: String,
    pub is_nullable: bool,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct SchemaTable {
    pub name: String,
    pub schema: String,
    pub columns: Vec<SchemaColumn>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct DatabaseSchema {
    pub database: String,
    pub tables: BTreeMap<String, SchemaTable>,
}

#[async_trait]
pub trait Connection {
    type Conn: sqlx::Connection;
    type Row: Row;
    type Column: Column;

    // Connect to a database
    async fn connect(&self) -> Result<Self::Conn>;

    /// Generically query a database
    async fn query(
        &self,
        pool: Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Vec<Self::Row>, bool)>;

    /// Generically query a database
    async fn schema(&self, pool: Self::Conn) -> Result<DatabaseSchema>;

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
            // return Err(SharedError::Sql(Sql::ParquetConversion(
            //     "No data to convert".to_string(),
            // )));
            return Ok(Bytes::new());
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
            .map(ArrowType::to_array_ref)
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

        // for (index, col) in cols.iter().enumerate() {
        //     println!(
        //         "{} ({}) = {:?}",
        //         fields[index].name(),
        //         fields[index].data_type(),
        //         col
        //     );
        // }

        let schema = ArrowSchema::new(fields);
        let mut writer = ArrowWriter::try_new(file, Arc::new(schema.clone()), None)?;
        writer.write(&RecordBatch::try_new(Arc::new(schema), cols)?)?;
        let parquet = writer.into_inner()?;

        Ok(parquet.into())
    }
}

// async fn schema<<T: Connection>::Conn>(
//     conn: impl Connection,
//     sql_conn: SqlConnection,
//     database: &str,
//     query: Result<Vec<T>>>,
// ) -> Result<DatabaseSchema> {
//     let rows = query.await?;

//     let mut schema = DatabaseSchema {
//         database: database.to_owned(),
//         tables: BTreeMap::new(),
//     };

//     for row in rows.into_iter() {
//         let table_name = row.get::<String, usize>(2);

//         schema
//             .tables
//             // get or insert the table
//             .entry(table_name.to_owned())
//             .or_insert_with(|| SchemaTable {
//                 name: table_name,
//                 schema: row.get::<String, usize>(1),
//                 columns: vec![],
//             })
//             .columns
//             // add the column to the table
//             .push(SchemaColumn {
//                 name: row.get::<String, usize>(3),
//                 r#type: row.get::<String, usize>(4),
//                 is_nullable: match row.get::<String, usize>(5).to_lowercase().as_str() {
//                     "yes" => true,
//                     _ => false,
//                 },
//             });
//     }

//     Ok(schema)
// }
