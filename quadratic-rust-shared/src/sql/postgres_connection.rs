use std::collections::BTreeMap;

use arrow::datatypes::Date32Type;
use async_trait::async_trait;
use bigdecimal::BigDecimal;
use bytes::Bytes;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use sqlx::{
    postgres::{types::PgTimeTz, PgColumn, PgConnectOptions, PgRow, PgTypeKind},
    Column, ConnectOptions, PgConnection, Row, TypeInfo,
};

use crate::arrow::arrow_type::ArrowType;
use crate::convert_pg_type;
use crate::error::{Result, SharedError, Sql};
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::Connection;

#[derive(Debug, Serialize, Deserialize)]
pub struct PostgresConnection {
    pub username: Option<String>,
    pub password: Option<String>,
    pub host: String,
    pub port: Option<String>,
    pub database: String,
}

impl PostgresConnection {
    pub fn new(
        username: Option<String>,
        password: Option<String>,
        host: String,
        port: Option<String>,
        database: String,
    ) -> PostgresConnection {
        PostgresConnection {
            username,
            password,
            host,
            port,
            database,
        }
    }

    async fn query_all(pool: &mut PgConnection, sql: &str) -> Result<Vec<PgRow>> {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;

        Ok(rows)
    }
}

#[async_trait]
impl Connection for PostgresConnection {
    type Conn = PgConnection;
    type Row = PgRow;
    type Column = PgColumn;

    fn row_len(row: &Self::Row) -> usize {
        row.len()
    }

    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        Box::new(row.columns().iter())
    }

    fn column_name(col: &Self::Column) -> &str {
        col.name()
    }

    async fn connect(&self) -> Result<Self::Conn> {
        let mut options = PgConnectOptions::new();
        options = options.host(&self.host);
        options = options.database(&self.database);

        if let Some(ref username) = self.username {
            options = options.username(username);
        }

        if let Some(ref password) = self.password {
            options = options.password(password);
        }

        if let Some(ref port) = self.port {
            options = options.port(port.parse::<u16>().map_err(|_| {
                SharedError::Sql(Sql::Connect("Could not parse port into a number".into()))
            })?);
        }

        let pool = options
            .connect()
            .await
            .map_err(|e| SharedError::Sql(Sql::Connect(format!("{:?}: {e}", self.database))))?;

        Ok(pool)
    }

    async fn query(
        &self,
        pool: &mut Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool)> {
        let mut rows = vec![];
        let mut over_the_limit = false;

        if let Some(max_bytes) = max_bytes {
            let mut bytes = 0;
            let mut stream = sqlx::query(sql).fetch(pool);

            while let Some(row) = stream.next().await {
                let row = row.map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;
                bytes += row.len() as u64;

                if bytes > max_bytes {
                    over_the_limit = true;
                    break;
                }

                rows.push(row);
            }
            tracing::info!("Query executed with {bytes} bytes");
        } else {
            rows = sqlx::query(sql)
                .fetch_all(pool)
                .await
                .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;
        }

        Ok((Self::to_parquet(rows)?, over_the_limit))
    }

    async fn schema(&self, pool: &mut Self::Conn) -> Result<DatabaseSchema> {
        let database = self.database.to_owned();
        let sql = format!("
            select c.table_catalog as database, c.table_schema as schema, c.table_name as table, c.column_name, c.udt_name as column_type, c.is_nullable
            from information_schema.tables as t inner join information_schema.columns as c on t.table_name = c.table_name
            where t.table_type = 'BASE TABLE' 
                and c.table_schema not in 
                    ('pg_catalog', 'information_schema')
                    and c.table_catalog = '{database}'
            order by c.table_name, c.ordinal_position, c.column_name");

        let rows = Self::query_all(pool, &sql).await?;

        let mut schema = DatabaseSchema {
            database,
            tables: BTreeMap::new(),
        };

        for row in rows.into_iter() {
            let table_name = row.get::<String, usize>(2);

            schema
                .tables
                // get or insert the table
                .entry(table_name.to_owned())
                .or_insert_with(|| SchemaTable {
                    name: table_name,
                    schema: row.get::<String, usize>(1),
                    columns: vec![],
                })
                .columns
                // add the column to the table
                .push(SchemaColumn {
                    name: row.get::<String, usize>(3),
                    r#type: row.get::<String, usize>(4),
                    is_nullable: matches!(
                        row.get::<String, usize>(5).to_lowercase().as_str(),
                        "yes"
                    ),
                });
        }

        Ok(schema)
    }

    fn to_arrow(row: &Self::Row, column: &Self::Column, index: usize) -> ArrowType {
        // println!("Column: {} ({})", column.name(), column.type_info().name());
        match column.type_info().name() {
            "TEXT" | "VARCHAR" | "CHAR" | "CHAR(N)" | "NAME" | "CITEXT" => {
                ArrowType::Utf8(convert_pg_type!(String, row, index))
            }
            "SMALLINT" | "SMALLSERIAL" | "INT2" => {
                ArrowType::Int16(convert_pg_type!(i16, row, index))
            }
            "INT" | "SERIAL" | "INT4" => ArrowType::Int32(convert_pg_type!(i32, row, index)),
            "BIGINT" | "BIGSERIAL" | "INT8" => ArrowType::Int64(convert_pg_type!(i64, row, index)),
            "BOOL" => ArrowType::Boolean(convert_pg_type!(bool, row, index)),
            "REAL" | "FLOAT4" => ArrowType::Float32(convert_pg_type!(f32, row, index)),
            "DOUBLE PRECISION" | "FLOAT8" => ArrowType::Float64(convert_pg_type!(f64, row, index)),
            "NUMERIC" => ArrowType::BigDecimal(convert_pg_type!(BigDecimal, row, index)),
            "TIMESTAMP" => ArrowType::Timestamp(convert_pg_type!(NaiveDateTime, row, index)),
            "TIMESTAMPTZ" => ArrowType::TimestampTz(convert_pg_type!(DateTime<Local>, row, index)),
            "DATE" => {
                let naive_date = convert_pg_type!(NaiveDate, row, index);
                ArrowType::Date32(Date32Type::from_naive_date(naive_date))
            }
            "TIME" => ArrowType::Time32(convert_pg_type!(NaiveTime, row, index)),
            "TIMETZ" => {
                let time = row.try_get::<PgTimeTz, usize>(index).ok();
                time.map_or_else(|| ArrowType::Void, |time| ArrowType::Time32(time.time))
            }
            "INTERVAL" => {
                // TODO(ddimaria): implement once we support intervals
                // let interval = row.try_get::<PgInterval, usize>(index).ok();
                // PgInterval { months: -2, days: 0, microseconds: 0
                ArrowType::Void
            }
            "JSON" => ArrowType::Json(convert_pg_type!(Value, row, index)),
            "JSONB" => ArrowType::Jsonb(convert_pg_type!(Value, row, index)),
            "UUID" => ArrowType::Uuid(convert_pg_type!(Uuid, row, index)),
            "XML" => ArrowType::Void,
            "VOID" => ArrowType::Void,
            // try to convert others to a string
            _ => {
                match column.type_info().kind() {
                    PgTypeKind::Enum(_) => {
                        let value = row
                            .try_get_raw(index)
                            .map(|value| value.as_str().unwrap_or_default().to_string());

                        if let Ok(value) = value {
                            return ArrowType::Utf8(value);
                        }
                    }
                    PgTypeKind::Simple => {}
                    PgTypeKind::Pseudo => {}
                    PgTypeKind::Domain(_type_info) => {}
                    PgTypeKind::Composite(_type_info_array) => {}
                    PgTypeKind::Array(_type_info) => {}
                    PgTypeKind::Range(_type_info) => {}
                };

                // println!(
                //     "Unknown type: {:?}",
                //     row.try_get_raw(index)
                //         .and_then(|value| Ok(value.as_str().unwrap_or_default().to_string()))
                // );

                ArrowType::Utf8(convert_pg_type!(String, row, index))
            }
        }
    }
}

