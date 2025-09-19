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
use chrono::NaiveDate;
use reqwest::Client;
use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::{SharedError, error::Result};

#[cfg(feature = "arrow")]
use {
    arrow::datatypes::{Field, Schema},
    arrow::record_batch::RecordBatch,
    parquet::arrow::arrow_writer::ArrowWriter,
    std::{fs::File, sync::Arc},
};

#[derive(Debug, Clone)]
pub enum MixpanelServer {
    US,
    EU,
    India,
}

impl MixpanelServer {
    fn base_url(&self) -> &'static str {
        match self {
            MixpanelServer::US => "https://mixpanel.com/api/2.0",
            MixpanelServer::EU => "https://eu.mixpanel.com/api/2.0",
            MixpanelServer::India => "https://in.mixpanel.com/api/2.0",
        }
    }

    fn data_export_url(&self) -> &'static str {
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

// ============================================================================
// Data Models
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct Event {
    pub event: String,
    pub properties: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct EngageResponse {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub session_id: Option<String>,
    pub status: Option<String>,
    pub total: Option<u32>,
    pub results: Vec<UserProfile>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UserProfile {
    #[serde(rename = "$distinct_id")]
    pub distinct_id: String,
    #[serde(rename = "$properties")]
    pub properties: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Funnel {
    pub funnel_id: u32,
    pub name: String,
    pub created: Option<String>,
    pub updated: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct FunnelData {
    pub funnel_id: u32,
    pub name: String,
    pub date: String,
    pub steps: Vec<FunnelStep>,
    pub analysis: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct FunnelStep {
    pub count: u32,
    pub step_label: String,
    pub avg_time_to_convert: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RevenueData {
    pub date: String,
    pub amount: f64,
    pub count: u32,
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
    #[serde(deserialize_with = "deserialize_int_to_bool")]
    pub is_visible: Option<bool>,
}

fn deserialize_int_to_bool<'de, D>(deserializer: D) -> Result<Option<bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    match Option::<u32>::deserialize(deserializer)? {
        Some(0) => Ok(Some(false)),
        Some(_) => Ok(Some(true)),
        None => Ok(None),
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CohortMember {
    pub distinct_id: String,
    pub cohort_id: u32,
}

// ============================================================================
// Request Parameters
// ============================================================================

#[derive(Debug, Clone)]
pub struct ExportParams {
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub events: Option<Vec<String>>,
    pub r#where: Option<String>,
    pub bucket: Option<String>,
}

#[derive(Debug, Clone)]
pub struct EngageParams {
    pub r#where: Option<String>,
    pub session_id: Option<String>,
    pub page: Option<u32>,
    pub include_all_users: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct FunnelParams {
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub unit: String, // "minute", "hour", "day", "week", "month"
}

#[derive(Debug, Clone)]
pub struct RevenueParams {
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub unit: String, // "day", "week", "month"
}

// ============================================================================
// Main Client Implementation
// ============================================================================

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

    async fn make_request<T: DeserializeOwned>(
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

    // ========================================================================
    // Events Export (Raw Data)
    // ========================================================================

    /// Export raw event data as Row objects for direct parquet writing
    pub async fn export_events_as_rows(
        &self,
        params: ExportParams,
    ) -> Result<Vec<parquet::record::Row>> {
        use parquet::record::{Field, Row};

        let url = format!("{}/export", self.config.server.data_export_url());

        let mut query_params = vec![
            ("from_date", params.from_date.format("%Y-%m-%d").to_string()),
            ("to_date", params.to_date.format("%Y-%m-%d").to_string()),
        ];

        if let Some(events) = &params.events {
            let events_json = serde_json::to_string(events)?;
            query_params.push(("event", events_json));
        }

        if let Some(where_clause) = &params.r#where {
            query_params.push(("where", where_clause.clone()));
        }

        let query_params_str: Vec<(&str, &str)> =
            query_params.iter().map(|(k, v)| (*k, v.as_str())).collect();

        let start_time = std::time::Instant::now();

        let response = self
            .client
            .get(&url)
            .query(&query_params_str)
            .send()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to send request: {}", e)))?;

        if !response.status().is_success() {
            return Err(SharedError::Synced(format!(
                "Export request failed: {}",
                response.status()
            )));
        }

        println!("Time taken to send request: {:?}", start_time.elapsed());

        let start_time = std::time::Instant::now();

        // Use bytes() which is more efficient than text()
        let bytes = response
            .bytes()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to get bytes: {}", e)))?;

        let text = String::from_utf8(bytes.to_vec()).map_err(|e| {
            SharedError::Synced(format!("Failed to convert bytes to string: {}", e))
        })?;

        println!(
            "Time taken to get response data: {:?}",
            start_time.elapsed()
        );

        let start_time = std::time::Instant::now();
        let mut rows = Vec::new();

        for line in text.lines() {
            if !line.trim().is_empty() {
                let event: Event = serde_json::from_str(line)?;

                // Convert directly to Row with flattened properties
                let mut fields = Vec::new();
                fields.push(("event".to_string(), Field::Str(event.event)));

                // Flatten JSON properties into individual fields
                if let serde_json::Value::Object(props) = event.properties {
                    for (key, value) in props {
                        let field_value = match value {
                            serde_json::Value::Null => Field::Null,
                            serde_json::Value::Bool(b) => Field::Bool(b),
                            serde_json::Value::Number(n) => {
                                if let Some(i) = n.as_i64() {
                                    Field::Long(i)
                                } else if let Some(f) = n.as_f64() {
                                    Field::Double(f)
                                } else {
                                    Field::Str(n.to_string())
                                }
                            }
                            serde_json::Value::String(s) => Field::Str(s),
                            serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
                                Field::Str(value.to_string()) // Nested structures as JSON strings
                            }
                        };

                        fields.push((key, field_value));
                    }
                }

                rows.push(Row::new(fields));
            }
        }

        println!("Time taken to parse rows: {:?}", start_time.elapsed());

        Ok(rows)
    }

    /// Export raw event data
    pub async fn export_events(&self, params: ExportParams) -> Result<Vec<Event>> {
        let url = format!("{}/export", self.config.server.data_export_url());

        let mut query_params = vec![
            ("from_date", params.from_date.format("%Y-%m-%d").to_string()),
            ("to_date", params.to_date.format("%Y-%m-%d").to_string()),
        ];

        if let Some(events) = &params.events {
            let events_json = serde_json::to_string(events)?;
            query_params.push(("event", events_json));
        }

        if let Some(where_clause) = &params.r#where {
            query_params.push(("where", where_clause.clone()));
        }

        let query_params_str: Vec<(&str, &str)> =
            query_params.iter().map(|(k, v)| (*k, v.as_str())).collect();

        let response = self
            .client
            .get(&url)
            .query(&query_params_str)
            .send()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to send request: {}", e)))?;

        if !response.status().is_success() {
            return Err(SharedError::Synced(format!(
                "Export request failed: {}",
                response.status()
            )));
        }

        // The export API returns JSONL (one JSON object per line)
        let text = response
            .text()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to get text: {}", e)))?;
        let mut events = Vec::new();

        for line in text.lines() {
            println!("line: {:?}", line);
            if !line.trim().is_empty() {
                let event: Event = serde_json::from_str(line)?;
                events.push(event);
            }
        }

        Ok(events)
    }

    /// Export events in chunks to handle large datasets
    pub async fn export_events_chunked(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
        events: Option<Vec<String>>,
    ) -> Result<Vec<Event>> {
        let mut all_events = Vec::new();
        let mut current_date = start_date;

        while current_date <= end_date {
            let chunk_end = std::cmp::min(
                current_date + chrono::Duration::days(self.config.date_window_size as i64),
                end_date,
            );

            println!("Exporting events from {} to {}", current_date, chunk_end);

            let params = ExportParams {
                from_date: current_date,
                to_date: chunk_end,
                events: events.clone(),
                r#where: None,
                bucket: None,
            };

            let mut chunk_events = self.export_events(params).await?;
            all_events.append(&mut chunk_events);

            current_date = chunk_end + chrono::Duration::days(1);

            // Add delay to respect rate limits
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }

        Ok(all_events)
    }

    // ========================================================================
    // Engage (People/Users)
    // ========================================================================

    /// Get user profiles
    pub async fn engage(&self, params: EngageParams) -> Result<EngageResponse> {
        let url = format!("{}/engage", self.config.server.base_url());

        let mut query_params = vec![];

        if let Some(where_clause) = &params.r#where {
            query_params.push(("where", where_clause.as_str()));
        }

        if let Some(session_id) = &params.session_id {
            query_params.push(("session_id", session_id.as_str()));
        }

        let page_str;
        if let Some(page) = params.page {
            page_str = page.to_string();
            query_params.push(("page", &page_str));
        }

        self.make_request(&url, &query_params).await
    }

    /// Get all user profiles (handles pagination)
    pub async fn engage_all(&self, params: EngageParams) -> Result<Vec<UserProfile>> {
        let mut all_profiles = Vec::new();
        let mut current_params = params;
        let mut session_id: Option<String> = None;

        loop {
            current_params.session_id = session_id.clone();
            let response = self.engage(current_params.clone()).await?;

            all_profiles.extend(response.results);

            // Check if there are more pages
            if let Some(new_session_id) = response.session_id {
                session_id = Some(new_session_id);
            } else {
                break;
            }

            // Add delay to respect rate limits
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        Ok(all_profiles)
    }

    // ========================================================================
    // Funnels
    // ========================================================================

    /// List all funnels
    pub async fn list_funnels(&self) -> Result<Vec<Funnel>> {
        let url = format!("{}/funnels/list", self.config.server.base_url());
        let response: serde_json::Value = self.make_request(&url, &[]).await?;

        if let Some(funnels) = response.as_array() {
            let parsed_funnels: Result<Vec<Funnel>, _> = funnels
                .iter()
                .map(|f| serde_json::from_value(f.clone()))
                .collect();
            parsed_funnels
                .map_err(|e| SharedError::Synced(format!("Failed to parse funnels: {}", e)))
        } else {
            Ok(vec![])
        }
    }

    /// Get funnel data for a specific funnel
    pub async fn get_funnel_data(
        &self,
        funnel_id: u32,
        params: FunnelParams,
    ) -> Result<FunnelData> {
        let url = format!("{}/funnels", self.config.server.base_url());

        let query_params = vec![
            ("funnel_id", funnel_id.to_string()),
            ("from_date", params.from_date.format("%Y-%m-%d").to_string()),
            ("to_date", params.to_date.format("%Y-%m-%d").to_string()),
            ("unit", params.unit),
        ];

        let query_params_str: Vec<(&str, &str)> =
            query_params.iter().map(|(k, v)| (*k, v.as_str())).collect();

        let response: serde_json::Value = self.make_request(&url, &query_params_str).await?;

        // Parse the funnel response structure
        serde_json::from_value(response)
            .map_err(|e| SharedError::Synced(format!("Failed to parse funnel data: {}", e)))
    }

    /// Get all funnel data for a date range
    pub async fn get_all_funnels_data(&self, params: FunnelParams) -> Result<Vec<FunnelData>> {
        let funnels = self.list_funnels().await?;
        let mut all_funnel_data = Vec::new();

        for funnel in funnels {
            match self.get_funnel_data(funnel.funnel_id, params.clone()).await {
                Ok(data) => all_funnel_data.push(data),
                Err(e) => eprintln!("Failed to get data for funnel {}: {}", funnel.funnel_id, e),
            }

            // Rate limiting
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }

        Ok(all_funnel_data)
    }

    // ========================================================================
    // Revenue
    // ========================================================================

    /// Get revenue data
    pub async fn get_revenue(&self, params: RevenueParams) -> Result<Vec<RevenueData>> {
        let url = format!("{}/engage/revenue", self.config.server.base_url());

        let query_params = vec![
            ("from_date", params.from_date.format("%Y-%m-%d").to_string()),
            ("to_date", params.to_date.format("%Y-%m-%d").to_string()),
            ("unit", params.unit),
        ];

        let query_params_str: Vec<(&str, &str)> =
            query_params.iter().map(|(k, v)| (*k, v.as_str())).collect();

        let response: serde_json::Value = self.make_request(&url, &query_params_str).await?;

        // Parse revenue response - typically comes as date->amount mapping
        let mut revenue_data = Vec::new();
        if let Some(data) = response["data"].as_object() {
            for (date, values) in data {
                if let Some(amount) = values["amount"].as_f64() {
                    let count = values["count"].as_u64().unwrap_or(0) as u32;
                    revenue_data.push(RevenueData {
                        date: date.clone(),
                        amount,
                        count,
                    });
                }
            }
        }

        Ok(revenue_data)
    }

    // ========================================================================
    // Annotations
    // ========================================================================

    /// Get all annotations
    pub async fn get_annotations(&self) -> Result<Vec<Annotation>> {
        let url = format!("{}/annotations", self.config.server.base_url());
        let response: serde_json::Value = self.make_request(&url, &[]).await?;

        if let Some(annotations) = response["annotations"].as_array() {
            let parsed: Result<Vec<Annotation>, _> = annotations
                .iter()
                .map(|a| serde_json::from_value(a.clone()))
                .collect();
            parsed.map_err(|e| SharedError::Synced(format!("Failed to parse annotations: {}", e)))
        } else {
            Ok(vec![])
        }
    }

    // ========================================================================
    // Cohorts
    // ========================================================================

    /// List all cohorts
    pub async fn list_cohorts(&self) -> Result<Vec<Cohort>> {
        let url = format!("{}/cohorts/list", self.config.server.base_url());
        let response: serde_json::Value = self.make_request(&url, &[]).await?;

        if let Some(cohorts) = response.as_array() {
            let parsed: Result<Vec<Cohort>, _> = cohorts
                .iter()
                .map(|c| serde_json::from_value(c.clone()))
                .collect();
            parsed.map_err(|e| SharedError::Synced(format!("Failed to parse cohorts: {}", e)))
        } else {
            Ok(vec![])
        }
    }

    /// Get members of a specific cohort
    pub async fn get_cohort_members(&self, cohort_id: u32) -> Result<Vec<CohortMember>> {
        let params = EngageParams {
            r#where: Some(format!(r#"{{"$cohort": ["{}"]}}"#, cohort_id)),
            session_id: None,
            page: None,
            include_all_users: Some(false),
        };

        let profiles = self.engage_all(params).await?;

        Ok(profiles
            .into_iter()
            .map(|profile| CohortMember {
                distinct_id: profile.distinct_id,
                cohort_id,
            })
            .collect())
    }

    /// Get all cohort members across all cohorts
    pub async fn get_all_cohort_members(&self) -> Result<Vec<CohortMember>> {
        let cohorts = self.list_cohorts().await?;
        let mut all_members = Vec::new();

        for cohort in cohorts {
            match self.get_cohort_members(cohort.id).await {
                Ok(mut members) => all_members.append(&mut members),
                Err(e) => eprintln!("Failed to get members for cohort {}: {}", cohort.id, e),
            }

            // Rate limiting
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }

        Ok(all_members)
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /// Test the connection and authentication
    pub async fn test_connection(&self) -> Result<bool> {
        match self.list_cohorts().await {
            Ok(_) => Ok(true),
            Err(e) => {
                eprintln!("Connection test failed: {}", e);
                Ok(false)
            }
        }
    }

    /// Get project information (if available)
    pub async fn get_project_info(&self) -> Result<serde_json::Value> {
        let url = format!("{}/engage", self.config.server.base_url());
        let params = vec![("page", "0")];
        self.make_request(&url, &params).await
    }
}

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

    use crate::{arrow::arrow_type::ArrowType, parquet::utils::vec_to_parquet};

    #[tokio::test]
    async fn test_mixpanel_client() -> Result<()> {
        let client = new_mixpanel_client();

        // Test connection
        println!("Testing connection...");
        if client.test_connection().await? {
            println!("✅ Connection successful!");
        } else {
            println!("❌ Connection failed!");
            return Ok(());
        }

        // Example: Export events from the last 7 days
        let end_date = chrono::Utc::now().date_naive();
        let start_date = end_date - chrono::Duration::days(30);

        println!("Exporting events from {} to {}...", start_date, end_date);

        let params = ExportParams {
            from_date: start_date,
            to_date: end_date,
            events: None,
            r#where: None,
            bucket: None,
        };

        match client.export_events_as_rows(params).await {
            Ok(rows) => {
                println!("✅ Exported {} events as rows", rows.len());
                let start_time = std::time::Instant::now();

                // write rows directly to parquet file
                let parquet_file = "/Users/daviddimaria/Downloads/mixpanel_events-3.parquet";
                vec_to_parquet(rows, parquet_file)?;
                println!("✅ Wrote events to {}", parquet_file);
                println!(
                    "Time taken to write events to parquet: {:?}",
                    start_time.elapsed()
                );
            }
            Err(e) => println!("❌ Failed to export events: {}", e),
        }

        // // Example: Get user profiles
        // println!("\nGetting user profiles...");
        // let engage_params = EngageParams {
        //     r#where: None,
        //     session_id: None,
        //     page: Some(0),
        //     include_all_users: Some(true),
        // };

        // match client.engage(engage_params).await {
        //     Ok(response) => {
        //         println!("✅ Got {} user profiles", response.results.len());
        //         if let Some(first_profile) = response.results.first() {
        //             println!("Sample profile ID: {}", first_profile.distinct_id);
        //         }
        //     }
        //     Err(e) => println!("❌ Failed to get user profiles: {}", e),
        // }

        // // Example: List funnels
        // println!("\nListing funnels...");
        // match client.list_funnels().await {
        //     Ok(funnels) => {
        //         println!("✅ Found {} funnels", funnels.len());
        //         for funnel in funnels {
        //             println!("  - {} (ID: {})", funnel.name, funnel.funnel_id);
        //         }
        //     }
        //     Err(e) => println!("❌ Failed to list funnels: {}", e),
        // }

        // // Example: Get revenue data
        // println!("\nGetting revenue data...");
        // let revenue_params = RevenueParams {
        //     from_date: start_date,
        //     to_date: end_date,
        //     unit: "day".to_string(),
        // };

        // match client.get_revenue(revenue_params).await {
        //     Ok(revenue_data) => {
        //         println!("✅ Got revenue data for {} days", revenue_data.len());
        //         for revenue in &revenue_data {
        //             println!(
        //                 "  - {}: ${:.2} ({} transactions)",
        //                 revenue.date, revenue.amount, revenue.count
        //             );
        //         }
        //     }
        //     Err(e) => println!("❌ Failed to get revenue data: {}", e),
        // }

        // // Example: List cohorts
        // println!("\nListing cohorts...");
        // match client.list_cohorts().await {
        //     Ok(cohorts) => {
        //         println!("✅ Found {} cohorts", cohorts.len());
        //         for cohort in cohorts {
        //             println!(
        //                 "  - {} (ID: {}, Count: {:?})",
        //                 cohort.name, cohort.id, cohort.count
        //             );
        //         }
        //     }
        //     Err(e) => println!("❌ Failed to list cohorts: {}", e),
        // }

        // // Example: Get annotations
        // println!("\nGetting annotations...");
        // match client.get_annotations().await {
        //     Ok(annotations) => {
        //         println!("✅ Found {} annotations", annotations.len());
        //         for annotation in annotations {
        //             println!("  - {}: {}", annotation.date, annotation.description);
        //         }
        //     }
        //     Err(e) => println!("❌ Failed to get annotations: {}", e),
        // }

        println!("\n🎉 All examples completed!");
        Ok(())
    }
}
