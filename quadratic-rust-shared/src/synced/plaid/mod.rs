use async_trait::async_trait;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::SharedError;
use crate::environment::Environment;
use crate::error::Result;
use crate::synced::plaid::client::{PlaidClient, PlaidEnvironment};
use crate::synced::{DATE_FORMAT, SyncedClient, SyncedConnection, SyncedConnectionKind};

pub mod balance;
pub mod client;
pub mod investments;
pub mod liabilities;
pub mod transactions;

#[derive(Debug, Deserialize, Serialize)]
pub struct PlaidConnection {
    pub start_date: String,
    /// Access token obtained after user links their account via Plaid Link
    pub access_token: String,
    /// Optional institution name for display purposes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub institution_name: Option<String>,

    /// Optional values, set them from environment variables    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<PlaidEnvironment>,
}

#[async_trait]
impl SyncedConnection for PlaidConnection {
    fn name(&self) -> &str {
        "PLAID"
    }

    fn kind(&self) -> SyncedConnectionKind {
        SyncedConnectionKind::Plaid
    }

    fn start_date(&self) -> NaiveDate {
        NaiveDate::parse_from_str(&self.start_date, DATE_FORMAT)
            .map_err(|e| SharedError::Synced(format!("Invalid start_date format: {}", e)))
            .unwrap()
    }

    fn streams(&self) -> Vec<&'static str> {
        PlaidClient::streams()
    }

    async fn to_client(&self, environment: Environment) -> Result<Box<dyn SyncedClient>> {
        let client_id = self
            .client_id
            .as_ref()
            .ok_or_else(|| SharedError::Synced("Client ID not set".to_string()))?;
        let secret = self
            .secret
            .as_ref()
            .ok_or_else(|| SharedError::Synced("Secret not set".to_string()))?;

        let client = PlaidClient::new(
            client_id,
            secret,
            environment.into(),
            Some(self.access_token.to_string()),
        );

        Ok(Box::new(client))
    }
}

// For testing only
use std::sync::{LazyLock, Mutex};
pub static PLAID_CREDENTIALS: LazyLock<Mutex<Option<String>>> = LazyLock::new(|| {
    // Try to load .env.test file, but don't fail if it doesn't exist
    let _ = dotenv::from_filename(".env.test");
    let credentials = std::env::var("PLAID_CREDENTIALS").ok();

    Mutex::new(credentials)
});

#[derive(Debug, Deserialize, Serialize)]
pub struct PlaidConfigFromEnv {
    pub client_id: String,
    pub secret: String,
}
pub async fn new_plaid_client(
    add_access_token: bool,
    products: Vec<plaid::model::Products>,
) -> PlaidClient {
    new_plaid_client_with_products(add_access_token, products).await
}

async fn new_plaid_client_with_products(
    add_access_token: bool,
    products: Vec<plaid::model::Products>,
) -> PlaidClient {
    // Clone the credentials out of the mutex, then drop the lock before potentially panicking.
    // This prevents the mutex from being poisoned if credentials are missing.
    let credentials = {
        let guard = PLAID_CREDENTIALS
            .lock()
            .expect("PLAID_CREDENTIALS lock poisoned");
        guard.clone()
    };
    let credentials =
        credentials.expect("PLAID_CREDENTIALS not set in .env.test - create a .env.test file with PLAID_CREDENTIALS='{\"client_id\":\"...\",\"secret\":\"...\"}'");
    let config = serde_json::from_str::<PlaidConfigFromEnv>(&credentials)
        .expect("Failed to parse PLAID_CREDENTIALS JSON");
    let environment = PlaidEnvironment::Sandbox;
    let mut client = PlaidClient::new(&config.client_id, &config.secret, environment, None);

    if add_access_token {
        let public_token_response = client
            .client
            .sandbox_public_token_create(
                products,
                "ins_109508", // First Platypus Bank - test institution (supports investments)
            )
            .await
            .expect("Failed to create sandbox public token. Check your credentials in .env.test");

        let exchange_response = client
            .client
            .item_public_token_exchange(&public_token_response.public_token)
            .await
            .expect("Failed to exchange public token for access token");

        // Set the access token and test the connection
        client.access_token = Some(exchange_response.access_token);
    }

    client
}
