use std::sync::Arc;

use axum::{
    Extension, Json,
    extract::{Path, Query},
    response::IntoResponse,
};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection, sql::mysql_connection::MySqlConnection,
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::{add_key_to_connection, get_api_connection},
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse, test_connection},
    ssh::open_ssh_tunnel_for_connection,
    state::State,
};

use super::{Schema, SchemaQuery, query_generic, schema_generic_with_ssh};

/// Test the connection to the database.
pub(crate) async fn test(
    headers: HeaderMap,
    state: Extension<Arc<State>>,
    claims: Claims,
    Json(mut connection): Json<MySqlConnection>,
) -> Result<Json<TestResponse>> {
    add_key_to_connection(&mut connection, &state, &headers, &claims).await?;

    let tunnel = open_ssh_tunnel_for_connection(&mut connection).await?;
    let result = test_connection(connection).await;

    if let Some(mut tunnel) = tunnel {
        tunnel.close().await?;
    }

    Ok(result)
}

/// Get the connection details from the API and create a PostgresConnection.
async fn get_connection(
    state: &State,
    claims: &Claims,
    connection_id: &Uuid,
    team_id: &Uuid,
    headers: &HeaderMap,
) -> Result<ApiConnection<MySqlConnection>> {
    let connection =
        get_api_connection(state, "", &claims.email, connection_id, team_id, headers).await?;

    Ok(connection)
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    headers: HeaderMap,
    state: Extension<Arc<State>>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let connection = get_connection(
        &state,
        &claims,
        &sql_query.connection_id,
        &team_id,
        &headers,
    )
    .await?;

    query_with_connection(state, sql_query, connection.type_details).await
}

pub(crate) async fn query_with_connection(
    state: Extension<Arc<State>>,
    sql_query: Json<SqlQuery>,
    mut connection: MySqlConnection,
) -> Result<impl IntoResponse> {
    let tunnel = open_ssh_tunnel_for_connection(&mut connection).await?;
    let result = query_generic::<MySqlConnection>(connection, state, sql_query).await?;

    if let Some(mut tunnel) = tunnel {
        tunnel.close().await?;
    }

    Ok(result)
}

/// Get the schema of the database
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    state: Extension<Arc<State>>,
    claims: Claims,
    Query(params): Query<SchemaQuery>,
) -> Result<Json<Schema>> {
    let team_id = get_team_id_header(&headers)?;
    let api_connection = get_connection(&state, &claims, &id, &team_id, &headers).await?;

    schema_generic_with_ssh(api_connection, state, params).await
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::{
        num_vec, test_connection,
        test_util::{new_state, response_bytes, str_vec, validate_parquet},
    };
    use arrow::datatypes::Date32Type;
    use arrow_schema::{DataType, TimeUnit};
    use bytes::Bytes;
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Timelike};
    use http::StatusCode;
    use quadratic_rust_shared::{
        net::ssh::tests::get_ssh_config,
        sql::schema::{SchemaColumn, SchemaTable},
    };
    use tracing_test::traced_test;
    use uuid::Uuid;

    fn get_connection(ssh: bool) -> ApiConnection<MySqlConnection> {
        let type_details = if ssh {
            let mut ssh_config = get_ssh_config();
            ssh_config.port = 2223;

            MySqlConnection {
                host: "localhost".into(),
                port: Some("3306".into()),
                username: Some("dbuser".into()),
                password: Some("dbpassword".into()),
                database: "mydb".into(),
                use_ssh: Some(true),
                ssh_host: Some(ssh_config.host.to_string()),
                ssh_port: Some(ssh_config.port.to_string()),
                ssh_username: Some(ssh_config.username.to_string()),
                ssh_key: Some(ssh_config.private_key.to_string()),
            }
        } else {
            MySqlConnection {
                host: "0.0.0.0".into(),
                port: Some("3306".into()),
                username: Some("user".into()),
                password: Some("password".into()),
                database: "mysql-connection".into(),
                use_ssh: Some(false),
                ssh_host: None,
                ssh_port: None,
                ssh_username: None,
                ssh_key: None,
            }
        };

        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            type_details,
        }
    }

    #[tokio::test]
    #[traced_test]
    async fn mysql_test_connection() {
        let connection = get_connection(false);
        test_connection!(connection.type_details);
    }

    #[tokio::test]
    #[traced_test]
    async fn mysql_schema() {
        let api_connection = get_connection(false);
        let state = Extension(Arc::new(new_state().await));
        let params = SchemaQuery::forced_cache_refresh();
        let response = schema_generic_with_ssh(api_connection, state, params)
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
                    SchemaColumn {
                        name: "null_bool_col".into(),
                        r#type: "tinyint".into(),
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
        let state = Extension(Arc::new(new_state().await));
        let connection = get_connection(false);
        let data = query_with_connection(state, Json(sql_query), connection.type_details)
            .await
            .unwrap();
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
                num_vec!(
                    NaiveTime::parse_from_str("12:34:56", "%H:%M:%S")
                        .unwrap()
                        .num_seconds_from_midnight()
                ),
            ),
            (DataType::UInt16, num_vec!(2024_u16)),
            (DataType::Utf8, str_vec(r#"{"key":"value"}"#)),
            (DataType::Utf8, vec![]), // null
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
        let mut test_state = new_state().await;
        test_state.settings.max_response_bytes = 0;
        let state = Extension(Arc::new(test_state));
        let connection = get_connection(false);
        let data = query_with_connection(state, Json(sql_query), connection.type_details)
            .await
            .unwrap();
        let response = data.into_response();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_bytes(response).await;
        assert_eq!(body, Bytes::new());
    }

    #[tokio::test]
    #[traced_test]
    async fn mysql_test_connection_with_ssh() {
        let connection = get_connection(true);
        let result = query_with_connection(
            Extension(Arc::new(new_state().await)),
            Json(SqlQuery {
                query: "SELECT * FROM INFORMATION_SCHEMA.COLUMNS LIMIT 1".into(),
                connection_id: Uuid::new_v4(),
            }),
            connection.type_details,
        )
        .await
        .unwrap();

        println!("result: {:?}", result.into_response());
    }
}
