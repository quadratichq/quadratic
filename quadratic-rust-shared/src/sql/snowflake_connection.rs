use arrow::array::ArrayRef;
use arrow_array::array::Array;
use async_trait::async_trait;
use bytes::{Bytes, BytesMut};
use futures_util::stream::StreamExt;
use parquet::arrow::ArrowWriter;
use serde::{Deserialize, Serialize};
use snowflake_api::responses::ExecResponse;
use snowflake_api::{QueryResult, RawQueryResult, SnowflakeApi};
use std::collections::BTreeMap;
use std::sync::Arc;

use crate::arrow::arrow_type::ArrowType;
use crate::error::{Result, SharedError, Sql};
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::Connection;
use crate::utils::array::transpose;

#[derive(Debug, Serialize, Deserialize)]
pub struct SnowflakeConnection {
    pub account_identifier: String,
    pub username: String,
    pub password: String,
    pub warehouse: Option<String>,
    pub database: String,
    pub schema: Option<String>,
    pub role: Option<String>,
}

impl SnowflakeConnection {
    pub fn new(
        account_identifier: String,
        username: String,
        password: String,
        warehouse: Option<String>,
        database: String,
        schema: Option<String>,
        role: Option<String>,
    ) -> SnowflakeConnection {
        SnowflakeConnection {
            account_identifier,
            username,
            password,
            warehouse,
            database,
            schema,
            role,
        }
    }
}

/// Implement the Connection trait for Snowflake
///
/// Since the snowflake api returns arrow data, we don't need some of the
/// trait functions implemented.
#[async_trait]
impl Connection for SnowflakeConnection {
    type Conn = SnowflakeApi;
    type Row = Arc<dyn Array>;
    type Column = ArrayRef;

    fn row_len(_row: &Self::Row) -> usize {
        unimplemented!();
    }

    fn row_columns(_row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        unimplemented!();
    }

    fn column_name(_col: &Self::Column) -> &str {
        unimplemented!();
    }

    fn to_arrow(_row: &Self::Row, _: &ArrayRef, _index: usize) -> ArrowType {
        unimplemented!();
    }

    async fn connect(&self) -> Result<SnowflakeApi> {
        let client = SnowflakeApi::with_password_auth(
            &self.account_identifier,
            self.warehouse.as_deref(),
            Some(&self.database),
            self.schema.as_deref(),
            &self.username,
            self.role.as_deref(),
            &self.password,
        )
        .map_err(|e| {
            SharedError::Sql(Sql::Connect(format!("Error connecting to snowflake: {e}")))
        })?;

        Ok(client)
    }

    async fn query(
        &self,
        client: &mut Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool)> {
        let mut parquet = BytesMut::new();
        let query_error = |e: String| SharedError::Sql(Sql::Query(e));
        let query_result = client
            .exec_raw(sql, true)
            .await
            .map_err(|e| query_error(e.to_string()))?;

        if let RawQueryResult::Stream(mut bytes_stream) = query_result {
            let mut chunks = vec![];

            while let Some(bytes) = bytes_stream.next().await {
                let bytes = bytes.map_err(|e| query_error(e.to_string()))?;

                if let Some(max_bytes) = max_bytes {
                    if (chunks.len() + bytes.len()) as u64 > max_bytes {
                        return Ok((parquet.into(), true));
                    }
                }

                chunks.push(bytes);
            }

            let bytes = chunks.into_iter().flatten().collect::<Vec<u8>>();
            let resp = serde_json::from_slice::<ExecResponse>(&bytes)
                .map_err(|e| query_error(e.to_string()))?;
            let raw_query_result = client
                .parse_arrow_raw_response(resp)
                .await
                .map_err(|e| query_error(e.to_string()))?;
            let query_result = raw_query_result
                .deserialize_arrow()
                .map_err(|e| query_error(e.to_string()))?;

            if let QueryResult::Arrow(batches) = query_result {
                for batch in batches {
                    let file = Vec::new();
                    let mut writer = ArrowWriter::try_new(file, batch.schema(), None)?;

                    writer.write(&batch)?;

                    let bytes = writer.into_inner()?;

                    parquet.extend_from_slice(&bytes);
                }

                return Ok((parquet.into(), false));
            }
        }

        Err(SharedError::Sql(Sql::Query(
            "Could not convert to Arrow".to_string(),
        )))
    }

