// Google Analytics 4 (GA4) Connection
//
// Note: Universal Analytics (GA3) was deprecated on July 1, 2023.
// This module uses the Google Analytics Data API v1beta (GA4).
//
// Supports two authentication methods:
// 1. Service Account (legacy) - Uses service_account_configuration JSON
// 2. OAuth (preferred) - Uses access_token and refresh_token

use arrow::datatypes::{DataType, Date32Type, Field, Schema};
use arrow_array::{Date32Array, Float64Array, RecordBatch, StringArray};
use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, NaiveDate, Utc};
use google_analyticsdata1_beta::{
    AnalyticsData,
    api::{DateRange, Dimension, Metric, RunReportRequest, RunReportResponse},
};
use hyper_rustls::HttpsConnector;
use hyper_util::client::legacy::{Client, connect::HttpConnector};
use hyper_util::rt::TokioExecutor;
use rustls::crypto::ring::default_provider;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use yup_oauth2::{AccessTokenAuthenticator, ServiceAccountAuthenticator, ServiceAccountKey};

use crate::{SharedError, synced::string_to_date};
use crate::{
    environment::Environment,
    synced::{DATE_FORMAT, SyncedConnectionKind, google_analytics::reports::REPORTS, today},
};
use crate::{error::Result, synced::SyncedConnection};
use crate::{parquet::utils::record_batch_to_parquet_bytes, synced::SyncedClient};

#[derive(Debug, Deserialize, Serialize)]
pub struct GoogleAnalyticsConfig {
    // GA4 property ID (format: "properties/123456789")
    pub property_id: String,
    // Service Account authentication (legacy)
    #[serde(default)]
    pub service_account_configuration: Option<String>,
    // OAuth authentication (preferred)
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub token_expires_at: Option<String>,
}

/// Authentication method for Google Analytics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum GoogleAnalyticsAuth {
    /// Service Account authentication using JSON credentials
    ServiceAccount { credentials: String },
    /// OAuth authentication using access and refresh tokens
    OAuth {
        access_token: String,
        refresh_token: String,
        token_expires_at: DateTime<Utc>,
    },
}

/// Internal struct for deserializing connection from JSON
/// Supports both service account (legacy) and OAuth (new) formats
#[derive(Deserialize)]
struct GoogleAnalyticsConnectionRaw {
    property_id: String,
    start_date: NaiveDate,
    // Service Account fields (legacy)
    #[serde(default)]
    service_account_configuration: Option<String>,
    // OAuth fields (new)
    #[serde(default)]
    access_token: Option<String>,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    token_expires_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct GoogleAnalyticsConnection {
    pub property_id: String,
    pub auth: GoogleAnalyticsAuth,
    pub start_date: NaiveDate,
}

impl<'de> Deserialize<'de> for GoogleAnalyticsConnection {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = GoogleAnalyticsConnectionRaw::deserialize(deserializer)?;

        // Determine auth method based on available fields
        let auth = if let (Some(access_token), Some(refresh_token), Some(token_expires_at)) =
            (raw.access_token, raw.refresh_token, raw.token_expires_at)
        {
            // OAuth authentication
            GoogleAnalyticsAuth::OAuth {
                access_token,
                refresh_token,
                token_expires_at,
            }
        } else if let Some(credentials) = raw.service_account_configuration {
            // Service Account authentication (legacy)
            GoogleAnalyticsAuth::ServiceAccount { credentials }
        } else {
            return Err(serde::de::Error::custom(
                "Missing authentication: either service_account_configuration (legacy) or \
                 access_token + refresh_token + token_expires_at (OAuth) required",
            ));
        };

        Ok(GoogleAnalyticsConnection {
            property_id: raw.property_id,
            auth,
            start_date: raw.start_date,
        })
    }
}

impl GoogleAnalyticsConnection {
    /// Create a new connection using service account credentials (legacy)
    pub fn with_service_account(
        property_id: String,
        service_account_configuration: String,
        start_date: NaiveDate,
    ) -> Self {
        Self {
            property_id,
            auth: GoogleAnalyticsAuth::ServiceAccount {
                credentials: service_account_configuration,
            },
            start_date,
        }
    }

