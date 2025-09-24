//! datafusion
//!
//! Functions to interact with datafusion

use arrow::array::ArrayRef;
use arrow_array::array::Array;
use async_trait::async_trait;
use bytes::Bytes;
use datafusion::prelude::{ParquetReadOptions, SessionContext};
use derivative::Derivative;
use parquet::arrow::ArrowWriter;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;
use url::Url;
use uuid::Uuid;

use crate::arrow::arrow_type::ArrowType;
use crate::arrow::object_store::new_s3_object_store;
use crate::error::Result;
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::{Connection, connect_error, query_error, schema_error};

/// datafusion connection
#[derive(Derivative, Serialize, Deserialize)]
#[derivative(Debug, Clone)]
pub struct DatafusionConnection {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub endpoint: Option<String>,
    pub region: String,
    pub bucket: String,
    pub connection_id: Option<Uuid>,
    #[serde(skip)]
    #[derivative(Debug = "ignore")]
    pub session_context: SessionContext,
}

impl DatafusionConnection {
    /// Create a new datafusion connection
    pub fn new(
        access_key_id: String,
        secret_access_key: String,
        endpoint: Option<String>,
        region: String,
        bucket: String,
    ) -> DatafusionConnection {
        DatafusionConnection {
            access_key_id,
            secret_access_key,
            endpoint,
            region,
            bucket,
            connection_id: None,
            session_context: SessionContext::new(),
        }
    }

    /// Get the parquet path for a table in the object store
    pub fn object_store_parquet_path(&self, url: &Url, table: &str) -> Result<String> {
        let connection_id = self
            .connection_id
            .ok_or_else(|| connect_error("Connection ID is required"))?;

        Ok(format!("{}/{}/{}/", url.as_str(), connection_id, table))
    }
}

/// Implement the Connection trait for datafusion
///
/// Since the datafusion api returns arrow data, we don't need some of the
/// trait functions implemented.
#[async_trait]
impl<'a> Connection<'a> for DatafusionConnection {
    type Conn = SessionContext;
    type Row = Arc<dyn Array>;
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
    fn column_name(&self, _col: &Self::Column, _index: usize) -> String {
        unimplemented!();
    }

    /// Convert a row to an Arrow type
    fn to_arrow(&self, _row: &Self::Row, _: &ArrayRef, _index: usize) -> ArrowType {
        unimplemented!();
    }

    /// Connect to a datafusion database
    async fn connect(&self) -> Result<SessionContext> {
        let ctx: SessionContext = SessionContext::new();
        let (arc_s3, s3_url) = new_s3_object_store(
            &self.bucket,
            &self.region,
            &self.access_key_id,
            &self.secret_access_key,
            self.endpoint.is_some(),
        )?;

        // register the object store in datafusion context
        ctx.register_object_store(&s3_url, arc_s3.clone());

        // hard-code for now
        // TODO(ddimaria): remove this in favor of getting the tables elsewhere
        let tables = vec!["events"];

        // register the parquet path for every table
        for table in tables {
            let parquet_path = self.object_store_parquet_path(&s3_url, table)?;
            ctx.register_parquet(table, &parquet_path, ParquetReadOptions::default())
                .await
                .map_err(connect_error)?;
        }

        Ok(ctx)
    }

    /// Query rows from a parquet file
    async fn query(
        &mut self,
        client: &mut Self::Conn,
        sql: &str,
        _max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool, usize)> {
        let df = client.sql(sql).await.map_err(query_error)?;
        // TODO(ddimaria): remove this
        // df.clone().show().await.unwrap();
        let batches = df.collect().await.map_err(query_error)?;

        if batches.is_empty() {
            return Ok((Bytes::new(), false, 0));
        }

        let mut total_records = 0;
        let buffer = Vec::new();
        let mut writer = ArrowWriter::try_new(buffer, batches[0].schema(), None)?;

        for batch in &batches {
            total_records += batch.num_rows();
            writer.write(batch)?;
        }

        let parquet = writer.into_inner()?;

        Ok((parquet.into(), false, total_records))
    }

