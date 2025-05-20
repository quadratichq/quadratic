//! PostgreSQL
//!
//! Functions to interact with PostgreSQL

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
    Column, ConnectOptions, PgConnection, Row, TypeInfo,
    postgres::{PgColumn, PgConnectOptions, PgRow, PgTypeKind, types::PgTimeTz},
};

use crate::error::{Result, SharedError};
use crate::quadratic_api::Connection as ApiConnection;
use crate::sql::error::Sql as SqlError;
use crate::sql::schema::{DatabaseSchema, SchemaColumn, SchemaTable};
use crate::sql::{ArrowType, Connection};
use crate::{convert_sqlx_type, net::ssh::SshConfig, sql::UsesSsh, to_arrow_type};

/// PostgreSQL connection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresConnection {
    pub username: Option<String>,
    pub password: Option<String>,
    pub host: String,
    pub port: Option<String>,
    pub database: String,
    pub use_ssh: Option<bool>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<String>,
    pub ssh_username: Option<String>,
    pub ssh_key: Option<String>,
}

impl From<&ApiConnection<PostgresConnection>> for PostgresConnection {
    fn from(connection: &ApiConnection<PostgresConnection>) -> Self {
        let details = connection.type_details.to_owned();
        PostgresConnection::new(
            details.username,
            details.password,
            details.host,
            details.port,
            details.database,
            details.use_ssh,
            details.ssh_host,
            details.ssh_port,
            details.ssh_username,
            details.ssh_key,
        )
    }
}

impl TryFrom<PostgresConnection> for SshConfig {
    type Error = SharedError;

    fn try_from(connection: PostgresConnection) -> Result<Self> {
        let required = |value: Option<String>| {
            value.ok_or(SharedError::Sql(SqlError::Connect(
                "Required field is missing".into(),
            )))
        };

        let ssh_port = <PostgresConnection as UsesSsh>::parse_port(&connection.ssh_port).ok_or(
            SharedError::Sql(SqlError::Connect("SSH port is required".into())),
        )??;

        Ok(SshConfig::new(
            required(connection.ssh_host)?,
            ssh_port,
            required(connection.ssh_username)?,
            connection.password,
            required(connection.ssh_key)?,
            None,
        ))
    }
}

impl PostgresConnection {
    /// Create a new PostgreSQL connection
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        username: Option<String>,
        password: Option<String>,
        host: String,
        port: Option<String>,
        database: String,
        use_ssh: Option<bool>,
        ssh_host: Option<String>,
        ssh_port: Option<String>,
        ssh_username: Option<String>,
        ssh_key: Option<String>,
    ) -> PostgresConnection {
        PostgresConnection {
            username,
            password,
            host,
            port,
            database,
            use_ssh,
            ssh_host,
            ssh_port,
            ssh_username,
            ssh_key,
        }
    }

    /// Query all rows from a PostgreSQL database
    async fn query_all(pool: &mut PgConnection, sql: &str) -> Result<Vec<PgRow>> {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| SharedError::Sql(SqlError::Query(e.to_string())))?;

        Ok(rows)
    }
}

#[async_trait]
impl Connection for PostgresConnection {
    type Conn = PgConnection;
    type Row = PgRow;
    type Column = PgColumn;

    /// Get the length of a row
    fn row_len(row: &Self::Row) -> usize {
        row.len()
    }

