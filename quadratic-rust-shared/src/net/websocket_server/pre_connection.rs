use uuid::Uuid;

#[derive(Debug, Clone, PartialEq)]
pub struct PreConnection {
    pub id: Uuid,
    pub jwt: Option<String>,
    pub m2m_token: Option<String>,
}

impl PreConnection {
    pub fn new(jwt: Option<String>, m2m_token: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            jwt,
            m2m_token,
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
