//! Mixpanel Events

use bytes::Bytes;
use chrono::{DateTime, NaiveDate, Utc};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::{
    SharedError,
    error::Result,
    parquet::json::grouped_json_to_parquet,
    synced::{DATE_FORMAT, mixpanel::client::MixpanelClient},
};

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
    pub limit: Option<u32>,
}

impl ExportParams {
    pub fn new(from_date: NaiveDate, to_date: NaiveDate) -> Self {
        Self {
            from_date,
            to_date,
            ..Default::default()
        }
    }
}

impl Default for ExportParams {
    fn default() -> Self {
        Self {
            from_date: chrono::Utc::now().date_naive(),
            to_date: chrono::Utc::now().date_naive(),
            events: None,
            r#where: None,
            limit: None,
        }
    }
}

impl MixpanelClient {
    /// Export raw event data using arrow-json for consistent schema handling
    pub async fn export_events(&self, params: ExportParams) -> Result<HashMap<String, Bytes>> {
        let url = format!("{}/export", self.data_export_url());

        // gather params
        let from_date = params.from_date.format(DATE_FORMAT).to_string();
        let to_date = params.to_date.format(DATE_FORMAT).to_string();
        let mut query_params = vec![("from_date", from_date), ("to_date", to_date)];

        if let Some(events) = &params.events {
            let events_json = serde_json::to_string(events)?;
            query_params.push(("event", events_json));
        }

        if let Some(where_clause) = params.r#where {
            query_params.push(("where", where_clause));
        }

        if let Some(limit) = params.limit {
            query_params.push(("limit", limit.to_string()));
        }

        let query_params_str: Vec<_> = query_params.iter().map(|(k, v)| (*k, v.as_str())).collect();

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

        let text = response
            .text()
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to get response text: {}", e)))?;

        // group JSON lines by date and flatten the structure using parallel processing
        let grouped_json = Mutex::new(HashMap::<String, Vec<String>>::new());

        // process lines in parallel
        let results: Vec<Result<Option<(String, String)>>> = text
            .lines()
            .collect::<Vec<&str>>()
            .par_iter()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                // parse and flatten the Mixpanel event structure
                let event: Event = serde_json::from_str(line)?;

