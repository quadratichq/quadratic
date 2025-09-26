use std::sync::Arc;

use axum::{
    Extension, Json,
    extract::{Path, Query},
    response::IntoResponse,
};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::datafusion_connection::{
        DatafusionConnection, tests::new_datafusion_connection as new_datafusion_test_connection,
    },
    synced::mixpanel::client::MixpanelClient,
};

use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::get_api_connection,
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse},
    state::State,
    synced_connection::{MixpanelConnection, process_mixpanel_connection},
};

use super::{Schema, SchemaQuery, query_generic, schema_generic};

/// Test the connection to the database.
pub(crate) async fn test_mixpanel(
    Json(connection): Json<MixpanelConnection>,
) -> Json<TestResponse> {
    let client = MixpanelClient::new(&connection.api_secret, &connection.project_id);
    TestResponse::new(client.test_connection().await, None).into()
}

/// Get the connection details from the API and create a MySqlConnection.
async fn get_connection(
    state: &State,
    _claims: &Claims,
    connection_id: &Uuid,
    _team_id: &Uuid,
    _headers: &HeaderMap,
) -> Result<ApiConnection<DatafusionConnection>> {
    let mut datafusion_connection = match cfg!(not(test)) {
        true => state.settings.datafusion_connection.clone(),
        false => new_datafusion_test_connection(),
    };

    datafusion_connection.connection_id = Some(*connection_id);

    let api_connection = ApiConnection {
        uuid: *connection_id,
        name: "".into(),
        r#type: "".into(),
        type_details: datafusion_connection,
    };

    Ok(api_connection)
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    headers: HeaderMap,
    state: Extension<Arc<State>>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let connection_id = sql_query.connection_id;
    let connection = get_connection(&state, &claims, &connection_id, &team_id, &headers).await?;

    query_generic::<DatafusionConnection>(connection.type_details, state, sql_query).await
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

    schema_generic(api_connection, state, params).await
}

pub(crate) async fn sync_mixpanel(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    state: Extension<Arc<State>>,
    claims: Claims,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let api_connection = get_api_connection::<MixpanelConnection>(
        &state,
        "",
        &claims.email,
        &id,
        &team_id,
        &headers,
    )
    .await?;
    let mixpanel_connection = MixpanelConnection {
        api_secret: api_connection.type_details.api_secret,
        project_id: api_connection.type_details.project_id,
    };

    process_mixpanel_connection(&state, mixpanel_connection, id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::{get_claims, new_state, new_team_id_with_header};
    use axum::Extension;
    use std::sync::Arc;
    use tracing_test::traced_test;
    use uuid::Uuid;

    fn get_test_mixpanel_connection() -> MixpanelConnection {
        MixpanelConnection {
            api_secret: "test_secret".to_string(),
            project_id: "test_project_id".to_string(),
        }
    }

    // TODO(ddimaria): remove this ignore once datafusion connection is mocked
    #[tokio::test]
    #[traced_test]
    #[ignore]
    async fn test_mixpanel_connection_success() {
        let connection = get_test_mixpanel_connection();
        let response = test_mixpanel(Json(connection)).await;
        assert!(response.0.connected);
    }

    #[tokio::test]
    #[traced_test]
    async fn test_get_connection() {
        let state = new_state().await;
        let claims = get_claims();
        let connection_id = Uuid::new_v4();
        let team_id = Uuid::new_v4();
        let headers = HeaderMap::new();

        let result = get_connection(&state, &claims, &connection_id, &team_id, &headers).await;
        assert!(result.is_ok());

        let api_connection = result.unwrap();
        assert_eq!(api_connection.uuid, connection_id);
        assert_eq!(
            api_connection.type_details.connection_id,
            Some(connection_id)
        );
    }

    #[tokio::test]
    #[traced_test]
    async fn test_query() {
        let (_, headers) = new_team_id_with_header().await;
        let state = Extension(Arc::new(new_state().await));
        let claims = get_claims();
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "SELECT 1 as test_column".to_string(),
            connection_id,
        };

        let result = query(headers, state, claims, Json(sql_query)).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[traced_test]
    async fn test_schema_with_forced_refresh() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
        let state = Extension(Arc::new(new_state().await));
        let claims = get_claims();
        let params = SchemaQuery {
            force_cache_refresh: Some(true),
        };

        let result = schema(Path(connection_id), headers, state, claims, Query(params))
            .await
            .unwrap();
        assert_eq!(result.0.id, connection_id);
    }

    #[tokio::test]
    #[traced_test]
    async fn test_schema_without_forced_refresh() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
        let state = Extension(Arc::new(new_state().await));
        let claims = get_claims();
        let params = SchemaQuery {
            force_cache_refresh: Some(false),
        };

        let result = schema(Path(connection_id), headers, state, claims, Query(params))
            .await
            .unwrap();
        assert_eq!(result.0.id, connection_id);
    }

    #[tokio::test]
    #[traced_test]
    #[ignore]
    async fn test_sync_mixpanel_basic() {
        let connection_id = Uuid::new_v4();
        let (_, headers) = new_team_id_with_header().await;
        let state = Extension(Arc::new(new_state().await));
        let claims = get_claims();

        sync_mixpanel(Path(connection_id), headers, state, claims)
            .await
            .unwrap();
    }
}
