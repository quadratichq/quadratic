//! CockroachDB
//!
//! Functions to interact with CockroachDB

use crate::sql::postgres_connection::PostgresConnection;
pub type CockroachDbConnection = PostgresConnection;

#[cfg(test)]
mod tests {

    use super::*;

    use crate::sql::Connection;
    use crate::sql::schema::SchemaColumn;
    use sqlx::{Column, Row, TypeInfo};

    fn new_cockroach_connection() -> CockroachDbConnection {
        CockroachDbConnection::new(
            Some("root".into()),
            Some("".into()),
            "127.0.0.1".into(),
            Some("26257".into()),
            "cockroachdb_connection".into(),
            Some(false),
            Some("".into()),
            Some("".into()),
            Some("".into()),
            Some("".into()),
        )
    }

    #[tokio::test]
    async fn test_cockroach_connection() {
        let connection = new_cockroach_connection();
        let mut pool = connection.connect().await.unwrap();
        let sql = "select * from all_native_data_types limit 1";
        let rows = CockroachDbConnection::query_all(&mut pool, sql)
            .await
            .unwrap();

        for row in &rows {
            for (index, col) in row.columns().iter().enumerate() {
                let value = connection.to_arrow(row, col, index);
                println!("{} ({}) = {:?}", col.name(), col.type_info().name(), value);
            }
        }

        let _data = connection.to_parquet(rows);
    }

    #[tokio::test]
    async fn test_cockroach_schema() {
        let connection = new_cockroach_connection();
        let mut pool = connection.connect().await.unwrap();
        let schema = connection.schema(&mut pool).await.unwrap();

        let expected = vec![
            SchemaColumn {
                name: "id".into(),
                r#type: "int4".into(),
                is_nullable: false,
            },
            SchemaColumn {
                name: "smallint_col".into(),
                r#type: "int2".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "integer_col".into(),
                r#type: "int4".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bigint_col".into(),
                r#type: "int8".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "decimal_col".into(),
                r#type: "numeric".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "numeric_col".into(),
                r#type: "numeric".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "real_col".into(),
                r#type: "float4".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "double_col".into(),
                r#type: "float8".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "serial_col".into(),
                r#type: "int4".into(),
                is_nullable: false,
            },
            SchemaColumn {
                name: "bigserial_col".into(),
                r#type: "int8".into(),
                is_nullable: false,
            },
            SchemaColumn {
                name: "char_col".into(),
                r#type: "bpchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "varchar_col".into(),
                r#type: "varchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "text_col".into(),
                r#type: "text".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "bytea_col".into(),
                r#type: "bytea".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "timestamp_col".into(),
                r#type: "timestamp".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "timestamptz_col".into(),
                r#type: "timestamptz".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "date_col".into(),
                r#type: "date".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "time_col".into(),
                r#type: "time".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "timetz_col".into(),
                r#type: "timetz".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "interval_col".into(),
                r#type: "interval".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "boolean_col".into(),
                r#type: "bool".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "enum_col".into(),
                r#type: "varchar".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "inet_col".into(),
                r#type: "inet".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "json_col".into(),
                r#type: "jsonb".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "jsonb_col".into(),
                r#type: "jsonb".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "uuid_col".into(),
                r#type: "uuid".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "array_col".into(),
                r#type: "int4[]".into(),
                is_nullable: true,
            },
            SchemaColumn {
                name: "null_bool_col".into(),
                r#type: "bool".into(),
                is_nullable: true,
            },
        ];

        let columns = &schema.tables.get("all_native_data_types").unwrap().columns;

        for (index, column) in columns.iter().enumerate() {
            assert_eq!(column, &expected[index]);
        }
    }
}
