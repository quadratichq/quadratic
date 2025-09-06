use axum::{
    Extension, Json,
    extract::{Path, Query},
    response::IntoResponse,
};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::bigquery_connection::{BigqueryConfig, BigqueryConnection},
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::get_api_connection,
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse},
    sql::SchemaQuery,
    state::State,
};

use super::{Schema, query_generic, schema_generic};

/// Test the connection to the database.
pub(crate) async fn test(
    state: Extension<State>,
    Json(config): Json<BigqueryConfig>,
) -> Result<Json<TestResponse>> {
    let sql_query = SqlQuery {
        query: "SELECT 1".into(),
        connection_id: Uuid::new_v4(), // This is not used
    };

    let connection = BigqueryConnection::new(
        config.service_account_configuration,
        config.project_id,
        config.dataset,
    )
    .await?;

    let response = query_generic::<BigqueryConnection>(connection, state, sql_query.into()).await;

    let message = match response {
        Ok(_) => None,
        Err(e) => Some(e.to_string()),
    };

    Ok(TestResponse::new(message.is_none(), message).into())
}

/// Get the connection details from the API and create a MySqlConnection.
async fn get_connection(
    state: &State,
    claims: &Claims,
    connection_id: &Uuid,
    team_id: &Uuid,
) -> Result<ApiConnection<BigqueryConfig>> {
    let connection = if cfg!(not(test)) {
        get_api_connection(state, "", &claims.email, connection_id, team_id).await?
    } else {
        let config = new_config().await;
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
    let config_connection =
        get_connection(&state, &claims, &sql_query.connection_id, &team_id).await?;
    let connection = BigqueryConnection::new_from_config(config_connection.type_details).await?;

    query_generic::<BigqueryConnection>(connection, state, sql_query).await
}

/// Get the schema of the database
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    state: Extension<State>,
    claims: Claims,
    Query(params): Query<SchemaQuery>,
) -> Result<Json<Schema>> {
    let team_id = get_team_id_header(&headers)?;
    let connection = get_connection(&state, &claims, &id, &team_id).await?;

    let api_connection = ApiConnection {
        uuid: connection.uuid,
        name: connection.name,
        r#type: connection.r#type,
        created_date: connection.created_date,
        updated_date: connection.updated_date,
        type_details: BigqueryConnection::new_from_config(connection.type_details).await?,
    };

    schema_generic(api_connection, state, params).await
}

use std::sync::{LazyLock, Mutex};
pub static BIGQUERY_CREDENTIALS: LazyLock<Mutex<String>> = LazyLock::new(|| {
    dotenv::from_filename(".env").ok();
    let credentials = std::env::var("BIGQUERY_CREDENTIALS").unwrap();

    Mutex::new(credentials)
});
pub async fn new_config() -> BigqueryConfig {
    let credentials = BIGQUERY_CREDENTIALS.lock().unwrap();

    BigqueryConfig {
        service_account_configuration: credentials.to_string(),
        project_id: "quadratic-development".to_string(),
        dataset: "all_native_data_types".to_string(),
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::{
        num_vec,
        test_util::{
            get_claims, new_state, new_team_id_with_header, response_bytes, str_vec,
            validate_parquet,
        },
    };
    use arrow_schema::{DataType, TimeUnit};
    use bytes::Bytes;
    use http::StatusCode;
    use quadratic_rust_shared::sql::bigquery_connection::tests::expected_bigquery_schema;
    use tracing_test::traced_test;
    use uuid::Uuid;

    #[tokio::test]
    #[traced_test]
    async fn bigquery_test_connection() {
        let config = new_config().await;
        let state = Extension(new_state().await);
        let response = test(state, axum::Json(config)).await.unwrap();

        assert!(response.0.connected);
    }

    #[tokio::test]
    #[traced_test]
    async fn bigquery_schema() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
        let state = Extension(new_state().await);
        let params = SchemaQuery::forced_cache_refresh();
        let response = schema(
            Path(connection_id),
            headers,
            state,
            get_claims(),
            Query(params),
        )
        .await
        .unwrap();
        let schema = response.0;
        let columns = &schema.tables[0].columns;

        assert_eq!(columns, &expected_bigquery_schema());
    }

    #[tokio::test]
    #[traced_test]
    async fn bigquery_query_all_data_types() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query:
                "select * from quadratic-development.all_native_data_types.all_data_types limit 1;"
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
    async fn bigquery_query_max_response_bytes() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "SELECT * FROM quadratic-development.all_native_data_types.all_data_types ORDER BY id".into(),
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