                if let Some(time_value) = event.properties.get("time")
                    && let Some(timestamp) = time_value.as_i64()
                {
                    let datetime = DateTime::<Utc>::from_timestamp(timestamp, 0)
                        .ok_or_else(|| SharedError::Synced("Invalid timestamp".to_string()))?;
                    let date_key = datetime.format(DATE_FORMAT).to_string();

                    // flatten the event into a single JSON object
                    let flattened_event = Self::flatten_mixpanel_event(&event);
                    let flattened_json = serde_json::to_string(&flattened_event)?;

                    return Ok(Some((date_key, flattened_json)));
                }
                Ok(None)
            })
            .collect();

        // collect results and handle any errors
        for result in results {
            // skip events without timestamps
            if let Some((date_key, flattened_json)) = result? {
                grouped_json
                    .lock()
                    .unwrap()
                    .entry(date_key)
                    .or_default()
                    .push(flattened_json);
            }
        }

        let grouped_json = grouped_json.into_inner().unwrap();

        // convert grouped JSON to Parquet using arrow-json with schema inference
        if grouped_json.is_empty() {
            return Ok(HashMap::new());
        }

        let grouped_parquet = grouped_json_to_parquet(grouped_json)?;

        Ok(grouped_parquet)
    }

    /// Flatten a Mixpanel event into a single-level JSON object.
    /// This converts the nested structure to a flat structure suitable for Arrow processing.
    fn flatten_mixpanel_event(event: &Event) -> serde_json::Map<String, serde_json::Value> {
        let mut flattened = serde_json::Map::new();

        flattened.insert(
            "event".to_string(),
            serde_json::Value::String(event.event.clone()),
        );

        // flatten all properties, converting complex objects to JSON strings
        if let serde_json::Value::Object(properties) = &event.properties {
            for (key, value) in properties {
                let flattened_value = match value {
                    // keep simple types as-is
                    serde_json::Value::Null
                    | serde_json::Value::Bool(_)
                    | serde_json::Value::Number(_)
                    | serde_json::Value::String(_) => value.clone(),

                    // convert complex types to JSON strings
                    serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
                        serde_json::Value::String(value.to_string())
                    }
                };
                flattened.insert(key.clone(), flattened_value);
            }
        }

        flattened
    }

    // /// Export raw event data as Row objects for direct parquet writing (legacy method)
    // pub async fn export_events_as_rows(
    //     &self,
    //     params: ExportParams,
    // ) -> Result<HashMap<String, Vec<parquet::record::Row>>> {
    //     let url = format!("{}/export", self.data_export_url());

    //     let mut query_params = vec![
    //         ("from_date", params.from_date.format("%Y-%m-%d").to_string()),
    //         ("to_date", params.to_date.format("%Y-%m-%d").to_string()),
    //     ];

    //     if let Some(events) = &params.events {
    //         let events_json = serde_json::to_string(events)?;
    //         query_params.push(("event", events_json));
    //     }

    //     if let Some(where_clause) = params.r#where {
    //         query_params.push(("where", where_clause));
    //     }

    //     let query_params_str: Vec<_> = query_params.iter().map(|(k, v)| (*k, v.as_str())).collect();

    //     let start_time = std::time::Instant::now();

    //     let response = self
    //         .client()
    //         .get(&url)
    //         .query(&query_params_str)
    //         .send()
    //         .await
    //         .map_err(|e| SharedError::Synced(format!("Failed to send request: {}", e)))?;

    //     if !response.status().is_success() {
    //         return Err(SharedError::Synced(format!(
    //             "Export request failed: {}",
    //             response.status()
    //         )));
    //     }

    //     println!("Time taken to send request: {:?}", start_time.elapsed());

    //     let start_time = std::time::Instant::now();

    //     // Use bytes() which is more efficient than text()
    //     let text = response
    //         .text()
    //         .await
    //         .map_err(|e| SharedError::Synced(format!("Failed to get bytes: {}", e)))?;

    //     println!(
    //         "Time taken to get response data: {:?}",
    //         start_time.elapsed()
    //     );

    //     // let start_time = std::time::Instant::now();

    //     // let text = String::from_utf8(bytes.to_vec()).map_err(|e| {
    //     //     SharedError::Synced(format!("Failed to convert bytes to string: {}", e))
    //     // })?;

    //     // println!(
    //     //     "Time taken to convert bytes to string: {:?}",
    //     //     start_time.elapsed()
    //     // );

    //     let start_time = std::time::Instant::now();
    //     let mut records: HashMap<String, Vec<Row>> = HashMap::new();

    //     for line in text.lines() {
    //         if !line.trim().is_empty() {
    //             let event: Event = serde_json::from_str(line)?;

    //             // Convert directly to Row with flattened properties
    //             let mut fields = Vec::new();
    //             fields.push(("event".to_string(), Field::Str(event.event)));
    //             let mut datetime = None;

    //             // Flatten JSON properties into individual fields
    //             if let serde_json::Value::Object(props) = event.properties {
    //                 for (key, value) in props {
    //                     let field_value = StringColumn::json_value_to_field(value);

    //                     if key == "time"
    //                         && let Field::Long(n) = field_value
    //                     {
    //                         datetime = Some(DateTime::<Utc>::from_timestamp(n, 0).unwrap());
    //                     }

    //                     fields.push((key, field_value));
    //                 }
    //             }

    //             if let Some(datetime) = datetime {
    //                 let key = datetime.format("%Y-%m-%d").to_string();
    //                 let row = Row::new(fields);

    //                 if let Some(record) = records.get_mut(&key) {
    //                     record.push(row);
    //                 } else {
    //                     records.insert(key, vec![row]);
    //                 }
    //             }
    //         }
    //     }

    //     println!("Time taken to parse rows: {:?}", start_time.elapsed());

    //     Ok(records)
    // }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::synced::mixpanel::client::new_mixpanel_client;

    // #[tokio::test]
    // async fn test_mixpanel_events() {
    //     let client = new_mixpanel_client();
    //     let s3 = s3_object_store();
    //     let num_objects = list_objects(&s3, None).await.unwrap().len();
    //     println!("Number of objects: {}", num_objects);

    //     // if we don't have any objects, we need to export the last 30 days
    //     // let num_days = if num_objects > 0 { 0 } else { 30 };
    //     let num_days = 31;
    //     let end_date = chrono::Utc::now().date_naive();
    //     let start_date = end_date - chrono::Duration::days(num_days);

    //     println!("Exporting events from {} to {}...", start_date, end_date);

    //     let params = ExportParams {
    //         from_date: start_date,
    //         to_date: end_date,
    //         events: None,
    //         r#where: None,
    //     };

    //     let start_time = std::time::Instant::now();
    //     let events = client.export_events_as_rows(params).await.unwrap();

    //     println!("Exported {} event dates", events.len());

    //     let (num_files, total_records) = upload_to_s3(&s3, events).await.unwrap();

    //     println!(
    //         "Time taken to write {} events to parquet for {} days: {:?}",
    //         total_records,
    //         num_files,
    //         start_time.elapsed()
    //     );
    // }

    #[tokio::test]
    async fn test_mixpanel_events() {
        let client = new_mixpanel_client();
        let start_date = chrono::Utc::now().date_naive();
        let mut params = ExportParams::new(start_date, start_date);
        params.limit = Some(1);

        let parquet_data = client.export_events(params).await.unwrap();

        assert_eq!(parquet_data.len(), 1);
        assert_eq!(
            *parquet_data.keys().next().unwrap(),
            start_date.format(DATE_FORMAT).to_string()
        );
    }

    #[test]
    fn test_flatten_mixpanel_event() {
        let event = Event {
            event: "Purchase".to_string(),
            properties: serde_json::json!({
                "time": 1640995200,
                "user_id": "123",
                "amount_usd": 29.99,
                "language": {"Connection": {"id": "456", "kind": "POSTGRES"}},
                "utm_term": null,
                "items": ["item1", "item2"]
            }),
        };

        let flattened = MixpanelClient::flatten_mixpanel_event(&event);

        // Check basic fields
        assert_eq!(
            flattened.get("event").unwrap(),
            &serde_json::Value::String("Purchase".to_string())
        );
        assert_eq!(
            flattened.get("time").unwrap(),
            &serde_json::Value::Number(serde_json::Number::from(1640995200))
        );
        assert_eq!(
            flattened.get("user_id").unwrap(),
            &serde_json::Value::String("123".to_string())
        );
        assert_eq!(
            flattened.get("amount_usd").unwrap(),
            &serde_json::Value::Number(serde_json::Number::from_f64(29.99).unwrap())
        );

        // Check that complex objects are converted to strings
        let language_value = flattened.get("language").unwrap();
        assert!(language_value.is_string());
        assert!(language_value.as_str().unwrap().contains("Connection"));

        // Check that arrays are converted to strings
        let items_value = flattened.get("items").unwrap();
        assert!(items_value.is_string());
        assert!(items_value.as_str().unwrap().contains("item1"));

        // Check that null values are preserved
        assert_eq!(flattened.get("utm_term").unwrap(), &serde_json::Value::Null);
    }

    #[test]
    fn test_event_name_preservation() {
        // Test that event names with special characters are preserved correctly
        let special_events = vec![
            "[Auth0].signUp",
            "[Auth].signup",
            "User Sign-up",
            "Purchase: $100",
            "Event with \"quotes\"",
        ];

        for event_name in special_events {
            let event = Event {
                event: event_name.to_string(),
                properties: serde_json::json!({
                    "time": 1640995200,
                }),
            };

            let flattened = MixpanelClient::flatten_mixpanel_event(&event);
            let flattened_json = serde_json::to_string(&flattened).unwrap();

            // Parse back to verify the event name is preserved
            let parsed: serde_json::Value = serde_json::from_str(&flattened_json).unwrap();
            let parsed_event_name = parsed.get("event").unwrap().as_str().unwrap();

            assert_eq!(
                parsed_event_name, event_name,
                "Event name '{}' was not preserved correctly, got '{}'",
                event_name, parsed_event_name
            );
        }
    }
}
