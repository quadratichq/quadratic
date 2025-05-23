//! BigQuery Connection
//!
//! Functions to interact with BigQuery

use std::any::Any;
use std::collections::BTreeMap;

use async_trait::async_trait;
use bigdecimal::BigDecimal;
use bytes::Bytes;
use chrono::{DateTime, NaiveDateTime, NaiveTime, Utc};
use google_cloud_bigquery::client::google_cloud_auth::credentials::CredentialsFile;
use google_cloud_bigquery::client::{Client, ClientConfig};
use google_cloud_bigquery::http::job::query::QueryRequest;
use google_cloud_bigquery::http::table::{TableFieldMode, TableFieldType};
use google_cloud_bigquery::query::row::Row;
use serde::{self, Deserialize, Serialize};

use crate::error::Result;
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::{ArrowType, Connection};
use crate::sql::{query_error, schema_error};
use crate::{bigquery_type, sql_unwrap_or_null};

use super::connect_error;

#[derive(Debug, Serialize, Deserialize)]
pub struct BigqueryConfig {
    pub project_id: String,
    pub service_account_configuration: String,
}

/// Bigquery connection
pub struct BigqueryConnection {
    pub project_id: String,
    pub client: Client,
}

impl BigqueryConnection {
    pub async fn new(credentials: String, project_id: String) -> Result<Self> {
        let credentials = CredentialsFile::new_from_str(&credentials)
            .await
            .map_err(|e| connect_error(format!("Unable to parse credentials file: {}", e)))?;

        let config = ClientConfig::new_with_credentials(credentials)
            .await
            .map_err(|e| connect_error(format!("Unable to create config: {}", e)))?
            .0;

        let client = Client::new(config)
            .await
            .map_err(|e| connect_error(format!("Unable to create client: {}", e)))?;

        Ok(Self { project_id, client })
    }
}

#[derive(Debug)]
pub struct BigqueryColumn<'a> {
    pub field_type: (TableFieldType, &'a str),
    pub repeats: bool,
}

pub type BigqueryRow<'a> = (Row, Vec<BigqueryColumn<'a>>);

/// Implement the Connection trait for Bigquery
///
/// Since the Bigquery api returns arrow data, we don't need some of the
/// trait functions implemented.
#[async_trait]
impl<'a> Connection<'a> for BigqueryConnection {
    type Conn = Option<Client>;
    type Row = BigqueryRow<'a>;
    type Column = BigqueryColumn<'a>;

    /// Get the length of a row
    fn row_len(row: &Self::Row) -> usize {
        row.1.len()
    }

