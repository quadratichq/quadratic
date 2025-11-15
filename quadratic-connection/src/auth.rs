//! Authentication and authorization middleware.
//!
//!

use axum::{
    RequestPartsExt, async_trait,
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use axum_extra::{
    TypedHeader,
    headers::{Authorization, authorization::Bearer},
};
use quadratic_rust_shared::auth::jwt::{authorize, authorize_m2m};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    error::{ConnectionError, Result},
    state::State,
};

/// The claims from the Quadratic/Auth JWT token.
/// We need our own implementation of this because we need to impl on it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub email: String,
    pub exp: usize,
}

/// Instance of Axum's middleware that also contains a copy of state
#[cfg(not(test))]
pub fn get_middleware(
    state: Arc<State>,
) -> axum::middleware::FromExtractorLayer<Claims, Arc<State>> {
    axum::middleware::from_extractor_with_state::<Claims, _>(state)
}

// Middleware that accepts json for tests
#[cfg(test)]
pub fn get_middleware(
    _state: Arc<State>,
) -> tower_http::validate_request::ValidateRequestHeaderLayer<
    tower_http::validate_request::AcceptHeader<axum::body::Body>,
> {
    tower_http::validate_request::ValidateRequestHeaderLayer::accept("application/json")
}

/// Extract the claims from the request.
/// Anytime a claims parameter is added to a handler, this will automatically
/// be called.
#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    Arc<State>: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ConnectionError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        let state = Arc::<State>::from_ref(state);
        let jwks = state
            .settings
            .jwks
            .as_ref()
            .ok_or(ConnectionError::InternalServer(
                "JWKS not found in state".to_string(),
            ))?;

        let m2m_token = state.settings.m2m_auth_token.clone();

        match authorize_m2m(&parts.headers, &m2m_token) {
            Ok(token_data) => {
                return Ok(Claims {
                    email: token_data.claims.email,
                    exp: token_data.claims.exp,
                });
            }
            Err(_e) => {
                // Extract the token from the authorization header
                let TypedHeader(Authorization(bearer)) = parts
                    .extract::<TypedHeader<Authorization<Bearer>>>()
                    .await
                    .map_err(|e| ConnectionError::InvalidToken(e.to_string()))?;

                let token_data = authorize(jwks, bearer.token(), false, true)?;

                Ok(token_data.claims)
            }
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {}
