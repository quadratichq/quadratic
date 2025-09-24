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
    error::{ConnectionError, Result},
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
    let mut datafusion_connection =
        match cfg!(not(test)) {
            true => state.settings.datafusion_connection.clone().ok_or_else(|| {
                ConnectionError::Config("Datafusion connection not found".to_string())
            }),
            false => Ok(new_datafusion_test_connection()),
        }?;

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
    state: Extension<State>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let connection_id = sql_query.connection_id;
    let connection = get_connection(&state, &claims, &connection_id, &team_id, &headers).await?;
    println!("connection: {:?}", connection);
    query_generic::<DatafusionConnection>(connection.type_details, state, sql_query).await
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
    let api_connection = get_connection(&state, &claims, &id, &team_id, &headers).await?;

    schema_generic(api_connection, state, params).await
}

pub(crate) async fn sync_mixpanel(
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    state: Extension<State>,
    claims: Claims,
) -> Result<impl IntoResponse> {
    let team_id = get_team_id_header(&headers)?;
    let connection = get_connection(&state, &claims, &id, &team_id, &headers).await?;
    let mixpanel_connection = MixpanelConnection {
        api_secret: connection.type_details.access_key_id,
        project_id: connection.type_details.bucket,
    };
    process_mixpanel_connection(&state.settings, mixpanel_connection, connection.uuid).await
}