    async fn schema(&self, client: &mut Self::Conn) -> Result<DatabaseSchema> {
        let database = self.database.to_owned();
        let sql = format!(
            "
            SELECT
                db.database_name,
                sch.schema_name,
                tbl.table_name,
                col.column_name,
                col.data_type,
                col.is_nullable
            FROM
                {database}.information_schema.columns col
            JOIN
                {database}.information_schema.tables tbl 
                    ON col.table_catalog = tbl.table_catalog
                    AND col.table_schema = tbl.table_schema
                    AND col.table_name = tbl.table_name
            JOIN
                {database}.information_schema.schemata sch
                    ON tbl.table_schema = sch.schema_name
            JOIN
                {database}.information_schema.databases db
                ON sch.catalog_name = db.database_name
            where sch.schema_name != 'INFORMATION_SCHEMA'
            ORDER BY
                db.database_name,
                sch.schema_name,
                tbl.table_name,
                col.ordinal_position;"
        );

        let row_stream = client
            .exec(&sql)
            .await
            .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;

        let mut data = vec![vec![]; 6];

        match row_stream {
            QueryResult::Arrow(a) => {
                for batch in a {
                    let num_cols = batch.num_columns();

                    for col_index in 0..num_cols {
                        let col = batch.column(col_index);

                        // convert columns into a vec of strings
                        let col_values = col
                            .as_any()
                            .downcast_ref::<arrow::array::StringArray>()
                            .unwrap()
                            .iter()
                            .map(|s| s.unwrap_or_default().to_owned())
                            .collect::<Vec<String>>();

                        // data in coming in as batches, so we need to combine them
                        data[col_index].extend(col_values);
                    }
                }
            }
            QueryResult::Json(j) => unimplemented!("{j}"),
            QueryResult::Empty => { /* noop */ }
        }

        let rows = transpose(data);
        let mut schema = DatabaseSchema {
            database: self.database.to_owned(),
            tables: BTreeMap::new(),
        };

        for (index, row) in rows.into_iter().enumerate() {
            let safe_get = |data: Option<&String>, kind: &str| {
                data.map(|s| s.to_string())
                    .unwrap_or(format!("Unknown {kind} - {index}"))
            };
            let table_name = safe_get(row.get(2), "Table");

            schema
                .tables
                .entry(table_name.to_owned())
                .or_insert_with(|| SchemaTable {
                    name: table_name,
                    schema: safe_get(row.get(1), "Schema"),
                    columns: vec![],
                })
                .columns
                .push(SchemaColumn {
                    name: safe_get(row.get(3), "Column"),
                    r#type: safe_get(row.get(4), "Type"),
                    is_nullable: row.get(5).map_or("NO", |v| v).to_uppercase() == "YES",
                });
        }

        Ok(schema)
    }
}

#[cfg(test)]
mod tests {

    use crate::parquet::utils::compare_parquet_file_with_bytes;
    use crate::test::request::get_server;

    #[cfg(feature = "record-request-mock")]
    use crate::test::request::{playback_server, record_start, record_stop, recording_server};

    use super::*;
    use tracing_test::traced_test;

    const PARQUET_FILE: &str = "data/parquet/all_native_data_types-snowflake.parquet";

    fn new_snowflake_connection() -> SnowflakeConnection {
        SnowflakeConnection::new(
            "TEST".into(),
            "TEST".into(),
            "TEST".into(),
            None,
            "ALL_NATIVE_DATA_TYPES".into(),
            None,
            None,
        )
    }

    // async fn _seed(
    //     connection: SnowflakeConnection,
    //     client: Result<SnowflakeApi>,
    // ) -> SnowflakeConnection {
    //     let sql = "
    //         CREATE OR REPLACE TABLE all_native_data_types (
    //             integer_col INTEGER,
    //             float_col FLOAT,
    //             number_col NUMBER(38, 0),
    //             decimal_col DECIMAL(18, 2),
    //             boolean_col BOOLEAN,
    //             varchar_col VARCHAR(255),
    //             char_col CHAR(10),
    //             string_col STRING,
    //             binary_col BINARY,
    //             date_col DATE,
    //             time_col TIME,
    //             timestamp_ntz_col TIMESTAMP_NTZ,
    //             timestamp_ltz_col TIMESTAMP_LTZ,
    //             timestamp_tz_col TIMESTAMP_TZ,
    //             variant_col VARIANT,
    //             object_col OBJECT,
    //             array_col ARRAY,
    //             geography_col GEOGRAPHY
    //         );

