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
use crate::environment::Environment;
use crate::error::Result;
use crate::synced::{DATE_FORMAT, SyncedClient};
use crate::utils::json::flatten_to_json;

pub static PLAID_VERSION: &str = "2020-09-14";

#[derive(Debug, Clone, Copy, EnumString, Display, Serialize, Deserialize)]
#[strum(serialize_all = "lowercase")]
#[serde(rename_all = "lowercase")]
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

impl std::fmt::Debug for PlaidClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "PlaidClient {{ client_id: {}, secret: {}, environment: {:?}, access_token: {:?} }}",
            self.client_id, self.secret, self.environment, self.access_token
        )
    }
}

impl From<Environment> for PlaidEnvironment {
    fn from(environment: Environment) -> Self {
        match environment {
            Environment::Production => PlaidEnvironment::Production,
            Environment::Development => PlaidEnvironment::Development,
            Environment::Local | Environment::Docker | Environment::Test => {
                PlaidEnvironment::Sandbox
            }
        }
    }
}

impl PlaidClient {
    /// Create a new Plaid client.
    pub fn new(
        client_id: &str,
        secret: &str,
        environment: PlaidEnvironment,
        access_token: Option<String>,
    ) -> Self {
        let authentication = PlaidAuth::ClientId {
            client_id: client_id.to_string(),
            secret: secret.to_string(),
            version: PLAID_VERSION.into(),
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
            access_token,
        }
    }

    /// Create a new Plaid client with an access token
    pub fn with_access_token(&mut self, access_token: String) -> &mut Self {
        self.access_token = Some(access_token);
        self
    }

    /// Get the access token
    /// Returns the access token if it is set
    /// Returns an error if the access token is not set
    pub fn access_token(&self) -> Result<&String> {
        self.access_token
            .as_ref()
            .ok_or_else(|| SharedError::Synced("Access token not set".to_string()))
    }

    /// Make a raw HTTP request to any Plaid endpoint
    ///
    /// This bypasses the plaid crate's type system and returns raw JSON,
    /// which handles null values gracefully. Use this for endpoints where
    /// the plaid crate has deserialization issues.
    ///
    /// # Arguments
    /// * `endpoint` - The Plaid API endpoint (e.g., "liabilities/get")
    /// * `extra_params` - Additional parameters to include in the request body
    ///
    /// # Returns
    /// Returns the raw JSON response as a serde_json::Value
    pub async fn raw_request(
        &self,
        endpoint: &str,
        extra_params: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let access_token = self.access_token()?;
        let url = format!("{}/{}", self.environment.base_url(), endpoint);

        // Build request body with auth and merge extra params
        let mut request_body = serde_json::json!({
            "client_id": self.client_id,
            "secret": self.secret,
            "access_token": access_token,
        });

        // Merge extra_params into request_body
        if let (Some(base), Some(extra)) = (request_body.as_object_mut(), extra_params.as_object())
        {
            for (key, value) in extra {
                base.insert(key.clone(), value.clone());
            }
        }

        let client = reqwest::Client::new();
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Plaid-Version", PLAID_VERSION)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| SharedError::Synced(format!("Plaid request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(SharedError::Synced(format!(
                "Plaid API error: HTTP {} - {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to parse Plaid response: {}", e)))
    }

