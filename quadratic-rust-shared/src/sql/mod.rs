use arrow::{
    array::{ArrayRef, RecordBatch, StringArray},
    datatypes::*,
};
use bytes::Bytes;
use futures_util::Future;
use parquet::arrow::ArrowWriter;
use std::sync::Arc;

use self::{mysql_connection::MysqlConnection, postgres_connection::PostgresConnection};
use sqlx::{Column, Row};

pub mod mysql_connection;
pub mod postgres_connection;

pub enum SqlConnection<'a> {
    Postgres(PostgresConnection<'a>),
    Mysql(MysqlConnection),
}

pub trait Connection {
    type Pool;
    type Row: Row;
    type Column: Column;

    /// Create a connection string from the connection parameters
    fn connection_string(&self) -> String;

    fn connect(&self) -> impl Future<Output = Result<Self::Pool, sqlx::Error>>;

    /// Generically query a database
    fn query(
        &self,
        pool: Self::Pool,
        sql: &str,
    ) -> impl Future<Output = Result<Vec<Self::Row>, sqlx::Error>>;

    /// Convert a database-specific column to an Arrow type
    fn to_arrow(
        row: &Self::Row,
        column: &<<Self::Row as sqlx::Row>::Database as sqlx::Database>::Column,
        index: usize,
    ) -> Option<String>;

    /// Default implementation of converting a vec of rows to a Parquet byte array
    ///
    /// This should work over any row/colmn SQLx vec
    fn to_parquet(data: Vec<Self::Row>) -> Bytes
    where
        Self::Row: Row,
        Self::Column: Column,
    {
        let fields = data[0]
            .columns()
            .iter()
            .map(|col| Field::new(col.name().to_string(), DataType::Utf8, true))
            .collect::<Vec<Field>>();

        let col_count = fields.len();
        let schema = Schema::new(fields);

        // transpose columns to rows, converting to Arrow types
        let mut transposed = vec![vec![]; col_count];

        for row in data.iter() {
            for (col_index, col) in row.columns().iter().enumerate() {
                let value = Self::to_arrow(row, col, col_index).unwrap_or("".into());
                transposed[col_index].push(value);
            }
        }

        let file = Vec::new();
        let mut writer = ArrowWriter::try_new(file, Arc::new(schema.clone()), None).unwrap();

        let cols = transposed
            .into_iter()
            .map(|col| Arc::new(StringArray::from_iter_values(col)) as ArrayRef)
            .collect::<Vec<ArrayRef>>();

        writer
            .write(&RecordBatch::try_new(Arc::new(schema.clone()), cols).unwrap())
            .unwrap();

        writer.into_inner().unwrap().into()
    }
}
