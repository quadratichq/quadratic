use smallvec::{smallvec, SmallVec};
use std::fmt;

use super::{FormulaErrorMsg, FormulaResult, Spanned};

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    String(String),
    Number(f64),
    Bool(bool),
    Array(Vec<SmallVec<[Value; 1]>>),
    MissingErr,
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::String(s) => write!(f, "{s}"),
            Value::Number(n) => write!(f, "{n}"),
            Value::Bool(true) => write!(f, "TRUE"),
            Value::Bool(false) => write!(f, "FALSE"),
            Value::Array(_) => write!(f, "[array]"),
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
}
