use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection, sql::mssql_connection::MsSqlConnection,
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::{add_key_to_connection, get_api_connection},
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse, test_connection},
    ssh::open_ssh_tunnel_for_connection,
    state::State as AppState,
};

use super::{Schema, SchemaQuery, query_generic, schema_generic_with_ssh};

/// Test the connection to the database.
pub(crate) async fn test(
    headers: HeaderMap,
    state: Extension<AppState>,
    claims: Claims,
    Json(mut connection): Json<MsSqlConnection>,
) -> Result<Json<TestResponse>> {
    add_key_to_connection(&mut connection, &state, &headers, &claims).await?;

    let tunnel = open_ssh_tunnel_for_connection(&mut connection).await?;
    let result = test_connection(connection).await;
    tracing::info!("result: {:?}", result);

    if let Some(mut tunnel) = tunnel {
        tunnel.close().await?;
    }

    Ok(result)
}

/// Get the connection details from the API and create a MySqlConnection.
async fn get_connection(
    state: &AppState,
    claims: &Claims,
    connection_id: &Uuid,
    team_id: &Uuid,
    headers: &HeaderMap,
) -> Result<ApiConnection<MsSqlConnection>> {
    let connection = if cfg!(not(test)) {
        get_api_connection(state, "", &claims.sub, connection_id, team_id, &headers).await?
    } else {
        let ssh_config = quadratic_rust_shared::net::ssh::tests::get_ssh_config();
        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            created_date: "".into(),
            updated_date: "".into(),
            type_details: MsSqlConnection {
                host: "0.0.0.0".into(),
                port: Some("1433".into()),
                username: Some("sa".into()),
                password: Some("yourStrong(!)Password".into()),
                database: "AllTypes".into(),
                use_ssh: Some(true),
                ssh_host: Some(ssh_config.host.to_string()),
                ssh_port: Some(ssh_config.port.to_string()),
                ssh_username: Some(ssh_config.username.to_string()),
                ssh_key: Some(ssh_config.private_key.to_string()),
            },
        }
    };

    Ok(connection)
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    headers: HeaderMap,
    state: Extension<AppState>,
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
    state: Extension<AppState>,
    sql_query: Json<SqlQuery>,
    mut connection: MsSqlConnection,
) -> Result<impl IntoResponse> {
    let tunnel = open_ssh_tunnel_for_connection(&mut connection).await?;
    let result = query_generic::<MsSqlConnection>(connection, state, sql_query).await?;

    if let Some(mut tunnel) = tunnel {
        tunnel.close().await?;
    }

    Ok(result)
}

/// Get the schema of the database
#[axum::debug_handler]
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<SchemaQuery>,
) -> Result<Json<Schema>> {
    let team_id = get_team_id_header(&headers)?;
    let api_connection = get_connection(&state, &claims, &id, &team_id, &headers).await?;

    schema_generic_with_ssh(api_connection, Extension(state), params).await
}

#[cfg(test)]
mod tests {

    use std::str::FromStr;

