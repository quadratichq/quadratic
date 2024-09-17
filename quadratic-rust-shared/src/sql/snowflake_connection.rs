use arrow::array::ArrayRef;
use arrow_array::array::Array;
use async_trait::async_trait;
use bytes::{Bytes, BytesMut};
use parquet::arrow::ArrowWriter;
use serde::{Deserialize, Serialize};
use snowflake_api::{QueryResult, SnowflakeApi};
use std::collections::BTreeMap;
use std::sync::Arc;

use crate::arrow::arrow_type::ArrowType;
use crate::error::{Result, SharedError, Sql};
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::Connection;

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

fn transpose(matrix: Vec<Vec<String>>) -> Vec<Vec<String>> {
    if matrix.is_empty() {
        return vec![];
    }

    let row_len = matrix[0].len();
    let mut transposed: Vec<Vec<String>> = vec![Vec::with_capacity(matrix.len()); row_len];

    for row in matrix {
        for (i, element) in row.into_iter().enumerate() {
            transposed[i].push(element);
        }
    }

    transposed
}

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

        let row_stream = client
            .exec(sql)
            .await
            .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;

        match row_stream {
            QueryResult::Arrow(a) => {
                for batch in a {
                    let file = Vec::new();
                    let mut writer = ArrowWriter::try_new(file, batch.schema(), None)?;

                    writer.write(&batch)?;

                    let bytes = writer.into_inner()?;

                    if let Some(max_bytes) = max_bytes {
                        if (parquet.len() + bytes.len()) as u64 > max_bytes {
                            return Ok((parquet.into(), true));
                        }
                    }

                    parquet.extend_from_slice(&bytes);
                }
            }
            QueryResult::Json(j) => {
                println!("{j}");
            }
            QueryResult::Empty => { /* noop */ }
        }

        Ok((parquet.into(), false))
    }

    async fn schema(&self, client: &mut Self::Conn) -> Result<DatabaseSchema> {
        //         let database = self.database.as_ref().ok_or_else(|| {
        //             SharedError::Sql(Sql::Schema("Database name is required for MsSQL".into()))
        //         })?;

        let sql = "
            SELECT
                db.database_name,
                sch.schema_name,
                tbl.table_name,
                col.column_name,
                col.data_type,
                col.is_nullable
            FROM
                information_schema.columns col
            JOIN
                information_schema.tables tbl 
                    ON col.table_catalog = tbl.table_catalog
                    AND col.table_schema = tbl.table_schema
                    AND col.table_name = tbl.table_name
            JOIN
                information_schema.schemata sch
                    ON tbl.table_schema = sch.schema_name
            JOIN
                information_schema.databases db
                ON sch.catalog_name = db.database_name
            WHERE sch.schema_name = 'PUBLIC'
            ORDER BY
                db.database_name,
                sch.schema_name,
                tbl.table_name,
                col.ordinal_position;";

        let row_stream = client
            .exec(sql)
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
                            .map(|s| s.unwrap_or_default().to_string())
                            .collect::<Vec<String>>();

                        // data in coming in as batches, so we need to combine them
                        data[col_index].extend(col_values);
                    }
                }
            }
            QueryResult::Json(j) => {
                println!("{j}");
            }
            QueryResult::Empty => {
                println!("Query finished successfully")
            }
        }

        let rows = transpose(data);

        let mut schema = DatabaseSchema {
            database: self.database.to_owned(),
            tables: BTreeMap::new(),
        };

        for (index, row) in rows.into_iter().enumerate() {
            let default_schema_name = format!("Unknown Schema - {}", index);
            let schema_name: &str = row.get(1).unwrap_or(&default_schema_name);

            let default_table_name = format!("Unknown Table - {}", index);
            let table_name: &str = row.get(2).unwrap_or(&default_table_name);

            let default_column_name = format!("Unknown Column - {}", index);
            let column_name: &str = row.get(3).unwrap_or(&default_column_name);

            let default_column_type = format!("Unknown Type - {}", index);
            let column_type: &str = row.get(4).unwrap_or(&default_column_type);

            let is_nullable: &str = row.get(5).map_or("NO", |v| v);

            schema
                .tables
                .entry(table_name.into())
                .or_insert_with(|| SchemaTable {
                    name: table_name.into(),
                    schema: schema_name.into(),
                    columns: vec![],
                })
                .columns
                .push(SchemaColumn {
                    name: column_name.into(),
                    r#type: column_type.into(),
                    is_nullable: is_nullable.to_uppercase() == "YES",
                });
        }

        Ok(schema)
    }

    fn to_arrow(_row: &Self::Row, _: &ArrayRef, _index: usize) -> ArrowType {
        unimplemented!();
    }
}

#[cfg(test)]
mod tests {

    use crate::parquet::utils::compare_parquet_file_with_bytes;

    use super::*;
    use httpmock::prelude::*;
    use std::path::PathBuf;
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

    async fn test_query(record: bool, max_bytes: Option<u64>) -> (Bytes, bool) {
        let connection = new_snowflake_connection();
        let scenario = "snowflake";
        let fixtures_dir = "./fixtures";
        let fixtures_path = PathBuf::from(fixtures_dir);
        let path = PathBuf::from(format!("{fixtures_dir}/{scenario}.yml"));
        let url = format!(
            "https://{}.snowflakecomputing.com",
            &connection.account_identifier
        );
        let mut recording = None;

        let server = match record {
            true => {
                let recording_server = MockServer::start();

                // proxy all requests from the mock server to `url`
                recording_server.forward_to(&url, |rule| {
                    rule.filter(|when| {
                        when.any_request();
                    });
                });

                recording_server
            }
            false => {
                let playback_server = MockServer::start();
                playback_server.playback(path.clone());
                playback_server
            }
        };

        if record {
            // setuup the recording server, this is not used during playback but required for recording
            recording = Some(server.record(|rule| {
                rule.filter(|when| {
                    when.any_request();
                });
            }));
        }

        // get the snowflake client, using the mock server as the host (`server.base_url()`)
        let client = connection
            .connect()
            .await
            .map(|c| c.with_host(Some(server.base_url())));

        let result = connection
            .query(
                &mut client.unwrap(),
                "select * from all_native_data_types.public.all_native_data_types;",
                max_bytes,
            )
            .await
            .unwrap();

        if let Some(recording) = recording {
            let saved_path = recording
                .save_to_async(fixtures_path, scenario)
                .await
                .expect("cannot store scenario on disk");

            std::fs::rename(saved_path, path).unwrap();
        }

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
        let (rows, over_the_limit) = test_query(false, None).await;

        // ensure the parquet file is the same as the bytes
        assert!(compare_parquet_file_with_bytes(PARQUET_FILE, rows));
        assert_eq!(over_the_limit, false);

        // // test if we're over the limit
        let (_, over_the_limit) = test_query(false, Some(10)).await;
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
