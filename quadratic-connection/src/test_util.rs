// use fake::faker::filesystem::en::FilePath;
// use fake::faker::internet::en::FreeEmail;
// use fake::faker::name::en::{FirstName, LastName};
// use fake::Fake;
// use quadratic_core::controller::operations::operation::Operation;
// use quadratic_core::controller::GridController;
// use quadratic_core::{Array, CellValue, SheetRect};

use std::io::Read;

use arrow_schema::DataType;
use axum::response::Response;
use bytes::Bytes;
use futures::StreamExt;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::data_type::AsBytes;
use quadratic_rust_shared::connections::sql::postgres_connection::PostgresConnection;
use serde::de::DeserializeOwned;

use crate::auth::Claims;
use crate::config::config;
use crate::state::State;

/// Utility to test a connection over various databases.
#[macro_export]
macro_rules! test_connection {
    ( $get_connection:expr ) => {{
        let connection_id = Uuid::new_v4();
        let state = new_state().await;
        let claims = get_claims();
        let (mysql_connection, _) = $get_connection(&state, &claims, &connection_id)
            .await
            .unwrap();
        let response = test(axum::Json(mysql_connection)).await;

        assert_eq!(response.0, TestResponse::new(true, None));
    }};
}

/// Convert a number into a vector of bytes.
#[macro_export]
macro_rules! num_vec {
    ( $value:expr ) => {{
        $value.to_le_bytes().to_vec()
    }};
}

// Convert a string into a vector of bytes.
pub(crate) fn str_vec(value: &str) -> Vec<u8> {
    value.as_bytes().to_vec()
}

pub(crate) async fn new_state() -> State {
    let config = config().unwrap();
    State::new(&config, None).unwrap()
}

/// TODO(ddimaria): remove once API is setup to return connections
pub(crate) fn _new_postgres_connection() -> PostgresConnection {
    PostgresConnection::new(
        Some("postgres".into()),
        Some("postgres".into()),
        "0.0.0.0".into(),
        Some("5432".into()),
        Some("postgres".into()),
    )
}

pub(crate) fn get_claims() -> Claims {
    Claims {
        sub: "test".to_string(),
        exp: 0,
    }
}

pub(crate) async fn response_bytes(response: Response) -> Bytes {
    response
        .into_body()
        .into_data_stream()
        .into_future()
        .await
        .0
        .unwrap_or(Ok(Bytes::new()))
        .unwrap()
}

pub(crate) async fn response_json<T: DeserializeOwned>(response: Response) -> T {
    let body = response_bytes(response).await;
    serde_json::from_slice::<T>(&body).unwrap()
}

/// Validate a parquet response against an expected array of (DataType, Value Byte Array)
pub(crate) async fn validate_parquet(response: Response, expected: Vec<(DataType, Vec<u8>)>) {
    let bytes = response_bytes(response).await;
    let builder = ParquetRecordBatchReaderBuilder::try_new(bytes).unwrap();
    let reader = builder.build().unwrap();

    let mut output = vec![];
    for batch in reader {
        let batch = batch.unwrap();
        let num_cols = batch.num_columns();

        for col_index in 0..num_cols {
            let col = batch.column(col_index);

            let value = match col.data_type() {
                DataType::Utf8 => col
                    .as_any()
                    .downcast_ref::<arrow::array::StringArray>()
                    .unwrap()
                    .iter()
                    .flat_map(|s| s.unwrap_or_default().to_string().into_bytes())
                    .collect::<Vec<_>>(),
                _ => col
                    .to_data()
                    .buffer(0)
                    .bytes()
                    .flatten()
                    .flat_map(|s| s.as_bytes().to_owned())
                    .collect::<Vec<_>>(),
            };

            // println!("col: {:?}", col.to_data());
            output.push((col.data_type().to_owned(), value));
        }
    }

    for (count, expect) in expected.iter().enumerate() {
        let (data_type, value) = output.get(count).unwrap().to_owned();

        assert_eq!(data_type, expect.0);
        assert_eq!(value, expect.1);
    }
}
