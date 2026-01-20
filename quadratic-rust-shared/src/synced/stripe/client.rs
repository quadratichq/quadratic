//! Stripe API Client
//!
//! This client provides access to Stripe data export endpoints:
//! - Customers
//! - Charges

use async_trait::async_trait;
use bytes::Bytes;
use chrono::NaiveDate;
use std::collections::HashMap;
use stripe::Client;

use crate::synced::SyncedClient;
use crate::{SharedError, error::Result};

/// Stripe client configuration
#[derive(Debug, Clone)]
pub struct StripeConfig {
    pub api_key: String,
}

impl StripeConfig {
    pub fn new(api_key: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
        }
    }
}

/// Stripe client for data export
pub struct StripeClient {
    client: Client,
    config: StripeConfig,
}

impl std::fmt::Debug for StripeClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StripeClient")
            .field("config", &self.config)
            .finish()
    }
}

#[async_trait]
impl SyncedClient for StripeClient {
    /// Get the streams available for this client
    fn streams() -> Vec<&'static str> {
        vec!["customers", "charges"]
    }

    /// Test the connection and authentication
    async fn test_connection(&self) -> bool {
        // Try to list a single customer to verify credentials
        self.list_customers_page(None, Some(1)).await.is_ok()
    }

    /// Process a single stream
    async fn process(
        &self,
        stream: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<HashMap<String, Bytes>> {
        match stream {
            "customers" => self.export_customers(start_date, end_date).await,
            "charges" => self.export_charges(start_date, end_date).await,
            _ => Err(SharedError::Synced(format!(
                "Unknown Stripe stream: {}",
                stream
            ))),
        }
    }
}

impl StripeClient {
    /// Create a new Stripe client with the given API key
    pub fn new(api_key: &str) -> Self {
        let config = StripeConfig::new(api_key);
        Self::from_config(config)
    }

    /// Create a new Stripe client from configuration
    pub fn from_config(config: StripeConfig) -> Self {
        let client = Client::new(&config.api_key);
        Self { client, config }
    }

    /// Get a reference to the underlying Stripe client
    pub fn client(&self) -> &Client {
        &self.client
    }

    /// Get a reference to the configuration
    pub fn config(&self) -> &StripeConfig {
        &self.config
    }
}

// For testing
use std::sync::{LazyLock, Mutex};
pub static STRIPE_CREDENTIALS: LazyLock<Mutex<String>> = LazyLock::new(|| {
    let _path = dotenv::from_filename(".env.test").ok();
    let credentials = std::env::var("STRIPE_API_KEY").unwrap_or_default();

    Mutex::new(credentials)
});

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct StripeConfigFromEnv {
    pub api_key: String,
}

pub fn new_stripe_client() -> StripeClient {
    let credentials = STRIPE_CREDENTIALS.lock().unwrap().to_string();
    StripeClient::new(&credentials)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stripe_client_new() {
        let client = StripeClient::new("sk_test_123");

        assert_eq!(client.config().api_key, "sk_test_123");
    }

    #[test]
    fn test_stripe_streams() {
        let streams = StripeClient::streams();

        assert!(streams.contains(&"customers"));
        assert!(streams.contains(&"charges"));
    }

    // Integration test that requires real credentials - kept ignored
    #[ignore]
    #[tokio::test]
    async fn test_stripe_connection() {
        let client = new_stripe_client();
        let is_connected = client.test_connection().await;

        assert!(is_connected);
    }
}
