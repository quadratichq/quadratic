use axum::{extract::Path, response::IntoResponse, Extension, Json};
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::{mysql_connection::MySqlConnection, Connection},
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::get_api_connection,
    error::Result,
    server::{test_connection, SqlQuery, TestResponse},
    state::State,
};

use super::{query_generic, Schema};

/// Test the connection to the database.
pub(crate) async fn test(Json(connection): Json<MySqlConnection>) -> Json<TestResponse> {
    test_connection(connection).await
}

/// Get the connection details from the API and create a MySqlConnection.
async fn get_connection(
    state: &State,
    claims: &Claims,
    connection_id: &Uuid,
) -> Result<(MySqlConnection, ApiConnection)> {
    let connection = if cfg!(not(test)) {
        get_api_connection(state, "", &claims.sub, connection_id).await?
    } else {
        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            created_date: "".into(),
            updated_date: "".into(),
            type_details: quadratic_rust_shared::quadratic_api::TypeDetails {
                host: "0.0.0.0".into(),
                port: Some("3306".into()),
                username: Some("user".into()),
                password: Some("password".into()),
                database: "mysql-connection".into(),
            },
        }
    };

    let pg_connection = MySqlConnection::new(
        connection.type_details.username.to_owned(),
        connection.type_details.password.to_owned(),
        connection.type_details.host.to_owned(),
        connection.type_details.port.to_owned(),
        Some(connection.type_details.database.to_owned()),
    );

    Ok((pg_connection, connection))
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    state: Extension<State>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let connection = get_connection(&state, &claims, &sql_query.connection_id)
        .await?
        .0;
    query_generic::<MySqlConnection>(connection, state, sql_query).await
}

/// Get the schema of the database
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    state: Extension<State>,
    claims: Claims,
) -> Result<Json<Schema>> {
    let (connection, api_connection) = get_connection(&state, &claims, &id).await?;
    let mut pool = connection.connect().await?;
    let database_schema = connection.schema(&mut pool).await?;
    let schema = Schema {
        id: api_connection.uuid,
        name: api_connection.name,
        r#type: api_connection.r#type,
        database: api_connection.type_details.database,
        tables: database_schema.tables.into_values().collect(),
    };

    Ok(Json(schema))
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::{
        num_vec, test_connection,
        test_util::{get_claims, new_state, response_bytes, str_vec, validate_parquet},
    };
    use arrow::datatypes::Date32Type;
    use arrow_schema::{DataType, TimeUnit};
    use bytes::Bytes;
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Timelike};
    use http::StatusCode;
    use quadratic_rust_shared::sql::schema::{SchemaColumn, SchemaTable};
    use tracing_test::traced_test;
    use uuid::Uuid;

    #[tokio::test]
    #[traced_test]
    async fn mysql_test_connection() {
        test_connection!(get_connection);
    }

    #[tokio::test]
    #[traced_test]
    async fn mysql_schema() {
        let connection_id = Uuid::new_v4();
        let state = Extension(new_state().await);
        let response = schema(Path(connection_id), state, get_claims())
            .await
            .unwrap();

        let expected = Schema {
            id: response.0.id,
            name: "".into(),
            r#type: "".into(),
            database: "mysql-connection".into(),
            tables: vec![SchemaTable {
                name: "all_native_data_types".into(),
                schema: "mysql-connection".into(),
                columns: vec![
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
                ],
            }],
        };

        assert_eq!(response.0, expected);
    }

    #[tokio::test]
    #[traced_test]
    async fn mysql_query_all_data_types() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types order by id limit 1".into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
        let response = data.into_response();

        let expected = vec![
            (DataType::Int32, num_vec!(1_i32)),
            (DataType::Int8, num_vec!(127_i8)),
            (DataType::Int16, num_vec!(32767_i16)),
            (DataType::Int32, num_vec!(8388607_i32)),
            (DataType::Int32, num_vec!(2147483647_i32)),
            (DataType::Int64, num_vec!(9223372036854775807_i64)),
            (DataType::Float64, num_vec!(12345.67_f64)),
            (DataType::Float32, num_vec!(123.45_f32)),
            (DataType::Float64, num_vec!(123456789.123456_f64)),
            (DataType::UInt64, num_vec!(1_u64)),
            (DataType::Utf8, str_vec("char_data")),
            (DataType::Utf8, str_vec("varchar_data")),
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, str_vec("tinytext_data")),
            (DataType::Utf8, str_vec("text_data")),
            (DataType::Utf8, str_vec("mediumtext_data")),
            (DataType::Utf8, str_vec("longtext_data")),
            (DataType::Utf8, str_vec("value1")),
            (DataType::Utf8, str_vec("value1,value2")),
            (
                DataType::Date32,
                num_vec!(Date32Type::from_naive_date(
                    NaiveDate::parse_from_str("2024-05-28", "%Y-%m-%d").unwrap(),
                )),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    NaiveDateTime::parse_from_str("2024-05-28 12:34:56", "%Y-%m-%d %H:%M:%S")
                        .unwrap()
                        .and_utc()
                        .timestamp_millis()
                ),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    NaiveDateTime::parse_from_str("2024-05-28 12:34:56", "%Y-%m-%d %H:%M:%S")
                        .unwrap()
                        .and_utc()
                        .timestamp_millis()
                ),
            ),
            (
                DataType::Time32(TimeUnit::Second),
                num_vec!(NaiveTime::parse_from_str("12:34:56", "%H:%M:%S")
                    .unwrap()
                    .num_seconds_from_midnight()),
            ),
            (DataType::UInt16, num_vec!(2024_u16)),
            (DataType::Utf8, str_vec(r#"{"key":"value"}"#)),
        ];

        validate_parquet(response, expected).await;
        // assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    #[traced_test]
    async fn mysql_query_max_response_bytes() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types order by id limit 1".into(),
            connection_id,
        };
        let mut state = Extension(new_state().await);
        state.settings.max_response_bytes = 0;
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
        let response = data.into_response();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_bytes(response).await;
        assert_eq!(body, Bytes::new());
    }
}
