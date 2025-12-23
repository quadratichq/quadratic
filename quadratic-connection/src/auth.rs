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
use http::HeaderName;
use quadratic_rust_shared::auth::jwt::{Claims as SharedClaims, authorize, authorize_m2m};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{ConnectionError, Result},
    state::State,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Claims {
    pub email: String,
    pub exp: usize,
    pub file_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
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

        // For M2M tokens (internal services), skip team_id validation
        match authorize_m2m(&parts.headers, &m2m_token) {
            Ok(token_data) => {
                return Ok(Claims {
                    email: token_data.claims.email,
                    exp: token_data.claims.exp,
                    file_id: None,
                    team_id: None,
                });
            }
            Err(_e) => {
                // Extract the token from the authorization header
                let TypedHeader(Authorization(bearer)) = parts
                    .extract::<TypedHeader<Authorization<Bearer>>>()
                    .await
                    .map_err(|e| ConnectionError::InvalidToken(e.to_string()))?;

                let token_data = authorize::<SharedClaims>(jwks, bearer.token(), false, true)?;

                // Validate team_id if present in JWT claims
                if let Some(jwt_team_id) = token_data.claims.team_id {
                    let header_team_id = parts
                        .headers
                        .get(HeaderName::from_static("x-team-id"))
                        .and_then(|v| v.to_str().ok())
                        .and_then(|s| Uuid::parse_str(s).ok());

                    match header_team_id {
                        Some(header_id) if header_id == jwt_team_id => {
                            // team_id matches, continue
                        }
                        Some(header_id) => {
                            tracing::warn!(
                                "JWT team_id {} does not match x-team-id header {} (file_id: {:?})",
                                jwt_team_id,
                                header_id,
                                token_data.claims.file_id
                            );
                            return Err(ConnectionError::Authentication(
                                "team_id mismatch".to_string(),
                            ));
                        }
                        None => {
                            // JWT has team_id but header is missing - reject to prevent bypass
                            tracing::warn!(
                                "JWT has team_id {} but x-team-id header is missing (file_id: {:?})",
                                jwt_team_id,
                                token_data.claims.file_id
                            );
                            return Err(ConnectionError::Authentication(
                                "missing x-team-id header".to_string(),
                            ));
                        }
                    }
                }

                Ok(Claims {
                    email: token_data.claims.email,
                    exp: token_data.claims.exp,
                    file_id: token_data.claims.file_id,
                    team_id: token_data.claims.team_id,
                })
            }
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {}
