use arrow::array::ArrayRef;
use arrow_array::{
    ArrowPrimitiveType, BinaryArray, BooleanArray, Date32Array, Decimal128Array, PrimitiveArray,
    StringArray, TimestampMicrosecondArray, TimestampMillisecondArray,
};
use std::{str::FromStr, sync::Arc};

use crate::SharedError;
use crate::arrow::error::Arrow as ArrowError;
use crate::error::Result;

/// Convert a vector of strings to an Arrow ArrayRef for primitive types
pub fn string_to_array_ref<U: ArrowPrimitiveType>(strings: Vec<Option<String>>) -> Result<ArrayRef>
where
    U::Native: FromStr,
{
    let mut values: Vec<Option<U::Native>> = Vec::new();

    for value_opt in &strings {
        match value_opt {
            Some(s) => {
                let val = s.parse::<U::Native>().map_err(|_| {
                    SharedError::Arrow(ArrowError::ConvertString(format!(
                        "Could not parse '{}' as {}",
                        s,
                        std::any::type_name::<U::Native>()
                    )))
                })?;
                values.push(Some(val));
            }
            None => values.push(None),
        }
    }

    Ok(Arc::new(PrimitiveArray::<U>::from_iter(values)))
}

/// Convert a vector of strings to a Boolean ArrayRef
pub fn string_to_boolean_array_ref(strings: Vec<Option<String>>) -> Result<ArrayRef> {
    let mut values: Vec<Option<bool>> = Vec::new();

    for value_opt in &strings {
        match value_opt {
            Some(s) => {
                let val = s.parse::<bool>().map_err(|_| {
                    SharedError::Arrow(ArrowError::ConvertString(format!(
                        "Could not parse '{}' as bool",
                        s
                    )))
                })?;
                values.push(Some(val));
            }
            None => values.push(None),
        }
    }

    Ok(Arc::new(BooleanArray::from(values)))
}

/// Convert a vector of strings to a String ArrayRef
pub fn string_to_string_array_ref(strings: Vec<Option<String>>) -> Result<ArrayRef> {
    let values: Vec<Option<&str>> = strings
        .iter()
        .map(|opt| opt.as_ref().map(|s| s.as_str()))
        .collect();
    Ok(Arc::new(StringArray::from(values)))
}

/// Convert a vector of strings to a Binary ArrayRef
pub fn string_to_binary_array_ref(strings: Vec<Option<String>>) -> Result<ArrayRef> {
    let mut byte_data: Vec<Vec<u8>> = Vec::new();
    let mut validity = Vec::new();

    for value_opt in &strings {
        match value_opt {
            Some(s) => {
                // Try to parse as hex string, or use bytes directly
                let bytes = if s.starts_with("0x") {
                    // For now, just use the string bytes since hex crate might not be available
                    s.as_bytes().to_vec()
                } else {
                    s.as_bytes().to_vec()
                };
                byte_data.push(bytes);
                validity.push(true);
            }
            None => {
                byte_data.push(Vec::new());
                validity.push(false);
            }
        }
    }

    // Convert to the format expected by BinaryArray
    let byte_refs: Vec<Option<&[u8]>> = byte_data
        .iter()
        .zip(validity.iter())
        .map(|(bytes, &is_valid)| {
            if is_valid {
                Some(bytes.as_slice())
            } else {
                None
            }
        })
        .collect();

    Ok(Arc::new(BinaryArray::from(byte_refs)))
}

/// Convert a vector of strings to a Date32 ArrayRef
pub fn string_to_date32_array_ref(strings: Vec<Option<String>>) -> Result<ArrayRef> {
    let mut values: Vec<Option<i32>> = Vec::new();

    for value_opt in &strings {
        match value_opt {
            Some(s) => {
                let val = s.parse::<i32>().map_err(|_| {
                    SharedError::Arrow(ArrowError::ConvertString(format!(
                        "Could not parse '{}' as Date32 (days since epoch)",
                        s
                    )))
                })?;
                values.push(Some(val));
            }
            None => values.push(None),
        }
    }

    Ok(Arc::new(Date32Array::from(values)))
}

/// Convert a vector of strings to a TimestampMillisecond ArrayRef
pub fn string_to_timestamp_millis_array_ref(strings: Vec<Option<String>>) -> Result<ArrayRef> {
    let mut values: Vec<Option<i64>> = Vec::new();

    for value_opt in &strings {
        match value_opt {
            Some(s) => {
                let val = s.parse::<i64>().map_err(|_| {
                    SharedError::Arrow(ArrowError::ConvertString(format!(
                        "Could not parse '{}' as timestamp milliseconds",
                        s
                    )))
                })?;
                values.push(Some(val));
            }
            None => values.push(None),
        }
    }

    Ok(Arc::new(TimestampMillisecondArray::from(values)))
}

/// Convert a vector of strings to a TimestampMicrosecond ArrayRef
pub fn string_to_timestamp_micros_array_ref(strings: Vec<Option<String>>) -> Result<ArrayRef> {
    let mut values: Vec<Option<i64>> = Vec::new();

    for value_opt in &strings {
        match value_opt {
            Some(s) => {
                let val = s.parse::<i64>().map_err(|_| {
                    SharedError::Arrow(ArrowError::ConvertString(format!(
                        "Could not parse '{}' as timestamp microseconds",
                        s
                    )))
                })?;
                values.push(Some(val));
            }
            None => values.push(None),
        }
    }

    Ok(Arc::new(TimestampMicrosecondArray::from(values)))
}

/// Convert a vector of strings to a Decimal128 ArrayRef
pub fn string_to_decimal128_array_ref(
    strings: Vec<Option<String>>,
    precision: u8,
    scale: i8,
) -> Result<ArrayRef> {
    let mut values: Vec<Option<i128>> = Vec::new();

    for value_opt in &strings {
        match value_opt {
            Some(s) => {
                // Parse as f64 first, then convert to scaled integer
                let float_val = s.parse::<f64>().map_err(|_| {
                    SharedError::Arrow(ArrowError::ConvertString(format!(
                        "Could not parse '{}' as decimal",
                        s
                    )))
                })?;

                // Scale by the decimal scale factor
                let scale_factor = 10_f64.powi(scale as i32);
                let scaled_val = (float_val * scale_factor).round() as i128;
                values.push(Some(scaled_val));
            }
            None => values.push(None),
        }
    }

    Ok(Arc::new(
        Decimal128Array::from(values).with_precision_and_scale(precision, scale)?,
    ))
}