    /// Get the columns of a row
    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        Box::new(row.1.iter())
    }

    /// Get the name of a column
    fn column_name(col: &Self::Column) -> &str {
        &col.field_type.1
    }

    /// Convert a row to an Arrow type
    fn to_arrow(row: &Self::Row, column: &BigqueryColumn, index: usize) -> ArrowType {
        let repeats = column.repeats;

        match column.field_type.0 {
            TableFieldType::String => {
                bigquery_type!(ArrowType::Utf8, String, row, index, repeats)
            }
            TableFieldType::Int64 | TableFieldType::Integer => {
                bigquery_type!(ArrowType::Int64, i64, row, index, repeats)
            }
            TableFieldType::Float64 | TableFieldType::Float => {
                bigquery_type!(ArrowType::Float64, f64, row, index, repeats)
            }
            TableFieldType::Boolean | TableFieldType::Bool => {
                bigquery_type!(ArrowType::Boolean, bool, row, index, repeats)
            }
            TableFieldType::Numeric
            | TableFieldType::Bignumeric
            | TableFieldType::Decimal
            | TableFieldType::Bigdecimal => sql_unwrap_or_null!(bigquery_number(row, index)),
            TableFieldType::Date => sql_unwrap_or_null!(bigquery_date(row, index)),
            TableFieldType::Time => sql_unwrap_or_null!(bigquery_time(row, index)),
            TableFieldType::Datetime => sql_unwrap_or_null!(bigquery_datetime(row, index)),
            TableFieldType::Timestamp => sql_unwrap_or_null!(bigquery_timestamp(row, index)),
            TableFieldType::Json => sql_unwrap_or_null!(bigquery_json(row, index)),
            TableFieldType::Record => ArrowType::Unsupported,
            _ => ArrowType::Utf8(bigquery_column::<String>(row, index).unwrap_or("".to_string())),
        }
    }

    /// Connect to a Snowflake database
    async fn connect(&self) -> Result<Self::Conn> {
        Ok(None)
    }

    async fn query(
        &self,
        _: &mut Self::Conn,
        sql: &str,
        _max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool, usize)> {
        let over_the_limit = false;
        let fields = fields(&self.client, &self.project_id, sql).await?;
        let request = QueryRequest {
            query: sql.to_string(),
            ..Default::default()
        };

        let mut rows = Vec::new();
        let mut iter = self
            .client
            .query::<Row>(&self.project_id, request)
            .await
            .map_err(query_error)?;

        while let Some(row) = iter.next().await.map_err(query_error)? {
            let mut iter_row = (row, vec![]);
            for column in 0..fields.len() {
                let repeats = &fields[column]
                    .2
                    .as_ref()
                    .map_or(false, |mode| mode == &TableFieldMode::Repeated);

                let column = BigqueryColumn {
                    field_type: (fields[column].0.to_owned(), &fields[column].1),
                    repeats: *repeats,
                };

                iter_row.1.push(column);
            }

            rows.push(iter_row);
        }

        let (bytes, num_records) = Self::to_parquet(rows)?;
        Ok((bytes, over_the_limit, num_records))
    }

    async fn schema(&self, _pool: &mut Self::Conn) -> Result<DatabaseSchema> {
        let project_id = self.project_id.to_owned();
        let dataset_id = "all_native_data_types".to_owned();
        let sql = format!(
            "
            SELECT 
                t.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
            FROM 
                {project_id}.{dataset_id}.INFORMATION_SCHEMA.TABLES t
            LEFT JOIN 
                {project_id}.{dataset_id}.INFORMATION_SCHEMA.COLUMNS c
                ON t.table_name = c.table_name
                    AND t.table_schema = c.table_schema
                    AND t.table_catalog = c.table_catalog
            WHERE 
                t.table_type IN ('BASE TABLE', 'VIEW', 'MATERIALIZED VIEW')
            ORDER BY 
                t.table_schema,
                t.table_name,
                c.ordinal_position;
            "
        );

        let request = QueryRequest {
            query: sql.to_string(),
            ..Default::default()
        };
        let mut iter = self
            .client
            .query::<Row>(&self.project_id, request)
            .await
            .map_err(schema_error)?;

        let mut schema = DatabaseSchema {
            database: dataset_id.to_owned(),
            tables: BTreeMap::new(),
        };

        // we need this variable since the iterator is a custom one that
        // doesn't comply with the Iterator trait by not including enumeration
        let mut table_count = 0;

        while let Some(bigquery_row) = iter.next().await.map_err(schema_error)? {
            let table_name = bigquery_row
                .column::<String>(0)
                .unwrap_or(format!("table_{table_count}"));

            schema
                .tables
                // get or insert the table
                .entry(table_name.to_owned())
                .or_insert_with(|| SchemaTable {
                    name: table_name,
                    schema: dataset_id.to_owned(),
                    columns: vec![],
                })
                .columns
                // add the column to the table
                .push(SchemaColumn {
                    name: bigquery_row.column::<String>(1).map_err(schema_error)?,
                    r#type: bigquery_row.column::<String>(2).map_err(schema_error)?,
                    is_nullable: matches!(
                        bigquery_row
                            .column::<String>(3)
                            .map_err(schema_error)?
                            .to_lowercase()
                            .as_str(),
                        "yes"
                    ),
                });

            table_count += 1;
        }

        Ok(schema)
    }
}

/// Get the fields of a query, which is necessary to get column information
/// as it's not returned in the main query response.
async fn fields(
    client: &Client,
    project_id: &str,
    sql: &str,
) -> Result<Vec<(TableFieldType, String, Option<TableFieldMode>)>> {
    // limit the query to 1 row to get the fields
    let request = QueryRequest {
        query: sql.to_string(),
        max_results: Some(1),
        ..Default::default()
    };

    let response = client
        .job()
        .query(&project_id, &request)
        .await
        .map_err(query_error)?;

    // for row in response.rows.unwrap() {
    //     for cell in row.f {
    //         println!("{:?}", cell.v);
    //     }
    // }

    let fields = response
        .schema
        .ok_or_else(|| query_error("No schema returned from query"))?
        .fields
        .into_iter()
        .map(|f| (f.data_type, f.name, f.mode))
        .collect::<Vec<_>>();

    Ok(fields)
}

