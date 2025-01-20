// use fake::faker::filesystem::en::FilePath;
// use fake::faker::internet::en::FreeEmail;
// use fake::faker::name::en::{FirstName, LastName};
// use fake::Fake;
// use quadratic_core::controller::operations::operation::Operation;
// use quadratic_core::controller::GridController;
// use quadratic_core::{Array, CellValue, SheetRect};
use std::sync::Arc;

use axum::body::Body;
use axum::{http, Router};
use http::{Request, Response};
use jsonwebtoken::jwk::JwkSet;
use serde_json::json;
use tower::util::ServiceExt;

use crate::config::config;
use crate::state::State;

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

// pub(crate) fn operation(grid: &mut GridController, x: i64, y: i64, value: &str) -> Operation {
//     let sheet_id = grid.sheet_ids().first().unwrap().to_owned();
//     let sheet_rect = SheetRect::single_pos((x, y).into(), sheet_id);
//     let value = CellValue::Text(value.into());
//     let values = Array::from(value);

//     Operation::SetCellValues { sheet_rect, values }
// }