    async fn schema(&self, client: &mut Self::Conn) -> Result<DatabaseSchema> {
        let database = self.bucket.clone();

        // get all registered tables
        let table_names = client
            .catalog("datafusion")
            .ok_or_else(|| schema_error("datafusion catalog not found"))?
            .schema("public")
            .ok_or_else(|| schema_error("public schema not found"))?
            .table_names();

        let mut schema = DatabaseSchema {
            database,
            tables: BTreeMap::new(),
        };

        for table_name in table_names {
            let df = client.table(&table_name).await.map_err(schema_error)?;
            let df_schema = df.schema();

            let columns = df_schema
                .fields()
                .iter()
                .map(|field| SchemaColumn {
                    name: field.name().clone(),
                    r#type: format!("{:?}", field.data_type()),
                    is_nullable: field.is_nullable(),
                })
                .collect::<Vec<_>>();

            schema.tables.insert(
                table_name.clone(),
                SchemaTable {
                    name: table_name,
                    schema: "public".to_string(),
                    columns,
                },
            );
        }

        Ok(schema)
    }
}

pub mod tests {

    use super::*;

    pub const PARQUET_FILE: &str = "s3://synced-data/consolidated/mixpanel_data.parquet";

    pub fn new_datafusion_connection() -> DatafusionConnection {
        DatafusionConnection::new(
            "test".into(),
            "test".into(),
            Some("http://localhost:4566".into()),
            "us-east-2".into(),
            "synced-data".into(),
        )
    }

    pub async fn setup() -> (DatafusionConnection, Result<SessionContext>) {
        let connection = new_datafusion_connection();
        let client = connection.connect().await;

        (connection, client)
    }

    pub fn expected_datafusion_schema() -> Vec<SchemaColumn> {
        vec![
            SchemaColumn {
                name: "event".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "time".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "distinct_id".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_browser".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_browser_version".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_city".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_current_url".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_device".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_device_id".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_initial_referrer".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_initial_referring_domain".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_insert_id".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_lib_version".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_os".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_region".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_screen_height".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_screen_width".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_user_id".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_country_code".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_lib".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_sent_by_lib_version".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "path".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "utm_campaign".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "utm_content".into(),
                r#type: "Float64".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "utm_medium".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "utm_source".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "utm_term".into(),
                r#type: "Float64".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "_sdc_extracted_at".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "_stream".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "database".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_referrer".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_referring_domain".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_search_engine".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "gclid".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "chatId".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "filenames".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "prompt".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "email".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "isOnPaidPlan".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "loadTimeMs".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "route".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "type".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "inline".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "label".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "userMessageCountUponSubmit".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "isPrivate".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "language".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "title".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "newFilename".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "id".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "fileName".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "exceededBillingLimit".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "location".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "ab_test".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "__createdAt".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "__version".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "goals[]".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "languages[]".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "personal-uses[]".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "use".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mp_reserved_source".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "Campaign ID".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "Campaign Name".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "Campaign Status".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "Campaign Type".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "Event Timestamp".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "messageCount".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "context".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "error".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "files".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "education-identity".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "education-subjects[]".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "AB Test Variant".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "Page".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "Test Type".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "description".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "fbclid".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "team_uuid".into(),
                r#type: "Utf8View".into(),
                is_nullable: true,
            },
        ]
    }

    // to record: cargo test --features record-request-mock
    pub async fn test_query(max_bytes: Option<u64>) -> (Bytes, bool, usize) {
        let mut connection = new_datafusion_connection();
        let mut client = connection.connect().await.unwrap();

        connection
            .query(
                &mut client,
                "select * from mixpanel_data limit 10;",
                max_bytes,
            )
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn test_datafusion_connection() {
        let (_, client) = setup().await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_datafusion_query() {
        let start = std::time::Instant::now();
        let (rows, over_the_limit, num_records) = test_query(None).await;
        println!("time: {:?}", start.elapsed());
        println!("num_records: {:?}", num_records);

        // ensure the parquet file is the same as the bytes
        assert!(crate::parquet::utils::compare_parquet_file_with_bytes(
            PARQUET_FILE,
            rows
        ));
        assert!(!over_the_limit);
        assert_eq!(num_records, 2);

        // // test if we're over the limit
        let (_, over_the_limit, num_records) = test_query(Some(10)).await;
        assert!(over_the_limit);
        assert_eq!(num_records, 0);
    }

    // to record: cargo test test_datafusion_schema --features record-request-mock
    #[tokio::test]
    async fn test_datafusion_schema() {
        let connection = new_datafusion_connection();
        let mut client = connection.connect().await.unwrap();
        let schema = connection.schema(&mut client).await.unwrap();
        let columns = &schema.tables.get("mixpanel_data").unwrap().columns;

        assert!(schema.tables.contains_key("mixpanel_data"));
        assert_eq!(columns, &expected_datafusion_schema());
    }
}