    /// Create a new connection using OAuth tokens (preferred)
    pub fn with_oauth(
        property_id: String,
        access_token: String,
        refresh_token: String,
        token_expires_at: DateTime<Utc>,
        start_date: NaiveDate,
    ) -> Self {
        Self {
            property_id,
            auth: GoogleAnalyticsAuth::OAuth {
                access_token,
                refresh_token,
                token_expires_at,
            },
            start_date,
        }
    }

    /// Check if this connection uses OAuth authentication
    pub fn is_oauth(&self) -> bool {
        matches!(self.auth, GoogleAnalyticsAuth::OAuth { .. })
    }

    /// Check if the OAuth token is expired or about to expire
    /// Returns None for service account connections (they don't expire)
    /// Returns Some(true) if expired, Some(false) if valid, for OAuth connections
    pub fn is_token_expired(&self) -> Option<bool> {
        match &self.auth {
            GoogleAnalyticsAuth::ServiceAccount { .. } => None,
            GoogleAnalyticsAuth::OAuth {
                token_expires_at, ..
            } => {
                // Consider token expired if it expires within 5 minutes
                let buffer = chrono::Duration::minutes(5);
                Some(*token_expires_at <= Utc::now() + buffer)
            }
        }
    }

    /// Get the token expiration time for OAuth connections
    pub fn token_expires_at(&self) -> Option<DateTime<Utc>> {
        match &self.auth {
            GoogleAnalyticsAuth::OAuth {
                token_expires_at, ..
            } => Some(*token_expires_at),
            GoogleAnalyticsAuth::ServiceAccount { .. } => None,
        }
    }
}

#[async_trait]
impl SyncedConnection for GoogleAnalyticsConnection {
    fn name(&self) -> &str {
        "GOOGLE_ANALYTICS"
    }

    fn kind(&self) -> SyncedConnectionKind {
        SyncedConnectionKind::GoogleAnalytics
    }

    fn start_date(&self) -> NaiveDate {
        self.start_date
    }

    fn streams(&self) -> Vec<&'static str> {
        GoogleAnalyticsClient::streams()
    }

    async fn to_client(&self, _environment: Environment) -> Result<Box<dyn SyncedClient>> {
        // Check if OAuth token is expired before creating client
        if let Some(true) = self.is_token_expired() {
            let expires_at = self
                .token_expires_at()
                .map(|t| t.to_rfc3339())
                .unwrap_or_else(|| "unknown".to_string());
            return Err(SharedError::Synced(format!(
                "Google Analytics OAuth token has expired (expired at {}). \
                 Please re-authenticate in the Quadratic app to refresh your connection.",
                expires_at
            )));
        }

        let client = match &self.auth {
            GoogleAnalyticsAuth::ServiceAccount { credentials } => {
                GoogleAnalyticsClient::with_service_account(
                    credentials.clone(),
                    self.property_id.clone(),
                    self.start_date.format(DATE_FORMAT).to_string(),
                )
                .await?
            }
            GoogleAnalyticsAuth::OAuth {
                access_token,
                refresh_token: _,
                token_expires_at,
            } => {
                GoogleAnalyticsClient::with_oauth(
                    access_token.clone(),
                    *token_expires_at,
                    self.property_id.clone(),
                    self.start_date.format(DATE_FORMAT).to_string(),
                )
                .await?
            }
        };

        Ok(Box::new(client))
    }
}

/// Google Analytics client that can use either service account or OAuth authentication
pub struct GoogleAnalyticsClient {
    pub property_id: String,
    pub analytics: AnalyticsData<HttpsConnector<HttpConnector>>,
    pub start_date: NaiveDate,
}

