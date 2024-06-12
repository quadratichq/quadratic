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
                port: "3306".into(),
                username: "user".into(),
                password: "password".into(),
                database: "mysql-connection".into(),
            },
        }
    };

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
    use crate::test_util::{get_claims, new_state, validate_parquet};
    use arrow_schema::{DataType, TimeUnit};
    use tracing_test::traced_test;
    use uuid::Uuid;

    #[tokio::test]
    #[traced_test]
    async fn test_mysql_connection() {
        let connection_id = Uuid::new_v4();
        let sql_query = SqlQuery {
            query: "select * from all_native_data_types order by id limit 1".into(),
            connection_id,
        };
        let state = Extension(new_state().await);
        let data = query(state, get_claims(), Json(sql_query)).await.unwrap();
        let response = data.into_response();
        /*
        ArrayData { data_type: UInt64, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000020681c0, len: 8, data: [1, 0, 0, 0, 0, 0, 0, 0] }, ptr: 0x6000020681c0, length: 8 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328170, len: 8, data: [0, 0, 0, 0, 9, 0, 0, 0] }, ptr: 0x600006328170, length: 8 }, Buffer { data: Bytes { ptr: 0x6000063289f0, len: 9, data: [99, 104, 97, 114, 95, 100, 97, 116, 97] }, ptr: 0x6000063289f0, length: 9 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063281a0, len: 8, data: [0, 0, 0, 0, 12, 0, 0, 0] }, ptr: 0x6000063281a0, length: 8 }, Buffer { data: Bytes { ptr: 0x600006328000, len: 12, data: [118, 97, 114, 99, 104, 97, 114, 95, 100, 97, 116, 97] }, ptr: 0x600006328000, length: 12 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063281d0, len: 8, data: [0, 0, 0, 0, 0, 0, 0, 0] }, ptr: 0x6000063281d0, length: 8 }, Buffer { data: Bytes { ptr: 0x1, len: 0, data: [] }, ptr: 0x1, length: 0 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063286d0, len: 8, data: [0, 0, 0, 0, 0, 0, 0, 0] }, ptr: 0x6000063286d0, length: 8 }, Buffer { data: Bytes { ptr: 0x1, len: 0, data: [] }, ptr: 0x1, length: 0 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328670, len: 8, data: [0, 0, 0, 0, 0, 0, 0, 0] }, ptr: 0x600006328670, length: 8 }, Buffer { data: Bytes { ptr: 0x1, len: 0, data: [] }, ptr: 0x1, length: 0 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328610, len: 8, data: [0, 0, 0, 0, 0, 0, 0, 0] }, ptr: 0x600006328610, length: 8 }, Buffer { data: Bytes { ptr: 0x1, len: 0, data: [] }, ptr: 0x1, length: 0 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328550, len: 8, data: [0, 0, 0, 0, 0, 0, 0, 0] }, ptr: 0x600006328550, length: 8 }, Buffer { data: Bytes { ptr: 0x1, len: 0, data: [] }, ptr: 0x1, length: 0 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063284f0, len: 8, data: [0, 0, 0, 0, 0, 0, 0, 0] }, ptr: 0x6000063284f0, length: 8 }, Buffer { data: Bytes { ptr: 0x1, len: 0, data: [] }, ptr: 0x1, length: 0 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328530, len: 8, data: [0, 0, 0, 0, 13, 0, 0, 0] }, ptr: 0x600006328530, length: 8 }, Buffer { data: Bytes { ptr: 0x600006328eb0, len: 13, data: [116, 105, 110, 121, 116, 101, 120, 116, 95, 100, 97, 116, 97] }, ptr: 0x600006328eb0, length: 13 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063284c0, len: 8, data: [0, 0, 0, 0, 9, 0, 0, 0] }, ptr: 0x6000063284c0, length: 8 }, Buffer { data: Bytes { ptr: 0x600006328ef0, len: 9, data: [116, 101, 120, 116, 95, 100, 97, 116, 97] }, ptr: 0x600006328ef0, length: 9 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063284e0, len: 8, data: [0, 0, 0, 0, 15, 0, 0, 0] }, ptr: 0x6000063284e0, length: 8 }, Buffer { data: Bytes { ptr: 0x600006328f20, len: 15, data: [109, 101, 100, 105, 117, 109, 116, 101, 120, 116, 95, 100, 97, 116, 97] }, ptr: 0x600006328f20, length: 15 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328450, len: 8, data: [0, 0, 0, 0, 13, 0, 0, 0] }, ptr: 0x600006328450, length: 8 }, Buffer { data: Bytes { ptr: 0x600006328f50, len: 13, data: [108, 111, 110, 103, 116, 101, 120, 116, 95, 100, 97, 116, 97] }, ptr: 0x600006328f50, length: 13 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063283d0, len: 8, data: [0, 0, 0, 0, 6, 0, 0, 0] }, ptr: 0x6000063283d0, length: 8 }, Buffer { data: Bytes { ptr: 0x600006328f90, len: 6, data: [118, 97, 108, 117, 101, 49] }, ptr: 0x600006328f90, length: 6 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328410, len: 8, data: [0, 0, 0, 0, 13, 0, 0, 0] }, ptr: 0x600006328410, length: 8 }, Buffer { data: Bytes { ptr: 0x600006328fc0, len: 13, data: [118, 97, 108, 117, 101, 49, 44, 118, 97, 108, 117, 101, 50] }, ptr: 0x600006328fc0, length: 13 }], child_data: [], nulls: None }
        ArrayData { data_type: Date32, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006328ff0, len: 4, data: [159, 77, 0, 0] }, ptr: 0x600006328ff0, length: 4 }], child_data: [], nulls: None }
        ArrayData { data_type: Timestamp(Millisecond, None), len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600002068540, len: 8, data: [128, 77, 50, 191, 143, 1, 0, 0] }, ptr: 0x600002068540, length: 8 }], child_data: [], nulls: None }
        ArrayData { data_type: Timestamp(Millisecond, None), len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000020685a0, len: 8, data: [128, 77, 50, 191, 143, 1, 0, 0] }, ptr: 0x6000020685a0, length: 8 }], child_data: [], nulls: None }
        ArrayData { data_type: Time32(Second), len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x600006329040, len: 4, data: [240, 176, 0, 0] }, ptr: 0x600006329040, length: 4 }], child_data: [], nulls: None }
        ArrayData { data_type: UInt16, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x12e107800, len: 2, data: [232, 7] }, ptr: 0x12e107800, length: 2 }], child_data: [], nulls: None }
        ArrayData { data_type: Utf8, len: 1, offset: 0, buffers: [Buffer { data: Bytes { ptr: 0x6000063282e0, len: 8, data: [0, 0, 0, 0, 15, 0, 0, 0] }, ptr: 0x6000063282e0, length: 8 }, Buffer { data: Bytes { ptr: 0x6000063290a0, len: 15, data: [123, 34, 107, 101, 121, 34, 58, 34, 118, 97, 108, 117, 101, 34, 125] }, ptr: 0x6000063290a0, length: 15 }], child_data: [], nulls: None }
        */
        let expected = vec![
            (DataType::Int32, 1_i32.to_ne_bytes().to_vec()),
            (DataType::Int8, 127_i8.to_ne_bytes().to_vec()),
            (DataType::Int16, 32767_i16.to_ne_bytes().to_vec()),
            (DataType::Int32, 8388607_i32.to_ne_bytes().to_vec()),
            (DataType::Int32, 2147483647_i32.to_ne_bytes().to_vec()),
            (
                DataType::Int64,
                9223372036854775807_i64.to_ne_bytes().to_vec(),
            ),
            (DataType::Float64, 12345.67_f64.to_ne_bytes().to_vec()),
            (DataType::Float32, 123.45_f32.to_ne_bytes().to_vec()),
            (
                DataType::Float64,
                123456789.123456_f64.to_ne_bytes().to_vec(),
            ),
        ];

        validate_parquet(response, expected).await;
        // assert_eq!(response.status(), 200);
    }
}
