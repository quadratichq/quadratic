//! Mixpanel Revenue

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::{error::Result, synced::mixpanel::client::MixpanelClient};

#[derive(Debug, Deserialize, Serialize)]
pub struct RevenueData {
    pub date: String,
    pub amount: f64,
    pub count: u32,
}

#[derive(Debug, Clone)]
pub struct RevenueParams {
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub unit: String, // "day", "week", "month"
}

impl MixpanelClient {
    /// Get revenue data
    pub async fn get_revenue(&self, params: RevenueParams) -> Result<Vec<RevenueData>> {
        let url = format!("{}/engage/revenue", self.config().server.base_url());

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
}

#[cfg(test)]
mod tests {
    use crate::synced::mixpanel::client::new_mixpanel_client;

    use super::*;

    // TODO(ddimaria): we don't have revenue data for quadratic
    #[ignore]
    #[tokio::test]
    async fn test_mixpanel_revenue() {
        let client = new_mixpanel_client();
        let start_date = chrono::Utc::now().date_naive() - chrono::Duration::days(1);
        let end_date = chrono::Utc::now().date_naive();
        let revenue_params = RevenueParams {
            from_date: start_date,
            to_date: end_date,
            unit: "day".to_string(),
        };
        let revenue_data = client.get_revenue(revenue_params).await.unwrap();

        println!("Got revenue data for {} days", revenue_data.len());

        for revenue in &revenue_data {
            println!(
                "  - {}: ${:.2} ({} transactions)",
                revenue.date, revenue.amount, revenue.count
            );
        }
    }
}
