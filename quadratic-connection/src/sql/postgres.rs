use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection, sql::postgres_connection::PostgresConnection,
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::{add_key_to_connection, get_api_connection},
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse, test_connection},
    sql::SchemaQuery,
    ssh::open_ssh_tunnel_for_connection,
    state::State as AppState,
};

use super::{Schema, query_generic, schema_generic_with_ssh};

/// Test the connection to the database.
// #[axum::debug_handler]
pub(crate) async fn test(
    headers: HeaderMap,
    state: Extension<AppState>,
    claims: Claims,
    Json(mut connection): Json<PostgresConnection>,
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
    state: &AppState,
    claims: &Claims,
    connection_id: &Uuid,
    team_id: &Uuid,
) -> Result<ApiConnection<PostgresConnection>> {
    let connection = get_api_connection(state, "", &claims.sub, connection_id, team_id).await?;

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
    let connection = get_connection(&state, &claims, &sql_query.connection_id, &team_id).await?;

    query_with_connection(state, sql_query, connection.type_details).await
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query_with_connection(
    state: Extension<AppState>,
    sql_query: Json<SqlQuery>,
    mut connection: PostgresConnection,
) -> Result<impl IntoResponse> {
    let tunnel = open_ssh_tunnel_for_connection(&mut connection).await?;
    let result = query_generic::<PostgresConnection>(connection, state, sql_query).await?;

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
    let api_connection = get_connection(&state, &claims, &id, &team_id).await?;

    schema_generic_with_ssh(api_connection, Extension(state), params).await
}

#[cfg(test)]
pub mod tests {
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
        net::ssh::tests::get_ssh_config, sql::postgres_connection::tests::expected_postgres_schema,
    };
    use tracing_test::traced_test;
    use uuid::Uuid;

    fn get_connection(ssh: bool) -> ApiConnection<PostgresConnection> {
        let type_details = if ssh {
            let ssh_config = get_ssh_config();

            PostgresConnection {
                host: "localhost".into(),
                port: Some("5432".into()),
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
            PostgresConnection {
                host: "0.0.0.0".into(),
                port: Some("5433".into()),
                username: Some("user".into()),
                password: Some("password".into()),
                database: "postgres-connection".into(),
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
    async fn postgres_test_connection() {
        let connection = get_connection(false);
        test_connection!(connection.type_details);
    }

    #[tokio::test]
    #[traced_test]
    async fn postgres_schema() {
        let state = new_state().await;
        let api_connection = get_connection(false);
        let api_connection_id = api_connection.uuid;
        let params = SchemaQuery::forced_cache_refresh();
        let response = schema_generic_with_ssh(api_connection, Extension(state.clone()), params)
            .await
            .unwrap();
        let columns = &response
            .0
            .tables
            .iter()
            .find(|table| table.name == "all_native_data_types")
            .unwrap()
            .columns;

        let expected = expected_postgres_schema();
        assert_eq!(columns, &expected);

        // check that the schema was added to the cache
        assert_eq!(
            state.cache.get_schema(api_connection_id).await.unwrap(),
            response.0
        );
    }

    #[tokio::test]
    #[traced_test]
    async fn postgres_query_all_data_types() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types order by id limit 1".into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let connection = get_connection(false);
        let data = query_with_connection(state, Json(sql_query), connection.type_details)
            .await
            .unwrap();
        let response = data.into_response();

        let expected = vec![
            (DataType::Int32, num_vec!(1_i32)),
            (DataType::Int16, num_vec!(32767_i16)),
            (DataType::Int32, num_vec!(2147483647_i32)),
            (DataType::Int64, num_vec!(9223372036854775807_i64)),
            (DataType::Float64, num_vec!(12345.67_f64)),
            (DataType::Float64, num_vec!(12345.67_f64)),
            (DataType::Float32, num_vec!(123.45_f32)),
            (DataType::Float64, num_vec!(123456789.123456_f64)),
            (DataType::Int32, num_vec!(1_i32)),
            (DataType::Int64, num_vec!(1_i64)),
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, str_vec("char_data ")),
            (DataType::Utf8, str_vec("varchar_data")),
            (DataType::Utf8, str_vec("text_data")),
            (DataType::Utf8, vec![]), // unsupported
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    NaiveDateTime::parse_from_str("2024-05-20 12:34:56", "%Y-%m-%d %H:%M:%S")
                        .unwrap()
                        .and_utc()
                        .timestamp_millis()
                ),
            ), // unsupported
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(
                    NaiveDateTime::parse_from_str("2024-05-20 06:34:56+00", "%Y-%m-%d %H:%M:%S%#z")
                        .unwrap()
                        .and_utc()
                        .timestamp_millis()
                ),
            ),
            (
                DataType::Date32,
                num_vec!(Date32Type::from_naive_date(
                    NaiveDate::parse_from_str("2024-05-20", "%Y-%m-%d").unwrap(),
                )),
            ),
            (
                DataType::Time32(TimeUnit::Second),
                num_vec!(
                    NaiveTime::parse_from_str("12:34:56", "%H:%M:%S")
                        .unwrap()
                        .num_seconds_from_midnight()
                ),
            ),
            (
                DataType::Time32(TimeUnit::Second),
                num_vec!(
                    NaiveTime::parse_from_str("12:34:56+09:30", "%H:%M:%S%z")
                        .unwrap()
                        .num_seconds_from_midnight()
                ),
            ),
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Boolean, vec![1]),
            (DataType::Utf8, str_vec("value1")),
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, str_vec(r#"{"key":"value"}"#)),
            (DataType::Utf8, str_vec(r#"{"key":"value"}"#)),
            (
                DataType::Utf8,
                str_vec("123e4567-e89b-12d3-a456-426614174000"),
            ),
            (DataType::Utf8, vec![]), // unsupported
            (DataType::Utf8, str_vec("1,2,3")),
            (DataType::Utf8, str_vec("32767,16384,8192")),
            (
                DataType::Utf8,
                str_vec("9223372036854775807,4611686018427387903,2305843009213693951"),
            ),
            (DataType::Utf8, str_vec("123.45,67.89,12.34")),
            (DataType::Utf8, str_vec("123.45,67.89,12.34")),
            (
                DataType::Utf8,
                str_vec("123456789.123456,987654321.987654,555555555.555555"),
            ),
            (DataType::Utf8, str_vec("text1,text2,text3")),
            (DataType::Utf8, str_vec("varchar1,varchar2,varchar3")),
            (DataType::Utf8, str_vec("true,false,true")),
            (
                DataType::Utf8,
                str_vec("2024-05-20 12:34:56,2024-06-15 15:30:00,2024-07-10 09:15:30"),
            ),
            (DataType::Utf8, str_vec("2024-05-20,2024-06-15,2024-07-10")),
            (
                DataType::Utf8,
                str_vec("{\"key1\":\"value1\"},{\"key2\":\"value2\"},{\"key3\":\"value3\"}"),
            ), // unsupported
            (DataType::Utf8, vec![]), // null
        ];

        validate_parquet(response, expected).await;
        // assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    #[traced_test]
    async fn postgres_query_max_response_bytes() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types order by id limit 1".into(),
            connection_id,
        };
        let mut state = Extension(new_state().await);
        state.settings.max_response_bytes = 0;
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
    async fn postgres_test_connection_with_ssh() {
        let connection = get_connection(true);
        let result = query_with_connection(
            Extension(new_state().await),
            Json(SqlQuery {
                query: "SELECT * FROM pg_catalog.pg_tables;".into(),
                connection_id: Uuid::new_v4(),
            }),
            connection.type_details,
        )
        .await
        .unwrap();

        println!("result: {:?}", result.into_response());
    }
}