    use super::*;
    use crate::{
        num_vec, test_connection,
        test_util::{new_state, response_bytes, str_vec, validate_parquet},
    };
    use arrow::datatypes::Date32Type;
    use arrow_schema::{DataType, TimeUnit};
    use bytes::Bytes;
    use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime, Timelike};
    use http::StatusCode;
    use quadratic_rust_shared::{
        net::ssh::tests::get_ssh_config,
        sql::schema::{SchemaColumn, SchemaTable},
    };
    use tracing_test::traced_test;
    use uuid::Uuid;

    fn get_connection(ssh: bool) -> ApiConnection<MsSqlConnection> {
        let type_details = if ssh {
            let mut ssh_config = get_ssh_config();
            ssh_config.port = 2224;

            MsSqlConnection {
                host: "localhost".into(),
                port: Some("1433".into()),
                username: Some("sa".into()),
                password: Some("yourStrong(!)Password".into()),
                database: "AllTypes".into(),
                use_ssh: Some(true),
                ssh_host: Some(ssh_config.host.to_string()),
                ssh_port: Some(ssh_config.port.to_string()),
                ssh_username: Some(ssh_config.username.to_string()),
                ssh_key: Some(ssh_config.private_key.to_string()),
            }
        } else {
            MsSqlConnection {
                host: "0.0.0.0".into(),
                port: Some("1433".into()),
                username: Some("sa".into()),
                password: Some("yourStrong(!)Password".into()),
                database: "AllTypes".into(),
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
            created_date: "".into(),
            updated_date: "".into(),
            type_details,
        }
    }

    #[tokio::test]
    #[traced_test]
    async fn mssql_test_connection() {
        let connection = get_connection(false);
        test_connection!(connection.type_details);
    }

    #[tokio::test]
    #[traced_test]
    async fn mssql_schema() {
        let api_connection = get_connection(false);
        let state = Extension(new_state().await);
        let params = SchemaQuery::forced_cache_refresh();
        let response = schema_generic_with_ssh(api_connection, state, params)
            .await
            .unwrap();

        let expected = Schema {
            id: response.0.id,
            name: "".into(),
            r#type: "".into(),
            database: "AllTypes".into(),
            tables: vec![SchemaTable {
                name: "all_native_data_types".into(),
                schema: "dbo".into(),
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
                        name: "bit_col".into(),
                        r#type: "bit".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "decimal_col".into(),
                        r#type: "decimal".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "numeric_col".into(),
                        r#type: "numeric".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "money_col".into(),
                        r#type: "money".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "smallmoney_col".into(),
                        r#type: "smallmoney".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "float_col".into(),
                        r#type: "float".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "real_col".into(),
                        r#type: "real".into(),
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
                        name: "datetime2_col".into(),
                        r#type: "datetime2".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "datetimeoffset_col".into(),
                        r#type: "datetimeoffset".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "datetime_col".into(),
                        r#type: "datetime".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "smalldatetime_col".into(),
                        r#type: "smalldatetime".into(),
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
                        name: "text_col".into(),
                        r#type: "text".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "nchar_col".into(),
                        r#type: "nchar".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "nvarchar_col".into(),
                        r#type: "nvarchar".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "ntext_col".into(),
                        r#type: "ntext".into(),
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
                        name: "image_col".into(),
                        r#type: "image".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "json_col".into(),
                        r#type: "nvarchar".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "uniqueidentifier_col".into(),
                        r#type: "uniqueidentifier".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "xml_col".into(),
                        r#type: "xml".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "varchar_max_col".into(),
                        r#type: "varchar".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "nvarchar_max_col".into(),
                        r#type: "nvarchar".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "varbinary_max_col".into(),
                        r#type: "varbinary".into(),
                        is_nullable: true,
                    },
                ],
            }],
        };

        assert_eq!(response.0, expected);
    }

    #[tokio::test]
    #[traced_test]
    async fn mssql_query_all_data_types() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "SELECT TOP 1 * FROM [dbo].[all_native_data_types] ORDER BY id".into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let connection = get_connection(false);
        let data = query_with_connection(state, Json(sql_query), (&connection).into())
            .await
            .unwrap();
        let response = data.into_response();

        let expected = vec![
            (DataType::Int32, num_vec!(1_i32)),
            (DataType::UInt8, num_vec!(255_u8)),
            (DataType::Int16, num_vec!(32767_i16)),
            (DataType::Int32, num_vec!(2147483647_i32)),
            (DataType::Int64, num_vec!(9223372036854775807_i64)),
            (DataType::Boolean, num_vec!(1_u8)),
            (DataType::Float64, num_vec!(12345.67_f64)),
            (DataType::Float64, num_vec!(12345.67_f64)),
            (DataType::Float64, num_vec!(922337203685477.6_f64)),
            (DataType::Float64, num_vec!(214748.3647_f64)),
            (DataType::Float64, num_vec!(123456789.123456_f64)),
            (DataType::Float32, num_vec!(123456.79_f32)),
            (
                DataType::Date32,
                num_vec!(Date32Type::from_naive_date(
                    NaiveDate::parse_from_str("2024-05-28", "%Y-%m-%d").unwrap(),
                )),
            ),
            (
                DataType::Time32(TimeUnit::Second),
                num_vec!(
                    NaiveTime::from_str("12:34:56.123456700")
                        .unwrap()
                        .num_seconds_from_midnight()
                ),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    NaiveDateTime::from_str("2024-05-28T12:34:56.123456700")
                        .unwrap()
                        .and_utc()
                        .timestamp_millis()
                ),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    DateTime::<Local>::from_str("2024-05-28T16:04:56.123456700+05:30")
                        .unwrap()
                        .timestamp_millis()
                ),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    NaiveDateTime::from_str("2024-05-28T12:34:56")
                        .unwrap()
                        .and_utc()
                        .timestamp_millis()
                ),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    NaiveDateTime::from_str("2024-05-28T12:34:00")
                        .unwrap()
                        .and_utc()
                        .timestamp_millis()
                ),
            ),
            (DataType::Utf8, str_vec("CHAR      ")),
            (DataType::Utf8, str_vec("VARCHAR")),
            (DataType::Utf8, str_vec("TEXT")),
            (DataType::Utf8, str_vec("NCHAR     ")),
            (DataType::Utf8, str_vec("NVARCHAR")),
            (DataType::Utf8, str_vec("NTEXT")),
            (
                DataType::Utf8,
                str_vec("\u{1}\u{2}\u{3}\u{4}\u{5}\0\0\0\0\0"),
            ),
            (DataType::Utf8, str_vec("\u{1}\u{2}\u{3}\u{4}\u{5}")),
            (DataType::Utf8, str_vec("\u{1}\u{2}\u{3}\u{4}\u{5}")),
            (DataType::Utf8, str_vec("{\"key\": \"value\"}")),
            (
                DataType::Utf8,
                str_vec("abcb8303-a0a2-4392-848b-3b32181d224b"),
            ),
            (
                DataType::Utf8,
                str_vec("<root><element>value</element></root>"),
            ),
            (DataType::Utf8, str_vec("A".repeat(8000).as_str())),
            (DataType::Utf8, str_vec("A".repeat(4000).as_str())),
            (DataType::Utf8, str_vec("A".repeat(8000).as_str())),
        ];

        validate_parquet(response, expected).await;
        // assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    #[traced_test]
    async fn mssql_query_max_response_bytes() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "SELECT TOP 1 * FROM [dbo].[all_native_data_types] ORDER BY id".into(),
            connection_id,
        };
        let mut state = Extension(new_state().await);
        state.settings.max_response_bytes = 0;
        let connection = get_connection(false);
        let data = query_with_connection(state, Json(sql_query), (&connection).into())
            .await
            .unwrap();
        let response = data.into_response();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_bytes(response).await;
        assert_eq!(body, Bytes::new());
    }

    #[tokio::test]
    #[traced_test]
    async fn mssql_test_connection_with_ssh() {
        let connection = get_connection(true);
        let result = query_with_connection(
            Extension(new_state().await),
            Json(SqlQuery {
                query: "SELECT * FROM ALL_NATIVE_DATA_TYPES".into(),
                connection_id: Uuid::new_v4(),
            }),
            connection.type_details,
        )
        .await
        .unwrap();

        println!("result: {:?}", result.into_response());
    }
}
