// use fake::faker::filesystem::en::FilePath;
// use fake::faker::internet::en::FreeEmail;
// use fake::faker::name::en::{FirstName, LastName};
// use fake::Fake;
// use quadratic_core::controller::operations::operation::Operation;
// use quadratic_core::controller::GridController;
// use quadratic_core::{Array, CellValue, SheetRect};

use std::io::Read;

use arrow_schema::DataType;
use axum::body::Body;
use axum::response::Response;
use bytes::Bytes;
use futures::StreamExt;
use http::{HeaderMap, HeaderName, HeaderValue};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::data_type::AsBytes;
use quadratic_rust_shared::sql::postgres_connection::PostgresConnection;
use serde::de::DeserializeOwned;
use tower::ServiceExt;
use uuid::Uuid;

use crate::auth::Claims;
use crate::config::config;
use crate::server::app;
use crate::state::State;

/// Utility to test a connection over various databases.
#[macro_export]
macro_rules! test_connection {
    ( $connection:expr ) => {{
        let (_, headers) = $crate::test_util::new_team_id_with_header().await;
        let state = Extension($crate::test_util::new_state().await);
        let claims = $crate::test_util::get_claims();
        let response = test(headers, state, claims, axum::Json($connection))
            .await
            .unwrap();

        println!("response: {:?}", response);

        assert_eq!(response.0, TestResponse::new(true, None));
    }};
}

/// Convert a number into a vector of bytes.
#[macro_export]
macro_rules! num_vec {
    ( $value:expr ) => {{ $value.to_le_bytes().to_vec() }};
}

// Convert a string into a vector of bytes.
pub(crate) fn str_vec(value: &str) -> Vec<u8> {
    value.as_bytes().to_vec()
}

pub(crate) async fn new_state() -> State {
    let config = config().unwrap();
    State::new(&config, None).unwrap()
}

pub(crate) async fn new_team_id_with_header() -> (Uuid, HeaderMap) {
    let team_id = Uuid::new_v4();
    let mut headers = HeaderMap::new();
    headers.insert(
        HeaderName::from_static("x-team-id"),
        HeaderValue::from_str(&team_id.to_string()).unwrap(),
    );

    (team_id, headers)
}
/// TODO(ddimaria): remove once API is setup to return connections
pub(crate) fn _new_postgres_connection() -> PostgresConnection {
    PostgresConnection::new(
        Some("postgres".into()),
        Some("postgres".into()),
        "0.0.0.0".into(),
        Some("5432".into()),
        "postgres".into(),
        Some(false),
        Some("".into()),
        Some("".into()),
        Some("".into()),
        Some("".into()),
    )
}

pub(crate) fn get_claims() -> Claims {
    Claims {
        email: "test@test.com".to_string(),
        exp: 0,
    }
}

pub(crate) async fn response_bytes(response: Response) -> Bytes {
    StreamExt::into_future(response.into_body().into_data_stream())
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
        println!("data_type: {data_type:?}, value: {value:?}");
        println!("expected data_type: {:?}", expect.0);

        assert_eq!(data_type, expect.0, "Invalid data type at index {count}");
        assert_eq!(value, expect.1, "Invalid value at index {count}");
    }
}

/// Process a route and return the response.
/// TODO(ddimaria): move to quadratic-rust-shared
pub(crate) async fn process_route(uri: &str, method: http::Method, body: Body) -> Response<Body> {
    let state = new_state().await;
    let app = app(state).unwrap();

    app.oneshot(
        axum::http::Request::builder()
            .method(method)
            .uri(uri)
            .body(body)
            .unwrap(),
    )
    .await
    .unwrap()
}
