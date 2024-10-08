use axum::{extract::Path, response::IntoResponse, Extension, Json};
use quadratic_rust_shared::{
    quadratic_api::Connection as ApiConnection,
    sql::{snowflake_connection::SnowflakeConnection, Connection},
};
use uuid::Uuid;

use crate::{
    auth::Claims,
    connection::get_api_connection,
    error::Result,
    server::{SqlQuery, TestResponse},
    state::State,
};

use super::{query_generic, Schema};

/// Test the connection to the database.
pub(crate) async fn test(
    state: Extension<State>,
    Json(connection): Json<SnowflakeConnection>,
) -> Json<TestResponse> {
    let sql_query = SqlQuery {
        query: "SELECT 1".into(),
        connection_id: Uuid::new_v4(), // This is not used
    };
    let response = query_generic::<SnowflakeConnection>(connection, state, sql_query.into()).await;
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
) -> Result<(SnowflakeConnection, ApiConnection<SnowflakeConnection>)> {
    let connection = if cfg!(not(test)) {
        get_api_connection(state, "", &claims.sub, connection_id).await?
    } else {
        ApiConnection {
            uuid: Uuid::new_v4(),
            name: "".into(),
            r#type: "".into(),
            created_date: "".into(),
            updated_date: "".into(),
            type_details: SnowflakeConnection {
                account_identifier: "TEST".into(),
                username: "TEST".into(),
                password: "TEST".into(),
                database: "ALL_NATIVE_DATA_TYPES".into(),
                warehouse: None,
                schema: None,
                role: None,
            },
        }
    };

    let snowflake_connection = SnowflakeConnection::new(
        connection.type_details.account_identifier.to_owned(),
        connection.type_details.username.to_owned(),
        connection.type_details.password.to_owned(),
        None,
        connection.type_details.database.to_owned(),
        None,
        None,
    );

    Ok((snowflake_connection, connection))
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
    query_generic::<SnowflakeConnection>(connection, state, sql_query).await
}

/// Get the schema of the database
pub(crate) async fn schema(
    Path(id): Path<Uuid>,
    state: Extension<State>,
    claims: Claims,
) -> Result<Json<Schema>> {
    let (connection, api_connection) = get_connection(&state, &claims, &id).await?;
    let mut pool = connection.connect().await?;
    let database_schema = connection.schema(&mut pool).await?;
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
    use crate::test_util::{get_claims, new_state, response_bytes};
    use bytes::Bytes;
    use http::StatusCode;
    use quadratic_rust_shared::parquet::utils::compare_parquet_file_with_bytes;
    use quadratic_rust_shared::sql::schema::{SchemaColumn, SchemaTable};
    use quadratic_rust_shared::test::get_snowflake_parquet_path;
    use tracing_test::traced_test;
    use uuid::Uuid;

    // TODO(ddimaria): removing this test for now until we can record different queries (only single for now)
    // #[tokio::test]
    // #[traced_test]
    // async fn snowflake_test_connection() {
    //     let state = Extension(new_state().await);
    //     let connection_id = Uuid::new_v4();
    //     let claims = get_claims();
    //     let (snowflake_connection, _) = get_connection(&state, &claims, &connection_id)
    //         .await
    //         .unwrap();
    //     let response = test(state, axum::Json(snowflake_connection)).await;

    //     assert!(response.0.connected);
    // }

    #[tokio::test]
    #[traced_test]
    async fn snowflake_schema() {
        let connection_id = Uuid::new_v4();
        let state = Extension(new_state().await);
        let response = schema(Path(connection_id), state, get_claims())
            .await
            .unwrap();

        let expected = Schema {
            id: response.0.id,
            name: "".into(),
            r#type: "".into(),
            database: "ALL_NATIVE_DATA_TYPES".into(),
            tables: vec![SchemaTable {
                name: "ALL_NATIVE_DATA_TYPES".into(),
                schema: "PUBLIC".into(),
                columns: vec![
                    SchemaColumn {
                        name: "INTEGER_COL".into(),
                        r#type: "NUMBER".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "FLOAT_COL".into(),
                        r#type: "FLOAT".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "NUMBER_COL".into(),
                        r#type: "NUMBER".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "DECIMAL_COL".into(),
                        r#type: "NUMBER".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "BOOLEAN_COL".into(),
                        r#type: "BOOLEAN".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "VARCHAR_COL".into(),
                        r#type: "TEXT".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "CHAR_COL".into(),
                        r#type: "TEXT".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "STRING_COL".into(),
                        r#type: "TEXT".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "BINARY_COL".into(),
                        r#type: "BINARY".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "DATE_COL".into(),
                        r#type: "DATE".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "TIME_COL".into(),
                        r#type: "TIME".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "TIMESTAMP_NTZ_COL".into(),
                        r#type: "TIMESTAMP_NTZ".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "TIMESTAMP_LTZ_COL".into(),
                        r#type: "TIMESTAMP_LTZ".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "TIMESTAMP_TZ_COL".into(),
                        r#type: "TIMESTAMP_TZ".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "VARIANT_COL".into(),
                        r#type: "VARIANT".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "OBJECT_COL".into(),
                        r#type: "OBJECT".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "ARRAY_COL".into(),
                        r#type: "ARRAY".into(),
                        is_nullable: true,
                    },
                    SchemaColumn {
                        name: "GEOGRAPHY_COL".into(),
                        r#type: "GEOGRAPHY".into(),
                        is_nullable: true,
                    },
                ],
            }],
        };

        assert_eq!(response.0, expected);
    }

    #[tokio::test]
    #[traced_test]
    async fn snowflake_query_all_data_types() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types;".into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
        let response = data.into_response();

        assert!(compare_parquet_file_with_bytes(
            &get_snowflake_parquet_path(),
            response_bytes(response).await
        ));
        // assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    #[traced_test]
    async fn snowflake_query_max_response_bytes() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "SELECT TOP 1 * FROM [dbo].[all_native_data_types] ORDER BY id".into(),
            connection_id,
        };
        let mut state = Extension(new_state().await);
        state.settings.max_response_bytes = 0;
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
        let response = data.into_response();

        assert_eq!(response.status(), StatusCode::OK);

        let body = response_bytes(response).await;
        assert_eq!(body, Bytes::new());
    }
}
