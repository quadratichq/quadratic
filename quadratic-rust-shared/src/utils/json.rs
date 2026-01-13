/// Flatten a JSON map, converting nested objects and arrays to JSON strings.
pub fn flatten_json_map(
    map: &serde_json::Map<String, serde_json::Value>,
) -> serde_json::Map<String, serde_json::Value> {
    use serde_json::Value;

    map.iter()
        .map(|(key, value)| {
            let flattened_value = match value {
                Value::Array(_) | Value::Object(_) => {
                    Value::String(serde_json::to_string(value).unwrap_or_default())
                }
                other => other.clone(),
            };
            (key.clone(), flattened_value)
        })
        .collect()
}

/// Flatten any serializable object into a single-level JSON object.
/// Nested objects and arrays are converted to JSON strings.
pub fn flatten_to_json<T: serde::Serialize>(
    item: &T,
) -> serde_json::Map<String, serde_json::Value> {
    let json_value = serde_json::to_value(item).unwrap_or(serde_json::Value::Null);

    if let serde_json::Value::Object(map) = json_value {
        flatten_json_map(&map)
    } else {
        serde_json::Map::new()
    }
}