    //         INSERT INTO all_native_data_types (
    //             integer_col, float_col, number_col, decimal_col, boolean_col, varchar_col, char_col, string_col,
    //             binary_col, date_col, time_col, timestamp_ntz_col, timestamp_ltz_col, timestamp_tz_col,
    //             variant_col, object_col, array_col, geography_col
    //         ) select
    //             321, 321.654, 111111111111111111, 321654.78, FALSE, 'Snowflake', 'B', 'Sample text',
    //             TO_BINARY('DEADBEEF', 'HEX'), '2023-06-26', '12:34:56', '2023-06-26 12:34:56',
    //             '2023-06-26 12:34:56 +01:00', '2023-06-26 12:34:56 +01:00',
    //             PARSE_JSON('{\"key\": \"value\"}'),
    //             OBJECT_CONSTRUCT(  'name', 'Jones'::VARIANT,  'age',  42::VARIANT),
    //             ARRAY_CONSTRUCT(1, 2, 3), 'POINT(-122.4194 37.7749)';
    //     ";

    //     connection
    //         .query(&mut client.unwrap(), sql, None)
    //         .await
    //         .unwrap();

    //     connection
    // }

    async fn setup() -> (SnowflakeConnection, Result<SnowflakeApi>) {
        let connection = new_snowflake_connection();

        // save for seeding if needed
        // let connection = seed(connection, client).await;
        let client = connection.connect().await;

        (connection, client)
    }

    // to record: cargo test --features record-request-mock
    async fn test_query(max_bytes: Option<u64>) -> (Bytes, bool) {
        let connection = new_snowflake_connection();
        let scenario = "snowflake-connection";
        let url = format!(
            "https://{}.snowflakecomputing.com",
            &connection.account_identifier
        );
        let server = get_server(cfg!(feature = "record-request-mock"), scenario, &url);

        #[cfg(feature = "record-request-mock")]
        let recording = record_start(&server);

        // get the snowflake client, using the mock server as the host (`server.base_url()`)
        let client = connection
            .connect()
            .await
            .map(|c| c.with_host(Some(server.base_url())));

        let result = connection
            .query(
                &mut client.unwrap(),
                "select * from all_native_data_types;",
                max_bytes,
            )
            .await
            .unwrap();

        #[cfg(feature = "record-request-mock")]
        record_stop(scenario, recording).await;

        result
    }

    #[tokio::test]
    #[traced_test]
    async fn test_snowflake_connection() {
        let (_, client) = setup().await;

        assert!(client.is_ok());
    }

    #[tokio::test]
    #[traced_test]
    async fn test_snowflake_query() {
        let (rows, over_the_limit) = test_query(None).await;

        // ensure the parquet file is the same as the bytes
        assert!(compare_parquet_file_with_bytes(PARQUET_FILE, rows));
        assert_eq!(over_the_limit, false);

        // // test if we're over the limit
        let (_, over_the_limit) = test_query(Some(10)).await;
        assert_eq!(over_the_limit, true);
    }

    #[tokio::test]
    #[traced_test]
    async fn test_snowflake_schema() {
        let connection = new_snowflake_connection();
        let mut client = connection.connect().await.unwrap();
        let schema = connection.schema(&mut client).await.unwrap();

        let expected = vec![
            SchemaColumn {
                name: "INTEGER_COL".into(),
                r#type: "NUMBER".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "FLOAT_COL".into(),
                r#type: "FLOAT".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "NUMBER_COL".into(),
                r#type: "NUMBER".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "DECIMAL_COL".into(),
                r#type: "NUMBER".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "BOOLEAN_COL".into(),
                r#type: "BOOLEAN".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "VARCHAR_COL".into(),
                r#type: "TEXT".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "CHAR_COL".into(),
                r#type: "TEXT".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "STRING_COL".into(),
                r#type: "TEXT".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "BINARY_COL".into(),
                r#type: "BINARY".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "DATE_COL".into(),
                r#type: "DATE".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "TIME_COL".into(),
                r#type: "TIME".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "TIMESTAMP_NTZ_COL".into(),
                r#type: "TIMESTAMP_NTZ".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "TIMESTAMP_LTZ_COL".into(),
                r#type: "TIMESTAMP_LTZ".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "TIMESTAMP_TZ_COL".into(),
                r#type: "TIMESTAMP_TZ".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "VARIANT_COL".into(),
                r#type: "VARIANT".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "OBJECT_COL".into(),
                r#type: "OBJECT".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "ARRAY_COL".into(),
                r#type: "ARRAY".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "GEOGRAPHY_COL".into(),
                r#type: "GEOGRAPHY".into(),
                is_nullable: true,
            },
        ];

        let columns = &schema.tables.get("ALL_NATIVE_DATA_TYPES").unwrap().columns;

        assert_eq!(columns, &expected);
    }
}
