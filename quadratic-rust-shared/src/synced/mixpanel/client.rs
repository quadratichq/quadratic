//! Comprehensive Mixpanel Data Export Client
//!
//! This Rust client provides access to all major Mixpanel data export endpoints:
//! - Events Export (Raw data)
//! - Engage (People/Users)
//! - Funnels
//! - Revenue
//! - Annotations
//! - Cohorts
//! - Cohort Members

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use bytes::Bytes;
use chrono::NaiveDate;
use reqwest::Client;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::collections::HashMap;

use crate::synced::SyncedClient;
use crate::synced::mixpanel::MixpanelServer;
use crate::{SharedError, error::Result, synced::mixpanel::events::ExportParams};
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct MixpanelConfig {
    pub api_secret: String,
    pub project_id: String,
    pub server: MixpanelServer,
    pub user_agent: Option<String>,
}

#[async_trait]
impl SyncedClient for MixpanelClient {
    /// Get the streams available for this client
    fn streams() -> Vec<&'static str> {
        vec![
            "events",
            // "engage",
            // "funnels",
            // "revenue",
            // "annotations",
            // "cohorts",
            // "cohort_members",
        ]
    }

    /// Test the connection and authentication
    async fn test_connection(&self) -> bool {
        let today = chrono::Utc::now().date_naive();
        let mut params = ExportParams::new(today, today);
        params.limit = Some(1);
        self.export_events(params).await.is_ok()
    }

    /// Process a single stream
    async fn process(
        &self,
        stream: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Option<HashMap<String, Bytes>>> {
        let params = ExportParams::new(start_date, end_date);

        match stream {
            "events" => self.export_events_streaming(params).await.map(Some),
            _ => Err(SharedError::Synced("Not implemented".to_string())),
        }
    }
}

impl MixpanelConfig {
    pub fn new(api_secret: &str, project_id: &str) -> Self {
        Self {
            api_secret: api_secret.to_string(),
            project_id: project_id.to_string(),
            server: MixpanelServer::US,
            user_agent: Some("rust-mixpanel-client/1.0".to_string()),
        }
    }
}

impl From<MixpanelConfig> for MixpanelClient {
    fn from(config: MixpanelConfig) -> Self {
        Self::from_config(config)
    }
}

#[derive(Debug)]
pub struct MixpanelClient {
    client: Client,
    config: MixpanelConfig,
}

impl MixpanelClient {
    pub fn new(api_secret: &str, project_id: &str) -> Self {
        let config: MixpanelConfig = MixpanelConfig::new(api_secret, project_id);
        Self::from_config(config)
    }

    pub fn from_config(config: MixpanelConfig) -> Self {
        let mut headers = reqwest::header::HeaderMap::new();

        // add authorization header
        let auth = BASE64.encode(format!("{}:", config.api_secret));
        headers.insert(
            reqwest::header::AUTHORIZATION,
            format!("Basic {}", auth).parse().unwrap(),
        );

        // add user agent if provided
        if let Some(ref user_agent) = config.user_agent {
            headers.insert(reqwest::header::USER_AGENT, user_agent.parse().unwrap());
        }

        let client = Client::builder()
            .default_headers(headers)
            .build()
            .expect("Failed to create HTTP client");

        Self { client, config }
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn config(&self) -> &MixpanelConfig {
        &self.config
    }

    pub fn data_export_url(&self) -> &'static str {
        self.config.server.data_export_url()
    }

    pub async fn make_request<T: DeserializeOwned>(
        &self,
        url: &str,
        params: &[(&str, &str)],
    ) -> Result<T> {
        let response = self
            .client
            .get(url)
            .query(params)
            .send()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to send request: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(SharedError::Synced(format!(
                "API request failed with status {}: {}",
                status, body
            )));
        }

        let result = response
            .json::<T>()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to parse response: {}", e)))?;
        Ok(result)
    }

    /// get project information (if available)
    pub async fn get_project_info(&self) -> Result<serde_json::Value> {
        let url = format!("{}/engage", self.config.server.base_url());
        let params = vec![("page", "0")];
        self.make_request(&url, &params).await
    }
}

// For testing
use std::sync::{LazyLock, Mutex};
pub static MIXPANEL_CREDENTIALS: LazyLock<Mutex<String>> = LazyLock::new(|| {
    let _path = dotenv::from_filename(".env.test").ok();
    let credentials = std::env::var("MIXPANEL_CREDENTIALS").unwrap();

    Mutex::new(credentials)
});
#[derive(Debug, Deserialize, Serialize)]
pub struct MixpanelConfigFromEnv {
    pub api_secret: String,
    pub project_id: String,
}
pub fn new_mixpanel_client() -> MixpanelClient {
    let credentials = MIXPANEL_CREDENTIALS.lock().unwrap().to_string();
    let config = serde_json::from_str::<MixpanelConfigFromEnv>(&credentials).unwrap();

    MixpanelClient::new(&config.api_secret, &config.project_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mixpanel_client_new() {
        let client = MixpanelClient::new("test_secret", "test_project");

        assert_eq!(client.config().api_secret, "test_secret");
        assert_eq!(client.config().project_id, "test_project");
    }

    #[tokio::test]
    async fn test_make_request_invalid_url() {
        let client = MixpanelClient::new("test_secret", "test_project");
        let invalid_url = "not-a-valid-url";
        let params = vec![];

        let result: Result<serde_json::Value> = client.make_request(invalid_url, &params).await;
        assert!(result.is_err());
    }

    // Integration test that requires real credentials - kept ignored
    // TODO(ddimaria): remove this ignore once we have mixpanel mocked
    #[ignore]
    #[tokio::test]
    async fn test_mixpanel_connection() {
        let client = new_mixpanel_client();
        let is_connected = client.test_connection().await;

        assert!(is_connected);
    }

    // Integration test for project info - kept ignored
    #[ignore]
    #[tokio::test]
    async fn test_get_project_info_integration() {
        let client = new_mixpanel_client();
        let project_info = client.get_project_info().await.unwrap();
        assert!(project_info.is_object());
    }

    #[test]
    fn test_export_params_creation() {
        let today = chrono::Utc::now().date_naive();
        let mut params = ExportParams::new(today, today);
        params.limit = Some(1);

        assert_eq!(params.from_date, today);
        assert_eq!(params.to_date, today);
        assert_eq!(params.limit, Some(1));
        assert!(params.events.is_none());
        assert!(params.r#where.is_none());
    }

    #[test]
    fn test_export_params_with_all_fields() {
        let from_date = chrono::NaiveDate::from_ymd_opt(2023, 1, 1).expect("Valid date");
        let to_date = chrono::NaiveDate::from_ymd_opt(2023, 1, 31).expect("Valid date");
        let mut params = ExportParams::new(from_date, to_date);

        params.events = Some(vec!["event1".to_string(), "event2".to_string()]);
        params.r#where = Some("properties[\"user_id\"] == \"123\"".to_string());
        params.limit = Some(1000);

        assert_eq!(params.from_date, from_date);
        assert_eq!(params.to_date, to_date);

        match &params.events {
            Some(events) => {
                assert_eq!(events.len(), 2);
                assert_eq!(events[0], "event1");
                assert_eq!(events[1], "event2");
            }
            None => panic!("Expected events to be Some"),
        }

        assert_eq!(
            params.r#where.unwrap(),
            "properties[\"user_id\"] == \"123\""
        );
        assert_eq!(params.limit, Some(1000));
    }
}