#[async_trait]
impl SyncedClient for GoogleAnalyticsClient {
    fn streams() -> Vec<&'static str> {
        REPORTS.keys().copied().collect()
    }

    /// Test the connection by running a simple report
    async fn test_connection(&self) -> bool {
        let today = Utc::now().date_naive().format(DATE_FORMAT).to_string();

        self.run_report(&today, &today, vec!["activeUsers"], None, Some(1))
            .await
            .is_ok()
    }

    async fn process(
        &self,
        stream: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Option<HashMap<String, Bytes>>> {
        // look up the report configuration
        let report = REPORTS
            .get(stream)
            .ok_or_else(|| SharedError::Synced(format!("Unknown report stream: {}", stream)))?;

        self.run_report(
            &start_date.format(DATE_FORMAT).to_string(),
            &end_date.format(DATE_FORMAT).to_string(),
            report.metrics.clone(),
            Some(report.dimensions.clone()),
            None,
        )
        .await
        .map(Some)
    }
}

impl GoogleAnalyticsClient {
    /// Check if a dimension name represents a date field
    /// GA4 date dimensions: date, dateHour, dateHourMinute, firstSessionDate, etc.
    fn is_date_dimension(name: &str) -> bool {
        matches!(
            name,
            "date" | "dateHour" | "dateHourMinute" | "firstSessionDate" | "cohortNthDay"
        )
    }

    /// Format a GA4 date string from YYYYMMDD to YYYY-MM-DD
    /// GA4 returns dates in YYYYMMDD format, but we need YYYY-MM-DD for parsing
    fn format_ga_date(date_str: &str) -> String {
        if date_str.len() == 8 && date_str.chars().all(|c| c.is_ascii_digit()) {
            format!(
                "{}-{}-{}",
                &date_str[0..4],
                &date_str[4..6],
                &date_str[6..8]
            )
        } else {
            date_str.to_string()
        }
    }

    /// Validate and normalize the property_id format
    fn normalize_property_id(mut property_id: String) -> Result<String> {
        if !property_id.starts_with("properties/") {
            // Check if it's a numeric property ID (all digits)
            if property_id.chars().all(|c| c.is_ascii_digit()) {
                property_id = format!("properties/{}", property_id);
            } else {
                return Err(SharedError::Synced(format!(
                    "Invalid property_id format: '{}'. GA4 property IDs must be in the format 'properties/123456789'. \
                    You can find your property ID in Google Analytics under Admin > Property > Property Settings.",
                    property_id
                )));
            }
        }
        Ok(property_id)
    }

    /// Create a new client using service account credentials (legacy method)
    pub async fn with_service_account(
        credentials: String,
        property_id: String,
        start_date: String,
    ) -> Result<Self> {
        // Install default crypto provider for rustls if not already installed
        let _ = default_provider().install_default();

        let start_date = NaiveDate::parse_from_str(&start_date, DATE_FORMAT)
            .map_err(|e| SharedError::Synced(format!("Failed to parse start_date: {}", e)))?;

        let property_id = Self::normalize_property_id(property_id)?;

        // Parse the service account key from the credentials JSON
        let service_account_key: ServiceAccountKey =
            serde_json::from_str(&credentials).map_err(|e| {
                SharedError::Synced(format!("Failed to parse service account key: {}", e))
            })?;

        // Create the authenticator with the required scopes for GA4 Data API
        let auth = ServiceAccountAuthenticator::builder(service_account_key)
            .build()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to create authenticator: {}", e)))?;

        let https = hyper_rustls::HttpsConnectorBuilder::new()
            .with_native_roots()
            .map_err(|e| SharedError::Synced(format!("Failed to build HTTPS connector: {}", e)))?
            .https_or_http()
            .enable_http1()
            .build();

        let client = Client::builder(TokioExecutor::new()).build(https);
        let analytics = AnalyticsData::new(client, auth);

        Ok(Self {
            property_id,
            analytics,
            start_date,
        })
    }

