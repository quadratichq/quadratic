//! Utility functions for Arrow.
//!
//! Functions to convert between different types of Arrow arrays.

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

#[cfg(test)]
mod tests {
    use super::*;
    use arrow::array::Array;
    use arrow::datatypes::{Float32Type, Float64Type, Int32Type, Int64Type};
    use arrow_array::{Float32Array, Float64Array, Int32Array, Int64Array};

    #[test]
    fn test_string_to_array_ref_i32() {
        let strings = vec![
            Some("42".to_string()),
            Some("-123".to_string()),
            None,
            Some("0".to_string()),
        ];
        let result = string_to_array_ref::<Int32Type>(strings).unwrap();
        let array = result.as_any().downcast_ref::<Int32Array>().unwrap();

        assert_eq!(array.len(), 4);
        assert_eq!(array.value(0), 42);
        assert_eq!(array.value(1), -123);
        assert!(array.is_null(2));
        assert_eq!(array.value(3), 0);
    }

    #[test]
    fn test_string_to_array_ref_i64() {
        let strings = vec![
            Some("9223372036854775807".to_string()),  // i64::MAX
            Some("-9223372036854775808".to_string()), // i64::MIN
            None,
        ];
        let result = string_to_array_ref::<Int64Type>(strings).unwrap();
        let array = result.as_any().downcast_ref::<Int64Array>().unwrap();

        assert_eq!(array.len(), 3);
        assert_eq!(array.value(0), i64::MAX);
        assert_eq!(array.value(1), i64::MIN);
        assert!(array.is_null(2));
    }

