use axum::body::Bytes;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::Instant;
use uuid::Uuid;

use quadratic_rust_shared::{
    quadratic_api::{get_file_checkpoint, set_file_checkpoint},
    sql::{postgres_connection::PostgresConnection, Connection},
};

use crate::{
    error::{ConnectorError, Result},
    server::SqlQuery,
    state::{settings::Settings, State},
};

pub(crate) async fn query_postgres<'a>(
    connection: PostgresConnection<'a>,
    query: SqlQuery,
) -> Result<Bytes> {
    let start = Instant::now();
    let pool = connection.connect().await.unwrap();

    let duration = start.elapsed();
    tracing::info!("Connecting to the database: {:?}", duration);
    let start = Instant::now();

    let rows = connection.query(pool, &query.statement).await.unwrap();

    let duration = start.elapsed();
    tracing::info!("Querying the database: {:?}", duration);
    let start = Instant::now();

    let parquet = PostgresConnection::to_parquet(rows);

    let duration = start.elapsed();
    tracing::info!("Converting to parquet: {:?}", duration);

    Ok(parquet)
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_rust_shared::sql::postgres_connection::PostgresConnection;
    use tracing_test::traced_test;

    fn new_postgres_connection() -> PostgresConnection<'static> {
        PostgresConnection::new("postgres", "postgres", "0.0.0.0", "5432", "postgres")
    }

    #[tokio::test]
    #[traced_test]
    async fn test_postgres_connection() {
        let connection = new_postgres_connection();
        let query = SqlQuery::new("select * from \"employees\" limit 1000000".into());
        let data = query_postgres(connection, query).await.unwrap();
    }
}
