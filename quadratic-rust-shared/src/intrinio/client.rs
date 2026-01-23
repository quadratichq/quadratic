use chrono::NaiveDate;
use intrinio_rs::Client;
use intrinio_rs::types::ApiResponseSecurityStockPrices;
use serde::{Deserialize, Serialize};

use crate::error::{Result, SharedError};
use crate::intrinio::error::Intrinio as IntrinioError;

const INTRINIO_BASE_URL: &str = "https://api-v2.intrinio.com";

#[derive(Debug, Clone)]
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
    ///
    /// # Arguments
    ///
    /// * `identifier` - The stock ticker symbol (e.g., "AAPL").
    /// * `start_date` - Optional start date for the price data.
    /// * `end_date` - Optional end date for the price data.
    pub async fn get_security_stock_prices(
        &self,
        identifier: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> Result<ApiResponseSecurityStockPrices> {
        let mut request = self
            .client
            .get_security_stock_prices()
            .identifier(identifier);

        if let Some(start) = start_date {
            request = request.start_date(start);
        }
        if let Some(end) = end_date {
            request = request.end_date(end);
        }

        request
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

        // Test with date range
        let start_date = NaiveDate::from_ymd_opt(2025, 1, 1);
        let end_date = NaiveDate::from_ymd_opt(2025, 1, 31);
        let stock_prices = client
            .get_security_stock_prices("AAPL", start_date, end_date)
            .await
            .expect("get_security_stock_prices should succeed");

        println!("Stock prices: {:?}", stock_prices);
    }
}