    #[test]
    fn test_string_to_array_ref_f32() {
        let strings = vec![
            Some("3.12".to_string()),
            Some("-2.5".to_string()),
            None,
            Some("0.0".to_string()),
        ];
        let result = string_to_array_ref::<Float32Type>(strings).unwrap();
        let array = result.as_any().downcast_ref::<Float32Array>().unwrap();

        assert_eq!(array.len(), 4);
        assert!((array.value(0) - 3.12).abs() < f32::EPSILON);
        assert!((array.value(1) - (-2.5)).abs() < f32::EPSILON);
        assert!(array.is_null(2));
        assert!((array.value(3) - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_string_to_array_ref_f64() {
        let strings = vec![
            Some("3.12345678".to_string()),
            Some("-123.456789".to_string()),
            None,
        ];
        let result = string_to_array_ref::<Float64Type>(strings).unwrap();
        let array = result.as_any().downcast_ref::<Float64Array>().unwrap();

        assert_eq!(array.len(), 3);
        assert!((array.value(0) - 3.12345678).abs() < f64::EPSILON);
        assert!((array.value(1) - (-123.456789)).abs() < f64::EPSILON);
        assert!(array.is_null(2));
    }

    #[test]
    fn test_string_to_array_ref_invalid_parse() {
        let strings = vec![Some("not_a_number".to_string())];
        let result = string_to_array_ref::<Int32Type>(strings);

        assert!(result.is_err());
    }

    #[test]
    fn test_string_to_boolean_array_ref() {
        let strings = vec![Some("true".to_string()), Some("false".to_string()), None];
        let result = string_to_boolean_array_ref(strings).unwrap();
        let array = result.as_any().downcast_ref::<BooleanArray>().unwrap();

        assert_eq!(array.len(), 3);
        assert!(array.value(0));
        assert!(!array.value(1));
        assert!(array.is_null(2));
    }

    #[test]
    fn test_string_to_boolean_array_ref_case_sensitive() {
        let uppercase_strings = vec![Some("TRUE".to_string())];
        let result = string_to_boolean_array_ref(uppercase_strings);
        assert!(result.is_err());

        let mixed_case_strings = vec![Some("False".to_string())];
        let result = string_to_boolean_array_ref(mixed_case_strings);
        assert!(result.is_err());
    }

    #[test]
    fn test_string_to_boolean_array_ref_invalid() {
        let strings = vec![Some("not_a_bool".to_string())];
        let result = string_to_boolean_array_ref(strings);
        assert!(result.is_err());
    }

    #[test]
    fn test_string_to_string_array_ref() {
        let strings = vec![
            Some("hello".to_string()),
            Some("world".to_string()),
            None,
            Some("".to_string()),
            Some("unicode: 🦀".to_string()),
        ];
        let result = string_to_string_array_ref(strings).unwrap();
        let array = result.as_any().downcast_ref::<StringArray>().unwrap();

        assert_eq!(array.len(), 5);
        assert_eq!(array.value(0), "hello");
        assert_eq!(array.value(1), "world");
        assert!(array.is_null(2));
        assert_eq!(array.value(3), "");
        assert_eq!(array.value(4), "unicode: 🦀");
    }

    #[test]
    fn test_string_to_binary_array_ref() {
        let strings = vec![
            Some("hello".to_string()),
            Some("0xdeadbeef".to_string()),
            None,
            Some("".to_string()),
        ];
        let result = string_to_binary_array_ref(strings).unwrap();
        let array = result.as_any().downcast_ref::<BinaryArray>().unwrap();

        assert_eq!(array.len(), 4);
        assert_eq!(array.value(0), b"hello");
        assert_eq!(array.value(1), b"0xdeadbeef"); // Note: currently treats as string bytes
        assert!(array.is_null(2));
        assert_eq!(array.value(3), b"");
    }

    #[test]
    fn test_string_to_date32_array_ref() {
        let strings = vec![
            Some("0".to_string()),     // Epoch
            Some("18628".to_string()), // 2021-01-01
            Some("-1".to_string()),    // Day before epoch
            None,
        ];
        let result = string_to_date32_array_ref(strings).unwrap();
        let array = result.as_any().downcast_ref::<Date32Array>().unwrap();

        assert_eq!(array.len(), 4);
        assert_eq!(array.value(0), 0);
        assert_eq!(array.value(1), 18628);
        assert_eq!(array.value(2), -1);
        assert!(array.is_null(3));
    }

    #[test]
    fn test_string_to_date32_array_ref_invalid() {
        let strings = vec![Some("not_a_date".to_string())];
        let result = string_to_date32_array_ref(strings);
        assert!(result.is_err());
    }

    #[test]
    fn test_string_to_timestamp_millis_array_ref() {
        let strings = vec![
            Some("0".to_string()),             // Epoch
            Some("1609459200000".to_string()), // 2021-01-01 00:00:00 UTC
            Some("-1000".to_string()),         // Before epoch
            None,
        ];
        let result = string_to_timestamp_millis_array_ref(strings).unwrap();
        let array = result
            .as_any()
            .downcast_ref::<TimestampMillisecondArray>()
            .unwrap();

        assert_eq!(array.len(), 4);
        assert_eq!(array.value(0), 0);
        assert_eq!(array.value(1), 1609459200000);
        assert_eq!(array.value(2), -1000);
        assert!(array.is_null(3));
    }

    #[test]
    fn test_string_to_timestamp_millis_array_ref_invalid() {
        let strings = vec![Some("not_a_timestamp".to_string())];
        let result = string_to_timestamp_millis_array_ref(strings);
        assert!(result.is_err());
    }

    #[test]
    fn test_string_to_timestamp_micros_array_ref() {
        let strings = vec![
            Some("0".to_string()),                // Epoch
            Some("1609459200000000".to_string()), // 2021-01-01 00:00:00 UTC
            Some("-1000000".to_string()),         // Before epoch
            None,
        ];
        let result = string_to_timestamp_micros_array_ref(strings).unwrap();
        let array = result
            .as_any()
            .downcast_ref::<TimestampMicrosecondArray>()
            .unwrap();

        assert_eq!(array.len(), 4);
        assert_eq!(array.value(0), 0);
        assert_eq!(array.value(1), 1609459200000000);
        assert_eq!(array.value(2), -1000000);
        assert!(array.is_null(3));
    }

    #[test]
    fn test_string_to_timestamp_micros_array_ref_invalid() {
        let strings = vec![Some("not_a_timestamp".to_string())];
        let result = string_to_timestamp_micros_array_ref(strings);
        assert!(result.is_err());
    }

    #[test]
    fn test_string_to_decimal128_array_ref() {
        let strings = vec![
            Some("123.45".to_string()),
            Some("-67.89".to_string()),
            Some("0.00".to_string()),
            None,
        ];
        let precision = 10;
        let scale = 2;
        let result = string_to_decimal128_array_ref(strings, precision, scale).unwrap();
        let array = result.as_any().downcast_ref::<Decimal128Array>().unwrap();

        assert_eq!(array.len(), 4);
        assert_eq!(array.precision(), precision);
        assert_eq!(array.scale(), scale);

        // 123.45 * 100 = 12345
        assert_eq!(array.value(0), 12345);
        // -67.89 * 100 = -6789
        assert_eq!(array.value(1), -6789);
        // 0.00 * 100 = 0
        assert_eq!(array.value(2), 0);
        assert!(array.is_null(3));
    }

    #[test]
    fn test_string_to_decimal128_array_ref_different_scales() {
        let strings = vec![Some("123.456789".to_string())];
        let result = string_to_decimal128_array_ref(strings.clone(), 10, 3).unwrap();
        let array = result.as_any().downcast_ref::<Decimal128Array>().unwrap();
        assert_eq!(array.value(0), 123457); // Rounded to 123.457 * 1000

        let result = string_to_decimal128_array_ref(strings, 10, 0).unwrap();
        let array = result.as_any().downcast_ref::<Decimal128Array>().unwrap();
        assert_eq!(array.value(0), 123); // Rounded to 123 * 1
    }

    #[test]
    fn test_string_to_decimal128_array_ref_invalid() {
        let strings = vec![Some("not_a_decimal".to_string())];
        let result = string_to_decimal128_array_ref(strings, 10, 2);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_vectors() {
        let empty_strings: Vec<Option<String>> = vec![];

        assert!(string_to_array_ref::<Int32Type>(empty_strings.clone()).is_ok());
        assert!(string_to_boolean_array_ref(empty_strings.clone()).is_ok());
        assert!(string_to_string_array_ref(empty_strings.clone()).is_ok());
        assert!(string_to_binary_array_ref(empty_strings.clone()).is_ok());
        assert!(string_to_date32_array_ref(empty_strings.clone()).is_ok());
        assert!(string_to_timestamp_millis_array_ref(empty_strings.clone()).is_ok());
        assert!(string_to_timestamp_micros_array_ref(empty_strings.clone()).is_ok());
        assert!(string_to_decimal128_array_ref(empty_strings, 10, 2).is_ok());
    }

    #[test]
    fn test_all_none_vectors() {
        let none_strings = vec![None, None, None];
        let result = string_to_array_ref::<Int32Type>(none_strings.clone()).unwrap();
        let array = result.as_any().downcast_ref::<Int32Array>().unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));

        let result = string_to_boolean_array_ref(none_strings.clone()).unwrap();
        let array = result.as_any().downcast_ref::<BooleanArray>().unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));

        let result = string_to_string_array_ref(none_strings.clone()).unwrap();
        let array = result.as_any().downcast_ref::<StringArray>().unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));

        let result = string_to_binary_array_ref(none_strings.clone()).unwrap();
        let array = result.as_any().downcast_ref::<BinaryArray>().unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));

        let result = string_to_date32_array_ref(none_strings.clone()).unwrap();
        let array = result.as_any().downcast_ref::<Date32Array>().unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));

        let result = string_to_timestamp_millis_array_ref(none_strings.clone()).unwrap();
        let array = result
            .as_any()
            .downcast_ref::<TimestampMillisecondArray>()
            .unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));

        let result = string_to_timestamp_micros_array_ref(none_strings.clone()).unwrap();
        let array = result
            .as_any()
            .downcast_ref::<TimestampMicrosecondArray>()
            .unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));

        let result = string_to_decimal128_array_ref(none_strings, 10, 2).unwrap();
        let array = result.as_any().downcast_ref::<Decimal128Array>().unwrap();
        assert_eq!(array.len(), 3);
        assert!(array.is_null(0) && array.is_null(1) && array.is_null(2));
    }

    #[test]
    fn test_large_vectors() {
        let large_strings: Vec<Option<String>> = (0..1000).map(|i| Some(i.to_string())).collect();
        let result = string_to_array_ref::<Int32Type>(large_strings).unwrap();
        let array = result.as_any().downcast_ref::<Int32Array>().unwrap();

        assert_eq!(array.len(), 1000);
        assert_eq!(array.value(0), 0);
        assert_eq!(array.value(500), 500);
        assert_eq!(array.value(999), 999);
    }

    #[test]
    fn test_edge_case_numeric_strings() {
        let strings = [
            Some("0".to_string()),
            Some("+42".to_string()),
            Some("-0".to_string()),
            Some("  123  ".to_string()), // This might fail due to whitespace
        ];
        let result = string_to_array_ref::<Int32Type>(strings[0..3].to_vec());
        assert!(result.is_ok());

        let whitespace_result = string_to_array_ref::<Int32Type>(vec![Some("  123  ".to_string())]);
        assert!(whitespace_result.is_err());
    }
}
