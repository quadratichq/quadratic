use axum::{extract::Path, response::IntoResponse, Extension, Json};
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::{mysql_connection::MySqlConnection, Connection},
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::get_api_connection,
    error::Result,
    server::{test_connection, SqlQuery, TestResponse},
    state::State,
};

use super::{query_generic, Schema};

/// Test the connection to the database.
pub(crate) async fn test(Json(connection): Json<MySqlConnection>) -> Json<TestResponse> {
    test_connection(connection).await
}

/// Get the connection details from the API and create a MySqlConnection.
async fn get_connection(
    state: &State,
    claims: &Claims,
    connection_id: &Uuid,
) -> Result<(MySqlConnection, ApiConnection)> {
    let connection = get_api_connection(state, "", &claims.sub, connection_id).await?;
    let pg_connection = MySqlConnection::new(
        Some(connection.type_details.username.to_owned()),
        Some(connection.type_details.password.to_owned()),
        connection.type_details.host.to_owned(),
        Some(connection.type_details.port.to_owned()),
        Some(connection.type_details.database.to_owned()),
    );

    Ok((pg_connection, connection))
}

/// Query the database and return the results as a parquet file.
pub(crate) async fn query(
    state: Extension<State>,
    claims: Claims,
    sql_query: Json<SqlQuery>,
) -> Result<impl IntoResponse> {
    let connection = get_connection(&state, &claims, &sql_query.connection_id)
        .await?
        .0;
    query_generic::<MySqlConnection>(connection, state, sql_query).await
}

/// Get the schema of the database
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    state: Extension<State>,
    claims: Claims,
) -> Result<Json<Schema>> {
    let (connection, api_connection) = get_connection(&state, &claims, &id).await?;
    let pool = connection.connect().await?;
    let database_schema = connection.schema(pool).await?;
    let schema = Schema {
        id: api_connection.uuid,
        name: api_connection.name,
        r#type: api_connection.r#type,
        database: api_connection.type_details.database,
        tables: database_schema.tables.into_values().collect(),
    };

    Ok(Json(schema))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::{get_claims, new_state};
    use tracing_test::traced_test;
    use uuid::Uuid;

    #[tokio::test]
    #[traced_test]
    async fn test_mysql_connection() {
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
