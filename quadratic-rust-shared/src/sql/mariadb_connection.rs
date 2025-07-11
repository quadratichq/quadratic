//! MariaDB
//!
//! Functions to interact with MariaDB

use crate::sql::mysql_connection::MySqlConnection;
pub type MariaDBConnection = MySqlConnection;

#[cfg(test)]
mod tests {

    use chrono::{DateTime, Local, NaiveDateTime, NaiveTime};
    use rust_decimal::Decimal;
    use serde_json::json;
    use sqlx::Row;
    use std::str::FromStr;

    use super::*;
    use crate::error::Result;
    use crate::sql::schema::SchemaColumn;
    use crate::sql::{ArrowType, Connection};

    fn new_mysql_connection() -> MariaDBConnection {
        MariaDBConnection::new(
            Some("user".into()),
            Some("password".into()),
            "0.0.0.0".into(),
            Some("13306".into()),
            "mariadb-connection".into(),
            None,
            None,
            None,
            None,
            None,
        )
    }

    async fn setup() -> (MariaDBConnection, Result<sqlx::MySqlConnection>) {
        let connection = new_mysql_connection();
        let pool = connection.connect().await;

        (connection, pool)
    }

    #[tokio::test]
    async fn test_mariadb_connection() {
        let (_, pool) = setup().await;

        assert!(pool.is_ok());
    }

    #[tokio::test]
    async fn test_mariadb_query_to_arrow() {
        let (connection, pool) = setup().await;
        let mut pool = pool.unwrap();
        let sql = "select * from all_native_data_types order by id limit 1";
        let rows = MariaDBConnection::query_all(&mut pool, sql).await.unwrap();

        // for row in &rows {
        //     for (index, col) in row.columns().iter().enumerate() {
        //         let value = MariaDBConnection::to_arrow(row, col, index);
        //         println!("assert_eq!(to_arrow({}), ArrowType::{:?});", index, value);
        //     }
        // }

        let row = &rows[0];
        let columns = row.columns();
        let to_arrow = |index: usize| connection.to_arrow(row, &columns[index], index);

        assert_eq!(to_arrow(0), ArrowType::Int32(1));
        assert_eq!(to_arrow(1), ArrowType::Int8(127));
        assert_eq!(to_arrow(2), ArrowType::Int16(32767));
        assert_eq!(to_arrow(3), ArrowType::Int32(8388607));
        assert_eq!(to_arrow(4), ArrowType::Int32(2147483647));
        assert_eq!(to_arrow(5), ArrowType::Int64(9223372036854775807));
        assert_eq!(
            to_arrow(6),
            ArrowType::Decimal(Decimal::from_str("12345.67").unwrap())
        );
        assert_eq!(to_arrow(7), ArrowType::Float32(123.45));
        assert_eq!(to_arrow(8), ArrowType::Float64(123456789.123456));
        assert_eq!(to_arrow(9), ArrowType::UInt64(1));
        assert_eq!(to_arrow(10), ArrowType::Utf8("char_data".into()));
        assert_eq!(to_arrow(11), ArrowType::Utf8("varchar_data".into()));
        assert_eq!(to_arrow(12), ArrowType::Unsupported);
        assert_eq!(to_arrow(13), ArrowType::Unsupported);
        assert_eq!(to_arrow(14), ArrowType::Null);
        assert_eq!(to_arrow(15), ArrowType::Null);
        assert_eq!(to_arrow(16), ArrowType::Null);
        assert_eq!(to_arrow(17), ArrowType::Null);
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
    async fn test_mariadb_schema() {
        let connection = new_mysql_connection();
        let mut pool = connection.connect().await.unwrap();
        let schema = connection.schema(&mut pool).await.unwrap();

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
                r#type: "longtext".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "null_bool_col".into(),
                r#type: "tinyint".into(),
                is_nullable: true,
            },
        ];

        let columns = &schema.tables.get("all_native_data_types").unwrap().columns;

        assert_eq!(columns, &expected);
    }
}
