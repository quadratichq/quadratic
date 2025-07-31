//! BigQuery Connection
//!
//! Functions to interact with BigQuery

use std::collections::BTreeMap;
use std::str::FromStr;

use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, NaiveDateTime, NaiveTime, Utc};
use google_cloud_bigquery::client::google_cloud_auth::credentials::CredentialsFile;
use google_cloud_bigquery::client::{Client, ClientConfig};
use google_cloud_bigquery::http::error::Error as BigqueryError;
use google_cloud_bigquery::http::job::query::QueryRequest;
use google_cloud_bigquery::http::table::{TableFieldSchema, TableFieldType};
use google_cloud_bigquery::http::tabledata::list::{Cell, Tuple, Value};
use google_cloud_bigquery::query::row::Row;
use rust_decimal::Decimal;
use serde::{self, Deserialize, Serialize};
use serde_json::json;

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
    pub dataset: String,
}

/// Bigquery connection
pub struct BigqueryConnection {
    pub project_id: String,
    pub client: Client,
    pub dataset: String,
    pub columns: Vec<ColumnSchema>,
}

pub struct ColumnSchema {
    pub field_type: TableFieldType,
    pub field_name: String,
    pub field_struct: Option<Vec<String>>,
}

impl BigqueryConnection {
    pub async fn new(credentials: String, project_id: String, dataset: String) -> Result<Self> {
        let credentials = CredentialsFile::new_from_str(&credentials)
            .await
            .map_err(|e| connect_error(format!("Unable to parse credentials file: {e}")))?;

        let config = ClientConfig::new_with_credentials(credentials)
            .await
            .map_err(|e| connect_error(format!("Unable to create config: {e}")))?
            .0;

        let client = Client::new(config)
            .await
            .map_err(|e| connect_error(format!("Unable to create client: {e}")))?;

        Ok(Self {
            project_id,
            client,
            dataset,
            columns: Vec::new(),
        })
    }

    pub async fn new_from_config(config: BigqueryConfig) -> Result<Self> {
        BigqueryConnection::new(
            config.service_account_configuration,
            config.project_id,
            config.dataset,
        )
        .await
    }

    pub async fn raw_query(
        &mut self,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Vec<Tuple>, bool, usize)> {
        let request = QueryRequest {
            query: sql.to_string(),
            maximum_bytes_billed: max_bytes.map(|b| b as i64),
            ..Default::default()
        };

        let response = match self.client.job().query(&self.project_id, &request).await {
            Ok(response) => response,
            Err(e) => {
                // Check if the error is due to bytes billed limit exceeded
                if let BigqueryError::Response(error) = &e {
                    if error
                        .errors
                        .as_ref()
                        .and_then(|e| e.first().map(|e| e.reason.to_owned()))
                        .unwrap_or_default()
                        == "bytesBilledLimitExceeded"
                    {
                        return Ok((Vec::new(), true, 0));
                    }
                };

                return Err(query_error(e));
            }
        };

        let schema = response
            .schema
            .ok_or_else(|| query_error("No schema returned from query"))?;
        let fields = map_schema(schema.fields);
        let mut columns = Vec::new();

        for field in fields {
            let column = ColumnSchema {
                field_type: field.0.to_owned(),
                field_name: field.1.to_owned(),
                field_struct: field.2.to_owned(),
            };

            columns.push(column);
        }

        self.columns = columns;

        let response_rows = response
            .rows
            .ok_or_else(|| query_error("No rows returned from query"))?;

        let mut rows = Vec::new();

        for row in response_rows.into_iter() {
            rows.push(row);
        }

        let num_records = rows.len();

        Ok((rows, false, num_records))
    }

    pub fn get_column_schema(&self, index: usize) -> Result<&ColumnSchema> {
        self.columns
            .get(index)
            .ok_or_else(|| query_error(format!("Column not found at {index}")))
    }

    pub fn get_column_field_type(&self, index: usize) -> TableFieldType {
        self.get_column_schema(index)
            .map(|c| c.field_type.to_owned())
            .unwrap_or_else(|_| TableFieldType::String)
    }

    pub fn get_column_field_name(&self, index: usize) -> String {
        self.get_column_schema(index)
            .map(|c| c.field_name.to_owned())
            .unwrap_or_else(|_| format!("Column {index}"))
    }
}

pub type BigqueryColumn = Cell;
pub type BigqueryRow = Tuple;

/// Implement the Connection trait for Bigquery
///
/// Since the Bigquery api returns arrow data, we don't need some of the
/// trait functions implemented.
#[async_trait]
impl<'a> Connection<'a> for BigqueryConnection {
    type Conn = Option<Client>;
    type Row = BigqueryRow;
    type Column = BigqueryColumn;

    /// Get the length of a row
    fn row_len(row: &Self::Row) -> usize {
        row.f.len()
    }

