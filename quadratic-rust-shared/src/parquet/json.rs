//! Arrow JSON to Parquet conversion utilities
//!
//! This module provides utilities to convert JSON data directly to Parquet format
//! using Arrow's built-in JSON reader, eliminating custom schema inference and
//! type promotion logic.

use std::collections::HashMap;
use std::io::Cursor;
use std::sync::Arc;

use rayon::prelude::*;

use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use arrow_json::{ReaderBuilder, reader::infer_json_schema};
use bytes::Bytes;

use crate::parquet::error::Parquet as ParquetError;
use crate::parquet::utils::record_batch_to_parquet_bytes;
use crate::{SharedError, error::Result};

fn error(e: impl ToString) -> SharedError {
    SharedError::Parquet(ParquetError::Json(e.to_string()))
}

/// Create a converter with schema inference from JSON data
pub fn inferred_schema_from_json_lines(json_lines: &[&str]) -> Result<Arc<Schema>> {
    if json_lines.is_empty() {
        return Err(error(
            "Cannot infer schema from empty JSON lines".to_string(),
        ));
    }

    // use Arrow's JSON schema inference with more samples to get better type detection
    let sample_json = json_lines
        .iter()
        .take(2000) // Take more samples for better schema inference
        .map(|s| *s)
        .collect::<Vec<_>>()
        .join("\n");

    let mut cursor = Cursor::new(sample_json);

    // infer schema from JSON data - use more records for inference
    let (schema, _) = infer_json_schema(&mut cursor, Some(1000))?;

    // post-process schema to handle problematic types for real-world JSON
    // and onvert problematic types to Utf8 to handle mixed data types
    let fixed_fields: Vec<Field> = schema
        .fields()
        .iter()
        .map(|field| {
            let new_data_type = match field.data_type() {
                // always convert Null to Utf8
                DataType::Null => DataType::Utf8,
                // convert complex types that can vary to Utf8 for safety
                DataType::Struct(_) | DataType::List(_) | DataType::Map(_, _) => DataType::Utf8,
                // keep simple, consistent types
                DataType::Boolean | DataType::Int64 | DataType::Float64 | DataType::Utf8 => {
                    field.data_type().clone()
                }
                // convert everything else to Utf8 for maximum compatibility
                _ => DataType::Utf8,
            };
            Field::new(field.name(), new_data_type, true)
        })
        .collect();

    Ok(Arc::new(Schema::new(fixed_fields)))
}

/// Convert JSON lines to a RecordBatch using the predefined schema
pub fn json_lines_to_record_batch(schema: Arc<Schema>, json_lines: &[&str]) -> Result<RecordBatch> {
    if json_lines.is_empty() {
        return Err(error("Cannot convert empty JSON lines".to_string()));
    }

    // combine JSON lines into a single string
    let json_data = json_lines.join("\n");
    let cursor = Cursor::new(json_data);

    // create reader with our schema
    let builder = ReaderBuilder::new(schema.clone());
    let reader = builder.build(cursor)?;

    // read all batches and combine them
    let batches: std::result::Result<Vec<_>, _> = reader.collect();
    let batches = batches?;

    if batches.is_empty() {
        return Err(error("No data batches produced from JSON".to_string()));
    }

    // if we have multiple batches, concatenate them
    if batches.len() == 1 {
        Ok(batches.into_iter().next().unwrap())
    } else {
        // concatenate multiple batches
        let schema = batches[0].schema();
        let arrays: Vec<_> = (0..schema.fields().len())
            .map(|i| {
                let arrays: Vec<_> = batches
                    .iter()
                    .map(|batch| batch.column(i).clone())
                    .collect();
                arrow::compute::concat(&arrays.iter().map(|a| a.as_ref()).collect::<Vec<_>>())
            })
            .collect::<std::result::Result<Vec<_>, _>>()?;

        RecordBatch::try_new(schema, arrays)
            .map_err(|e| error(format!("Failed to create concatenated record batch: {}", e)))
    }
}

/// Convert JSON lines directly to Parquet bytes
pub fn json_lines_to_parquet_bytes(schema: Arc<Schema>, json_lines: &[&str]) -> Result<Bytes> {
    let record_batch = json_lines_to_record_batch(schema, json_lines)?;
    record_batch_to_parquet_bytes(record_batch)
}

