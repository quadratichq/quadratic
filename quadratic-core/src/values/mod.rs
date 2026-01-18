use std::fmt;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{SmallVec, smallvec};

mod array;
mod array_size;
pub mod arrow;
pub mod cell_values;
pub mod cellvalue;
mod code_cell;
mod convert;
mod currency;
pub mod date_time;
pub mod empty_values_cache;
mod from_js;
mod isblank;
pub mod number;
pub mod parquet;
mod time;

pub use array::Array;
pub use array_size::{ArraySize, Axis};
pub use cellvalue::{CellValue, CellValueHash};
pub use code_cell::CodeCell;
pub use convert::{CoerceInto, parse_value_text};
pub use isblank::IsBlank;
pub use time::{Duration, Instant};

use crate::formulas::LambdaValue;
use crate::{CodeResult, CodeResultExt, RunError, RunErrorMsg, SpannableIterExt, Spanned};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum Value {
    Single(CellValue),
    Array(Array),
    Tuple(Vec<Array>),
    /// A lambda function that can be called with arguments.
    Lambda(LambdaValue),
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
            Value::Lambda(l) => write!(f, "LAMBDA({})", l.params.join(", ")),
        }
    }
}

impl<T: Into<CellValue>> From<T> for Value {
    fn from(value: T) -> Self {
        Value::Single(value.into())
    }
}
impl From<Array> for Value {
    fn from(mut array: Array) -> Self {
        array.update_empty_values_cache();
        Value::Array(array)
    }
}
impl From<RunError> for Value {
    fn from(value: RunError) -> Self {
        Value::Single(CellValue::Error(Box::new(value)))
    }
}

