use async_trait::async_trait;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::SharedError;
use crate::error::Result;
use crate::synced::plaid::client::{PlaidClient, PlaidEnvironment};
use crate::synced::{DATE_FORMAT, SyncedClient, SyncedConnection, SyncedConnectionKind};

pub mod client;
pub mod transactions;

#[derive(Debug, Deserialize, Serialize)]
pub struct PlaidConnection {
    pub environment: PlaidEnvironment,
    pub client_id: String,
    pub secret: String,
    pub start_date: String,
    /// Access token obtained after user links their account via Plaid Link
    pub access_token: String,
    /// Optional institution name for display purposes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub institution_name: Option<String>,
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

    async fn to_client(&self) -> Result<Box<dyn SyncedClient>> {
        let client = PlaidClient::with_access_token(
            &self.client_id,
            &self.secret,
            self.environment,
            self.access_token.to_string(),
        );

        Ok(Box::new(client))
    }
}

// For testing only
use std::sync::{LazyLock, Mutex};
pub static PLAID_CREDENTIALS: LazyLock<Mutex<String>> = LazyLock::new(|| {
    dotenv::from_filename(".env.test").unwrap();
    let credentials = std::env::var("PLAID_CREDENTIALS").unwrap();

    Mutex::new(credentials)
});

#[derive(Debug, Deserialize, Serialize)]
pub struct PlaidConfigFromEnv {
    pub client_id: String,
    pub secret: String,
}
pub async fn new_plaid_client(add_access_token: bool) -> PlaidClient {
    let credentials = PLAID_CREDENTIALS.lock().unwrap().to_string();
    let config = serde_json::from_str::<PlaidConfigFromEnv>(&credentials).unwrap();
    let mut client = PlaidClient::new(&config.client_id, &config.secret, PlaidEnvironment::Sandbox);

    if add_access_token {
        let public_token_response = client
            .client
            .sandbox_public_token_create(
                vec![plaid::model::Products::Transactions],
                "ins_109508", // Chase - test institution
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
