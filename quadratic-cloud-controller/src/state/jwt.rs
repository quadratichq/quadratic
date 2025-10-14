use axum::{Extension, Json};
use jsonwebtoken::jwk::JwkSet;
use std::sync::Arc;

use super::State;

pub(crate) async fn handle_jwks(Extension(state): Extension<Arc<State>>) -> Json<JwkSet> {
    Json(state.settings.jwks.clone())
}
