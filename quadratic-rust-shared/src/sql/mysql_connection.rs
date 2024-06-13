use std::collections::BTreeMap;

use arrow::datatypes::Date32Type;
use bigdecimal::BigDecimal;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{
    mysql::{MySqlColumn, MySqlConnectOptions, MySqlRow /* , MySqlTypeInfo*/},
    Column, ConnectOptions, MySqlConnection as SqlxMySqlConnection, Row, TypeInfo,
};
use uuid::Uuid;

use crate::error::{Result, SharedError, Sql};
use crate::sql::{ArrowType, Connection};
use crate::{
    convert_mysql_type,
    sql::{DatabaseSchema, SchemaColumn, SchemaTable},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct MySqlConnection {
    pub username: Option<String>,
    pub password: Option<String>,
    pub host: String,
    pub port: Option<String>,
    pub database: Option<String>,
}

impl MySqlConnection {
    pub fn new(
        username: Option<String>,
        password: Option<String>,
        host: String,
        port: Option<String>,
        database: Option<String>,
    ) -> MySqlConnection {
        MySqlConnection {
            username,
            password,
            host,
            port,
            database,
        }
    }
}

impl Connection for MySqlConnection {
    type Conn = SqlxMySqlConnection;
    type Row = MySqlRow;
    type Column = MySqlColumn;

    async fn connect(&self) -> Result<Self::Conn> {
        let mut options = MySqlConnectOptions::new();

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

    async fn query(&self, mut pool: Self::Conn, sql: &str) -> Result<Vec<Self::Row>> {
        let rows = sqlx::query(sql)
            .fetch_all(&mut pool)
            .await
            .map_err(|e| SharedError::Sql(Sql::Query(e.to_string())))?;

        Ok(rows)
    }

    async fn schema(&self, pool: Self::Conn) -> Result<DatabaseSchema> {
        let database = self.database.as_ref().ok_or_else(|| {
            SharedError::Sql(Sql::Schema("Database name is required for MySQL".into()))
        })?;

        let sql = format!("
            select c.TABLE_SCHEMA as 'database', c.TABLE_SCHEMA as 'schema', c.TABLE_NAME as 'table', 
                c.COLUMN_NAME as 'column_name', c.DATA_TYPE as 'column_type', c.IS_NULLABLE as 'is_nullable'
            from INFORMATION_SCHEMA.COLUMNS as c
            where table_schema = '{database}'
            order by c.TABLE_NAME, c.ORDINAL_POSITION, c.COLUMN_NAME");

        let rows = self.query(pool, &sql).await?;

        let mut schema = DatabaseSchema {
            database: self.database.to_owned().unwrap_or_default(),
            tables: BTreeMap::new(),
        };

        for row in rows.into_iter() {
            let table_name = row.get::<String, usize>(2);

            schema
                .tables
                .entry(table_name.to_owned())
                .or_insert_with(|| SchemaTable {
                    name: table_name,
                    schema: row.get::<String, usize>(1),
                    columns: vec![],
                })
                .columns
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
            "TEXT" | "VARCHAR" | "CHAR" | "ENUM" => {
                ArrowType::Utf8(convert_mysql_type!(String, row, index))
            }
            "TINYINT" => ArrowType::Int8(convert_mysql_type!(i8, row, index)),
            "SMALLINT" => ArrowType::Int16(convert_mysql_type!(i16, row, index)),
            "MEDIUMINT" | "INT" => ArrowType::Int32(convert_mysql_type!(i32, row, index)),
            "BIGINT" => ArrowType::Int64(convert_mysql_type!(i64, row, index)),
            "TINYINT UNSIGNED" => ArrowType::UInt8(convert_mysql_type!(u8, row, index)),
            "SMALLINT UNSIGNED" => ArrowType::UInt16(convert_mysql_type!(u16, row, index)),
            "INT UNSIGNED" => ArrowType::UInt32(convert_mysql_type!(u32, row, index)),
            "BIGINT UNSIGNED" | "BIT" => ArrowType::UInt64(convert_mysql_type!(u64, row, index)),
            "BOOL" | "BOOLEAN" => ArrowType::Boolean(convert_mysql_type!(bool, row, index)),
            "FLOAT" => ArrowType::Float32(convert_mysql_type!(f32, row, index)),
            "DOUBLE" => ArrowType::Float64(convert_mysql_type!(f64, row, index)),
            "DECIMAL" => ArrowType::BigDecimal(convert_mysql_type!(BigDecimal, row, index)),
            "TIMESTAMP" => ArrowType::TimestampTz(convert_mysql_type!(DateTime<Local>, row, index)),
            "DATETIME" => ArrowType::Timestamp(convert_mysql_type!(NaiveDateTime, row, index)),
            "DATE" => {
                let naive_date = convert_mysql_type!(NaiveDate, row, index);
                ArrowType::Date32(Date32Type::from_naive_date(naive_date))
            }
            "TIME" => ArrowType::Time32(convert_mysql_type!(NaiveTime, row, index)),
            "YEAR" => ArrowType::UInt16(convert_mysql_type!(u16, row, index)),
            "JSON" => ArrowType::Json(convert_mysql_type!(Value, row, index)),
            "UUID" => ArrowType::Uuid(convert_mysql_type!(Uuid, row, index)),
            // try to convert others to a string
            _ => ArrowType::Unsupported,
        }
    }
}

#[macro_export]
macro_rules! convert_mysql_type {
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

    fn new_mysql_connection() -> MySqlConnection {
        MySqlConnection::new(
            Some("user".into()),
            Some("password".into()),
            "0.0.0.0".into(),
            Some("3306".into()),
            Some("mysql-connection".into()),
        )
    }

    #[tokio::test]
    #[traced_test]
    async fn test_mysql_connection() {
        let connection = new_mysql_connection();
        let pool = connection.connect().await.unwrap();
        let rows = connection
            // .query(pool, "select * from \"FileCheckpoint\" limit 10")
            .query(
                pool,
                "select * from all_native_data_types order by id limit 1",
            )
            .await
            .unwrap();

        for row in &rows {
            for (index, col) in row.columns().iter().enumerate() {
                let value = MySqlConnection::to_arrow(row, col, index);
                println!("{} ({}) = {:?}", col.name(), col.type_info().name(), value);
            }
        }

        let _data = MySqlConnection::to_parquet(rows);

        // println!("{:?}", _data);
    }

    #[tokio::test]
    #[traced_test]
    async fn test_mysql_schema() {
        let connection = new_mysql_connection();
        let pool = connection.connect().await.unwrap();
        let _schema = connection.schema(pool).await.unwrap();

        for (table_name, table) in &_schema.tables {
            println!("Table: {}", table_name);
            for column in &table.columns {
                println!("Column: {} ({})", column.name, column.r#type);
            }
        }

        // println!("{:?}", _schema.tables);
    }
}
