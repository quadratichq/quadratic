use axum::{extract::Path, response::IntoResponse, Extension, Json};
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::{snowflake_connection::SnowflakeConnection, Connection},
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
pub(crate) async fn test(
    state: Extension<State>,
    Json(connection): Json<SnowflakeConnection>,
) -> Json<TestResponse> {
    let sql_query = SqlQuery {
        query: "SELECT 1".into(),
        connection_id: Uuid::new_v4(), // This is not used
    };
    let response = query_generic::<SnowflakeConnection>(connection, state, sql_query.into()).await;
    let message = match response {
        Ok(_) => None,
        Err(e) => Some(e.to_string()),
    };

    TestResponse::new(message.is_none(), message).into()
}

/// Get the connection details from the API and create a MySqlConnection.
async fn get_connection(
    state: &State,
    claims: &Claims,
    connection_id: &Uuid,
) -> Result<(SnowflakeConnection, ApiConnection<SnowflakeConnection>)> {
    let connection = if cfg!(not(test)) {
        get_api_connection(state, "", &claims.sub, connection_id).await?
    } else {
        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            created_date: "".into(),
            updated_date: "".into(),
            type_details: SnowflakeConnection {
                account_identifier: "0.0.0.0".into(),
                username: "sa".into(),
                password: "yourStrong(!)Password".into(),
                database: "AllTypes".into(),
                warehouse: None,
                schema: None,
                role: None,
            },
        }
    };

    let snowflake_connection = SnowflakeConnection::new(
        connection.type_details.account_identifier.to_owned(),
        connection.type_details.username.to_owned(),
        connection.type_details.password.to_owned(),
        None,
        connection.type_details.database.to_owned(),
        None,
        None,
    );

    Ok((snowflake_connection, connection))
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
    query_generic::<SnowflakeConnection>(connection, state, sql_query).await
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

    use std::str::FromStr;

    use super::*;
    use crate::{
        num_vec, test_connection,
        test_util::{get_claims, new_state, response_bytes, str_vec, validate_parquet},
    };
    use arrow::datatypes::Date32Type;
    use arrow_schema::{DataType, TimeUnit};
    use bytes::Bytes;
    use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime, Timelike};
    use http::StatusCode;
    use quadratic_rust_shared::sql::schema::{SchemaColumn, SchemaTable};
    use tracing_test::traced_test;
    use uuid::Uuid;

    #[tokio::test]
    #[traced_test]
    async fn mssql_test_connection() {
        test_connection!(get_connection);
    }

    #[tokio::test]
    #[traced_test]
    async fn mssql_schema() {
        let connection_id = Uuid::new_v4();
        let state = Extension(new_state().await);
        let response = schema(Path(connection_id), state, get_claims())
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
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
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
                num_vec!(NaiveTime::from_str("12:34:56.123456700")
                    .unwrap()
                    .num_seconds_from_midnight()),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(NaiveDateTime::from_str("2024-05-28T12:34:56.123456700")
                    .unwrap()
                    .and_utc()
                    .timestamp_millis()),
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
                num_vec!(NaiveDateTime::from_str("2024-05-28T12:34:56")
                    .unwrap()
                    .and_utc()
                    .timestamp_millis()),
            ),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                num_vec!(NaiveDateTime::from_str("2024-05-28T12:34:00")
                    .unwrap()
                    .and_utc()
                    .timestamp_millis()),
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
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
        let response = data.into_response();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_bytes(response).await;
        assert_eq!(body, Bytes::new());
    }
}
