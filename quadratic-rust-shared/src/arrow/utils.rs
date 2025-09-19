use arrow::array::ArrayRef;
use arrow_array::{ArrowPrimitiveType, BooleanArray, PrimitiveArray, StringArray};
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
