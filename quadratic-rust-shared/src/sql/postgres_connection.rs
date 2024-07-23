use std::collections::BTreeMap;

use arrow::datatypes::Date32Type;
use async_trait::async_trait;
use bigdecimal::BigDecimal;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{
    postgres::{types::PgTimeTz, PgColumn, PgConnectOptions, PgRow, PgTypeKind},
    Column, ConnectOptions, PgConnection, Row, TypeInfo,
};
use uuid::Uuid;

use crate::error::{Result, SharedError, Sql};
use crate::sql::{ArrowType, Connection};
use crate::{
    convert_pg_type,
    sql::{DatabaseSchema, SchemaColumn, SchemaTable},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct PostgresConnection {
    pub username: Option<String>,
    pub password: Option<String>,
    pub host: String,
    pub port: Option<String>,
    pub database: Option<String>,
}

impl PostgresConnection {
    pub fn new(
        username: Option<String>,
        password: Option<String>,
        host: String,
        port: Option<String>,
        database: Option<String>,
    ) -> PostgresConnection {
        PostgresConnection {
            username,
            password,
            host,
            port,
            database,
        }
    }
}

#[async_trait]
impl Connection for PostgresConnection {
    type Conn = PgConnection;
    type Row = PgRow;
    type Column = PgColumn;

    async fn connect(&self) -> Result<Self::Conn> {
        let mut options = PgConnectOptions::new();
        options = options.host(&self.host);

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

        if let Some(ref database) = self.database {
            options = options.database(database);
        }

        let pool = options
            .connect()
            .await
            .map_err(|e| SharedError::Sql(Sql::Connect(format!("{:?}: {e}", self.database))))?;

        Ok(pool)
    }

    async fn query(
        &self,
        mut pool: Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Vec<Self::Row>, bool)> {
        let mut rows = vec![];
        let mut over_the_limit = false;

        if let Some(max_bytes) = max_bytes {
            let mut bytes = 0;
            let mut stream = sqlx::query(sql).fetch(&mut pool);

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
                .fetch_all(&mut pool)
                .await
                .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;
        }

        Ok((rows, over_the_limit))
    }

    async fn schema(&self, pool: Self::Conn) -> Result<DatabaseSchema> {
        let database = self.database.as_ref().ok_or_else(|| {
            SharedError::Sql(Sql::Schema("Database name is required for MySQL".into()))
        })?;

        let sql = format!("
            select c.table_catalog as database, c.table_schema as schema, c.table_name as table, c.column_name, c.udt_name as column_type, c.is_nullable
            from information_schema.tables as t inner join information_schema.columns as c on t.table_name = c.table_name
            where t.table_type = 'BASE TABLE' 
                and c.table_schema not in 
                    ('pg_catalog', 'information_schema')
                    and c.table_catalog = '{database}'
            order by c.table_name, c.ordinal_position, c.column_name");

        let (rows, _) = self.query(pool, &sql, None).await?;

        let mut schema = DatabaseSchema {
            database: self.database.to_owned().unwrap_or_default(),
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
            Some("postgres".into()),
            Some("postgres".into()),
            "0.0.0.0".into(),
            Some("5432".into()),
            Some("postgres".into()),
        )
    }

    #[tokio::test]
    #[traced_test]
    async fn test_postgres_connection() {
        let connection = new_postgres_connection();
        let pool = connection.connect().await.unwrap();
        let (rows, _) = connection
            // .query(pool, "select * from \"FileCheckpoint\" limit 10")
            .query(
                pool,
                "select * from all_native_data_types order by id limit 1",
                None,
            )
            .await
            .unwrap();

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
        let pool = connection.connect().await.unwrap();
        let _schema = connection.schema(pool).await.unwrap();

        // println!("{:?}", schema);
    }
}
