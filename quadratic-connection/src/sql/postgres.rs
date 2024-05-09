use axum::{extract, response::IntoResponse, Extension, Json};
use axum_macros::debug_handler;
use quadratic_rust_shared::{
    // quadratic_api::{get_file_checkpoint, set_file_checkpoint},
    sql::{postgres_connection::PostgresConnection, Connection},
};
use tokio::time::Instant;
use uuid::Uuid;

use crate::{
    connection::get_api_connection,
    error::Result,
    server::{test_connection, Claims, SqlQuery, TestResponse},
    state::State,
};

type TestRequest = PostgresConnection;

pub(crate) async fn test(Json(connection): Json<TestRequest>) -> Json<TestResponse> {
    test_connection(connection).await
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    state: Extension<State>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let connection = get_connection(&*state, &claims, &sql_query.connection_id).await?;
    let pool = connection.connect().await?;
    let rows = connection.query(pool, &sql_query.query).await?;
    let parquet = PostgresConnection::to_parquet(rows)?;

    state.stats.lock().await.last_query_time = Some(Instant::now());

    Ok(parquet)
}

async fn get_connection(
    state: &State,
    claims: &Claims,
    connection_id: &Uuid,
) -> Result<PostgresConnection> {
    let connection = get_api_connection(state, "", &claims.sub, connection_id).await?;
    let pg_connection = PostgresConnection::new(
        Some(connection.type_details.username),
        Some(connection.type_details.password),
        connection.type_details.host,
        Some(connection.type_details.port),
        Some(connection.type_details.database),
    );

    Ok(pg_connection)
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
    use crate::test_util::new_state;
    use tracing_test::traced_test;
    use uuid::Uuid;

    fn get_claims() -> Claims {
        Claims {
            sub: "test".to_string(),
            exp: 0,
        }
    }

    #[tokio::test]
    #[traced_test]
    async fn test_postgres_connection() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from \"FileCheckpoint\" limit 2".into(),
            connection_id: connection_id.clone(),
        };
        let state = Extension(new_state().await);
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();

        assert_eq!(data.into_response().status(), 200);
    }
}