    /// Get the columns of a row
    fn row_columns(row: &Self::Row) -> Box<dyn Iterator<Item = &Self::Column> + '_> {
        Box::new(row.columns().iter())
    }

    /// Get the name of a column
    fn column_name(col: &Self::Column) -> &str {
        col.name()
    }

    /// Connect to a PostgreSQL database
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

        if let Some(port) = self.port() {
            options = options.port(port?);
        }

        let pool = options.connect().await.map_err(|e| {
            SharedError::Sql(SqlError::Connect(format!("{:?}: {e}", self.database)))
        })?;

        Ok(pool)
    }

    /// Query rows from a PostgreSQL database
    async fn query(
        &self,
        pool: &mut Self::Conn,
        sql: &str,
        max_bytes: Option<u64>,
    ) -> Result<(Bytes, bool, usize)> {
        let mut rows = vec![];
        let mut over_the_limit = false;

        if let Some(max_bytes) = max_bytes {
            let mut bytes = 0;
            let mut stream = sqlx::query(sql).fetch(pool);

            while let Some(row) = stream.next().await {
                let row = row.map_err(|e| SharedError::Sql(SqlError::Query(e.to_string())))?;
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
                .map_err(|e| SharedError::Sql(SqlError::Query(e.to_string())))?;
        }

        let (bytes, num_records) = Self::to_parquet(rows)?;
        Ok((bytes, over_the_limit, num_records))
    }

    /// Get the schema of a PostgreSQL database
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

    /// Convert a row to an Arrow type
    fn to_arrow(row: &Self::Row, column: &Self::Column, index: usize) -> ArrowType {
        // println!("Column: {} ({})", column.name(), column.type_info().name());
        match column.type_info().name() {
            "TEXT" | "VARCHAR" | "CHAR" | "CHAR(N)" | "NAME" | "CITEXT" => {
                to_arrow_type!(ArrowType::Utf8, String, row, index)
            }
            "SMALLINT" | "SMALLSERIAL" | "INT2" => {
                to_arrow_type!(ArrowType::Int16, i16, row, index)
            }
            "INT" | "SERIAL" | "INT4" => to_arrow_type!(ArrowType::Int32, i32, row, index),
            "BIGINT" | "BIGSERIAL" | "INT8" => to_arrow_type!(ArrowType::Int64, i64, row, index),
            "BOOL" => to_arrow_type!(ArrowType::Boolean, bool, row, index),
            "REAL" | "FLOAT4" => to_arrow_type!(ArrowType::Float32, f32, row, index),
            "DOUBLE PRECISION" | "FLOAT8" => to_arrow_type!(ArrowType::Float64, f64, row, index),
            "NUMERIC" => to_arrow_type!(ArrowType::BigDecimal, BigDecimal, row, index),
            "TIMESTAMP" => to_arrow_type!(ArrowType::Timestamp, NaiveDateTime, row, index),
            "TIMESTAMPTZ" => to_arrow_type!(ArrowType::TimestampTz, DateTime<Local>, row, index),
            "DATE" => match convert_sqlx_type!(NaiveDate, row, index) {
                Some(naive_date) => ArrowType::Date32(Date32Type::from_naive_date(naive_date)),
                None => ArrowType::Null,
            },
            "TIME" => to_arrow_type!(ArrowType::Time32, NaiveTime, row, index),
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
            "JSON" => to_arrow_type!(ArrowType::Json, Value, row, index),
            "JSONB" => to_arrow_type!(ArrowType::Jsonb, Value, row, index),
            "UUID" => to_arrow_type!(ArrowType::Uuid, Uuid, row, index),
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

                to_arrow_type!(ArrowType::Utf8, String, row, index)
            }
        }
    }
}

impl UsesSsh for PostgresConnection {
    fn use_ssh(&self) -> bool {
        self.use_ssh.unwrap_or(false)
    }

    fn port(&self) -> Option<Result<u16>> {
        Self::parse_port(&self.port)
    }

    fn set_port(&mut self, port: u16) {
        self.port = Some(port.to_string());
    }

    fn ssh_host(&self) -> Option<String> {
        self.ssh_host.to_owned()
    }

    fn set_ssh_key(&mut self, ssh_key: Option<String>) {
        self.ssh_key = ssh_key;
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    // use std::io::Read;

    fn new_postgres_connection() -> PostgresConnection {
        PostgresConnection::new(
            Some("user".into()),
            Some("password".into()),
            "127.0.0.1".into(),
            Some("5433".into()),
            "postgres-connection".into(),
            Some(false),
            Some("".into()),
            Some("".into()),
            Some("".into()),
            Some("".into()),
        )
    }

    #[tokio::test]
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
    async fn test_postgres_schema() {
        let connection = new_postgres_connection();
        let mut pool = connection.connect().await.unwrap();
        let _schema = connection.schema(&mut pool).await.unwrap();

        // println!("{:?}", schema);
    }
}
