use itertools::Itertools;
use smallvec::{smallvec, SmallVec};
use std::fmt;

use super::{FormulaErrorMsg, FormulaResult, Spanned};

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    String(String),
    Number(f64),
    Bool(bool),
    Array(Vec<SmallVec<[Value; 1]>>),
    // TODO: remove this or replace it with a more generic error type
    MissingErr,
}

impl Default for Value {
    fn default() -> Self {
        Value::String(String::new())
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::String(s) => write!(f, "{s}"),
            Value::Number(n) => write!(f, "{n}"),
            Value::Bool(true) => write!(f, "TRUE"),
            Value::Bool(false) => write!(f, "FALSE"),
            Value::Array(rows) => {
                write!(
                    f,
                    "{{{}}}",
                    rows.iter().map(|row| row.iter().join(", ")).join("; "),
                )
            }
            Value::MissingErr => write!(f, "[missing]"),
        }
    }
}

impl Value {
    pub fn type_name(&self) -> &'static str {
        match self {
            Value::String(_) => "string",
            Value::Number(_) => "number",
            Value::Bool(_) => "boolean",
            Value::Array(_) => "array",
            Value::MissingErr => "missing value",
        }
    }

    /// Returns the number of values.
    ///
    /// Empty strings count as zero. Each value in an array counts separately.
    /// Other values count as 1.
    pub fn count(&self) -> usize {
        match self {
            Value::Array(a) => a.iter().flat_map(|row| row.iter().map(|v| v.count())).sum(),
            Value::String(n) if n.is_empty() => 0,
            Value::MissingErr => 0,

            Value::String(_) | Value::Number(_) | Value::Bool(_) => 1,
        }
    }

    /// Returns the size `(rows, columns)` of the array if this is an array
    /// value, or `None` otherwsie.
    pub fn array_size(&self) -> Option<(usize, usize)> {
        match self {
            Value::Array(a) => Some((a.len(), a.get(0).unwrap_or(&smallvec![]).len())),
            _ => None,
        }
    }
}

impl Spanned<Value> {
    pub fn to_number(&self) -> FormulaResult<f64> {
        match &self.inner {
            Value::String(s) => {
                if s.trim().is_empty() {
                    return Ok(0.0);
                }
                s.trim().parse().map_err(|_| {
                    FormulaErrorMsg::Expected {
                        expected: "number".into(),
                        got: Some(format!("{s:?}").into()),
                    }
                    .with_span(self)
                })
            }
            Value::Number(n) => Ok(*n),
            Value::Bool(true) => Ok(1.0),
            Value::Bool(false) => Ok(0.0),
            _ => Err(FormulaErrorMsg::Expected {
                expected: "number".into(),
                got: Some(self.inner.type_name().into()),
            }
            .with_span(self.span)),
        }
    }
    pub fn to_integer(&self) -> FormulaResult<i64> {
        Ok(self.to_number()?.round() as i64)
    }
    pub fn to_bool(&self) -> FormulaResult<bool> {
        match &self.inner {
            Value::Bool(b) => Ok(*b),
            Value::String(s) if s.eq_ignore_ascii_case("TRUE") => Ok(true),
            Value::String(s) if s.eq_ignore_ascii_case("FALSE") => Ok(false),
            _ => Err(FormulaErrorMsg::Expected {
                expected: "boolean".into(),
                got: Some(self.inner.type_name().into()),
            }
            .with_span(self.span)),
        }
    }

    pub fn to_numbers(&self) -> FormulaResult<SmallVec<[f64; 1]>> {
        self.to_flat_array_of(Self::to_number)
    }
    pub fn to_bools(&self) -> FormulaResult<SmallVec<[bool; 1]>> {
        self.to_flat_array_of(Self::to_bool)
    }
    pub fn to_strings(&self) -> FormulaResult<SmallVec<[String; 1]>> {
        self.to_flat_array_of(|x| Ok(x.to_string()))
    }
    fn to_flat_array_of<T>(
        &self,
        conv: fn(&Self) -> FormulaResult<T>,
    ) -> FormulaResult<SmallVec<[T; 1]>> {
        match &self.inner {
            Value::String(s) if s.is_empty() => Ok(smallvec![]),

            Value::Array(a) => a
                .iter()
                .flatten()
                .map(|v| {
                    conv(&Spanned {
                        inner: v.clone(),
                        span: self.span,
                    })
                })
                .collect(),

            Value::String(_) | Value::Number(_) | Value::Bool(_) => {
                conv(self).map(|x| smallvec![x])
            }

            Value::MissingErr => Ok(smallvec![]),
        }
    }

    /// Returns the value from an array if this is an array value, or the single
    /// value itself otherwise. If the array index is out of bounds, returns an
    /// internal error.
    pub fn get_array_value(&self, row: usize, col: usize) -> FormulaResult<Spanned<Value>> {
        match &self.inner {
            Value::Array(a) => Ok(Spanned {
                span: self.span,
                inner: a
                    .get(row)
                    .and_then(|row| row.get(col))
                    .ok_or_else(|| internal_error_value!("array value index out of bounds"))?
                    .clone(),
            }),

            _ => Ok(self.clone()),
        }
    }
}
