use std::fmt;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

mod array;
mod array_size;
pub mod arrow;
pub mod cell_values;
pub mod cellvalue;
mod convert;
mod isblank;
pub mod parquet;
mod time;

pub use array::Array;
pub use array_size::{ArraySize, Axis};
pub use cellvalue::CellValue;
pub use cellvalue::CodeCellValue;
pub use convert::CoerceInto;
pub use isblank::IsBlank;
pub use time::{Duration, Instant};

use crate::{CodeResult, CodeResultExt, RunErrorMsg, SpannableIterExt, Spanned};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum Value {
    Single(CellValue),
    Array(Array),
    Tuple(Vec<Array>),
}
impl Default for Value {
    fn default() -> Self {
        Value::Single(CellValue::default())
    }
}
impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::Single(v) => write!(f, "{v}"),
            Value::Array(a) => write!(f, "{a}"),
            Value::Tuple(t) => write!(f, "({})", t.iter().join(", ")),
        }
    }
}

impl<T: Into<CellValue>> From<T> for Value {
    fn from(value: T) -> Self {
        Value::Single(value.into())
    }
}
impl From<Array> for Value {
    fn from(array: Array) -> Self {
        Value::Array(array)
    }
}

impl Value {
    /// Returns the cell value for a single value or an array. Returns an error
    /// for an array with more than a single value, or for a tuple.
    pub fn as_cell_value(&self) -> Result<&CellValue, RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(value),
            Value::Array(a) => a.cell_value().ok_or_else(|| RunErrorMsg::Expected {
                expected: "single value".into(),
                got: Some(a.type_name().into()),
            }),
            Value::Tuple(_) => Err(RunErrorMsg::Expected {
                expected: "single value".into(),
                got: Some("tuple".into()),
            }),
        }
    }
    /// Returns the cell value for a single value or an array. Returns an error
    /// for an array with more than a single value, or for a tuple.
    pub fn into_cell_value(self) -> Result<CellValue, RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(value),
            Value::Array(a) => a.into_cell_value().map_err(|a| RunErrorMsg::Expected {
                expected: "single value".into(),
                got: Some(a.type_name().into()),
            }),
            Value::Tuple(_) => Err(RunErrorMsg::Expected {
                expected: "single value".into(),
                got: Some("tuple".into()),
            }),
        }
    }
    /// Returns an array for a single value or array, or an error for a tuple.
    pub fn into_array(self) -> Result<Array, RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(Array::from(value)),
            Value::Array(array) => Ok(array),
            Value::Tuple(_) => Err(RunErrorMsg::Expected {
                expected: "array".into(),
                got: Some("tuple".into()),
            }),
        }
    }
    /// Converts the value into one or more arrays.
    pub fn into_arrays(self) -> Vec<Array> {
        match self {
            Value::Single(value) => vec![Array::from(value)],
            Value::Array(array) => vec![array],
            Value::Tuple(tuple) => tuple,
        }
    }
    /// Returns a slice of values for a single value or an array. Returns an
    /// error for a tuple.
    pub fn cell_values_slice(&self) -> Result<&[CellValue], RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(std::slice::from_ref(value)),
            Value::Array(array) => Ok(array.cell_values_slice()),
            Value::Tuple(_) => Err(RunErrorMsg::Expected {
                expected: "single value or array".into(),
                got: Some("tuple".into()),
            }),
        }
    }

    /// Returns the value from an array if this is an array value, or the single
    /// value itself otherwise. If the array index is out of bounds, returns an
    /// internal error. Also returns an error for a tuple.
    pub fn get(&self, x: u32, y: u32) -> Result<&CellValue, RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(value),
            Value::Array(a) => a.get(x, y),
            Value::Tuple(arrays) => match arrays.first() {
                Some(a) => a.get(x, y),
                None => Err(RunErrorMsg::Expected {
                    expected: "value or array".into(),
                    got: Some("empty tuple".into()),
                }),
            },
        }
    }

    /// Returns a formula-source-code representation of the value.
    pub fn repr(&self) -> String {
        match self {
            Value::Single(value) => value.repr(),
            Value::Array(array) => array.repr(),
            Value::Tuple(tuple) => format!("({})", tuple.iter().map(|a| a.repr()).join(", ")),
        }
    }

    /// Returns the unique width and height that fits all of `values`.
    ///
    /// - If `values` does not contain any arrays, returns `(1, 1)`.
    /// - Sizes of `1` are ignored.
    /// - If there are multiple unequal sizes greater than one, returns an
    ///   error.
    /// - Both numbers returned are always nonzero.
    pub fn common_array_size<'a>(
        values: impl Copy + IntoIterator<Item = &'a Spanned<Value>>,
    ) -> CodeResult<ArraySize> {
        Ok(ArraySize {
            w: Array::common_len(Axis::X, values.into_iter().filter_map(|v| v.as_array()))?,
            h: Array::common_len(Axis::Y, values.into_iter().filter_map(|v| v.as_array()))?,
        })
    }
}
impl Spanned<Value> {
    pub fn cell_value(&self) -> CodeResult<Spanned<&CellValue>> {
        self.inner.as_cell_value().with_span(self.span)
    }
    pub fn into_cell_value(self) -> CodeResult<Spanned<CellValue>> {
        self.inner.into_cell_value().with_span(self.span)
    }
    /// Returns an array, or an error if the value is only a single cell or a
    /// tuple.
    pub fn as_array(&self) -> Option<Spanned<&Array>> {
        match &self.inner {
            Value::Single(_) => None,
            Value::Array(array) => Some(Spanned {
                span: self.span,
                inner: array,
            }),
            Value::Tuple(arrays) => Some(Spanned {
                span: self.span,
                inner: arrays.first()?,
            }),
        }
    }

