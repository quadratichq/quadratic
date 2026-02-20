use chrono::NaiveDate;
use intrinio_rs::Client;
use intrinio_rs::types::{ApiResponseSecurityStockPrices, GetSecurityStockPricesFrequency};
use serde::{Deserialize, Serialize};

use crate::error::{Result, SharedError};
use crate::intrinio::error::Intrinio as IntrinioError;

const INTRINIO_BASE_URL: &str = "https://api-v2.intrinio.com";

/// Frequency for stock price data.
/// Defaults to Daily if not specified.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StockPriceFrequency {
    #[default]
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
}

impl From<StockPriceFrequency> for GetSecurityStockPricesFrequency {
    fn from(freq: StockPriceFrequency) -> Self {
        match freq {
            StockPriceFrequency::Daily => GetSecurityStockPricesFrequency::Daily,
            StockPriceFrequency::Weekly => GetSecurityStockPricesFrequency::Weekly,
            StockPriceFrequency::Monthly => GetSecurityStockPricesFrequency::Monthly,
            StockPriceFrequency::Quarterly => GetSecurityStockPricesFrequency::Quarterly,
            StockPriceFrequency::Yearly => GetSecurityStockPricesFrequency::Yearly,
        }
    }
}

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
    /// * `frequency` - Optional frequency for the price data (defaults to Daily).
    pub async fn get_security_stock_prices(
        &self,
        identifier: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        frequency: Option<StockPriceFrequency>,
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

        let freq: GetSecurityStockPricesFrequency = frequency.unwrap_or_default().into();
        request = request.frequency(freq);

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

// For testing - tries INTRINIO_API first
#[cfg(test)]
use std::sync::{LazyLock, Mutex};

#[cfg(test)]
pub static INTRINIO_API_KEY: LazyLock<Mutex<String>> = LazyLock::new(|| {
    let _path = dotenv::from_filename(".env.test").ok();

    // Try INTRINIO_API_KEY first (plain API key)
    if let Ok(api_key) = std::env::var("INTRINIO_API_KEY") {
        return Mutex::new(api_key);
    }

    panic!("INTRINIO_API_KEY must be set");
});

#[cfg(test)]
pub fn new_intrinio_client() -> IntrinioClient {
    let api_key = INTRINIO_API_KEY
        .lock()
        .expect("Failed to lock INTRINIO_API_KEY")
        .clone();

    IntrinioClient::new(&api_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_security_stock_prices() {
        let client = new_intrinio_client();

        // Test with date range (daily frequency by default)
        let start_date = NaiveDate::from_ymd_opt(2025, 1, 1);
        let end_date = NaiveDate::from_ymd_opt(2025, 1, 31);
        let stock_prices = client
            .get_security_stock_prices("AAPL", start_date, end_date, None)
            .await
            .expect("get_security_stock_prices should succeed");

        println!("Stock prices (daily): {:?}", stock_prices);
    }

    #[tokio::test]
    async fn test_get_security_stock_prices_weekly() {
        let client = new_intrinio_client();

        // Test with weekly frequency
        let start_date = NaiveDate::from_ymd_opt(2025, 1, 1);
        let end_date = NaiveDate::from_ymd_opt(2025, 1, 31);
        let stock_prices = client
            .get_security_stock_prices(
                "AAPL",
                start_date,
                end_date,
                Some(StockPriceFrequency::Weekly),
            )
            .await
            .expect("get_security_stock_prices should succeed");

        println!("Stock prices (weekly): {:?}", stock_prices);
    }
}
