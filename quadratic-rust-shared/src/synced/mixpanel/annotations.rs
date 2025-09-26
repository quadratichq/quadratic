//! Mixpanel Annotations

use serde::{Deserialize, Serialize};

use crate::{SharedError, error::Result, synced::mixpanel::client::MixpanelClient};

#[derive(Debug, Deserialize, Serialize)]
pub struct Annotation {
    pub id: u32,
    pub project_id: u32,
    pub date: String,
    pub description: String,
    pub created: String,
}

impl MixpanelClient {
    /// Get all annotations
    pub async fn get_annotations(&self) -> Result<Vec<Annotation>> {
        let url = format!("{}/annotations", self.config().server.base_url());
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
}

#[cfg(test)]
mod tests {
    use crate::synced::mixpanel::client::new_mixpanel_client;

    // TODO(ddimaria): remove this ignore once we have annotations mocked
    #[ignore]
    #[tokio::test]
    async fn test_mixpanel_annotations() {
        let client = new_mixpanel_client();
        let annotations = client.get_annotations().await.unwrap();

        println!("Found {} annotations", annotations.len());

        for annotation in annotations {
            println!("  - {}: {}", annotation.date, annotation.description);
        }
    }
}