    /// Create a new client using OAuth tokens (preferred method for end users)
    ///
    /// Note: If the access token is expired, the caller should refresh it before calling this.
    /// Token refresh is handled at the API layer before creating the connection.
    pub async fn with_oauth(
        access_token: String,
        token_expires_at: DateTime<Utc>,
        property_id: String,
        start_date: String,
    ) -> Result<Self> {
        // Install default crypto provider for rustls if not already installed
        let _ = default_provider().install_default();

        let start_date = NaiveDate::parse_from_str(&start_date, DATE_FORMAT)
            .map_err(|e| SharedError::Synced(format!("Failed to parse start_date: {}", e)))?;

        let property_id = Self::normalize_property_id(property_id)?;

        // Check if the token is expired
        if token_expires_at <= Utc::now() {
            return Err(SharedError::Synced(
                "OAuth access token has expired. Please refresh the token before connecting."
                    .to_string(),
            ));
        }

        // Create the OAuth authenticator with the pre-obtained access token
        // AccessTokenAuthenticator is designed for use with tokens obtained from external OAuth flows
        let auth = AccessTokenAuthenticator::builder(access_token)
            .build()
            .await
            .map_err(|e| {
                SharedError::Synced(format!("Failed to create OAuth authenticator: {}", e))
            })?;

        let https = hyper_rustls::HttpsConnectorBuilder::new()
            .with_native_roots()
            .map_err(|e| SharedError::Synced(format!("Failed to build HTTPS connector: {}", e)))?
            .https_or_http()
            .enable_http1()
            .build();

        let client = Client::builder(TokioExecutor::new()).build(https);
        let analytics = AnalyticsData::new(client, auth);

        Ok(Self {
            property_id,
            analytics,
            start_date,
        })
    }

    /// Legacy constructor for backward compatibility
    /// Deprecated: Use with_service_account or with_oauth instead
    pub async fn new(credentials: String, property_id: String, start_date: String) -> Result<Self> {
        Self::with_service_account(credentials, property_id, start_date).await
    }

    /// Run reports for a date range and convert to Parquet files grouped by day
    ///
    /// This method queries all dates at once with the "date" dimension, then groups
    /// the results by date to create separate Parquet files for each day. This is
    /// more efficient than making individual requests for each day.
    ///
    /// # Arguments
    /// * `start_date` - Start date in YYYY-MM-DD format
    /// * `end_date` - End date in YYYY-MM-DD format
    /// * `metrics` - List of metric names
    /// * `dimensions` - Optional list of additional dimension names (date is added automatically)
    /// * `limit` - Optional limit on number of rows per request
    ///
    /// # Returns
    /// * `HashMap<String, Bytes>` - Map of date strings (YYYY-MM-DD) to Parquet byte arrays
    ///
    /// Request Docs: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
    /// Response Docs: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse
    ///
    /// # Example
    /// ```ignore
    /// let parquet_by_date = connection.run_report(
    ///     "2024-01-01",
    ///     "2024-01-07",
    ///     vec!["activeUsers", "sessions"],
    ///     Some(vec!["country"]),
    ///     None
    /// ).await?;
    /// // Returns HashMap with keys: "2024-01-01", "2024-01-02", ..., "2024-01-07"
    /// ```
    pub async fn run_report(
        &self,
        start_date: &str,
        end_date: &str,
        metrics: Vec<&str>,
        dimensions: Option<Vec<&str>>,
        limit: Option<i64>,
    ) -> Result<HashMap<String, Bytes>> {
        let start = string_to_date(start_date)?;
        let end = string_to_date(end_date)?;

        if start > end {
            return Err(SharedError::Synced(
                "start_date must be before or equal to end_date".to_string(),
            ));
        }

        // Ensure "date" dimension is included
        let mut dimension_list = Vec::new();
        dimension_list.push(Dimension {
            name: Some("date".to_string()),
            dimension_expression: None,
        });

        // Add any additional dimensions
        if let Some(dims) = dimensions {
            for name in dims {
                if name != "date" {
                    dimension_list.push(Dimension {
                        name: Some(name.to_string()),
                        dimension_expression: None,
                    });
                }
            }
        }

        // Build metric list
        let metric_list: Vec<Metric> = metrics
            .iter()
            .map(|name| Metric {
                name: Some(name.to_string()),
                expression: None,
                invisible: None,
            })
            .collect();

        // Create single request for entire date range
        let request = RunReportRequest {
            date_ranges: Some(vec![DateRange {
                start_date: Some(start_date.to_string()),
                end_date: Some(end_date.to_string()),
                name: None,
            }]),
            metrics: Some(metric_list),
            dimensions: Some(dimension_list),
            limit,
            ..Default::default()
        };

        // Run the report
        let (_, response) = self
            .analytics
            .properties()
            .run_report(request, &self.property_id)
            .doit()
            .await
            .map_err(|e| SharedError::Synced(format!("GA4 request failed: {}", e)))?;

        // Group rows by date
        self.group_response_by_date(response).await
    }

