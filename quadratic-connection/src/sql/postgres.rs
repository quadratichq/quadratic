use axum::{Extension, Json, debug_handler, extract::Path, response::IntoResponse};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::{Connection, postgres_connection::PostgresConnection},
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::{get_api_connection, get_api_team},
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse, test_connection},
    ssh::open_ssh_tunnel_for_connection,
    state::State,
};

use super::{Schema, query_generic};

/// Test the connection to the database.
// #[axum::debug_handler]
pub(crate) async fn test(
    headers: HeaderMap,
    state: Extension<State>,
    claims: Claims,
    Json(mut connection): Json<PostgresConnection>,
) -> Result<Json<TestResponse>> {
    let team_id = get_team_id_header(&headers)?;
    let team = get_api_team(&state, "", &claims.sub, &team_id).await?;
    connection.ssh_key = Some(team.ssh_private_key);

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
) -> Result<(PostgresConnection, ApiConnection<PostgresConnection>)> {
    let connection = get_api_connection(state, "", &claims.sub, connection_id, team_id).await?;

    Ok(((&connection).into(), connection))
}

// /// Get the connection details from the API and create a PostgresConnection.
// async fn get_connection(
//     state: &State,
//     claims: &Claims,
//     connection_id: &Uuid,
// ) -> Result<(PostgresConnection, ApiConnection<PostgresConnection>)> {
//     let connection = if cfg!(not(test)) {
//         get_api_connection(state, "", &claims.sub, connection_id).await?
//     } else {
//         let ssh_config = quadratic_rust_shared::net::ssh::tests::get_ssh_config();
//         ApiConnection {
//             uuid: Uuid::new_v4(),
//             name: "".into(),
//             r#type: "".into(),
//             created_date: "".into(),
//             updated_date: "".into(),
//             type_details: PostgresConnection {
//                 // host: "0.0.0.0".into(),
//                 // port: Some("5433".into()),
//                 // username: Some("user".into()),
//                 // password: Some("password".into()),
//                 // database: "postgres-connection".into(),
//                 host: "localhost".into(),
//                 port: Some("5432".into()),
//                 username: Some("dbuser".into()),
//                 password: Some("dbpassword".into()),
//                 database: "mydb".into(),
//                 use_ssh: Some(true),
//                 ssh_host: Some(ssh_config.host.to_string()),
//                 ssh_port: Some(ssh_config.port.to_string()),
//                 ssh_username: Some(ssh_config.username.to_string()),
//                 ssh_key: Some(ssh_config.private_key.to_string()),
//             },
//         }
//     };

//     let pg_connection = PostgresConnection::from(&connection);

//     Ok((pg_connection, connection))
// }

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    headers: HeaderMap,
    state: Extension<State>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let connection = get_connection(&state, &claims, &sql_query.connection_id, &team_id)
        .await?
        .0;

    query_with_connection(state, sql_query, connection).await
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query_with_connection(
    state: Extension<State>,
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
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    state: Extension<State>,
    claims: Claims,
) -> Result<Json<Schema>> {
    let team_id = get_team_id_header(&headers)?;
    let (connection, api_connection) = get_connection(&state, &claims, &id, &team_id).await?;
    let mut pool = connection.connect().await?;
    let database_schema = connection.schema(&mut pool).await?;

    if let Some(mut tunnel) = tunnel {
        tunnel.close().await?;
    }

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
pub mod tests {
    use super::*;
    use crate::{
        num_vec, test_connection,
        test_util::{
            get_claims, new_state, new_team_id_with_header, response_bytes, str_vec,
            validate_parquet,
        },
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

    // #[tokio::test]
    // #[traced_test]
    // async fn postgres_test_connection() {
    //     test_connection!(get_connection);
    // }

    #[tokio::test]
    #[traced_test]
    async fn postgres_schema() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
        let state = Extension(new_state().await);
        let response = schema(Path(connection_id), headers, state, get_claims())
            .await
            .unwrap();

        let expected = Schema {
            id: response.0.id,
            name: "".into(),
            r#type: "".into(),
            database: "postgres-connection".into(),
            tables: vec![SchemaTable {
                name: "all_native_data_types".into(),
                schema: "public".into(),
                columns: vec![
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
                        name: "money_col".into(),
                        r#type: "money".into(),
                        is_nullable: true,
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
                        name: "point_col".into(),
                        r#type: "point".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "line_col".into(),
                        r#type: "line".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "lseg_col".into(),
                        r#type: "lseg".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "box_col".into(),
                        r#type: "box".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "path_col".into(),
                        r#type: "path".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "polygon_col".into(),
                        r#type: "polygon".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "circle_col".into(),
                        r#type: "circle".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "cidr_col".into(),
                        r#type: "cidr".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "inet_col".into(),
                        r#type: "inet".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "macaddr_col".into(),
                        r#type: "macaddr".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "json_col".into(),
                        r#type: "json".into(),
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
                        name: "xml_col".into(),
                        r#type: "xml".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "array_col".into(),
                        r#type: "_int4".into(),
                        is_nullable: true,
                    },
                ],
            }],
        };
        assert_eq!(response.0, expected)
    }

    #[tokio::test]
    #[traced_test]
    async fn postgres_query_all_data_types() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types order by id limit 1".into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let data = query(headers, state, get_claims(), Json(sql_query))
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
            (DataType::Utf8, vec![]), // unsupported
        ];

        validate_parquet(response, expected).await;
        // assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    #[traced_test]
    async fn postgres_query_max_response_bytes() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
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
