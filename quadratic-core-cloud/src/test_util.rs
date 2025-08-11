// use fake::faker::filesystem::en::FilePath;
// use fake::faker::internet::en::FreeEmail;
// use fake::faker::name::en::{FirstName, LastName};
// use fake::Fake;
// use quadratic_core::controller::operations::operation::Operation;
// use quadratic_core::controller::GridController;
// use quadratic_core::{Array, CellValue, SheetRect};
use std::sync::Arc;

use axum::body::Body;
use axum::{Router, http};
use chrono::Utc;
use http::{Request, Response};
use jsonwebtoken::jwk::JwkSet;
use serde_json::json;
use tower::util::ServiceExt;
use uuid::Uuid;

use crate::config::{Config, config, config_with_file};
use crate::server::app;
use crate::state::State;
use crate::state::pubsub::ScheduledTask;

pub static GROUP_NAME_TEST: &str = "quadratic-core-cloud-test-1";

pub(crate) fn new_jwks() -> JwkSet {
    let key = "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU=";
    let jwks_json = json!({
        "keys": [
            {
                "kty": "oct",
                "alg": "HS256",
                "kid": "abc123",
                "k": key
            }
        ]
    });

    serde_json::from_value(jwks_json).expect("Failed HS256 check")
}

pub(crate) async fn new_state() -> State {
    let config = config().unwrap();
    State::new(&config, Some(new_jwks())).await.unwrap()
}

pub(crate) async fn new_arc_state() -> Arc<State> {
    Arc::new(new_state().await)
}

pub(crate) async fn setup() -> (Config, Arc<State>, Uuid) {
    let config = config_with_file(".env").unwrap();
    let state = new_arc_state().await;
    let channel = Uuid::new_v4();
    let scheduled_task = ScheduledTask {
        id: Uuid::new_v4(),
        file_id: Uuid::new_v4(),
        operations: vec![],
        start_datetime: Utc::now(),
        end_datetime: None,
        frequency_minutes: 0,
    };

    state
        .subscribe_pubsub(&channel.to_string(), GROUP_NAME_TEST)
        .await
        .unwrap();

    insert_scheduled_task(&state, &channel.to_string(), scheduled_task).await;

    (config, state, channel)
}

pub(crate) async fn response(app: Router, method: http::Method, uri: &str) -> Response<Body> {
    app.oneshot(
        Request::builder()
            .method(method)
            .uri(uri)
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .unwrap()
}

// insert a scheduled task into the pubsub queue
pub(crate) async fn insert_scheduled_task(
    state: &Arc<State>,
    channel: &str,
    scheduled_task: ScheduledTask,
) {
    // let transaction = ScheduledTask::new(task);
    state
        .pubsub
        .lock()
        .await
        .push_scheduled_task(channel, scheduled_task)
        .await
        .unwrap();
}

/// Process a route and return the response.
/// TODO(ddimaria): move to quadratic-rust-shared
pub(crate) async fn process_route(uri: &str, method: http::Method, body: Body) -> Response<Body> {
    let state = new_arc_state().await;
    let app = app(state);

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
