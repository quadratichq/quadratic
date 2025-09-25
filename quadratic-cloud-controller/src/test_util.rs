#[cfg(test)]
use axum::{body::Body, http, response::Response};

#[cfg(test)]
use std::sync::Arc;

#[cfg(test)]
use tower::ServiceExt;

#[cfg(test)]
use crate::{config::Config, server::public_app, state::State};

#[cfg(test)]
pub(crate) async fn new_state() -> Arc<State> {
    let config = Config::new().unwrap();
    let state = State::new(&config).await.unwrap();
    Arc::new(state)
}

/// Process a route and return the response.
/// TODO(ddimaria): move to quadratic-rust-shared
#[cfg(test)]
pub(crate) async fn process_route(uri: &str, method: http::Method, body: Body) -> Response<Body> {
    let state = new_state().await;
    let public_app = public_app(state).unwrap();

    public_app
        .oneshot(
            axum::http::Request::builder()
                .method(method)
                .uri(uri)
                .body(body)
                .unwrap(),
        )
        .await
        .unwrap()
}
