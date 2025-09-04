use axum::{
    Extension, Json,
    extract::{Path, Query},
    response::IntoResponse,
};
use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::datafusion_connection::{DatafusionConnection, tests::new_datafusion_connection},
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

use super::{Schema, SchemaQuery, query_generic, schema_generic};

/// Test the connection to the database.
pub(crate) async fn test(
    state: Extension<State>,
    // Json(connection): Json<DatafusionConnection>,
) -> Json<TestResponse> {
    let connection = DatafusionConnection::new(
        "test".into(),
        "test".into(),
        "http://localhost:4566".into(),
        "us-east-2".into(),
        "mixpanel-data".into(),
    );

    let sql_query = SqlQuery {
        query: "SELECT 1".into(),
        connection_id: Uuid::new_v4(), // This is not used
    };
    let response = query_generic::<DatafusionConnection>(connection, state, sql_query.into()).await;
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
) -> Result<ApiConnection<DatafusionConnection>> {
    let connection = if cfg!(not(test)) {
        // get_api_connection(state, "", &claims.sub, connection_id, team_id).await?
        let config = new_datafusion_connection();
        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            created_date: "".into(),
            updated_date: "".into(),
            type_details: config,
        }
    } else {
        let config = new_datafusion_connection();
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
    let api_connection = get_connection(&state, &claims, &id, &team_id).await?;

    schema_generic(api_connection, state, params).await
}
