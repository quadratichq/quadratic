use uuid::Uuid;

use crate::auth::jwt::Claims;

#[derive(Debug, Clone, PartialEq)]
pub struct PreConnection {
    pub id: Uuid,
    pub jwt: Option<String>,
    pub m2m_token: Option<String>,
    /// Validated claims from the JWT (if authenticated via JWT)
    pub claims: Option<Claims>,
}

impl PreConnection {
    pub fn new(jwt: Option<String>, m2m_token: Option<String>, claims: Option<Claims>) -> Self {
        Self {
            id: Uuid::new_v4(),
            jwt,
            m2m_token,
            claims,
        }
    }

    /// Get the m2m token if it exists.
    pub fn get_m2m_token(&self) -> Option<String> {
        self.m2m_token.clone()
    }

    /// Check if the connection is an m2m connection.
    pub fn is_m2m(&self) -> bool {
        self.m2m_token.is_some()
    }
}