    /// Group a report response by date dimension
    ///
    /// Takes a single response with multiple dates and groups the rows by date,
    /// creating separate Parquet files for each date.
    async fn group_response_by_date(
        &self,
        response: RunReportResponse,
    ) -> Result<HashMap<String, Bytes>> {
        // Handle empty responses
        if response.rows.as_ref().is_none_or(|r| r.is_empty()) {
            return Ok(HashMap::new());
        }

        let dimension_headers = response
            .dimension_headers
            .as_ref()
            .ok_or_else(|| SharedError::Synced("No dimension headers in response".to_string()))?;

        let rows = response
            .rows
            .as_ref()
            .ok_or_else(|| SharedError::Synced("No rows in response".to_string()))?;

        // Find the date dimension index (should be first)
        let date_dim_idx = dimension_headers
            .iter()
            .position(|h| h.name.as_deref() == Some("date"))
            .ok_or_else(|| {
                SharedError::Synced("Date dimension not found in response".to_string())
            })?;

        // Group rows by date
        let mut rows_by_date: HashMap<String, Vec<_>> = HashMap::new();

        for row in rows {
            if let Some(dim_values) = &row.dimension_values
                && let Some(dim_value) = dim_values.get(date_dim_idx)
                && let Some(date_str) = &dim_value.value
            {
                // GA4 returns dates in YYYYMMDD format, convert to YYYY-MM-DD
                let formatted_date = Self::format_ga_date(date_str);
                rows_by_date
                    .entry(formatted_date)
                    .or_default()
                    .push(row.clone());
            }
        }

        // Convert each date's rows to Parquet
        let mut result = HashMap::new();

        for (date_key, date_rows) in rows_by_date {
            let date_response = RunReportResponse {
                dimension_headers: response.dimension_headers.clone(),
                metric_headers: response.metric_headers.clone(),
                rows: Some(date_rows),
                ..Default::default()
            };

            let parquet_bytes = self.response_to_parquet(&date_key, date_response).await?;
            result.insert(date_key, parquet_bytes);
        }

        Ok(result)
    }

    /// Run a batch of reports on GA4 data
    ///
    /// This allows you to run multiple reports in a single API call, which is more efficient
    /// than making multiple individual requests.
    pub async fn batch_run_reports(
        &self,
        requests: Vec<RunReportRequest>,
    ) -> Result<Vec<RunReportResponse>> {
        use google_analyticsdata1_beta::api::BatchRunReportsRequest;

        let batch_request = BatchRunReportsRequest {
            requests: Some(requests),
        };

        let (_, response) = self
            .analytics
            .properties()
            .batch_run_reports(batch_request, &self.property_id)
            .doit()
            .await
            .map_err(|e| SharedError::Synced(format!("GA4 batch request failed: {}", e)))?;

        Ok(response.reports.unwrap_or_default())
    }

