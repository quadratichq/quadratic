use axum::{
    Extension, Json,
    extract::{Path, Query},
    response::IntoResponse,
};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::datafusion_connection::{
        DatafusionConnection, EmptyConnection,
        tests::new_datafusion_connection as new_datafusion_test_connection,
    },
    synced::{
        SyncedClient, SyncedConnection,
        google_analytics::client::{GoogleAnalyticsClient, GoogleAnalyticsConnection},
        mixpanel::{MixpanelConnection, client::MixpanelClient},
        plaid::{PlaidConnection, client::PlaidClient},
    },
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::get_api_connection,
    error::Result,
    header::get_team_id_header,
    server::{SqlQuery, TestResponse},
    sql::{Schema, SchemaQuery, query_generic, schema_generic},
    state::State,
};

/// Macro to generate test handler functions for Datafusion connections.
macro_rules! test_handler {
    ($fn_name:ident, $connection_type:ty) => {
        pub(crate) async fn $fn_name(
            state: Extension<Arc<State>>,
            Json(connection): Json<$connection_type>,
        ) -> Result<Json<TestResponse>> {
            let client = connection
                .to_client((**state).settings.environment.clone())
                .await?;
            Ok(TestResponse::new(client.test_connection().await, None).into())
        }
    };
}

test_handler!(test_google_analytics, GoogleAnalyticsConnection);
test_handler!(test_mixpanel, MixpanelConnection);

pub(crate) async fn test_plaid(
    state: Extension<Arc<State>>,
    Json(connection): Json<PlaidConnection>,
) -> Result<Json<TestResponse>> {
    let client = PlaidClient::new(
        &state.settings.plaid_client_id,
        &state.settings.plaid_secret,
        state.settings.plaid_environment,
        Some(connection.access_token),
    );

    Ok(TestResponse::new(client.test_connection().await, None).into())
}

/// Get the connection details from the API and create a MySqlConnection.
async fn get_connection(
    state: State,
    claims: &Claims,
    connection_id: &Uuid,
    team_id: &Uuid,
    headers: &HeaderMap,
) -> Result<ApiConnection<DatafusionConnection>> {
    let api_connection: ApiConnection<EmptyConnection> = match cfg!(not(test)) {
        true => {
            get_api_connection(&state, "", &claims.email, connection_id, team_id, headers).await?
        }
        false => ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            type_details: EmptyConnection {},
        },
    };

    let mut datafusion_connection = match cfg!(not(test)) {
        true => state.settings.datafusion_connection,
        false => new_datafusion_test_connection(),
    };

    let streams = match api_connection.r#type.as_str() {
        "MIXPANEL" => MixpanelClient::streams(),
        "GOOGLE_ANALYTICS" => GoogleAnalyticsClient::streams(),
        "PLAID" => PlaidClient::streams(),
        _ => vec![],
    };

    datafusion_connection.connection_id = Some(*connection_id);
    datafusion_connection.streams = streams
        .into_iter()
        .map(|stream| stream.to_string())
        .collect();

    let api_connection = ApiConnection {
        uuid: *connection_id,
        name: api_connection.name,
        r#type: api_connection.r#type,
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
    let connection = get_connection(
        (**state).clone(),
        &claims,
        &connection_id,
        &team_id,
        &headers,
    )
    .await?;

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
    let api_connection =
        get_connection((**state).clone(), &claims, &id, &team_id, &headers).await?;

    schema_generic(api_connection, state, params).await
}

// =============================================================================
// Generic DataFusion handlers
//
// These handlers read `prefix` and `streams` from the connection's typeDetails,
// making them reusable for any DataFusion-backed connection (e.g. Intrinio
// financial data, or any future data stored as Parquet on S3).
// =============================================================================

/// Type details expected for a generic DataFusion connection.
#[derive(Debug, Deserialize)]
struct GenericDatafusionTypeDetails {
    /// Optional S3 prefix override (defaults to connection_id if absent).
    prefix: Option<String>,
    /// Table/stream names available under this prefix.
    #[serde(default)]
    streams: Vec<String>,
}

/// Build a DatafusionConnection from a generic connection's typeDetails.
async fn get_generic_connection(
    state: State,
    claims: &Claims,
    connection_id: &Uuid,
    team_id: &Uuid,
    headers: &HeaderMap,
) -> Result<ApiConnection<DatafusionConnection>> {
    let api_connection: ApiConnection<GenericDatafusionTypeDetails> = match cfg!(not(test)) {
        true => {
            get_api_connection(&state, "", &claims.email, connection_id, team_id, headers).await?
        }
        false => ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            type_details: GenericDatafusionTypeDetails {
                prefix: None,
                streams: vec![],
            },
        },
    };

    let mut datafusion_connection = match cfg!(not(test)) {
        true => state.settings.datafusion_connection,
        false => new_datafusion_test_connection(),
    };

    datafusion_connection.connection_id = Some(*connection_id);
    datafusion_connection.prefix = api_connection.type_details.prefix;
    datafusion_connection.streams = api_connection.type_details.streams;

    let api_connection = ApiConnection {
        uuid: *connection_id,
        name: api_connection.name,
        r#type: api_connection.r#type,
        type_details: datafusion_connection,
    };

    Ok(api_connection)
}

/// Generic DataFusion query handler — reads streams/prefix from typeDetails.
pub(crate) async fn query_generic_datafusion(
    headers: HeaderMap,
    state: Extension<Arc<State>>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let connection_id = sql_query.connection_id;
    let connection = get_generic_connection(
        (**state).clone(),
        &claims,
        &connection_id,
        &team_id,
        &headers,
    )
    .await?;

    query_generic::<DatafusionConnection>(connection.type_details, state, sql_query).await
}

/// Generic DataFusion schema handler — reads streams/prefix from typeDetails.
pub(crate) async fn schema_generic_datafusion(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    state: Extension<Arc<State>>,
    claims: Claims,
    Query(params): Query<SchemaQuery>,
) -> Result<Json<Schema>> {
    let team_id = get_team_id_header(&headers)?;
    let api_connection =
        get_generic_connection((**state).clone(), &claims, &id, &team_id, &headers).await?;

    schema_generic(api_connection, state, params).await
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
            start_date: "2025-01-01".to_string(),
        }
    }

    // TODO(ddimaria): remove this ignore once datafusion connection is mocked
    #[tokio::test]
    #[traced_test]
    #[ignore]
    async fn test_mixpanel_connection_success() {
        let state = Extension(Arc::new(new_state().await));
        let connection = get_test_mixpanel_connection();
        let response = test_mixpanel(state, Json(connection)).await.unwrap();
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

        let result =
            get_connection(state.clone(), &claims, &connection_id, &team_id, &headers).await;
        println!("result: {:?}", result);
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
}
