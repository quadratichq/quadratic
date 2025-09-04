//! Accessing SQL databases that implement the Connection trait

use arrow::{
    array::{ArrayRef, RecordBatch},
    datatypes::{Schema as ArrowSchema, *},
};
use async_trait::async_trait;
use bytes::Bytes;
use error::Sql as SqlError;
use parquet::arrow::ArrowWriter;
use schema::DatabaseSchema;
use snowflake_connection::SnowflakeConnection;
use std::sync::Arc;

use crate::{SharedError, arrow::arrow_type::ArrowType, error::Result};

use self::{
    bigquery_connection::BigqueryConnection, mssql_connection::MsSqlConnection,
    mysql_connection::MySqlConnection, postgres_connection::PostgresConnection,
};

pub mod bigquery_connection;
pub mod cockroachdb_connection;
pub mod datafusion_connection;
pub mod error;
pub mod mariadb_connection;
pub mod mssql_connection;
pub mod mysql_connection;
pub mod neon_connection;
pub mod postgres_connection;
pub mod schema;
pub mod snowflake_connection;

pub fn query_error(e: impl ToString) -> SharedError {
    SharedError::Sql(SqlError::Query(e.to_string()))
}

pub fn schema_error(e: impl ToString) -> SharedError {
    SharedError::Sql(SqlError::Schema(e.to_string()))
}

pub fn connect_error(e: impl ToString) -> SharedError {
    SharedError::Sql(SqlError::Connect(e.to_string()))
}

pub enum SqlConnection {
    BigqueryConnection(BigqueryConnection),
    Mssql(MsSqlConnection),
    Mysql(MySqlConnection),
    Postgres(PostgresConnection),
    SnowflakeConnection(SnowflakeConnection),
}

#[async_trait]
pub trait Connection<'a> {
    type Conn;
    type Row;
    type Column;

    // Connect to a database
    async fn connect(&self) -> Result<Self::Conn>;

    /// Generically query a database
    ///
    /// Returns: (Parquet bytes, is over the limit, number of records)
    async fn query(
        &mut self,
        pool: &mut Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool, usize)>;

    /// Get the number of columns in a row
    fn row_len(row: &Self::Row) -> usize;

    /// Get an iterator over the columns of a row
    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_>;

    /// Get the name of a column
    fn column_name(&self, col: &Self::Column, index: usize) -> String;

    /// Generically query a database
    async fn schema(&self, pool: &mut Self::Conn) -> Result<DatabaseSchema>;

    /// Convert a database-specific column to an Arrow type
    fn to_arrow(&self, row: &Self::Row, col: &Self::Column, col_index: usize) -> ArrowType;

    /// Default implementation of converting a vec of rows to a Parquet byte array
    ///
    /// Returns: (Parquet bytes, number of records)
    fn to_parquet(&'a self, data: Vec<Self::Row>) -> Result<(Bytes, usize)> {
        if data.is_empty() {
            return Ok((Bytes::new(), 0));
        }

        let col_count = Self::row_len(&data[0]);

        // transpose columns to rows, converting to Arrow types
        let mut transposed = vec![vec![]; col_count];

        for row in &data {
            for (col_index, col) in Self::row_columns(row).enumerate() {
                let value = self.to_arrow(row, col, col_index);
                transposed[col_index].push(value);
            }
        }

        let file = Vec::new();
        let cols = transposed
            .into_iter()
            .map(ArrowType::to_array_ref)
            .collect::<Vec<ArrayRef>>();

        // headings
        let fields = Self::row_columns(&data[0])
            .enumerate()
            .map(|(index, col)| {
                Field::new(
                    self.column_name(col, index).to_string(),
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

        let record_batch = RecordBatch::try_new(Arc::new(schema), cols)?;
        let record_count = record_batch.num_rows();
        writer.write(&record_batch)?;
        let parquet = writer.into_inner()?;

        Ok((parquet.into(), record_count))
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

pub trait UsesSsh {
    // Whether the connection uses SSH
    fn use_ssh(&self) -> bool;

    // Parse the port to connect to
    fn parse_port(port: &Option<String>) -> Option<Result<u16>> {
        port.as_ref().map(|port| {
            port.parse::<u16>().map_err(|_| {
                SharedError::Sql(SqlError::Connect(
                    "Could not parse port into a number".into(),
                ))
            })
        })
    }

    // The port to connect to
    fn port(&self) -> Option<Result<u16>>;

    // Set the port to connect to
    fn set_port(&mut self, port: u16);

    // The database host to connect to
    fn host(&self) -> String;

    // Set the host to connect to
    fn set_host(&mut self, host: String);

    // The SSH host to connect to
    fn ssh_host(&self) -> Option<String>;

    // Set the SSH key
    fn set_ssh_key(&mut self, ssh_key: Option<String>);
}

/// Unwrap a result or return a null value
#[macro_export]
macro_rules! sql_unwrap_or_null {
    ( $value:expr ) => {{
        match $value {
            Ok(value) => value,
            Err(_) => ArrowType::Null,
        }
    }};
}

/// Convert a column data to an ArrowType into an Arrow type
#[macro_export]
macro_rules! convert_sqlx_type {
    ( $kind:ty, $row:ident, $index:ident ) => {{ $row.try_get::<$kind, usize>($index).ok() }};
}

/// Convert a column data to an ArrowType into an Arrow type
#[macro_export]
macro_rules! convert_sqlx_array_type {
    ( $kind:ty, $row:ident, $index:ident ) => {{
        let array = convert_sqlx_type!($kind, $row, $index);
        if let Some(array) = array {
            let array_string = array
                .iter()
                .map(|value| value.to_string())
                .collect::<Vec<String>>()
                .join(",");

            return ArrowType::Utf8(array_string);
        }

        ArrowType::Null
    }};
}

/// Convert a column data to an ArrowType into an Arrow type
/// else return a null value
#[macro_export]
macro_rules! to_arrow_type {
    ( $arrow_type:path, $kind:ty, $row:ident, $index:ident ) => {{
        match convert_sqlx_type!($kind, $row, $index) {
            Some(value) => $arrow_type(value),
            None => ArrowType::Null,
        }
    }};
}
