//! Mixpanel Events

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::{SharedError, error::Result, synced::mixpanel::client::MixpanelClient};

#[derive(Debug, Deserialize, Serialize)]
pub struct Event {
    pub event: String,
    pub properties: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct ExportParams {
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub events: Option<Vec<String>>,
    pub r#where: Option<String>,
    pub bucket: Option<String>,
}

impl MixpanelClient {
    /// Export raw event data as Row objects for direct parquet writing
    pub async fn export_events_as_rows(
        &self,
        params: ExportParams,
    ) -> Result<Vec<parquet::record::Row>> {
        use parquet::record::{Field, Row};

        let url = format!("{}/export", self.data_export_url());

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
            .client()
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
        let url = format!("{}/export", self.data_export_url());

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
            .client()
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
                current_date + chrono::Duration::days(self.date_window_size() as i64),
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
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::{parquet::utils::vec_to_parquet, synced::mixpanel::client::new_mixpanel_client};

    #[tokio::test]
    async fn test_mixpanel_events() {
        let client = new_mixpanel_client();
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

        let start_time = std::time::Instant::now();
        let events = client.export_events_as_rows(params).await.unwrap();

        println!("Exported {} events", events.len());

        let parquet_file = "/Users/daviddimaria/Downloads/mixpanel_events-3.parquet";
        vec_to_parquet(events, parquet_file).unwrap();

        println!("Wrote events to {}", parquet_file);

        println!(
            "Time taken to write events to parquet: {:?}",
            start_time.elapsed()
        );
    }
}
