use std::sync::Arc;

use axum::{http::StatusCode, response::IntoResponse};

pub(crate) async fn healthcheck() -> impl IntoResponse {
    StatusCode::OK
}