    /// Fetch paginated array data from a Plaid endpoint
    ///
    /// Handles pagination automatically by fetching in batches of 500.
    ///
    /// # Arguments
    /// * `endpoint` - The Plaid API endpoint (e.g., "transactions/get")
    /// * `start_date` - Start date for the query
    /// * `end_date` - End date for the query
    /// * `array_key` - The key in the response containing the array (e.g., "transactions")
    /// * `total_key` - The key in the response containing the total count (e.g., "total_transactions")
    /// * `extra_options` - Additional options to include in the request
    pub async fn fetch_paginated_array(
        &self,
        endpoint: &str,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
        array_key: &str,
        total_key: &str,
        extra_options: Option<serde_json::Value>,
    ) -> Result<Vec<serde_json::Value>> {
        tracing::info!("Starting Plaid request {endpoint}, from {start_date} to {end_date})",);

        let mut all_items = Vec::new();
        let mut offset = 0;
        let count = 500; // Max allowed by Plaid

        loop {
            let mut options = serde_json::json!({
                "count": count,
                "offset": offset,
            });

            // Merge extra options if provided
            if let Some(extra) = &extra_options
                && let (Some(opts), Some(extra_obj)) = (options.as_object_mut(), extra.as_object())
            {
                for (k, v) in extra_obj {
                    opts.insert(k.clone(), v.clone());
                }
            }

            let response = self
                .raw_request(
                    endpoint,
                    serde_json::json!({
                        "start_date": start_date.format("%Y-%m-%d").to_string(),
                        "end_date": end_date.format("%Y-%m-%d").to_string(),
                        "options": options,
                    }),
                )
                .await?;

            let items = response
                .get(array_key)
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let total = response
                .get(total_key)
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            let fetched_count = items.len();
            all_items.extend(items);

            tracing::trace!(
                "Fetched {} {} (offset: {}, total: {})",
                fetched_count,
                array_key,
                offset,
                total
            );

            if all_items.len() as i64 >= total {
                break;
            }

            offset += count;
        }

        tracing::info!(
            "Completed Plaid request {endpoint}, from {start_date} to {end_date} with {} records",
            all_items.len()
        );

        Ok(all_items)
    }

    /// Fetch object data from a Plaid endpoint (non-paginated)
    ///
    /// # Arguments
    /// * `endpoint` - The Plaid API endpoint (e.g., "liabilities/get")
    /// * `response_key` - The key in the response containing the data (e.g., "liabilities")
    pub async fn fetch_object(
        &self,
        endpoint: &str,
        response_key: &str,
    ) -> Result<serde_json::Value> {
        tracing::info!("Starting Plaid request {endpoint}",);

        let response = self.raw_request(endpoint, serde_json::json!({})).await?;
        let value = response
            .get(response_key)
            .cloned()
            .unwrap_or(serde_json::json!({}));

        tracing::info!("Completed Plaid request {endpoint}");

        Ok(value)
    }

    /// Create a link token for Plaid Link initialization
    /// This token is used to initialize Plaid Link on the frontend
    ///
    /// # Arguments
    /// * `user_id` - Your internal user ID
    /// * `client_name` - Your app name (displayed to users in Plaid Link)
    /// * `products` - List of Plaid products to request consent for
    ///
    /// # Returns
    /// Returns the link token that should be sent to the frontend
    pub async fn create_link_token(
        &self,
        user_id: &str,
        client_name: &str,
        products: Vec<Products>,
    ) -> Result<String> {
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
            .products(products)
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
        vec!["transactions", "investments", "liabilities"]
    }

    /// Test the connection to the Plaid API.
    /// This requires an access token to be set
    async fn test_connection(&self) -> bool {
        self.get_item().await.is_ok()
    }

