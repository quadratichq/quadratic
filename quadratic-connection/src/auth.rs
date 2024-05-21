//! Authentication and authorization middleware.
//!
//!

use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
    middleware::{self, FromExtractorLayer},
    RequestPartsExt,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use quadratic_rust_shared::auth::jwt::authorize;
use serde::{Deserialize, Serialize};

use crate::{
    error::{ConnectionError, Result},
    state::State,
};

/// The claims from the Quadratic/Auth0 JWT token.
/// We need our own implementation of this because we need to impl on it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

/// Instance of Axum's middleware that also contains a copy of state
pub fn get_middleware(state: State) -> FromExtractorLayer<Claims, State> {
    middleware::from_extractor_with_state::<Claims, _>(state)
}

/// Extract the claims from the request.
/// Anytime a claims parameter is added to a handler, this will automatically
/// be called.
#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    State: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ConnectionError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        let state = State::from_ref(state);
        let jwks = state
            .settings
            .jwks
            .as_ref()
            .ok_or(ConnectionError::InternalServer(
                "JWKS not found in state".to_string(),
            ))?;

        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|e| ConnectionError::InvalidToken(e.to_string()))?;

        let token_data = authorize(jwks, bearer.token(), false, true)?;

        Ok(token_data.claims)
    }
}

#[cfg(test)]
pub(crate) mod tests {}
