use anyhow::Result;
use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::auth::jwt::generate_jwt;
use tracing::info;
use uuid::Uuid;
use std::sync::Arc;
use axum::{Extension, Json};

use super::State;

const WORKER_JWT_ISS: &str = "quadratic-cloud-controller";

impl State {
    pub(crate) async fn generate_worker_access_token(&self, file_id: Uuid) -> Result<String> {
        info!("Generating worker access token for file {file_id}");

        generate_jwt(
            self.settings.worker_jwt_email.clone(),
            file_id.to_string(),
            WORKER_JWT_ISS.to_string(),
            &self.settings.jwt_encoding_key,
            self.settings.jwt_expiration_seconds,
        )
        .map_err(|e| {
            anyhow::anyhow!(
                "Failed to generate worker access token for file {file_id}, error: {e}",
                
            )
        })
    }
}

pub(crate) async fn handle_jwks(Extension(state): Extension<Arc<State>>) -> Json<JwkSet> {
    Json(state.settings.jwks.clone())
}