    /// Get the columns of a row
    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        Box::new(row.f.iter())
    }

    /// Get the name of a column
    fn column_name(&self, _col: &Self::Column, index: usize) -> String {
        self.get_column_field_name(index)
    }

    /// Convert a row to an Arrow type
    /// TODO(ddimaria): Make to_arrow() take ownership of the row
    fn to_arrow(&self, row: &Self::Row, _column: &BigqueryColumn, index: usize) -> ArrowType {
        let field_type = self.get_column_field_type(index);

        match field_type {
            TableFieldType::String => ArrowType::Utf8(string_column_value(row, index)),
            TableFieldType::Int64 | TableFieldType::Integer => {
                bigquery_type!(self, ArrowType::Int64, i64, row, index, repeats)
            }
            TableFieldType::Float64 | TableFieldType::Float => {
                bigquery_type!(self, ArrowType::Float64, f64, row, index, repeats)
            }
            TableFieldType::Boolean | TableFieldType::Bool => {
                bigquery_type!(self, ArrowType::Boolean, bool, row, index, repeats)
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
            TableFieldType::Record => {
                bigquery_type!(self, ArrowType::Utf8, String, row, index, repeats)
            }
            _ => ArrowType::Utf8(string_column_value(row, index)),
        }
    }

    /// Connect to a Snowflake database
    async fn connect(&self) -> Result<Self::Conn> {
        Ok(None)
    }

    async fn query(
        &mut self,
        _: &mut Self::Conn,
        sql: &str,
        _max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool, usize)> {
        let (rows, over_the_limit, num_records) = self.raw_query(sql, _max_bytes).await?;

        let (bytes, _) = self.to_parquet(rows)?;
        Ok((bytes, over_the_limit, num_records))
    }

    async fn schema(&self, _pool: &mut Self::Conn) -> Result<DatabaseSchema> {
        let project_id = self.project_id.to_owned();
        let dataset = self.dataset.to_owned();

        let sql = format!(
            "
            SELECT 
                t.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
            FROM 
                {project_id}.{dataset}.INFORMATION_SCHEMA.TABLES t
            LEFT JOIN 
                {project_id}.{dataset}.INFORMATION_SCHEMA.COLUMNS c
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
            database: dataset.to_owned(),
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
                    schema: dataset.to_owned(),
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

fn map_schema(schema: Vec<TableFieldSchema>) -> Vec<(TableFieldType, String, Option<Vec<String>>)> {
    schema
        .into_iter()
        .map(|f| {
            (
                f.data_type,
                f.name,
                f.fields
                    .map(|f| f.into_iter().map(|f| f.name).collect::<Vec<_>>()),
            )
        })
        .collect::<Vec<_>>()
}

fn column_value(row: &BigqueryRow, index: usize) -> Cell {
    match row.f.get(index) {
        Some(cell) => cell.to_owned(),
        None => Cell { v: Value::Null },
    }
}

fn string_value(cell: Cell) -> String {
    match cell.v {
        Value::String(s) => s,
        _ => "".to_string(),
    }
}

fn column_struct(conn: &BigqueryConnection, index: usize) -> Result<Option<Vec<String>>> {
    let column_schema = conn.get_column_schema(index)?;

    Ok(column_schema.field_struct.to_owned())
}

fn string_column_value(row: &BigqueryRow, index: usize) -> String {
    let value = column_value(row, index);
    string_value(value)
}

fn parse_value<T>(value: String) -> Result<T>
where
    T: FromStr,
    T::Err: std::fmt::Display,
{
    T::from_str(&value).map_err(|e| query_error(e.to_string()))
}

fn bigquery_number(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let number_string = string_column_value(row, index);
    let parsed = number_string.parse::<Decimal>().map_err(query_error)?;

    Ok(ArrowType::Decimal(parsed))
}

fn bigquery_date(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let date_string = string_column_value(row, index);
    let date =
        NaiveDateTime::parse_from_str(&format!("{date_string} 00:00:00"), "%Y-%m-%d %H:%M:%S")
            .map_err(query_error)?;
    let epoch = DateTime::<Utc>::from_timestamp(0, 0)
        .ok_or_else(|| query_error("Unable to create epoch"))?
        .naive_utc();

    Ok(ArrowType::Date32((date - epoch).num_days() as i32))
}

fn bigquery_time(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let time_string = string_column_value(row, index);
    let time = NaiveTime::parse_from_str(&time_string, "%H:%M:%S%.f").map_err(query_error)?;

    Ok(ArrowType::Time32(time))
}

fn bigquery_datetime(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let dt_string = string_column_value(row, index);
    let datetime =
        NaiveDateTime::parse_from_str(&dt_string, "%Y-%m-%dT%H:%M:%S").map_err(query_error)?;

    Ok(ArrowType::Timestamp(datetime))
}

fn bigquery_timestamp(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let ts_string = string_column_value(row, index);
    let seconds = ts_string.parse::<f64>().map_err(query_error)? as i64;
    let timestamp = DateTime::<Utc>::from_timestamp(seconds, 0)
        .ok_or_else(|| query_error("Unable to create timestamp"))?;

    Ok(ArrowType::Timestamp(timestamp.naive_utc()))
}

fn bigquery_json(row: &BigqueryRow, index: usize) -> Result<ArrowType> {
    let json_string = string_column_value(row, index);
    let json = serde_json::from_str(&json_string).map_err(query_error)?;

    Ok(ArrowType::Json(json))
}

#[macro_export]
macro_rules! bigquery_type {
    ( $self:ident, $arrow_type:expr, $typecast:ty, $row:ident, $index:ident, $repeats:expr ) => {{
        let value = column_value($row, $index);


        match value.v {
            Value::Null => ArrowType::Null,
            Value::String(s) => match parse_value::<$typecast>(s) {
                Ok(value) => $arrow_type(value),
                Err(_) => ArrowType::Null,
            },
            Value::Array(array) => {
                let values = array
                    .into_iter()
                    .map(|cell| string_value(cell))
                    .collect::<Vec<_>>()
                    .join(",");

                ArrowType::Utf8(values)
            }
            Value::Struct(tuple) => {
                let value = match column_struct($self, $index) {
                    Ok(Some(struct_names)) => {
                        let values = tuple
                            .f
                            .into_iter()
                            .enumerate()
                            .map(|(i, cell)| json!({
                                struct_names[i].clone(): string_value(cell)
                            }))
                            .collect::<Vec<_>>();
                        serde_json::to_string(&values).unwrap_or("".to_string())
                    }
                    _ => serde_json::to_string(&tuple).unwrap_or("".to_string()),
                };

                ArrowType::Utf8(value)
            }
        }
    }};
}

pub mod tests {

    use super::*;
    use std::sync::{LazyLock, Mutex};

    pub static BIGQUERY_CREDENTIALS: LazyLock<Mutex<String>> = LazyLock::new(|| {
        dotenv::from_filename(".env.test").ok();
        let credentials = std::env::var("BIGQUERY_CREDENTIALS").unwrap();

        Mutex::new(credentials)
    });

    pub async fn new_config() -> BigqueryConfig {
        let credentials = BIGQUERY_CREDENTIALS.lock().unwrap();

        BigqueryConfig {
            service_account_configuration: credentials.to_string(),
            project_id: "quadratic-development".to_string(),
            dataset: "all_native_data_types".to_string(),
        }
    }

    pub async fn new_connection() -> BigqueryConnection {
        let config = new_config().await;

        BigqueryConnection::new_from_config(config).await.unwrap()
    }

    pub fn expected_bigquery_schema() -> Vec<SchemaColumn> {
        vec![
            SchemaColumn {
                name: "id".into(),
                r#type: "INT64".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "string_col".into(),
                r#type: "STRING".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bytes_col".into(),
                r#type: "BYTES".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "int_col".into(),
                r#type: "INT64".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "float_col".into(),
                r#type: "FLOAT64".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "numeric_col".into(),
                r#type: "NUMERIC".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bignumeric_col".into(),
                r#type: "BIGNUMERIC".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bool_col".into(),
                r#type: "BOOL".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "timestamp_col".into(),
                r#type: "TIMESTAMP".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "date_col".into(),
                r#type: "DATE".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "time_col".into(),
                r#type: "TIME".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "datetime_col".into(),
                r#type: "DATETIME".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "json_col".into(),
                r#type: "JSON".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "array_int_col".into(),
                r#type: "ARRAY<INT64>".into(),
                is_nullable: false,
            },
            SchemaColumn {
                name: "struct_col".into(),
                r#type: "STRUCT<name STRING, value INT64>".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "interval_col".into(),
                r#type: "INTERVAL".into(),
                is_nullable: true,
            },
        ]
    }

    #[tokio::test]
    async fn test_bigquery_connection() {
        // let config = ClientConfig::new_with_emulator("0.0.0.0:9060", "http://0.0.0.0:9050");
        // let project_id = "test".to_string();
        // let mut connection = BigqueryConnection::new(config, project_id);
        // println!("{:?}", connection);

        // let config = ClientConfig::new_with_emulator("0.0.0.0:9060", "http://0.0.0.0:9050");
        // let mut client = Client::new(config).await.unwrap();

        let mut connection = new_connection().await;

        let sql = "SELECT * FROM `quadratic-development.all_native_data_types.all_data_types` order by id LIMIT 10".to_string();
        let results = connection.raw_query(&sql, None).await.unwrap();
        println!("{results:?}");
    }

    #[tokio::test]
    async fn test_bigquery_schema() {
        let connection = new_connection().await;
        let schema = connection.schema(&mut None).await.unwrap();
        let columns = &schema.tables.get("all_data_types").unwrap().columns;

        assert_eq!(columns, &expected_bigquery_schema());
    }

    #[tokio::test]
    async fn test_bigquery_query_over_limit() {
        let mut connection = new_connection().await;
        let sql = "select * from `quadratic-development.all_native_data_types.all_data_types`";
        let results = connection.raw_query(sql, Some(1)).await.unwrap();

        assert_eq!(results, (Vec::new(), true, 0));
    }
}
