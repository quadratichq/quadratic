use std::sync::Arc;

use axum::{Extension, Json, http::HeaderMap, response::IntoResponse};
use quadratic_rust_shared::{
    net::ssh::SshConfig,
    sql::{Connection, schema::SchemaTable},
};
use serde::Serialize;
use tokio::time::Instant;
use uuid::Uuid;

use crate::{
    error::{ConnectionError, Result},
    header::{number_header, time_header},
    server::SqlQuery,
    ssh::{UsesSsh, open_ssh_tunnel_for_connection},
    state::State,
};
use quadratic_rust_shared::quadratic_api::Connection as ApiConnection;

pub(crate) mod bigquery;
pub(crate) mod datafusion;
pub(crate) mod mssql;
pub(crate) mod mysql;
pub(crate) mod postgres;
pub(crate) mod snowflake;

#[derive(Debug, Serialize, PartialEq, Clone)]
pub struct Schema {
    id: Uuid,
    name: String,
    r#type: String,
    database: String,
    pub tables: Vec<SchemaTable>,
}

#[derive(Debug, PartialEq, Clone, serde::Deserialize)]
pub struct SchemaQuery {
    force_cache_refresh: Option<bool>,
}

impl SchemaQuery {
    #[cfg(test)]
    pub fn forced_cache_refresh() -> Self {
        SchemaQuery {
            force_cache_refresh: Some(true),
        }
    }
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query_generic<'a, T: Connection<'a>>(
    mut connection: T,
    state: Extension<Arc<State>>,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let mut headers = HeaderMap::new();
    let start = Instant::now();
    let max_response_bytes = Some(state.settings.max_response_bytes);

    let start_connect = Instant::now();
    let mut pool = connection.connect().await?;

    headers.insert("ELAPSED-DATABASE-CONNECTION-MS", time_header(start_connect));

    let start_query = Instant::now();
    let (parquet, over_the_limit, num_records) = connection
        .query(&mut pool, &sql_query.query, max_response_bytes)
        .await?;

    headers.insert("RECORD-COUNT", number_header(num_records));
    headers.insert("ELAPSED-DATABASE-QUERY-MS", time_header(start_query));
    headers.insert("OVER-THE-LIMIT", number_header(over_the_limit));

    state.stats.lock().await.last_query_time = Some(Instant::now());
    headers.insert("ELAPSED-TOTAL-MS", time_header(start));

    Ok((headers, parquet))
}

pub(crate) async fn schema_generic<'a, C>(
    api_connection: ApiConnection<C>,
    state: Extension<Arc<State>>,
    params: SchemaQuery,
) -> Result<Json<Schema>>
where
    C: Connection<'a> + 'a,
{
    let should_clear_cache = params.force_cache_refresh.unwrap_or(false);

    if should_clear_cache {
        // if the force_cache_refresh is true, delete the schema from the cache
        state.schema_cache.delete(api_connection.uuid).await;
    } else {
        // if the schema is in the cache, return it
        if let Some(schema) = state.schema_cache.get(api_connection.uuid).await {
            return Ok(Json(schema));
        }
    }

    // we're not using the cache, so get the schema from the database
    let mut pool = api_connection.type_details.connect().await?;
    let database_schema = api_connection.type_details.schema(&mut pool).await?;
    let schema = Schema {
        id: api_connection.uuid,
        name: api_connection.name,
        r#type: api_connection.r#type,
        database: database_schema.database,
        tables: database_schema.tables.into_values().collect(),
    };

    // add a copy of the schema to the cache
    state
        .schema_cache
        .add(api_connection.uuid, schema.clone())
        .await;

    Ok(Json(schema))
}

pub(crate) async fn schema_generic_with_ssh<'a, C>(
    mut api_connection: ApiConnection<C>,
    state: Extension<Arc<State>>,
    params: SchemaQuery,
) -> Result<Json<Schema>>
where
    C: Connection<'a> + Clone + UsesSsh + 'a,
    C: TryInto<SshConfig>,
    <C as TryInto<SshConfig>>::Error: Into<ConnectionError>,
{
    let tunnel = open_ssh_tunnel_for_connection(&mut api_connection.type_details).await?;
    let schema = schema_generic(api_connection, state, params).await?;

    if let Some(mut tunnel) = tunnel {
        tunnel.close().await?;
    }

    Ok(schema)
}