#[macro_export]
macro_rules! convert_pg_type {
    ( $kind:ty, $row:ident, $index:ident ) => {{
        $row.try_get::<$kind, usize>($index)
            .ok()
            .unwrap_or_default()
    }};
}

#[cfg(test)]
mod tests {

    use super::*;
    // use std::io::Read;
    use tracing_test::traced_test;

    fn new_postgres_connection() -> PostgresConnection {
        PostgresConnection::new(
            Some("user".into()),
            Some("password".into()),
            "127.0.0.1".into(),
            Some("5433".into()),
            "postgres-connection".into(),
        )
    }

    #[tokio::test]
    #[traced_test]
    async fn test_postgres_connection() {
        let connection = new_postgres_connection();
        let mut pool = connection.connect().await.unwrap();
        let sql = "select * from all_native_data_types limit 1";
        let rows = PostgresConnection::query_all(&mut pool, sql).await.unwrap();

        for row in &rows {
            for (index, col) in row.columns().iter().enumerate() {
                let value = PostgresConnection::to_arrow(row, col, index);
                println!("{} ({}) = {:?}", col.name(), col.type_info().name(), value);
            }
        }

        let _data = PostgresConnection::to_parquet(rows);

        // println!("{:?}", _data);
    }

    #[tokio::test]
    #[traced_test]
    async fn test_postgres_schema() {
        let connection = new_postgres_connection();
        let mut pool = connection.connect().await.unwrap();
        let _schema = connection.schema(&mut pool).await.unwrap();

        // println!("{:?}", schema);
    }
}
