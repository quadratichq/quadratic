use std::collections::BTreeMap;

use arrow::datatypes::Date32Type;
use async_trait::async_trait;
use bigdecimal::BigDecimal;
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use futures_util::StreamExt;
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

#[async_trait]
impl Connection for MySqlConnection {
    type Conn = SqlxMySqlConnection;
    type Row = MySqlRow;
    type Column = MySqlColumn;

    async fn connect(&self) -> Result<Self::Conn> {
        let mut options = MySqlConnectOptions::new();
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
            select c.TABLE_SCHEMA as 'database', c.TABLE_SCHEMA as 'schema', c.TABLE_NAME as 'table', 
                c.COLUMN_NAME as 'column_name', c.DATA_TYPE as 'column_type', c.IS_NULLABLE as 'is_nullable'
            from INFORMATION_SCHEMA.COLUMNS as c
            where table_schema = '{database}'
            order by c.TABLE_NAME, c.ORDINAL_POSITION, c.COLUMN_NAME");

        let (rows, _) = self.query(pool, &sql, None).await?;

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

    use std::str::FromStr;

    use super::*;
    // use std::io::Read;
    use bigdecimal::BigDecimal;
    use serde_json::json;
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

    async fn setup() -> (MySqlConnection, Result<sqlx::MySqlConnection>) {
        let connection = new_mysql_connection();
        let pool = connection.connect().await;

        (connection, pool)
    }

    #[tokio::test]
    #[traced_test]
    async fn test_mysql_connection() {
        let (_, pool) = setup().await;

        assert!(pool.is_ok());
    }

    #[tokio::test]
    #[traced_test]
    async fn test_mysql_query_to_arrow() {
        let (connection, pool) = setup().await;
        let (rows, over_the_limit) = connection
            .query(
                pool.unwrap(),
                "select * from all_native_data_types order by id limit 1",
                None,
            )
            .await
            .unwrap();

        // for row in &rows {
        //     for (index, col) in row.columns().iter().enumerate() {
        //         let value = MySqlConnection::to_arrow(row, col, index);
        //         println!("assert_eq!(to_arrow({}), ArrowType::{:?});", index, value);
        //     }
        // }

        let row = &rows[0];
        let columns = row.columns();
        let to_arrow = |index: usize| MySqlConnection::to_arrow(row, &columns[index], index);

        assert_eq!(over_the_limit, false);

        assert_eq!(to_arrow(0), ArrowType::Int32(1));
        assert_eq!(to_arrow(1), ArrowType::Int8(127));
        assert_eq!(to_arrow(2), ArrowType::Int16(32767));
        assert_eq!(to_arrow(3), ArrowType::Int32(8388607));
        assert_eq!(to_arrow(4), ArrowType::Int32(2147483647));
        assert_eq!(to_arrow(5), ArrowType::Int64(9223372036854775807));
        assert_eq!(
            to_arrow(6),
            ArrowType::BigDecimal(BigDecimal::from_str("12345.67").unwrap())
        );
        assert_eq!(to_arrow(7), ArrowType::Float32(123.45));
        assert_eq!(to_arrow(8), ArrowType::Float64(123456789.123456));
        assert_eq!(to_arrow(9), ArrowType::UInt64(1));
        assert_eq!(to_arrow(10), ArrowType::Utf8("char_data".into()));
        assert_eq!(to_arrow(11), ArrowType::Utf8("varchar_data".into()));
        assert_eq!(to_arrow(12), ArrowType::Unsupported);
        assert_eq!(to_arrow(13), ArrowType::Unsupported);
        assert_eq!(to_arrow(14), ArrowType::Unsupported);
        assert_eq!(to_arrow(15), ArrowType::Unsupported);
        assert_eq!(to_arrow(16), ArrowType::Unsupported);
        assert_eq!(to_arrow(17), ArrowType::Unsupported);
        assert_eq!(to_arrow(18), ArrowType::Utf8("tinytext_data".into()));
        assert_eq!(to_arrow(19), ArrowType::Utf8("text_data".into()));
        assert_eq!(to_arrow(20), ArrowType::Utf8("mediumtext_data".into()));
        assert_eq!(to_arrow(21), ArrowType::Utf8("longtext_data".into()));
        assert_eq!(to_arrow(22), ArrowType::Utf8("value1".into()));
        assert_eq!(to_arrow(23), ArrowType::Utf8("value1,value2".into()));
        assert_eq!(to_arrow(24), ArrowType::Date32(19871));
        assert_eq!(
            to_arrow(25),
            ArrowType::Timestamp(NaiveDateTime::from_str("2024-05-28T12:34:56").unwrap())
        );
        assert_eq!(
            to_arrow(26),
            ArrowType::TimestampTz(
                DateTime::<Local>::from_str("2024-05-28T06:34:56-06:00").unwrap()
            )
        );
        assert_eq!(
            to_arrow(27),
            ArrowType::Time32(NaiveTime::from_str("12:34:56").unwrap())
        );
        assert_eq!(to_arrow(28), ArrowType::UInt16(2024));
        assert_eq!(to_arrow(29), ArrowType::Json(json!({"key": "value"})));
    }

    #[tokio::test]
    #[traced_test]
    async fn test_mysql_schema() {
        let connection = new_mysql_connection();
        let pool = connection.connect().await.unwrap();
        let schema = connection.schema(pool).await.unwrap();

        // for (table_name, table) in &_schema.tables {
        //     println!("Table: {}", table_name);
        //     for column in &table.columns {
        //         println!("Column: {} ({})", column.name, column.r#type);
        //     }
        // }

        let expected = vec![
            SchemaColumn {
                name: "id".into(),
                r#type: "int".into(),
                is_nullable: false,
            },
            SchemaColumn {
                name: "tinyint_col".into(),
                r#type: "tinyint".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "smallint_col".into(),
                r#type: "smallint".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mediumint_col".into(),
                r#type: "mediumint".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "int_col".into(),
                r#type: "int".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bigint_col".into(),
                r#type: "bigint".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "decimal_col".into(),
                r#type: "decimal".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "float_col".into(),
                r#type: "float".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "double_col".into(),
                r#type: "double".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bit_col".into(),
                r#type: "bit".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "char_col".into(),
                r#type: "char".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "varchar_col".into(),
                r#type: "varchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "binary_col".into(),
                r#type: "binary".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "varbinary_col".into(),
                r#type: "varbinary".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "tinyblob_col".into(),
                r#type: "tinyblob".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "blob_col".into(),
                r#type: "blob".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mediumblob_col".into(),
                r#type: "mediumblob".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "longblob_col".into(),
                r#type: "longblob".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "tinytext_col".into(),
                r#type: "tinytext".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "text_col".into(),
                r#type: "text".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "mediumtext_col".into(),
                r#type: "mediumtext".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "longtext_col".into(),
                r#type: "longtext".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "enum_col".into(),
                r#type: "enum".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "set_col".into(),
                r#type: "set".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "date_col".into(),
                r#type: "date".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "datetime_col".into(),
                r#type: "datetime".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "timestamp_col".into(),
                r#type: "timestamp".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "time_col".into(),
                r#type: "time".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "year_col".into(),
                r#type: "year".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "json_col".into(),
                r#type: "json".into(),
                is_nullable: true,
            },
        ];

        let columns = &schema.tables.get("all_native_data_types").unwrap().columns;

        assert_eq!(columns, &expected);
    }
}
