use arrow::{
    array::{ArrayRef, RecordBatch},
    datatypes::{Schema as ArrowSchema, *},
};
use async_trait::async_trait;
use bytes::Bytes;
use parquet::arrow::ArrowWriter;
use schema::DatabaseSchema;
use std::sync::Arc;

use crate::{arrow::arrow_type::ArrowType, error::Result};

use self::{
    mssql_connection::MsSqlConnection, mysql_connection::MySqlConnection,
    postgres_connection::PostgresConnection,
};

pub mod error;
pub mod mssql_connection;
pub mod mysql_connection;
pub mod postgres_connection;
pub mod schema;

pub enum SqlConnection {
    Postgres(PostgresConnection),
    Mysql(MySqlConnection),
    Mssql(MsSqlConnection),
}

#[async_trait]
pub trait Connection {
    type Conn;
    type Row;
    type Column;

    // Connect to a database
    async fn connect(&self) -> Result<Self::Conn>;

    /// Generically query a database
    async fn query(
        &self,
        pool: &mut Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Vec<Self::Row>, bool)>;

    /// Get the number of columns in a row
    fn row_len(row: &Self::Row) -> usize;

    /// Get an iterator over the columns of a row
    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_>;

    /// Get the name of a column
    fn column_name(col: &Self::Column) -> &str;

    /// Generically query a database
    async fn schema(&self, pool: &mut Self::Conn) -> Result<DatabaseSchema>;

    /// Convert a database-specific column to an Arrow type
    fn to_arrow(row: &Self::Row, col: &Self::Column, col_index: usize) -> ArrowType;

    /// Default implementation of converting a vec of rows to a Parquet byte array
    ///
    /// This should work over any row/column SQLx vec
    fn to_parquet(data: Vec<Self::Row>) -> Result<Bytes> {
        if data.is_empty() {
            // return Err(SharedError::Sql(Sql::ParquetConversion(
            //     "No data to convert".to_string(),
            // )));
            return Ok(Bytes::new());
        }

        let col_count = Self::row_len(&data[0]);

        // transpose columns to rows, converting to Arrow types
        let mut transposed = vec![vec![]; col_count];

        for row in &data {
            for (col_index, col) in Self::row_columns(row).enumerate() {
                let value = Self::to_arrow(row, &col, col_index);
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
                    Self::column_name(&col).to_string(),
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
