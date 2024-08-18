use axum::{http::HeaderMap, response::IntoResponse, Extension, Json};
use quadratic_rust_shared::sql::{schema::SchemaTable, Connection};
use serde::Serialize;
use tokio::time::Instant;
use uuid::Uuid;

use crate::{
    error::Result,
    header::{number_header, time_header},
    server::SqlQuery,
    state::State,
};

pub(crate) mod mysql;
pub(crate) mod postgres;

#[derive(Debug, Serialize, PartialEq)]
pub struct Schema {
    id: Uuid,
    name: String,
    r#type: String,
    database: String,
    pub tables: Vec<SchemaTable>,
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query_generic<T: Connection>(
    connection: T,
    state: Extension<State>,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let mut headers = HeaderMap::new();
    let start = Instant::now();
    let max_response_bytes = state.settings.max_response_bytes;

    // let connection = get_connection(&*state, &claims, &sql_query.connection_id).await?;
    // headers.insert("ELAPSED-API-CONNECTION-MS", time_header(start));

    let start_connect = Instant::now();
    let mut pool = connection.connect().await?;

    headers.insert("ELAPSED-DATABASE-CONNECTION-MS", time_header(start_connect));

    let start_query = Instant::now();
    let (rows, over_the_limit) = connection
        .query(&mut pool, &sql_query.query, Some(max_response_bytes))
        .await?;

    headers.insert("RECORD-COUNT", number_header(rows.len()));
    headers.insert("ELAPSED-DATABASE-QUERY-MS", time_header(start_query));
    headers.insert("OVER-THE-LIMIT", number_header(over_the_limit));

    let start_conversion = Instant::now();
    let parquet = T::to_parquet(rows)?;

    headers.insert(
        "ELAPSED-PARQUET-CONVERSION-MS",
        time_header(start_conversion),
    );

    state.stats.lock().await.last_query_time = Some(Instant::now());
    headers.insert("ELAPSED-TOTAL-MS", time_header(start));

    Ok((headers, parquet))
}
