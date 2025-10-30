//! Mixpanel Cohorts

use serde::{Deserialize, Serialize};

use crate::{
    SharedError,
    error::Result,
    synced::mixpanel::{client::MixpanelClient, engage::EngageParams},
};

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
    /// List all cohorts
    pub async fn list_cohorts(&self) -> Result<Vec<Cohort>> {
        let url = format!("{}/cohorts/list", self.config().server.base_url());
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
}

#[cfg(test)]
mod tests {
    use crate::synced::mixpanel::client::new_mixpanel_client;

    // TODO(ddimaria): remove this ignore once we have cohorts mocked
    #[ignore]
    #[tokio::test]
    async fn test_mixpanel_cohorts() {
        let client = new_mixpanel_client();
        let cohorts = client.list_cohorts().await.unwrap();

        println!("Found {} cohorts", cohorts.len());

        for cohort in cohorts {
            println!(
                "  - {} (ID: {}, Count: {:?})",
                cohort.name, cohort.id, cohort.count
            );
        }
    }
}
