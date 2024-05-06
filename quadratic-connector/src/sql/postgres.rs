use std::sync::Arc;

use axum::{extract::Query, response::IntoResponse, Extension, Json};

use quadratic_rust_shared::{
    // quadratic_api::{get_file_checkpoint, set_file_checkpoint},
    sql::{postgres_connection::PostgresConnection, Connection},
};
use tokio::time::Instant;

use crate::{
    error::Result,
    server::{test_connection, SqlQuery, TestResponse},
    state::State,
};

type TestRequest = PostgresConnection;

pub(crate) async fn test(Json(connection): Json<TestRequest>) -> Json<TestResponse> {
    test_connection(connection).await
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    state: Extension<Arc<State>>,
    query: Query<SqlQuery>,
) -> Result<impl IntoResponse> {
    let connection = new_postgres_connection();
    let pool = connection.connect().await?;
    let rows = connection.query(pool, &query.0.statement).await?;
    let parquet = PostgresConnection::to_parquet(rows)?;

    state.stats.lock().await.last_query_time = Some(Instant::now());

    Ok(parquet)
}

/// TODO(ddimaria): remove once API is setup to return connections
fn new_postgres_connection() -> PostgresConnection {
    PostgresConnection::new(
        Some("postgres".into()),
        Some("postgres".into()),
        "0.0.0.0".into(),
        Some(5432),
        Some("postgres".into()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::new_arc_state;
    use tracing_test::traced_test;

    #[tokio::test]
    #[traced_test]
    async fn test_postgres_connection() {
        let statement = SqlQuery {
            statement: "select * from \"FileCheckpoint\" limit 2".into(),
        };
        let state = Extension(new_arc_state().await);
        let data = query(state, Query(statement)).await.unwrap();

        assert_eq!(data.into_response().status(), 200);
    }
}
