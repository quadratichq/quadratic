//! Mixpanel Engage

use serde::{Deserialize, Serialize};

use crate::{error::Result, synced::mixpanel::client::MixpanelClient};

#[derive(Debug, Deserialize, Serialize)]
pub struct UserProfile {
    #[serde(rename = "$distinct_id")]
    pub distinct_id: String,
    #[serde(rename = "$properties")]
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

#[derive(Debug, Clone)]
pub struct EngageParams {
    pub r#where: Option<String>,
    pub session_id: Option<String>,
    pub page: Option<u32>,
    pub include_all_users: Option<bool>,
}

impl MixpanelClient {
    /// Get user profiles
    pub async fn engage(&self, params: EngageParams) -> Result<EngageResponse> {
        let url = format!("{}/engage", self.config().server.base_url());

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
}

#[cfg(test)]
mod tests {
    use crate::synced::mixpanel::client::new_mixpanel_client;

    use super::*;

    #[tokio::test]
    async fn test_mixpanel_engage() {
        let client = new_mixpanel_client();
        let engage_params = EngageParams {
            r#where: None,
            session_id: None,
            page: Some(0),
            include_all_users: Some(true),
        };
        let response = client.engage(engage_params).await.unwrap();

        println!("✅ Got {} user profiles", response.results.len());

        if let Some(first_profile) = response.results.first() {
            println!("Sample profile ID: {}", first_profile.distinct_id);
        }
    }
}
