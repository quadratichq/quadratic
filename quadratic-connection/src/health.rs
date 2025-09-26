use axum::{Extension, Json};
use quadratic_rust_shared::quadratic_api::is_healthy;
use serde::{Deserialize, Serialize};

use crate::state::State;

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct HealthResponse {
    pub version: String,
}

pub(crate) async fn healthcheck() -> Json<HealthResponse> {
    HealthResponse {
        version: env!("CARGO_PKG_VERSION").into(),
    }
    .into()
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct FullHealthResponse {
    pub version: String,
    pub api_is_healthy: bool,
}

pub(crate) async fn full_healthcheck(
    Extension(state): Extension<State>,
) -> Json<FullHealthResponse> {
    println!("state: {:?}", state);
    let version = env!("CARGO_PKG_VERSION").into();
    println!(
        "state.settings.quadratic_api_uri: {:?}",
        state.settings.quadratic_api_uri
    );
    let api_is_healthy = is_healthy(&state.settings.quadratic_api_uri).await;

    FullHealthResponse {
        version,
        api_is_healthy,
    }
    .into()
}

#[cfg(test)]
mod tests {
    use crate::test_util::process_route;
    use axum::{
        body::Body,
        http::{self, StatusCode},
    };

    #[tokio::test]
    async fn responds_with_a_200_ok_for_a_healthcheck() {
        let response = process_route("/health", http::Method::GET, Body::empty()).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn responds_with_a_200_ok_for_a_full_healthcheck() {
        let response = process_route("/health/full", http::Method::GET, Body::empty()).await;
        assert_eq!(response.status(), StatusCode::OK);
    }
}
