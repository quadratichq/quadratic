use async_trait::async_trait;
use bytes::Bytes;
use chrono::NaiveDate;
use httpclient::Client as HttpClient;
use plaid::model::{CountryCode, LinkTokenCreateRequestUser, Products};
use plaid::request::link_token_create::LinkTokenCreateRequired;
use plaid::{PlaidAuth, PlaidClient as Client};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use strum_macros::{Display, EnumString};

use crate::SharedError;
use crate::error::Result;
use crate::synced::SyncedClient;

pub static PLAIV_VERSION: &'static str = "2020-09-14";

#[derive(Debug, Clone, Copy, EnumString, Display, Serialize, Deserialize)]
#[strum(serialize_all = "lowercase")]
pub enum PlaidEnvironment {
    Sandbox,
    Development,
    Production,
}

impl PlaidEnvironment {
    /// Get the base URL for this environment
    pub fn base_url(&self) -> &'static str {
        match self {
            PlaidEnvironment::Sandbox => "https://sandbox.plaid.com",
            PlaidEnvironment::Development => "https://development.plaid.com",
            PlaidEnvironment::Production => "https://production.plaid.com",
        }
    }
}

pub struct PlaidClient {
    pub client_id: String,
    pub secret: String,
    pub client: Client,
    pub environment: PlaidEnvironment,
    pub access_token: Option<String>,
}

impl PlaidClient {
    /// Create a new Plaid client.
    pub fn new(client_id: &str, secret: &str, environment: PlaidEnvironment) -> Self {
        let authentication = PlaidAuth::ClientId {
            client_id: client_id.to_string(),
            secret: secret.to_string(),
            version: PLAIV_VERSION.into(),
        };

        // Create an HTTP client with the correct base URL for the environment
        // This avoids needing to set the PLAID_ENV environment variable
        let http_client = HttpClient::new().base_url(environment.base_url());
        let client = Client::new(http_client, authentication);

        Self {
            client_id: client_id.to_string(),
            secret: secret.to_string(),
            client,
            environment,
            access_token: None,
        }
    }

    /// Create a new Plaid client with an access token
    pub fn with_access_token(
        client_id: &str,
        secret: &str,
        environment: PlaidEnvironment,
        access_token: String,
    ) -> Self {
        let mut client = Self::new(client_id, secret, environment);
        client.access_token = Some(access_token);
        client
    }

    /// Get the access token
    /// Returns the access token if it is set
    /// Returns an error if the access token is not set
    pub fn access_token(&self) -> Result<&String> {
        self.access_token
            .as_ref()
            .ok_or_else(|| SharedError::Synced("Access token not set".to_string()))
    }

    /// Create a link token for Plaid Link initialization
    /// This token is used to initialize Plaid Link on the frontend
    ///
    /// # Arguments
    /// * `user_id` - Your internal user ID
    /// * `client_name` - Your app name (displayed to users in Plaid Link)
    ///
    /// # Returns
    /// Returns the link token that should be sent to the frontend
    pub async fn create_link_token(&self, user_id: &str, client_name: &str) -> Result<String> {
        let user = LinkTokenCreateRequestUser {
            client_user_id: user_id.to_string(),
            ..Default::default()
        };

        let required = LinkTokenCreateRequired {
            client_name,
            language: "en",
            country_codes: vec![CountryCode::Us],
            user,
        };

        let response = self
            .client
            .link_token_create(required)
            .products(vec![Products::Transactions])
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to create link token: {}", e)))?;

        Ok(response.link_token)
    }

    /// Exchange a public token for an access token
    /// This is called after the user successfully links their account via Plaid Link
    ///
    /// # Arguments
    /// * `public_token` - The public token received from Plaid Link
    ///
    /// # Returns
    /// Returns the access token that should be stored securely for future API calls
    pub async fn exchange_public_token(&mut self, public_token: &str) -> Result<String> {
        let response = self
            .client
            .item_public_token_exchange(public_token)
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to exchange public token: {}", e)))?;

        // Store the access token in the client for future API calls
        self.access_token = Some(response.access_token.clone());

        Ok(response.access_token)
    }

    /// Get item information including consent expiration
    /// Use this to check when user consent expires
    ///
    /// # Returns
    /// Returns item information including consent_expiration_time
    pub async fn get_item(&self) -> Result<serde_json::Value> {
        let access_token = self.access_token()?;

        let response = self
            .client
            .item_get(access_token)
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to get item: {}", e)))?;

        // Convert the response to JSON for flexible access
        serde_json::to_value(&response)
            .map_err(|e| SharedError::Synced(format!("Failed to serialize item response: {}", e)))
    }
}

#[async_trait]
impl SyncedClient for PlaidClient {
    /// Get the streams available for this client
    fn streams() -> Vec<&'static str> {
        vec!["transactions"]
    }

    /// Test the connection to the Plaid API.
    /// This requires an access token to be set
    async fn test_connection(&self) -> bool {
        self.get_item().await.is_ok()
    }

    /// Process a single stream
    async fn process(
        &self,
        stream: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<HashMap<String, Bytes>> {
        match stream {
            "transactions" => {
                let transactions = self.get_transactions(start_date, end_date).await?;

                // Convert transactions to parquet format
                let parquet_bytes =
                    crate::synced::plaid::transactions::transactions_to_parquet(transactions)?;

                let mut result = HashMap::new();
                result.insert("transactions".to_string(), parquet_bytes);
                Ok(result)
            }
            _ => Err(SharedError::Synced(format!("Unknown stream: {}", stream))),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::synced::plaid::new_plaid_client;

    use super::*;

    #[tokio::test]
    async fn test_plaid_client() {
        let client = new_plaid_client(true).await;
        assert!(client.test_connection().await);
    }
}
