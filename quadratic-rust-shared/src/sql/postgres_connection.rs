use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use sqlx::{
    postgres::{PgColumn, PgPool, PgRow},
    Column, Row, TypeInfo,
};
use uuid::Uuid;

use crate::convert_pg_type;
use crate::sql::Connection;

pub struct PostgresConnection<'a> {
    pub user: &'a str,
    pub password: &'a str,
    pub host: &'a str,
    pub port: &'a str,
    pub database: &'a str,
}

impl PostgresConnection<'_> {
    pub fn new<'a>(
        user: &'a str,
        password: &'a str,
        host: &'a str,
        port: &'a str,
        database: &'a str,
    ) -> PostgresConnection<'a> {
        PostgresConnection {
            user,
            password,
            host,
            port,
            database,
        }
    }
}

impl<'a> Connection for PostgresConnection<'a> {
    type Pool = PgPool;
    type Row = PgRow;
    type Column = PgColumn;

    async fn connect(&self) -> Result<Self::Pool, sqlx::Error> {
        let connection = self.connection_string();
        let pool = PgPool::connect(&connection).await?;

        Ok(pool)
    }

    fn connection_string(&self) -> String {
        format!(
            "postgres://{}:{}@{}:{}/{}",
            self.user, self.password, self.host, self.port, self.database
        )
    }

    async fn query(&self, pool: Self::Pool, sql: &str) -> Result<Vec<Self::Row>, sqlx::Error> {
        let row = sqlx::query(sql).fetch_all(&pool).await?;

        Ok(row)
    }

    fn to_arrow(row: &Self::Row, column: &Self::Column, index: usize) -> Option<String> {
        match column.type_info().name() {
            "TEXT" | "VARCHAR" | "CHAR(N)" | "NAME" | "CITEXT" => {
                convert_pg_type!(String, row, index)
            }
            "SMALLINT" | "SMALLSERIAL" | "INT2" => convert_pg_type!(i16, row, index),
            "INT" | "SERIAL" | "INT4" => convert_pg_type!(i32, row, index),
            "BIGINT" | "BIGSERIAL" | "INT8" => convert_pg_type!(i64, row, index),
            "BOOLEAN" => convert_pg_type!(bool, row, index),
            "REAL" | "FLOAT4" => convert_pg_type!(f32, row, index),
            "DOUBLE PRECISION" | "FLOAT8" => convert_pg_type!(f64, row, index),
            "TIMESTAMP" => convert_pg_type!(NaiveDateTime, row, index),
            "TIMESTAMPTZ" => convert_pg_type!(DateTime<Local>, row, index),
            "DATE" => convert_pg_type!(NaiveDate, row, index),
            "TIME" => convert_pg_type!(NaiveTime, row, index),
            "UUID" => convert_pg_type!(Uuid, row, index),
            "VOID" => None,
            _ => None,
        }
    }
}

#[macro_export]
macro_rules! convert_pg_type {
    ( $kind:ty, $row:ident, $index:ident ) => {
        $row.try_get::<$kind, usize>($index)
            .ok()
            .map(|v| v.to_string())
    };
}

#[cfg(test)]
mod tests {

    use super::*;

    fn new_postgres_connection() -> PostgresConnection<'static> {
        PostgresConnection::new("postgres", "postgres", "0.0.0.0", "5432", "postgres")
    }

    #[tokio::test]
    async fn test_postgres_connection() {
        let connection = new_postgres_connection();
        let pool = connection.connect().await.unwrap();
        let rows = connection
            .query(pool, "select * from \"FileCheckpoint\" limit 1")
            .await
            .unwrap();

        let _data = PostgresConnection::to_parquet(rows);

        // for row in rows {
        //     for (index, col) in row.columns().into_iter().enumerate() {
        //         let value = PostgresConnection::to_arrow(&row, col, index);
        //         println!(
        //             "{} ({}) = {:?}",
        //             col.name().to_string(),
        //             col.type_info().name(),
        //             value
        //         );
        //     }
        // }
    }
}
