use std::str::FromStr;

use bigdecimal::BigDecimal;
use chrono::{DateTime, FixedOffset, Local, NaiveDate, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};
use sqlx::{
    postgres::{types::PgTimeTz, PgColumn, PgConnectOptions, PgRow},
    Column, ConnectOptions, PgConnection, Row, TypeInfo,
};
use uuid::Uuid;

use crate::convert_pg_type;
use crate::error::{Result, SharedError, Sql};
use crate::sql::{ArrowType, Connection};

#[derive(Debug, Serialize, Deserialize)]
pub struct PostgresConnection {
    pub username: Option<String>,
    pub password: Option<String>,
    pub host: String,
    pub port: Option<u16>,
    pub database: Option<String>,
}

impl PostgresConnection {
    pub fn new(
        username: Option<String>,
        password: Option<String>,
        host: String,
        port: Option<u16>,
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

impl Connection for PostgresConnection {
    type Conn = PgConnection;
    type Row = PgRow;
    type Column = PgColumn;

    async fn connect(&self) -> Result<Self::Conn> {
        let mut options = PgConnectOptions::new();

        if let Some(ref username) = self.username {
            options = options.username(username);
        }

        if let Some(ref password) = self.password {
            options = options.password(password);
        }

        if let Some(ref port) = self.port {
            options = options.port(*port);
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

    async fn query(&self, mut pool: Self::Conn, sql: &str) -> Result<Vec<Self::Row>> {
        let row = sqlx::query(sql)
            .fetch_all(&mut pool)
            .await
            .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;

        Ok(row)
    }

    fn to_arrow(row: &Self::Row, column: &Self::Column, index: usize) -> ArrowType {
        match column.type_info().name() {
            "TEXT" | "VARCHAR" | "CHAR(N)" | "NAME" | "CITEXT" => {
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
            "DATE" => ArrowType::Date32(convert_pg_type!(NaiveDate, row, index)),
            "TIME" => ArrowType::Time32(convert_pg_type!(NaiveTime, row, index)),
            "TIMETZ" => {
                let time = row.try_get::<PgTimeTz, usize>(index).ok();
                time.map_or_else(|| ArrowType::Void, |time| ArrowType::Time32(time.time))
            }
            "UUID" => ArrowType::Uuid(convert_pg_type!(Uuid, row, index)),
            "VOID" => ArrowType::Void,
            // try to convert others to a string
            _ => ArrowType::Utf8(convert_pg_type!(String, row, index)),
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
            Some(5432),
            Some("postgres".into()),
        )
    }

    #[tokio::test]
    #[traced_test]
    async fn test_postgres_connection() {
        let connection = new_postgres_connection();
        let pool = connection.connect().await.unwrap();
        let rows = connection
            // .query(pool, "select * from \"FileCheckpoint\" limit 10")
            .query(pool, "select * from \"Sample\" order by id limit 10")
            .await
            .unwrap();

        for row in &rows {
            for (index, col) in row.columns().into_iter().enumerate() {
                let value = PostgresConnection::to_arrow(&row, col, index);
                println!(
                    "{} ({}) = {:?}",
                    col.name().to_string(),
                    col.type_info().name(),
                    value
                );
            }
        }

        let _data = PostgresConnection::to_parquet(rows);

        // println!("{:?}", _data);
    }
}