fn bigquery_column<T>(row: &BigqueryRow, index: usize) -> Result<T>
where
    T: google_cloud_bigquery::http::query::value::Decodable
        + google_cloud_bigquery::storage::value::Decodable,
{
    row.0.column::<T>(index).map_err(query_error)
}

fn bigquery_number(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let number_string = bigquery_column::<String>(row, index)?;
    let parsed = number_string.parse::<BigDecimal>().map_err(query_error)?;

    Ok(ArrowType::BigDecimal(parsed))
}

fn bigquery_date(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let date_string = bigquery_column::<String>(row, index)?;
    let date =
        NaiveDateTime::parse_from_str(&format!("{} 00:00:00", date_string), "%Y-%m-%d %H:%M:%S")
            .map_err(query_error)?;
    let epoch = DateTime::<Utc>::from_timestamp(0, 0)
        .ok_or_else(|| query_error("Unable to create epoch"))?
        .naive_utc();

    Ok(ArrowType::Date32((date - epoch).num_days() as i32))
}

fn bigquery_time(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let time_string = bigquery_column::<String>(row, index)?;
    let time = NaiveTime::parse_from_str(&time_string, "%H:%M:%S%.f").map_err(query_error)?;

    Ok(ArrowType::Time32(time))
}

fn bigquery_datetime(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let dt_string = bigquery_column::<String>(row, index)?;
    let datetime =
        NaiveDateTime::parse_from_str(&dt_string, "%Y-%m-%dT%H:%M:%S").map_err(query_error)?;

    Ok(ArrowType::Timestamp(datetime))
}

fn bigquery_timestamp(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let ts_string = bigquery_column::<String>(row, index)?;
    let seconds = ts_string.parse::<f64>().map_err(query_error)? as i64;
    let timestamp = DateTime::<Utc>::from_timestamp(seconds, 0)
        .ok_or_else(|| query_error("Unable to create timestamp"))?;

    Ok(ArrowType::Timestamp(timestamp.naive_utc()))
}

fn bigquery_json(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let json_string = bigquery_column::<String>(row, index)?;
    let json = serde_json::from_str(&json_string).map_err(query_error)?;

    Ok(ArrowType::Json(json))
}

#[macro_export]
macro_rules! bigquery_type {
    ( $arrow_type:expr, $typecast:ty, $row:ident, $index:ident, $repeats:expr ) => {{
        if $repeats {
            match $row.0.column::<Vec<String>>($index) {
                Ok(value) => ArrowType::Utf8(value.join(",")),
                Err(_) => ArrowType::Null,
            }
        } else {
            match $row.0.column::<$typecast>($index) {
                Ok(value) => $arrow_type(value),
                Err(_) => ArrowType::Null,
            }
        }
    }};
}

#[cfg(test)]
mod tests {

    // use google_cloud_bigquery::client::EmptyTokenSourceProvider;

    use super::*;

    #[tokio::test]
    async fn test_bigquery_connection() {
        // let config = ClientConfig::new_with_emulator("0.0.0.0:9060", "http://0.0.0.0:9050");
        // let project_id = "test".to_string();
        // let mut connection = BigqueryConnection::new(config, project_id);
        // println!("{:?}", connection);

        // let config = ClientConfig::new_with_emulator("0.0.0.0:9060", "http://0.0.0.0:9050");
        // let mut client = Client::new(config).await.unwrap();

        let credentials = r#"
            {
                
            }
        "#;
        let connection =
            BigqueryConnection::new(credentials.to_string(), "quadratic-development".to_string())
                .await
                .unwrap();

        let sql = format!(
            "SELECT * FROM `quadratic-development.all_native_data_types.all_data_types` order by id LIMIT 10"
        );
        let results = connection.query(&mut None, &sql, None).await.unwrap();
        println!("{:?}", results);

        // let query = format!(
        //     "SELECT * FROM `quadratic-development.all_native_data_types.all_data_types` LIMIT 10"
        // );

        // // 3.  Execute the query.
        // let mut query_result = client.query(&query, QueryParameters::default()).await?;

        // // 4. Process the results.
        // while let Some(row) = query_result.nextrow().await? {
        //     for (column_name, cell) in row.columns() {
        //         match cell.value() {
        //             Value::String(s) => println!("{}: String({})", column_name, s),
        //             Value::Int64(i) => println!("{}: Int64({})", column_name, i),
        //             // ... (Handle other data types)
        //             _ => println!("{}: Other type", column_name),
        //         }
        //     }
        //     println!("---");
        // }

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
    }
}
