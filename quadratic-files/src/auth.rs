//! Authentication and authorization middleware.
//!
//!

use axum::{
    RequestPartsExt,
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use axum_extra::{
    TypedHeader,
    headers::{Authorization, authorization::Bearer},
};
use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::auth::jwt::authorize;
use serde::{Deserialize, Serialize};

use crate::error::{FilesError, Result};

// TODO(ddimaria): this is duplicated in files, abstract in quadratic-rust-shared
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[allow(dead_code)]
pub struct Claims {
    pub email: String,
    pub exp: usize,
}

/// Instance of Axum's middleware that also contains a copy of state
#[cfg(not(test))]
pub fn get_middleware(jwks: JwkSet) -> axum::middleware::FromExtractorLayer<Claims, JwkSet> {
    axum::middleware::from_extractor_with_state::<Claims, _>(jwks)
}

// Middleware that accepts json for tests
#[cfg(test)]
pub fn get_middleware(
    _jwks: JwkSet,
) -> tower_http::validate_request::ValidateRequestHeaderLayer<
    tower_http::validate_request::AcceptHeader<axum::body::Body>,
> {
    tower_http::validate_request::ValidateRequestHeaderLayer::accept("application/json")
}

/// Extract the claims from the request.
/// Anytime a claims parameter is added to a handler, this will automatically
/// be called.
impl<S> FromRequestParts<S> for Claims
where
    JwkSet: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = FilesError;

    async fn from_request_parts(parts: &mut Parts, jwks: &S) -> Result<Self> {
        let jwks = JwkSet::from_ref(jwks);
        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|e| FilesError::Authentication(e.to_string()))?;

        let token_data = authorize(&jwks, bearer.token(), false, true)?;

        Ok(token_data.claims)
    }
}

#[cfg(test)]
pub(crate) mod tests {}