    /// Convert a report response to Parquet bytes with an explicit date key
    ///
    /// # Arguments
    /// * `date_key` - The date string to use as the key (e.g., "2024-01-15" or "20240115")
    /// * `response` - The report response to convert
    ///
    /// # Returns
    /// * `Bytes` - Parquet byte array for this specific date
    ///
    /// # Notes
    /// - The caller is responsible for ensuring the response data corresponds to the date_key
    /// - This is typically used with batch_run_reports where each request is for a single day
    pub async fn response_to_parquet(
        &self,
        date_key: &str,
        response: RunReportResponse,
    ) -> Result<Bytes> {
        let dimension_headers = response.dimension_headers.unwrap_or_default();
        let metric_headers = response.metric_headers.unwrap_or_default();
        let rows = response.rows.unwrap_or_default();
        let mut fields = Vec::new();

        if rows.is_empty() {
            return Err(SharedError::Synced(format!(
                "No data rows in response for date: {}",
                date_key
            )));
        }

        // determine dimension types and build fields
        let dimension_types: Vec<bool> = dimension_headers
            .iter()
            .map(|header| {
                header
                    .name
                    .as_ref()
                    .map(|name| Self::is_date_dimension(name))
                    .unwrap_or(false)
            })
            .collect();

        // add dimension fields (strings or dates)
        for (header, &is_date) in dimension_headers.iter().zip(&dimension_types) {
            if let Some(name) = &header.name {
                let data_type = if is_date {
                    DataType::Date32
                } else {
                    DataType::Utf8
                };
                fields.push(Field::new(name, data_type, true));
            }
        }

        // add metric fields (all float64 for GA4 metrics)
        for header in &metric_headers {
            if let Some(name) = &header.name {
                fields.push(Field::new(name, DataType::Float64, true));
            }
        }

        let schema = Arc::new(Schema::new(fields));
        let mut columns: Vec<Arc<dyn arrow::array::Array>> = Vec::new();

        // process dimensions using pre-determined types
        for (dim_idx, &is_date) in dimension_types.iter().enumerate() {
            if is_date {
                // Process as Date32 (GA4 returns dates in YYYYMMDD format)
                let date_values: Vec<Option<i32>> = rows
                    .iter()
                    .map(|row| {
                        let value_str = row
                            .dimension_values
                            .as_ref()?
                            .get(dim_idx)?
                            .value
                            .as_ref()?;
                        let formatted_date = Self::format_ga_date(value_str);
                        let naive_date = string_to_date(&formatted_date).ok()?;
                        Some(Date32Type::from_naive_date(naive_date))
                    })
                    .collect();
                columns.push(Arc::new(Date32Array::from(date_values)));
            } else {
                // Process as String
                let values: Vec<Option<String>> = rows
                    .iter()
                    .map(|row| row.dimension_values.as_ref()?.get(dim_idx)?.value.clone())
                    .collect();
                columns.push(Arc::new(StringArray::from(values)));
            }
        }

        // process metrics (float64)
        for metric_idx in 0..metric_headers.len() {
            let values: Vec<Option<f64>> = rows
                .iter()
                .map(|row| {
                    row.metric_values
                        .as_ref()?
                        .get(metric_idx)?
                        .value
                        .as_ref()?
                        .parse::<f64>()
                        .ok()
                })
                .collect();
            columns.push(Arc::new(Float64Array::from(values)));
        }

        let record_batch = RecordBatch::try_new(schema, columns)
            .map_err(|e| SharedError::Synced(format!("Failed to create record batch: {}", e)))?;

        record_batch_to_parquet_bytes(record_batch)
    }
}

// For testing
use std::sync::{LazyLock, Mutex};
pub static GOOGLE_ANALYTICS_CREDENTIALS: LazyLock<Mutex<Option<String>>> = LazyLock::new(|| {
    let _path = dotenv::from_filename(".env.test").ok();
    let credentials = std::env::var("GOOGLE_ANALYTICS_CREDENTIALS").ok();

    Mutex::new(credentials)
});

#[derive(Debug, Deserialize, Serialize)]
pub struct GoogleAnalyticsConfigFromEnv {
    pub property_id: String,
}

