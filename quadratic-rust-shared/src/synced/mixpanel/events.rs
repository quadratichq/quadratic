//! Mixpanel Events

use chrono::{DateTime, NaiveDate, Utc};
use parquet::record::{Field, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
}

impl MixpanelClient {
    /// Export raw event data as Row objects for direct parquet writing
    pub async fn export_events_as_rows(
        &self,
        params: ExportParams,
    ) -> Result<HashMap<String, Vec<parquet::record::Row>>> {
        let url = format!("{}/export", self.data_export_url());

        let mut query_params = vec![
            ("from_date", params.from_date.format("%Y-%m-%d").to_string()),
            ("to_date", params.to_date.format("%Y-%m-%d").to_string()),
        ];

        if let Some(events) = &params.events {
            let events_json = serde_json::to_string(events)?;
            query_params.push(("event", events_json));
        }

        if let Some(where_clause) = params.r#where {
            query_params.push(("where", where_clause));
        }

        let query_params_str: Vec<_> = query_params.iter().map(|(k, v)| (*k, v.as_str())).collect();

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
        let text = response
            .text()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to get bytes: {}", e)))?;

        println!(
            "Time taken to get response data: {:?}",
            start_time.elapsed()
        );

        // let start_time = std::time::Instant::now();

        // let text = String::from_utf8(bytes.to_vec()).map_err(|e| {
        //     SharedError::Synced(format!("Failed to convert bytes to string: {}", e))
        // })?;

        // println!(
        //     "Time taken to convert bytes to string: {:?}",
        //     start_time.elapsed()
        // );

        let start_time = std::time::Instant::now();
        let mut records: HashMap<String, Vec<Row>> = HashMap::new();

        for line in text.lines() {
            if !line.trim().is_empty() {
                let event: Event = serde_json::from_str(line)?;

                // Convert directly to Row with flattened properties
                let mut fields = Vec::new();
                fields.push(("event".to_string(), Field::Str(event.event)));
                let mut datetime = None;

                // Flatten JSON properties into individual fields
                if let serde_json::Value::Object(props) = event.properties {
                    for (key, value) in props {
                        let field_value = match value {
                            serde_json::Value::Null => Field::Str("".to_string()),
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

                        if key == "time"
                            && let Field::Long(n) = field_value
                        {
                            datetime = Some(DateTime::<Utc>::from_timestamp(n, 0).unwrap());
                        }

                        fields.push((key, field_value));
                    }
                }

                if let Some(datetime) = datetime {
                    let key = datetime.format("%Y-%m-%d").to_string();
                    let row = Row::new(fields);

                    if let Some(record) = records.get_mut(&key) {
                        record.push(row);
                    } else {
                        records.insert(key, vec![row]);
                    }
                }
            }
        }

        println!("Time taken to parse rows: {:?}", start_time.elapsed());

        Ok(records)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::{
        arrow::object_store::list_objects,
        synced::{mixpanel::client::new_mixpanel_client, s3_object_store, upload_to_s3},
    };

    #[tokio::test]
    async fn test_mixpanel_events() {
        let client = new_mixpanel_client();
        let s3 = s3_object_store();
        let num_objects = list_objects(&s3, None).await.unwrap().len();

        // if we don't have any objects, we need to export the last 30 days
        let num_days = if num_objects > 0 { 0 } else { 30 };
        let end_date = chrono::Utc::now().date_naive();
        let start_date = end_date - chrono::Duration::days(num_days);

        println!("Exporting events from {} to {}...", start_date, end_date);

        let params = ExportParams {
            from_date: start_date,
            to_date: end_date,
            events: None,
            r#where: None,
        };

        let start_time = std::time::Instant::now();
        let events = client.export_events_as_rows(params).await.unwrap();

        println!("Exported {} event dates", events.len());

        let (num_files, total_records) = upload_to_s3(&s3, events).await.unwrap();

        println!(
            "Time taken to write {} events to parquet for {} days: {:?}",
            total_records,
            num_files,
            start_time.elapsed()
        );
    }
}
