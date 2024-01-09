use std::sync::Arc;

use axum::{http::StatusCode, response::IntoResponse};

use crate::state::State;

pub(crate) async fn healthcheck() -> impl IntoResponse {
    StatusCode::OK
}

pub(crate) async fn stats(state: &Arc<State>) -> impl IntoResponse {
    StatusCode::OK
}