pub async fn new_google_analytics_connection() -> Result<GoogleAnalyticsClient> {
    let credentials = {
        let credentials_guard = GOOGLE_ANALYTICS_CREDENTIALS
            .lock()
            .map_err(|e| SharedError::Synced(format!("Failed to lock credentials: {}", e)))?;

        credentials_guard
            .as_ref()
            .ok_or_else(|| {
                SharedError::Synced(
                    "GOOGLE_ANALYTICS_CREDENTIALS environment variable not set. \
                Please set it in .env.test for testing."
                        .to_string(),
                )
            })?
            .clone()
    }; // MutexGuard is dropped here

    let config = serde_json::from_str::<GoogleAnalyticsConfigFromEnv>(&credentials)
        .map_err(|e| SharedError::Synced(format!("Failed to parse credentials config: {}", e)))?;

    let start_date = today().format(DATE_FORMAT).to_string();

    GoogleAnalyticsClient::new(credentials, config.property_id, start_date).await
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use crate::{
        arrow::object_store::new_filesystem_object_store,
        parquet::utils::bytes_to_rows,
        synced::{google_analytics::reports::REPORTS, upload},
    };

    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_connection() {
        let client = new_google_analytics_connection().await.unwrap();
        let is_connected = client.test_connection().await;
        assert!(is_connected);
    }

    #[tokio::test]
    #[ignore]
    async fn test_batch_run_reports() {
        let client = new_google_analytics_connection().await.unwrap();
        let daily_active_users = REPORTS.get("daily_active_users").unwrap();
        let website_overview = REPORTS.get("website_overview").unwrap();
        let date_ranges = vec![DateRange {
            start_date: Some("7daysAgo".to_string()),
            end_date: Some("today".to_string()),
            name: None,
        }];
        let to_metric = |metrics: &Vec<&str>| {
            metrics
                .iter()
                .map(|name| Metric {
                    name: Some(name.to_string()),
                    expression: None,
                    invisible: None,
                })
                .collect()
        };
        let to_dimension = |dimensions: &Vec<&str>| {
            dimensions
                .iter()
                .map(|name| Dimension {
                    name: Some(name.to_string()),
                    dimension_expression: None,
                })
                .collect()
        };

        let requests = vec![
            RunReportRequest {
                date_ranges: Some(date_ranges.clone()),
                metrics: Some(to_metric(&daily_active_users.metrics)),
                dimensions: Some(to_dimension(&daily_active_users.dimensions)),
                limit: Some(5),
                ..Default::default()
            },
            RunReportRequest {
                date_ranges: Some(date_ranges.clone()),
                metrics: Some(to_metric(&website_overview.metrics)),
                dimensions: Some(to_dimension(&website_overview.dimensions)),
                limit: Some(5),
                ..Default::default()
            },
        ];

        let result = client.batch_run_reports(requests).await.unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].row_count.unwrap(), 5);
        assert_eq!(result[1].row_count.unwrap(), 5);
    }

    #[tokio::test]
    #[ignore]
    async fn test_run_report() {
        let client = new_google_analytics_connection().await.unwrap();
        let path = "/Users/daviddimaria/Downloads";
        let (store, _) = new_filesystem_object_store(path).unwrap();
        let now = Instant::now();

        for (name, report) in REPORTS.iter() {
            let parquet_by_date = client
                .run_report(
                    "2025-11-01",
                    "2025-11-07",
                    report.metrics.clone(),
                    Some(report.dimensions.clone()),
                    Some(10),
                )
                .await
                .unwrap();

            // Skip reports with no data (e.g., transactions report might not have data)
            if parquet_by_date.is_empty() {
                println!("Skipping {} - no data for date range", name);
                continue;
            }

            // Verify each date group
            for parquet_bytes in parquet_by_date.values() {
                assert!(!parquet_bytes.is_empty());

                // Verify we can read the Parquet data back
                let rows = bytes_to_rows(parquet_bytes.clone()).unwrap();
                assert!(!rows.is_empty());
            }

            let num_files = upload(&store, name, parquet_by_date).await.unwrap();
            assert!(num_files > 0);
        }

        let elapsed = now.elapsed();
        println!("Time taken: {:?}", elapsed);
    }

    #[tokio::test]
    #[ignore]
    async fn test_response_to_parquet() {
        let client = new_google_analytics_connection().await.unwrap();

        let parquet_by_date = client
            .run_report(
                "2024-11-01",
                "2024-11-01",
                vec!["activeUsers", "sessions"],
                Some(vec!["country"]),
                Some(10),
            )
            .await
            .unwrap();

        // should have exactly one entry for the single day
        assert_eq!(parquet_by_date.len(), 1);

        let parquet_bytes = parquet_by_date.get("2024-11-01").unwrap();
        assert!(!parquet_bytes.is_empty());

        // verify we can read the Parquet data back
        let rows = bytes_to_rows(parquet_bytes.clone()).unwrap();
        println!("Number of rows: {}", rows.len());
        assert!(!rows.is_empty());
    }
}
