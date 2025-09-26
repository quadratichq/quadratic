//! Mixpanel Funnel

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::{SharedError, error::Result, synced::mixpanel::client::MixpanelClient};

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

#[derive(Debug, Clone)]
pub struct FunnelParams {
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub unit: String, // "minute", "hour", "day", "week", "month"
}

impl MixpanelClient {
    /// List all funnels
    pub async fn list_funnels(&self) -> Result<Vec<Funnel>> {
        let url = format!("{}/funnels/list", self.config().server.base_url());
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
        let url = format!("{}/funnels", self.config().server.base_url());

        let query_params = [
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
}

#[cfg(test)]
mod tests {
    use crate::synced::mixpanel::client::new_mixpanel_client;

    // TODO(ddimaria): remove this ignore once we have funnels mocked
    #[ignore]
    #[tokio::test]
    async fn test_mixpanel_funnels() {
        let client = new_mixpanel_client();
        let funnels = client.list_funnels().await.unwrap();

        println!("Found {} funnels", funnels.len());

        for funnel in funnels {
            println!("  - {} (ID: {})", funnel.name, funnel.funnel_id);
        }
    }
}
