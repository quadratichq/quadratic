use async_trait::async_trait;
use bytes::Bytes;
use chrono::{Duration, NaiveDate};
use futures_util::stream::{FuturesUnordered, TryStreamExt};
use httpclient::Client as HttpClient;
use plaid::model::{CountryCode, LinkTokenCreateRequestUser, Products};
use plaid::request::link_token_create::LinkTokenCreateRequired;
use plaid::{PlaidAuth, PlaidClient as Client};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;
use strum_macros::{Display, EnumString};

use crate::SharedError;
use crate::environment::Environment;
use crate::error::Result;
use crate::parquet::json::grouped_json_to_parquet;
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
    pub async fn raw_request(&self, endpoint: &str, extra_params: Value) -> Result<Value> {
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
        extra_options: Option<Value>,
    ) -> Result<Vec<Value>> {
        tracing::trace!("Starting Plaid request {endpoint}, from {start_date} to {end_date})",);

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

        tracing::trace!(
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
    pub async fn fetch_object(&self, endpoint: &str, response_key: &str) -> Result<Value> {
        tracing::trace!("Starting Plaid request {endpoint}",);

        let response = self.raw_request(endpoint, serde_json::json!({})).await?;
        let value = response
            .get(response_key)
            .cloned()
            .unwrap_or(serde_json::json!({}));

        tracing::trace!("Completed Plaid request {endpoint}");

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
    pub async fn get_item(&self) -> Result<Value> {
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

    /// Get the products available for this connection from the Item metadata.
    ///
    /// Returns the products that are billed/consented for this Item.
    /// Checks `billed_products` first (products actively used), falls back to
    /// `consented_products` or `products` if billed_products is empty.
    pub async fn get_available_products(&self) -> Result<Vec<String>> {
        let item_response = self.get_item().await?;

        // The item is nested under "item" key in the response
        let item = item_response
            .get("item")
            .ok_or_else(|| SharedError::Synced("Missing 'item' in response".to_string()))?;

        // Check billed_products first (products actively used)
        // Fall back to consented_products or products if billed_products is empty
        let products = item
            .get("billed_products")
            .and_then(|v| v.as_array())
            .filter(|arr| !arr.is_empty())
            .or_else(|| {
                item.get("consented_products")
                    .and_then(|v| v.as_array())
                    .filter(|arr| !arr.is_empty())
            })
            .or_else(|| item.get("products").and_then(|v| v.as_array()))
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        Ok(products)
    }

    /// Map a Plaid product name to the corresponding stream name.
    /// Returns None if the product doesn't map to a supported stream.
    fn product_to_stream(product: &str) -> Option<&'static str> {
        match product {
            "transactions" => Some("transactions"),
            "investments" => Some("investments"),
            "liabilities" => Some("liabilities"),
            "balance" => Some("balances"),
            _ => None,
        }
    }

    /// Get the streams available for this specific connection.
    ///
    /// Queries the Plaid Item to determine which products are enabled,
    /// then maps those to stream names. This avoids making API calls for
    /// products that aren't available for this connection.
    pub async fn available_streams(&self) -> Result<Vec<&'static str>> {
        let products = self.get_available_products().await?;

        let streams: Vec<&'static str> = products
            .iter()
            .filter_map(|p| Self::product_to_stream(p))
            .collect();

        tracing::debug!(
            "Plaid connection has products {:?}, mapped to streams {:?}",
            products,
            streams
        );

        Ok(streams)
    }
}

#[async_trait]
impl SyncedClient for PlaidClient {
    /// Get all possible streams for Plaid.
    /// Note: Use `available_streams()` to get streams for a specific connection.
    fn streams() -> Vec<&'static str> {
        vec!["transactions", "investments", "liabilities", "balances"]
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
            "liabilities" => {
                // Liabilities are point-in-time snapshots; only fetch when syncing today.
                // Plaid only returns current liabilities, so historical backfills are skipped.
                if !is_today(end_date) {
                    tracing::trace!(
                        "Skipping liabilities for historical date {} (not today)",
                        end_date
                    );
                    return Ok(None);
                }
                match self.get_liabilities().await {
                    Ok(data) => process_snapshot(data, stream, end_date).map(Some),
                    Err(e) if is_stream_not_supported(&e) => Ok(None),
                    Err(e) => Err(e),
                }
            }
            "balances" => {
                // Balances are point-in-time snapshots; only fetch when syncing today.
                // Plaid only returns current balances, so historical backfills are skipped.
                if !is_today(end_date) {
                    tracing::trace!(
                        "Skipping balances for historical date {} (not today)",
                        end_date
                    );
                    return Ok(None);
                }
                match self.get_balances().await {
                    Ok(data) => process_snapshot(data, stream, end_date).map(Some),
                    Err(e) if is_stream_not_supported(&e) => Ok(None),
                    Err(e) => Err(e),
                }
            }
            _ => Err(SharedError::Synced(format!("Unknown stream: {}", stream))),
        }
    }

    /// Process all streams in parallel, but only for products this connection supports.
    ///
    /// Queries the Plaid Item first to determine available products, then only
    /// processes those streams. This avoids unnecessary API calls for products
    /// the connection doesn't have.
    async fn process_all(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<HashMap<String, HashMap<String, Bytes>>> {
        // Get available streams for this specific connection
        let streams = self.available_streams().await?;

        if streams.is_empty() {
            tracing::warn!("No supported streams found for this Plaid connection");
            return Ok(HashMap::new());
        }

        tracing::info!("Processing {} Plaid streams: {:?}", streams.len(), streams);

        streams
            .into_iter()
            .map(|stream| async move {
                let result = self.process(stream, start_date, end_date).await?;
                Ok::<(String, Option<HashMap<String, Bytes>>), SharedError>((
                    stream.to_string(),
                    result,
                ))
            })
            .collect::<FuturesUnordered<_>>()
            .try_collect::<Vec<_>>()
            .await
            .map(|results| {
                results
                    .into_iter()
                    .filter_map(|(stream, opt)| opt.map(|data| (stream, data)))
                    .collect()
            })
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
        || err_str.contains("NO_ACCOUNTS")
}

/// Check if a date is today (UTC).
/// Used for snapshot data (balances, liabilities) which can only be fetched in real-time.
/// We skip historical dates since Plaid only returns current balances, not historical.
///
/// Note: All dates in the sync system are UTC. This ensures consistency across
/// servers and users in different timezones. The `end_date` passed to `process()`
/// is also calculated using UTC (via `today()` in mod.rs).
fn is_today(date: NaiveDate) -> bool {
    let today = chrono::Utc::now().date_naive();
    date == today
}

/// Flatten items into serialized JSON string records.
///
/// Handles both:
/// - Object of arrays (e.g., `{credit: [...], mortgage: [...]}`) — adds a `{stream}_type` column
/// - Flat arrays — flattens each item directly
///
/// Optionally prepends a `date` column to each record.
fn flatten_to_records(data: &Value, stream: &str, date_str: Option<&str>) -> Result<Vec<String>> {
    let mut records = Vec::new();

    let items_with_type: Vec<(Option<&str>, &Value)> = match data {
        // object
        Value::Object(obj) => obj
            .iter()
            .flat_map(|(item_type, items)| {
                items.as_array().into_iter().flat_map(move |array| {
                    array
                        .iter()
                        .map(move |item| (Some(item_type.as_str()), item))
                })
            })
            .collect(),

        // array
        Value::Array(items) => items.iter().map(|item| (None, item)).collect(),

        // other values pass through
        _ => return Ok(records),
    };

    for (item_type, item) in items_with_type {
        // only flatten to 2 levels of depth
        let flattened = flatten_to_json(item, Some(2));
        let mut ordered = Map::new();

        if let Some(date) = date_str {
            ordered.insert("date".to_string(), Value::String(date.to_string()));
        }

        ordered.extend(flattened);

        if let Some(t) = item_type {
            ordered.insert(
                format!("{}_type", stream.trim_end_matches('s')),
                Value::String(t.to_string()),
            );
        }

        let json_str = serde_json::to_string(&ordered)
            .map_err(|e| SharedError::Synced(format!("Failed to serialize {}: {}", stream, e)))?;

        records.push(json_str);
    }

    Ok(records)
}

/// Process time-series data (transactions, investments) - group by date
fn process_time_series(
    items: Vec<Value>,
    stream: &str,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<HashMap<String, Bytes>> {
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

    // Group items by date, then flatten each group
    // BTreeMap gives deterministic date ordering in the output parquet files
    let mut date_groups: std::collections::BTreeMap<String, Vec<serde_json::Value>> =
        std::collections::BTreeMap::new();
    for item in items {
        let date_key = item
            .get("date")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        date_groups.entry(date_key).or_default().push(item);
    }

    for (date_key, date_items) in date_groups {
        let records = flatten_to_records(&Value::Array(date_items), stream, None)?;
        grouped.entry(date_key).or_default().extend(records);
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

/// Process snapshot data (liabilities, balances) - all records under single date.
/// Adds a `date` column to each record for tracking when the snapshot was captured.
fn process_snapshot(data: Value, stream: &str, date: NaiveDate) -> Result<HashMap<String, Bytes>> {
    let date_str = date.format(DATE_FORMAT).to_string();
    let records = flatten_to_records(&data, stream, Some(&date_str))?;

    if records.is_empty() {
        tracing::warn!("No {} found", stream);
        return Ok(HashMap::new());
    }

    tracing::trace!(
        "Processing {} {} records for {}",
        records.len(),
        stream,
        date
    );

    let mut grouped = HashMap::new();
    grouped.insert(date_str, records);

    grouped_json_to_parquet(grouped)
}

#[cfg(test)]
mod tests {
    use crate::synced::plaid::new_plaid_client;
    use plaid::model::Products;

    use super::*;

    #[test]
    fn test_product_to_stream() {
        assert_eq!(
            PlaidClient::product_to_stream("transactions"),
            Some("transactions")
        );
        assert_eq!(
            PlaidClient::product_to_stream("investments"),
            Some("investments")
        );
        assert_eq!(
            PlaidClient::product_to_stream("liabilities"),
            Some("liabilities")
        );
        assert_eq!(PlaidClient::product_to_stream("balance"), Some("balances"));
        assert_eq!(PlaidClient::product_to_stream("auth"), None);
        assert_eq!(PlaidClient::product_to_stream("identity"), None);
        assert_eq!(PlaidClient::product_to_stream("unknown"), None);
    }

    #[tokio::test]
    async fn test_plaid_client() {
        let client = new_plaid_client(true, vec![Products::Transactions]).await;
        assert!(client.test_connection().await);
    }

    #[test]
    fn test_is_today() {
        use chrono::Duration;

        let today = chrono::Utc::now().date_naive();
        let yesterday = today - Duration::days(1);
        let tomorrow = today + Duration::days(1);

        // Only today should return true
        assert!(super::is_today(today), "today should be true");

        // All other dates should return false
        assert!(!super::is_today(yesterday), "yesterday should be false");
        assert!(!super::is_today(tomorrow), "tomorrow should be false");
    }
}