    /// Returns the value from an array if this is an array value, or the single
    /// value itself otherwise. If the array index is out of bounds, returns an
    /// internal error. Also returns an error for a tuple.
    pub fn get(&self, x: u32, y: u32) -> CodeResult<Spanned<&CellValue>> {
        self.inner.get(x, y).with_span(self.span)
    }

    /// Iterates over an array, converting values to a particular type. If a
    /// value cannot be converted, it is ignored.
    #[allow(clippy::should_implement_trait)]
    pub fn into_iter<T>(self) -> impl Iterator<Item = CodeResult<Spanned<T>>>
    where
        CellValue: TryInto<T, Error = RunErrorMsg>,
    {
        // Ignore array values that fail to coerce, but return an error for a
        // single value that fails to coerce. This is consistent with Excel
        // semantics.

        let mut single_value: Option<CodeResult<Spanned<T>>> = None;
        let mut array: SmallVec<[CellValue; 1]> = smallvec![];
        match self.inner {
            Value::Single(v) => {
                let v = Spanned {
                    inner: v,
                    span: self.span,
                };
                single_value = Some(v.try_coerce::<T>());
            }
            Value::Array(a) => array = a.into_cell_values_vec(),
            Value::Tuple(t) => {
                array = t
                    .into_iter()
                    .flat_map(|a| a.into_cell_values_vec())
                    .collect();
            }
        };

        itertools::chain!(
            single_value,
            array
                .into_iter()
                .with_all_same_span(self.span)
                .flat_map(|v| v.coerce_or_none::<T>())
        )
    }
    /// Returns an iterator over cell values.
    pub fn iter_cell_values(&self) -> CodeResult<impl Iterator<Item = Spanned<&CellValue>>> {
        Ok(self
            .inner
            .cell_values_slice()?
            .iter()
            .map(move |v| Spanned {
                span: self.span,
                inner: v,
            }))
    }
    /// Returns an iterator over cell values.
    pub fn into_iter_cell_values(self) -> impl Iterator<Item = CodeResult<Spanned<CellValue>>> {
        let span = self.span;

        match self.inner {
            Value::Single(value) => smallvec![value],
            Value::Array(array) => array.into_cell_values_vec(),
            Value::Tuple(t) => t
                .into_iter()
                .flat_map(|a| a.into_cell_values_vec())
                .collect(),
        }
        .into_iter()
        .with_all_same_span(self.span)
        .map(move |v| {
            v.into_non_error_value()
                .map(|inner| Spanned { span, inner })
        })
    }
}
