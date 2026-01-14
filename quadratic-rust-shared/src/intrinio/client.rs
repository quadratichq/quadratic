use intrinio_rs::Client;
use intrinio_rs::types::ApiResponseSecurityStockPrices;
use serde::{Deserialize, Serialize};

use crate::error::{Result, SharedError};
use crate::intrinio::error::Intrinio as IntrinioError;

const INTRINIO_BASE_URL: &str = "https://api-v2.intrinio.com";

pub struct IntrinioClient {
    client: Client,
}

impl IntrinioClient {
    /// Create a new Intrinio client.
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::new(INTRINIO_BASE_URL, api_key),
        }
    }

    /// Get the stock prices for a security.
    pub async fn get_security_stock_prices(
        &self,
        identifier: &str,
    ) -> Result<ApiResponseSecurityStockPrices> {
        self.client
            .get_security_stock_prices()
            .identifier(identifier)
            .send()
            .await
            .map(|response| response.into_inner())
            .map_err(|e| self.endpoint_error("get_security_stock_prices", e))
    }

    fn endpoint_error(&self, endpoint: &str, error: impl ToString) -> SharedError {
        IntrinioError::Endpoint(endpoint.to_string(), error.to_string()).into()
    }
}

// For testing
#[cfg(test)]
use std::sync::{LazyLock, Mutex};

#[cfg(test)]
pub static INTRINIO_CREDENTIALS: LazyLock<Mutex<String>> = LazyLock::new(|| {
    let _path = dotenv::from_filename(".env.test").ok();
    let credentials =
        std::env::var("INTRINIO_CREDENTIALS").expect("INTRINIO_CREDENTIALS must be set");

    Mutex::new(credentials)
});

#[derive(Debug, Deserialize, Serialize)]
pub struct IntrinioConfigFromEnv {
    pub api_key: String,
}

#[cfg(test)]
pub fn new_intrinio_client() -> IntrinioClient {
    let credentials = INTRINIO_CREDENTIALS
        .lock()
        .expect("Failed to lock INTRINIO_CREDENTIALS")
        .to_string();
    let config = serde_json::from_str::<IntrinioConfigFromEnv>(&credentials)
        .expect("Failed to parse INTRINIO_CREDENTIALS");

    IntrinioClient::new(&config.api_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_security_stock_prices() {
        let client = new_intrinio_client();
        let stock_prices = client.get_security_stock_prices("AAPL").await.unwrap();
        println!("Stock prices: {:?}", stock_prices);
    }
}
