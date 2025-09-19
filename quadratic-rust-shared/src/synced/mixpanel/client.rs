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
use reqwest::Client;
use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::{SharedError, error::Result};

#[derive(Debug, Clone)]
pub enum MixpanelServer {
    US,
    EU,
    India,
}

impl MixpanelServer {
    pub fn base_url(&self) -> &'static str {
        match self {
            MixpanelServer::US => "https://mixpanel.com/api/2.0",
            MixpanelServer::EU => "https://eu.mixpanel.com/api/2.0",
            MixpanelServer::India => "https://in.mixpanel.com/api/2.0",
        }
    }

    pub fn data_export_url(&self) -> &'static str {
        match self {
            MixpanelServer::US => "https://data.mixpanel.com/api/2.0",
            MixpanelServer::EU => "https://data-eu.mixpanel.com/api/2.0",
            MixpanelServer::India => "https://data-in.mixpanel.com/api/2.0",
        }
    }
}

#[derive(Debug, Clone)]
pub struct MixpanelConfig {
    pub api_secret: String,
    pub project_id: String,
    pub server: MixpanelServer,
    pub date_window_size: u32,
    pub attribution_window: u32,
    pub project_timezone: String,
    pub user_agent: Option<String>,
}

#[derive(Debug)]
pub struct MixpanelClient {
    client: Client,
    config: MixpanelConfig,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Annotation {
    pub id: u32,
    pub project_id: u32,
    pub date: String,
    pub description: String,
    pub created: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Cohort {
    pub id: u32,
    pub name: String,
    pub description: Option<String>,
    pub created: String,
    pub count: Option<u32>,
    #[serde(deserialize_with = "crate::synced::deserialize_int_to_bool")]
    pub is_visible: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CohortMember {
    pub distinct_id: String,
    pub cohort_id: u32,
}

impl MixpanelClient {
    pub fn new(config: MixpanelConfig) -> Self {
        let mut headers = reqwest::header::HeaderMap::new();

        // Add authorization header
        let auth = BASE64.encode(format!("{}:", config.api_secret));
        headers.insert(
            reqwest::header::AUTHORIZATION,
            format!("Basic {}", auth).parse().unwrap(),
        );

        // Add user agent if provided
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

    pub fn date_window_size(&self) -> u32 {
        self.config.date_window_size
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

    /// Test the connection and authentication
    pub async fn test_connection(&self) -> bool {
        self.list_cohorts().await.is_ok()
    }

    /// Get project information (if available)
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

    let config = MixpanelConfig {
        api_secret: config.api_secret,
        project_id: config.project_id,
        server: MixpanelServer::US,
        date_window_size: 7, // 7-day chunks
        attribution_window: 5,
        project_timezone: "UTC".to_string(),
        user_agent: Some("rust-mixpanel-client/1.0".to_string()),
    };

    MixpanelClient::new(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mixpanel_connection() {
        let client = new_mixpanel_client();
        let is_connected = client.test_connection().await;

        assert!(is_connected);
    }
}