    /// Process a single stream
    /// Returns `None` if the product is not supported by this connection.
    /// Returns `Some(HashMap)` with parquet data per day (key = date string like "2024-01-15").
    async fn process(
        &self,
        stream: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Option<HashMap<String, Bytes>>> {
        match stream {
            "transactions" => {
                let items = self.get_transactions(start_date, end_date).await?;
                process_time_series(items, stream, start_date, end_date).map(Some)
            }
            "investments" => match self.get_investment_transactions(start_date, end_date).await {
                Ok(items) => process_time_series(items, stream, start_date, end_date).map(Some),
                Err(e) if is_stream_not_supported(&e) => Ok(None),
                Err(e) => Err(e),
            },
            "liabilities" => match self.get_liabilities().await {
                Ok(data) => process_snapshot(data, stream, end_date).map(Some),
                Err(e) if is_stream_not_supported(&e) => Ok(None),
                Err(e) => Err(e),
            },
            _ => Err(SharedError::Synced(format!("Unknown stream: {}", stream))),
        }
    }
}

/// Check if error indicates the stream/product is not supported by this connection.
/// These errors mean we should skip the stream entirely without writing markers.
fn is_stream_not_supported(err: &SharedError) -> bool {
    let err_str = err.to_string();
    err_str.contains("ADDITIONAL_CONSENT_REQUIRED")
        || err_str.contains("PRODUCT_NOT_READY")
        || err_str.contains("PRODUCTS_NOT_SUPPORTED")
        || err_str.contains("NO_INVESTMENT_ACCOUNTS")
        || err_str.contains("NO_LIABILITY_ACCOUNTS")
}

/// Process time-series data (transactions, investments) - group by date
fn process_time_series(
    items: Vec<serde_json::Value>,
    stream: &str,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<HashMap<String, Bytes>> {
    use crate::parquet::json::grouped_json_to_parquet;
    use chrono::Duration;

    if items.is_empty() {
        tracing::trace!(
            "No {} found for date range {} to {}",
            stream,
            start_date,
            end_date
        );
        return Ok(HashMap::new());
    }

    // Initialize with all dates in range
    let mut grouped: HashMap<String, Vec<String>> = HashMap::new();
    let mut current = start_date;
    while current <= end_date {
        grouped.insert(current.format(DATE_FORMAT).to_string(), Vec::new());
        current += Duration::days(1);
    }

    // Group items by date
    for item in &items {
        let date_key = item
            .get("date")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let flattened = flatten_to_json(item);
        let json_str = serde_json::to_string(&flattened)
            .map_err(|e| SharedError::Synced(format!("Failed to serialize {}: {}", stream, e)))?;
        grouped.entry(date_key).or_default().push(json_str);
    }

    let days_with_data = grouped.values().filter(|v| !v.is_empty()).count();

    tracing::info!(
        "Processing {} days ({} with data) for {} from {} to {}",
        grouped.len(),
        days_with_data,
        stream,
        start_date,
        end_date
    );

    grouped_json_to_parquet(grouped)
}

/// Process snapshot data (liabilities) - all records under single date
fn process_snapshot(
    data: serde_json::Value,
    stream: &str,
    date: NaiveDate,
) -> Result<HashMap<String, Bytes>> {
    use crate::parquet::json::grouped_json_to_parquet;

    let mut records = Vec::new();

    // Flatten nested object structure (e.g., liabilities.credit, liabilities.mortgage)
    if let Some(obj) = data.as_object() {
        for (item_type, items) in obj {
            if let Some(array) = items.as_array() {
                for item in array {
                    let mut flattened = flatten_to_json(item);

                    flattened.insert(
                        format!("{}_type", stream.trim_end_matches('s')),
                        serde_json::Value::String(item_type.clone()),
                    );

                    let json_str = serde_json::to_string(&flattened).map_err(|e| {
                        SharedError::Synced(format!("Failed to serialize {}: {}", stream, e))
                    })?;

                    records.push(json_str);
                }
            }
        }
    }

    if records.is_empty() {
        tracing::warn!("No {} found", stream);
        return Ok(HashMap::new());
    }

    tracing::info!(
        "Processing {} {} records for {}",
        records.len(),
        stream,
        date
    );

    let mut grouped = HashMap::new();
    grouped.insert(date.format(DATE_FORMAT).to_string(), records);
    grouped_json_to_parquet(grouped)
}

#[cfg(test)]
mod tests {
    use crate::synced::plaid::new_plaid_client;
    use plaid::model::Products;

    use super::*;

    #[tokio::test]
    async fn test_plaid_client() {
        let client = new_plaid_client(true, vec![Products::Transactions]).await;
        assert!(client.test_connection().await);
    }
}
