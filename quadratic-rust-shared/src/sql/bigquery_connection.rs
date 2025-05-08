//! BigQuery Connection
//!
//! Functions to interact with BigQuery

use std::sync::Arc;

use arrow_array::{Array, ArrayRef};
use async_trait::async_trait;
use bytes::Bytes;
use google_cloud_bigquery::client::google_cloud_auth::credentials::CredentialsFile;
use google_cloud_bigquery::client::{Client, ClientConfig};
use google_cloud_bigquery::http::job::query::QueryRequest;
use google_cloud_bigquery::http::table::{Table, TableFieldSchema, TableFieldType, TableSchema};
use google_cloud_bigquery::query::row::Row;
use serde::{self, Deserialize, Serialize};

use crate::error::{Result, SharedError};
use crate::quadratic_api::Connection as ApiConnection;
use crate::sql::error::Sql as SqlError;
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::{ArrowType, Connection};

/// Bigquery connection
#[derive(Debug)]
pub struct BigqueryConnection {
    pub config: ClientConfig,
    pub project_id: String,
}

impl BigqueryConnection {
    pub fn new(config: ClientConfig, project_id: String) -> Self {
        Self { config, project_id }
    }
}

/// Implement the Connection trait for Bigquery
///
/// Since the Bigquery api returns arrow data, we don't need some of the
/// trait functions implemented.
#[async_trait]
impl Connection for BigqueryConnection {
    type Conn = Client;
    type Row = Row;
    type Column = ArrayRef;

    /// Get the length of a row
    fn row_len(_row: &Self::Row) -> usize {
        unimplemented!();
    }

    /// Get the columns of a row
    fn row_columns(_row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        unimplemented!();
    }

    /// Get the name of a column
    fn column_name(_col: &Self::Column) -> &str {
        unimplemented!();
    }

    /// Convert a row to an Arrow type
    fn to_arrow(_row: &Self::Row, _: &ArrayRef, _index: usize) -> ArrowType {
        unimplemented!();
    }

    /// Connect to a Snowflake database
    async fn connect(&self) -> Result<Self::Conn> {
        unimplemented!();
    }

    async fn query(
        &self,
        pool: &mut Self::Conn,
        sql: &str,
        _max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool, usize)> {
        let request = QueryRequest {
            query: sql.to_string(),
            ..Default::default()
        };

        let mut iter = pool.query::<Row>(&self.project_id, request).await.unwrap();
        while let Some(row) = iter.next().await.unwrap() {
            let col1 = row.column::<String>(0);
            let col2 = row.column::<Option<String>>(1);
            println!("{:?}", col1);
            println!("{:?}", col2);
        }

        Ok((Bytes::new(), false, 0))
    }

    async fn schema(&self, _pool: &mut Self::Conn) -> Result<DatabaseSchema> {
        unimplemented!();
    }
}

#[cfg(test)]
mod tests {
    use std::time::SystemTime;

    use google_cloud_bigquery::client::EmptyTokenSourceProvider;

    use super::*;

    #[tokio::test]
    async fn test_bigquery_connection() {
        let config = ClientConfig::new_with_emulator("0.0.0.0:9060", "http://0.0.0.0:9050");
        let project_id = "test".to_string();
        let mut connection = BigqueryConnection::new(config, project_id);
        println!("{:?}", connection);

        let config = ClientConfig::new_with_emulator("0.0.0.0:9060", "http://0.0.0.0:9050");
        let mut client = Client::new(config).await.unwrap();

        // let now = SystemTime::now()
        //     .duration_since(SystemTime::UNIX_EPOCH)
        //     .unwrap()
        //     .as_secs();
        // let mut table1 = Table::default();
        // let table_id = format!("table{now}");
        // table1.table_reference.dataset_id = "dataset1".to_string();
        // table1.table_reference.project_id = "test".to_string();
        // table1.table_reference.table_id = table_id.clone();
        // table1.schema = Some(TableSchema {
        //     fields: vec![TableFieldSchema {
        //         name: "col_string".to_string(),
        //         data_type: TableFieldType::String,
        //         ..Default::default()
        //     }],
        // });
        // client.table().create(&table1).await.unwrap();

        // Insert data
        // let mut req = InsertAllRequest::<serde_json::Value>::default();
        // req.rows.push(Row {
        //     insert_id: None,
        //     json: serde_json::from_str(
        //         r#"
        //         {"col_string": "test1"}
        //     "#,
        //     )
        //     .unwrap(),
        // });
        // client
        //     .tabledata_client
        //     .insert(
        //         &table1.table_reference.project_id,
        //         &table1.table_reference.dataset_id,
        //         &table1.table_reference.table_id,
        //         &req,
        //     )
        //     .await
        //     .unwrap();

        let sql = format!("SELECT * FROM test.dataset1.table_a");
        let results = connection.query(&mut client, &sql, None).await.unwrap();
        println!("{:?}", results);
    }
}