impl Value {
    /// Returns the cell value for a single value or an array. Returns an error
    /// for an array with more than a single value, or for a tuple or lambda.
    #[inline]
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
            Value::Lambda(_) => Err(RunErrorMsg::Expected {
                expected: "single value".into(),
                got: Some("lambda".into()),
            }),
        }
    }
    /// Returns the cell value for a single value or an array. Returns an error
    /// for an array with more than a single value, or for a tuple or lambda.
    #[inline]
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
            Value::Lambda(_) => Err(RunErrorMsg::Expected {
                expected: "single value".into(),
                got: Some("lambda".into()),
            }),
        }
    }
    /// Returns an array for a single value or array, or an error for a tuple or lambda.
    #[inline]
    pub fn into_array(self) -> Result<Array, RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(Array::from(value)),
            Value::Array(array) => Ok(array),
            Value::Tuple(_) => Err(RunErrorMsg::Expected {
                expected: "array".into(),
                got: Some("tuple".into()),
            }),
            Value::Lambda(_) => Err(RunErrorMsg::Expected {
                expected: "array".into(),
                got: Some("lambda".into()),
            }),
        }
    }
    /// Converts the value into one or more arrays. Lambdas become empty vectors.
    #[inline]
    pub fn into_arrays(self) -> Vec<Array> {
        match self {
            Value::Single(value) => vec![Array::from(value)],
            Value::Array(array) => vec![array],
            Value::Tuple(tuple) => tuple,
            Value::Lambda(_) => vec![],
        }
    }
    /// Returns a slice of values for a single value or an array. Returns an
    /// error for a tuple or lambda.
    #[inline]
    pub fn cell_values_slice(&self) -> Result<&[CellValue], RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(std::slice::from_ref(value)),
            Value::Array(array) => Ok(array.cell_values_slice()),
            Value::Tuple(_) => Err(RunErrorMsg::Expected {
                expected: "single value or array".into(),
                got: Some("tuple".into()),
            }),
            Value::Lambda(_) => Err(RunErrorMsg::Expected {
                expected: "single value or array".into(),
                got: Some("lambda".into()),
            }),
        }
    }

    /// Returns the value from an array if this is an array value, or the single
    /// value itself otherwise. If the array index is out of bounds, returns an
    /// internal error. Also returns an error for a tuple or lambda.
    #[inline]
    pub fn get(&self, x: u32, y: u32) -> Result<&CellValue, RunErrorMsg> {
        match self {
            Value::Single(value) => Ok(value),
            Value::Array(a) => a.get(x, y),
            Value::Tuple(arrays) => match arrays.first() {
                Some(a) => a.get(x, y),
                None => Err(RunErrorMsg::Expected {
                    expected: "single value or array".into(),
                    got: Some("empty tuple".into()),
                }),
            },
            Value::Lambda(_) => Err(RunErrorMsg::Expected {
                expected: "single value or array".into(),
                got: Some("lambda".into()),
            }),
        }
    }

    /// Returns a formula-source-code representation of the value.
    pub fn repr(&self) -> String {
        match self {
            Value::Single(value) => value.repr(),
            Value::Array(array) => array.repr(),
            Value::Tuple(tuple) => format!("({})", tuple.iter().map(|a| a.repr()).join(", ")),
            Value::Lambda(lambda) => {
                format!("LAMBDA({})", lambda.params.join(", "))
            }
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

    /// Returns the size of the value. Lambdas have size 1x1.
    #[inline]
    pub fn size(&self) -> ArraySize {
        match self {
            Value::Single(_) => ArraySize::_1X1,
            Value::Array(array) => array.size(),
            Value::Tuple(t) => t
                .first()
                .unwrap_or(&Array::new_empty(ArraySize::_1X1))
                .size(),
            Value::Lambda(_) => ArraySize::_1X1,
        }
    }

    /// Returns the contained error, or panics the value is not just a single
    /// error.
    #[cfg(test)]
    #[track_caller]
    pub fn unwrap_err(self) -> crate::RunError {
        match self.into_cell_value() {
            Ok(v) => v.unwrap_err(),
            other => panic!("expected error value; got {other:?}"),
        }
    }
    /// Returns a list of all errors in the value.
    pub fn errors(&self) -> Vec<&crate::RunError> {
        match self {
            Value::Single(v) => v.error().into_iter().collect(),
            Value::Array(a) => a.errors().collect(),
            Value::Tuple(t) => t.iter().flat_map(|a| a.errors()).collect(),
            Value::Lambda(_) => vec![],
        }
    }
}
impl Spanned<Value> {
    #[inline]
    pub fn cell_value(&self) -> CodeResult<Spanned<&CellValue>> {
        self.inner.as_cell_value().with_span(self.span)
    }
    #[inline]
    pub fn into_cell_value(self) -> CodeResult<Spanned<CellValue>> {
        self.inner.into_cell_value().with_span(self.span)
    }
    /// Returns an array, or `None` if the value is only a single cell,
    /// tuple, or lambda.
    #[inline]
    fn as_array(&self) -> Option<Spanned<&Array>> {
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
            Value::Lambda(_) => None,
        }
    }
    /// Returns an array for a single value or array, or an error for a tuple.
    #[inline]
    pub fn into_array(self) -> CodeResult<Spanned<Array>> {
        self.inner.into_array().with_span(self.span)
    }

    /// Returns the value from an array if this is an array value, or the single
    /// value itself otherwise. If the array index is out of bounds, returns an
    /// internal error. Also returns an error for a tuple.
    #[inline]
    pub fn get(&self, x: u32, y: u32) -> CodeResult<Spanned<&CellValue>> {
        self.inner.get(x, y).with_span(self.span)
    }

    /// Iterates over an array, converting values to a particular type. If a
    /// value cannot be converted, it is ignored. Lambdas are skipped.
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
            Value::Lambda(_) => {
                // Lambdas cannot be iterated over as cell values
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
    /// Returns an iterator over cell values. Lambdas produce empty iterators.
    pub fn into_iter_cell_values(self) -> impl Iterator<Item = CodeResult<Spanned<CellValue>>> {
        let span = self.span;

        match self.inner {
            Value::Single(value) => smallvec![value],
            Value::Array(array) => array.into_cell_values_vec(),
            Value::Tuple(t) => t
                .into_iter()
                .flat_map(|a| a.into_cell_values_vec())
                .collect(),
            Value::Lambda(_) => smallvec![],
        }
        .into_iter()
        .with_all_same_span(self.span)
        .map(move |v| {
            v.into_non_error_value()
                .map(|inner| Spanned { span, inner })
        })
    }

    /// Returns the value if is an array or single value, or an error value if
    /// it is a tuple.
    pub fn into_non_tuple(self) -> Self {
        let span = self.span;
        self.map(|v| {
            if matches!(v, Value::Tuple(_)) {
                RunErrorMsg::Expected {
                    expected: "single value or array".into(),
                    got: Some("tuple".into()),
                }
                .with_span(span)
                .into()
            } else {
                v
            }
        })
    }

    /// Returns the contained error, or panics the value is not just a single
    /// error.
    #[cfg(test)]
    #[track_caller]
    pub fn unwrap_err(self) -> crate::RunError {
        self.inner.unwrap_err()
    }
}

#[cfg(test)]
mod tests {
    use crate::Span;
    use crate::controller::GridController;
    use crate::formulas::tests::*;

    #[test]
    fn test_value_repr() {
        let g = GridController::new();
        for s in ["1", "3.25", "\"hello\"", "\"hello \\\"world\\\"!\""] {
            assert_eq!(s, eval(&g, s).repr());
        }
    }

    #[test]
    fn test_value_into_non_tuple() {
        let span = Span { start: 10, end: 20 };

        // Test a bunch of things that shouldn't error.
        for v in [
            Value::Single("a".into()),
            Value::Single(1.into()),
            Value::Single(CellValue::Blank),
            Value::Array(Array::new_empty(ArraySize::_1X1)),
            Value::Array(Array::new_empty(ArraySize::new(5, 4).unwrap())),
        ] {
            let v = Spanned { span, inner: v };
            assert_eq!(v.clone(), v.into_non_tuple());
        }

        // Test with tuples that should error.
        for v in [
            Value::Tuple(vec![
                Array::new_empty(ArraySize::new(5, 4).unwrap()),
                Array::new_empty(ArraySize::_1X1),
            ]),
            Value::Tuple(vec![Array::new_empty(ArraySize::_1X1)]),
            Value::Tuple(vec![Array::new_empty(ArraySize::new(5, 4).unwrap())]),
        ] {
            let v = Spanned { span, inner: v };
            assert_eq!(
                Value::Single(CellValue::Error(Box::new(
                    RunErrorMsg::Expected {
                        expected: "single value or array".into(),
                        got: Some("tuple".into()),
                    }
                    .with_span(span)
                ))),
                v.into_non_tuple().inner,
            );
        }
    }
}
