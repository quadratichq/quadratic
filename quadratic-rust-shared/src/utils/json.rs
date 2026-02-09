/// Flatten a JSON map, converting nested objects and arrays to JSON strings.
pub fn flatten_json_map(
    map: &serde_json::Map<String, serde_json::Value>,
) -> serde_json::Map<String, serde_json::Value> {
    use serde_json::Value;

    map.iter()
        .map(|(key, value)| {
            let flattened_value = match value {
                Value::Array(_) | Value::Object(_) => {
                    let json_str = serde_json::to_string(value).unwrap_or_else(|e| {
                        tracing::warn!("Failed to serialize JSON value for key '{}': {}", key, e);
                        String::new()
                    });
                    Value::String(json_str)
                }
                other => other.clone(),
            };
            (key.clone(), flattened_value)
        })
        .collect()
}

/// Recursively flatten a JSON map with underscore-prefixed keys for nested objects.
/// Arrays are converted to JSON strings since they can't be flattened meaningfully.
/// `max_depth` controls how many levels deep to recurse before serializing as JSON strings.
pub fn flatten_json_map_recursive(
    map: &serde_json::Map<String, serde_json::Value>,
    max_depth: usize,
) -> serde_json::Map<String, serde_json::Value> {
    flatten_json_map_with_prefix(map, "", 0, max_depth)
}

/// Recursively flatten a JSON map with a key prefix.
/// Stops recursing at `max_depth` and serializes remaining nested values as JSON strings.
fn flatten_json_map_with_prefix(
    map: &serde_json::Map<String, serde_json::Value>,
    prefix: &str,
    depth: usize,
    max_depth: usize,
) -> serde_json::Map<String, serde_json::Value> {
    use serde_json::Value;

    let mut result = serde_json::Map::new();

    for (key, value) in map.iter() {
        let full_key = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{}_{}", prefix, key)
        };

        match value {
            // Recursively flatten nested objects (up to max depth)
            Value::Object(nested_map) if depth < max_depth => {
                let flattened =
                    flatten_json_map_with_prefix(nested_map, &full_key, depth + 1, max_depth);
                result.extend(flattened);
            }
            // At max depth, serialize nested objects/arrays as JSON strings
            Value::Object(_) | Value::Array(_) => {
                let json_str = serde_json::to_string(value).unwrap_or_else(|e| {
                    tracing::warn!(
                        "Failed to serialize JSON value for key '{}': {}",
                        full_key,
                        e
                    );
                    String::new()
                });
                result.insert(full_key, Value::String(json_str));
            }
            // Primitive values are kept as-is
            other => {
                result.insert(full_key, other.clone());
            }
        }
    }

    result
}

/// Flatten any serializable object into a single-level JSON object.
/// Nested objects and arrays are converted to JSON strings.
///
/// Set `max_depth` to `Some(n)` to recursively flatten nested objects up to `n` levels deep
/// with underscore-prefixed keys (e.g., `balances.available` becomes `balances_available`).
/// Use `None` for no recursive flattening (nested objects are serialized as JSON strings).
pub fn flatten_to_json<T: serde::Serialize>(
    item: &T,
    max_depth: Option<usize>,
) -> serde_json::Map<String, serde_json::Value> {
    let json_value = serde_json::to_value(item).unwrap_or_else(|e| {
        tracing::warn!("Failed to serialize item to JSON: {}", e);
        serde_json::Value::Null
    });

    if let serde_json::Value::Object(map) = json_value {
        if let Some(max_depth) = max_depth {
            flatten_json_map_recursive(&map, max_depth)
        } else {
            flatten_json_map(&map)
        }
    } else {
        serde_json::Map::new()
    }
}
