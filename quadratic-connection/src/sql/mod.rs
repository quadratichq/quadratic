use axum::{Extension, Json, http::HeaderMap, response::IntoResponse};
use quadratic_rust_shared::sql::{Connection, schema::SchemaTable};
use serde::Serialize;
use tokio::time::Instant;
use uuid::Uuid;

use crate::{
    error::Result,
    header::{number_header, time_header},
    server::SqlQuery,
    state::State,
};

pub(crate) mod bigquery;
pub(crate) mod mssql;
pub(crate) mod mysql;
pub(crate) mod postgres;
pub(crate) mod snowflake;

#[derive(Debug, Serialize, PartialEq)]
pub struct Schema {
    id: Uuid,
    name: String,
    r#type: String,
    database: String,
    pub tables: Vec<SchemaTable>,
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query_generic<'a, T: Connection<'a>>(
    mut connection: T,
    state: Extension<State>,
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