/// Convert grouped JSON data to multiple Parquet files with automatic schema inference
/// This infers a unified schema from all JSON data to ensure consistency across all files
/// Uses parallel processing for better performance
pub fn grouped_json_to_parquet(
    grouped_json: HashMap<String, Vec<String>>,
) -> Result<HashMap<String, Bytes>> {
    let mut result = HashMap::new();
    let grouped_json_value = grouped_json.values();

    if grouped_json.is_empty() || grouped_json_value.len() == 0 {
        return Ok(result);
    }

    // collect all JSON lines to infer a unified schema
    let all_json_lines: Vec<&str> = grouped_json_value
        .flat_map(|lines| lines.iter().map(|s| s.as_str()))
        .collect();

    // infer schema from all JSON data
    let schema = inferred_schema_from_json_lines(&all_json_lines)?;

    // process groups in parallel
    let results: Vec<Result<(String, Bytes)>> = grouped_json
        .into_par_iter()
        .map(|(key, json_lines)| {
            let json_refs: Vec<&str> = json_lines.iter().map(|s| s.as_str()).collect();
            let parquet_bytes = json_lines_to_parquet_bytes(schema.clone(), &json_refs)?;

            Ok((key, parquet_bytes))
        })
        .collect();

    // collect results and handle any errors
    for res in results {
        let (key, parquet_bytes) = res?;
        result.insert(key, parquet_bytes);
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_json_to_parquet() {
        let json_lines = vec![
            r#"{"name": "Alice", "age": 30, "score": 95.5}"#,
            r#"{"name": "Bob", "age": 25, "score": 87.2}"#,
            r#"{"name": "Charlie", "score": 92.0}"#, // Missing age - should be null
        ];

        let schema = inferred_schema_from_json_lines(&json_lines).unwrap();
        let result = json_lines_to_parquet_bytes(schema, &json_lines);
        assert!(result.is_ok());

        let parquet_bytes = result.unwrap();
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_schema_inference() {
        let json_lines = vec![
            r#"{"event": "purchase", "amount": 29.99, "user_id": "123", "timestamp": 1640995200}"#,
            r#"{"event": "signup", "amount": 0, "user_id": "456", "country": "US"}"#,
            r#"{"event": "login", "user_id": "123", "device": "mobile"}"#,
        ];

        let schema = inferred_schema_from_json_lines(&json_lines).unwrap();

        // Check that all fields are present
        assert!(schema.field_with_name("event").is_ok());
        assert!(schema.field_with_name("amount").is_ok());
        assert!(schema.field_with_name("user_id").is_ok());

        // Test conversion
        let result = json_lines_to_parquet_bytes(schema, &json_lines);
        assert!(result.is_ok());

        let parquet_bytes = result.unwrap();
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_null_to_string_type_handling() {
        // This test reproduces the utm_term issue where a field starts as null
        // but later has string values
        let json_lines = vec![
            r#"{"event": "signup", "utm_term": null, "user_id": "123"}"#,
            r#"{"event": "login", "utm_term": null, "user_id": "456"}"#,
            r#"{"event": "purchase", "utm_term": "0_e4959f7aa7-aacdf245f3-298176542", "user_id": "789"}"#,
        ];

        let schema = inferred_schema_from_json_lines(&json_lines).unwrap();

        // utm_term should be Utf8, not Null, to handle mixed null/string values
        let utm_term_field = schema.field_with_name("utm_term").unwrap();
        assert_eq!(utm_term_field.data_type(), &DataType::Utf8);
        assert!(utm_term_field.is_nullable()); // Should be nullable

        // Test conversion - this should not panic
        let result = json_lines_to_parquet_bytes(schema, &json_lines);
        assert!(result.is_ok());

        let parquet_bytes = result.unwrap();
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_mixed_types_handling() {
        // Test handling of fields that have different types across records
        let json_lines = vec![
            r#"{"event": "signup", "language": "en", "user_id": "123"}"#,
            r#"{"event": "login", "language": "fr", "user_id": "456"}"#,
            r#"{"event": "error", "language": "{\"Connection\": {\"id\": \"123\", \"kind\": \"POSTGRES\"}}", "user_id": "789"}"#,
        ];

        let schema = inferred_schema_from_json_lines(&json_lines).unwrap();

        // language should be Utf8 to handle both strings and serialized objects
        let language_field = schema.field_with_name("language").unwrap();
        assert_eq!(language_field.data_type(), &DataType::Utf8);

        // Test conversion - this should not panic
        let result = json_lines_to_parquet_bytes(schema, &json_lines);
        assert!(result.is_ok());

        let parquet_bytes = result.unwrap();
        assert!(!parquet_bytes.is_empty());
    }

    #[test]
    fn test_grouped_json_with_inference() {
        let mut grouped_json = HashMap::new();

        grouped_json.insert(
            "2024-01-01".to_string(),
            vec![
                r#"{"event": "purchase", "amount": 29.99, "user_id": "123"}"#.to_string(),
                r#"{"event": "signup", "amount": 0, "user_id": "456"}"#.to_string(),
            ],
        );

        grouped_json.insert(
            "2024-01-02".to_string(),
            vec![r#"{"event": "login", "user_id": "123", "device": "mobile"}"#.to_string()],
        );

        let result = grouped_json_to_parquet(grouped_json).unwrap();

        assert_eq!(result.len(), 2);
        assert!(result.contains_key("2024-01-01"));
        assert!(result.contains_key("2024-01-02"));

        // Both files should have data
        assert!(!result["2024-01-01"].is_empty());
        assert!(!result["2024-01-02"].is_empty());
    }

    #[test]
    fn test_parallel_performance() {
        // Create a larger dataset to test parallel performance
        let mut grouped_json = HashMap::new();

        // Create multiple date groups with many records each
        for day in 1..=10 {
            let date_key = format!("2024-01-{:02}", day);
            let mut records = Vec::new();

            // Add many records per date (using properly flattened structure)
            for i in 1..=1000 {
                let record = format!(
                    r#"{{"event": "test_event", "user_id": "{}", "amount": {}, "timestamp": {}, "complex_field": "{{\"nested\": \"value_{}\"}}" }}"#,
                    i,
                    i as f64 * 10.5,
                    1640995200 + i,
                    i
                );
                records.push(record);
            }

            grouped_json.insert(date_key, records);
        }

        let start_time = std::time::Instant::now();
        let result = grouped_json_to_parquet(grouped_json).unwrap();
        let duration = start_time.elapsed();

        println!("Parallel processing took: {:?}", duration);

        // Should have 10 date groups
        assert_eq!(result.len(), 10);

        // Each group should have parquet data
        for (_, parquet_data) in result {
            assert!(!parquet_data.is_empty());
        }
    }
}
