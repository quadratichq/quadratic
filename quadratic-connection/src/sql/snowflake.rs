use axum::{Extension, Json, extract::Path, response::IntoResponse};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection, sql::snowflake_connection::SnowflakeConnection,
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::get_api_connection,
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse},
    state::State,
};

use super::{Schema, query_generic, schema_generic};

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
    team_id: &Uuid,
) -> Result<ApiConnection<SnowflakeConnection>> {
    let connection = if cfg!(not(test)) {
        get_api_connection(state, "", &claims.sub, connection_id, team_id).await?
    } else {
        let config = new_snowflake_connection();
        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            created_date: "".into(),
            updated_date: "".into(),
            type_details: config,
        }
    };

    Ok(connection)
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    headers: HeaderMap,
    state: Extension<State>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let connection = get_connection(&state, &claims, &sql_query.connection_id, &team_id).await?;
    query_generic::<SnowflakeConnection>(connection.type_details, state, sql_query).await
}

/// Get the schema of the database
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    state: Extension<State>,
    claims: Claims,
) -> Result<Json<Schema>> {
    let team_id = get_team_id_header(&headers)?;
    let api_connection = get_connection(&state, &claims, &id, &team_id).await?;

    schema_generic(api_connection, state).await
}

use std::sync::{LazyLock, Mutex};
pub static SNOWFLAKE_CREDENTIALS: LazyLock<Mutex<String>> = LazyLock::new(|| {
    dotenv::from_filename(".env").ok();
    let credentials = std::env::var("SNOWFLAKE_CREDENTIALS").unwrap();

    Mutex::new(credentials)
});
pub fn new_snowflake_connection() -> SnowflakeConnection {
    let credentials = SNOWFLAKE_CREDENTIALS.lock().unwrap().to_string();
    serde_json::from_str::<SnowflakeConnection>(&credentials).unwrap()
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::num_vec;
    use crate::test_util::{
        get_claims, new_state, new_team_id_with_header, response_bytes, str_vec, validate_parquet,
    };
    use arrow_schema::{DataType, TimeUnit};
    use bytes::Bytes;
    use http::StatusCode;
    use quadratic_rust_shared::sql::snowflake_connection::tests::expected_snowflake_schema;
    use tracing_test::traced_test;
    use uuid::Uuid;

    #[tokio::test]
    #[traced_test]
    async fn snowflake_schema() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
        let state = Extension(new_state().await);
        let response = schema(Path(connection_id), headers, state, get_claims())
            .await
            .unwrap();
        let schema = response.0;
        let columns = &schema.tables[0].columns;

        assert_eq!(columns, &expected_snowflake_schema());
    }

    #[tokio::test]
    #[traced_test]
    async fn snowflake_query_all_data_types() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query:
                "select * from ALL_NATIVE_DATA_TYPES.ALL_NATIVE_DATA_TYPES.ALL_NATIVE_DATA_TYPES;"
                    .into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let (_, headers) = new_team_id_with_header().await;
        let data = query(headers, state, get_claims(), Json(sql_query))
            .await
            .unwrap();
        let response = data.into_response();

        let expected = vec![
            (DataType::Int64, num_vec!(4_i64)),
            (DataType::Utf8, str_vec("Sample Text 4")),
            (DataType::Utf8, str_vec("YmluYXJ5IGRhdGEgNA==")),
            (DataType::Int64, num_vec!(4000_i64)),
            (DataType::Float64, num_vec!(4.56789_f64)),
            (DataType::Float64, num_vec!(456.78_f64)),
            (
                DataType::Float64,
                num_vec!(6666666666666666666.6666666666_f64),
            ),
            (DataType::Boolean, num_vec!(0_u8)),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                vec![192, 150, 14, 2, 151, 1, 0, 0],
            ),
            (DataType::Date32, vec![8, 79, 0, 0]),
            (DataType::Time32(TimeUnit::Second), vec![184, 161, 0, 0]),
            (
                DataType::Timestamp(TimeUnit::Millisecond, None),
                vec![192, 150, 14, 2, 151, 1, 0, 0],
            ),
            (DataType::Utf8, str_vec(r#"{"key":"value4","number":45}"#)),
            (DataType::Utf8, vec![49, 48, 44, 49, 49, 44, 49, 50]),
            (
                DataType::Utf8,
                vec![
                    91, 123, 34, 110, 97, 109, 101, 34, 58, 34, 65, 108, 105, 99, 101, 34, 125, 44,
                    123, 34, 118, 97, 108, 117, 101, 34, 58, 34, 52, 48, 48, 34, 125, 93,
                ],
            ),
            (DataType::Utf8, str_vec("0-0 4 0:0:0")),
        ];

        validate_parquet(response, expected).await;
    }

    #[tokio::test]
    #[traced_test]
    async fn snowflake_query_max_response_bytes() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "SELECT TOP 1 * FROM [dbo].[all_native_data_types] ORDER BY id".into(),
            connection_id,
        };
        let mut state = Extension(new_state().await);
        state.settings.max_response_bytes = 0;
        let (_, headers) = new_team_id_with_header().await;
        let data = query(headers, state, get_claims(), Json(sql_query))
            .await
            .unwrap();
        let response = data.into_response();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_bytes(response).await;
        assert_eq!(body, Bytes::new());
    }
}
