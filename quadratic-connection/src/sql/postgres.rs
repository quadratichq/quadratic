use axum::{extract::Path, response::IntoResponse, Extension, Json};
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::{postgres_connection::PostgresConnection, Connection},
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
pub(crate) async fn test(Json(connection): Json<PostgresConnection>) -> Json<TestResponse> {
    test_connection(connection).await
}

/// Get the connection details from the API and create a PostgresConnection.
async fn get_connection(
    state: &State,
    claims: &Claims,
    connection_id: &Uuid,
) -> Result<(PostgresConnection, ApiConnection)> {
    let connection = if cfg!(not(test)) {
        get_api_connection(state, "", &claims.sub, connection_id).await?
    } else {
        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            created_date: "".into(),
            updated_date: "".into(),
            type_details: quadratic_rust_shared::quadratic_api::TypeDetails {
                host: "0.0.0.0".into(),
                port: "5433".into(),
                username: "user".into(),
                password: "password".into(),
                database: "postgres-connection".into(),
            },
        }
    };

    let pg_connection = PostgresConnection::new(
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
    query_generic::<PostgresConnection>(connection, state, sql_query).await
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
    async fn test_postgres_connection() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types order by id limit 1".into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
        let response = data.into_response();

        println!("{:?}", response.body());

        assert_eq!(response.status(), 200);
    }
}
