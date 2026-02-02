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

/// Recursively flatten a JSON map with underscore-prefixed keys for nested objects.
/// Arrays are converted to JSON strings since they can't be flattened meaningfully.
pub fn flatten_json_map_recursive(
    map: &serde_json::Map<String, serde_json::Value>,
) -> serde_json::Map<String, serde_json::Value> {
    flatten_json_map_with_prefix(map, "")
}

/// Recursively flatten a JSON map with a key prefix.
fn flatten_json_map_with_prefix(
    map: &serde_json::Map<String, serde_json::Value>,
    prefix: &str,
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
            // Recursively flatten nested objects
            Value::Object(nested_map) => {
                let flattened = flatten_json_map_with_prefix(nested_map, &full_key);
                result.extend(flattened);
            }
            // Arrays can't be meaningfully flattened, convert to JSON string
            Value::Array(_) => {
                result.insert(
                    full_key,
                    Value::String(serde_json::to_string(value).unwrap_or_default()),
                );
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
/// Set `recursive` to true to recursively flatten nested objects with
/// underscore-prefixed keys (e.g., `balances.available` becomes `balances_available`).
pub fn flatten_to_json<T: serde::Serialize>(
    item: &T,
    recursive: bool,
) -> serde_json::Map<String, serde_json::Value> {
    let json_value = serde_json::to_value(item).unwrap_or(serde_json::Value::Null);

    if let serde_json::Value::Object(map) = json_value {
        if recursive {
            flatten_json_map_recursive(&map)
        } else {
            flatten_json_map(&map)
        }
    } else {
        serde_json::Map::new()
    }
}
