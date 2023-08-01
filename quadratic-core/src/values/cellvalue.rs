use std::fmt;

use serde::{Deserialize, Serialize};

use super::{Duration, ErrorMsg, Instant, IsBlank};
use crate::{CodeResult, Error, Span};

/// Non-array value in the formula language.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
#[serde(tag = "type", content = "value")]
#[serde(rename_all = "snake_case")]
pub enum CellValue {
    /// Blank cell, which contains nothing.
    #[default]
    Blank,
    /// Empty string.
    Text(String),
    /// Numeric value.
    Number(f64),
    /// Logical value.
    Logical(bool),
    /// Instant in time.
    Instant(Instant),
    /// Duration of time.
    Duration(Duration),
    /// Error value.
    Error(Box<Error>),
}
impl fmt::Display for CellValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CellValue::Blank => write!(f, ""),
            CellValue::Text(s) => write!(f, "{s}"),
            CellValue::Number(n) => write!(f, "{n}"),
            CellValue::Logical(true) => write!(f, "TRUE"),
            CellValue::Logical(false) => write!(f, "FALSE"),
            CellValue::Instant(i) => write!(f, "{i}"),
            CellValue::Duration(d) => write!(f, "{d}"),
            CellValue::Error(e) => write!(f, "{}", e.msg),
        }
    }
}
/// Implement `AsRef` so we can use `impl AsRef<CellValue>` to be generic over
/// `CellValue` and `&CellValue`.
impl AsRef<CellValue> for CellValue {
    fn as_ref(&self) -> &CellValue {
        self
    }
}

impl CellValue {
    /// Returns a human-friendly string describing the type of value.
    pub fn type_name(&self) -> &'static str {
        match self {
            CellValue::Blank => "blank",
            CellValue::Text(_) => "text",
            CellValue::Number(_) => "number",
            CellValue::Logical(_) => "logical",
            CellValue::Instant(_) => "time instant",
            CellValue::Duration(_) => "time duration",
            CellValue::Error(_) => "error",
        }
    }
    /// Returns a formula-source-code representation of the value.
    pub fn repr(&self) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => format!("{s:?}"),
            CellValue::Number(n) => format!("{n:?}"),
            CellValue::Logical(true) => "TRUE".to_string(),
            CellValue::Logical(false) => "FALSE".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => format!("[error]"),
        }
    }

    pub fn is_blank_or_empty_string(&self) -> bool {
        self.is_blank() || *self == CellValue::Text(String::new())
    }
    /// Returns the contained error, if this is an error value.
    pub fn error(&self) -> Option<&Error> {
        match self {
            CellValue::Error(e) => Some(e),
            _ => None,
        }
    }

    /// Coerces the value to a specific type; returns `None` if the conversion
    /// fails or the original value is `None`.
    pub fn coerce_nonblank<'a, T>(&'a self) -> Option<T>
    where
        &'a CellValue: TryInto<T>,
    {
        match self.is_blank() {
            true => None,
            false => self.try_into().ok(),
        }
    }

    /// Compares two values but propogates errors and returns `None` in the case
    /// of disparate types.
    pub fn partial_cmp(&self, other: &Self) -> CodeResult<Option<std::cmp::Ordering>> {
        Ok(Some(match (self, other) {
            (CellValue::Error(e), _) | (_, CellValue::Error(e)) => return Err((**e).clone()),

            (CellValue::Number(a), CellValue::Number(b)) => a.total_cmp(&b),
            (CellValue::Text(a), CellValue::Text(b)) => {
                let a = a.to_ascii_uppercase();
                let b = b.to_ascii_uppercase();
                a.cmp(&b)
            }
            (CellValue::Logical(a), CellValue::Logical(b)) => a.cmp(b),
            (CellValue::Instant(a), CellValue::Instant(b)) => a.cmp(b),
            (CellValue::Duration(a), CellValue::Duration(b)) => a.cmp(b),
            (CellValue::Blank, CellValue::Blank) => std::cmp::Ordering::Equal,

            (CellValue::Number(_), _)
            | (CellValue::Text(_), _)
            | (CellValue::Logical(_), _)
            | (CellValue::Instant(_), _)
            | (CellValue::Duration(_), _)
            | (CellValue::Blank, _) => return Ok(None),
        }))
    }

    /// Compares two values using a total ordering that propogates errors and
    /// converts blanks to zeros.
    pub fn cmp(&self, other: &Self) -> CodeResult<std::cmp::Ordering> {
        fn type_id(v: &CellValue) -> u8 {
            // Sort order, based on the results of Excel's `SORT()` function.
            // The comparison operators are the same, except that blank coerces
            // to zero before comparison.
            match v {
                CellValue::Number(_) => 0,
                CellValue::Text(_) => 1,
                CellValue::Logical(_) => 2,
                CellValue::Error(_) => 3,
                CellValue::Instant(_) => 4,
                CellValue::Duration(_) => 5,
                CellValue::Blank => 6,
            }
        }

        let mut lhs = self;
        let mut rhs = other;
        if lhs.is_blank() {
            lhs = &CellValue::Number(0.0);
        }
        if rhs.is_blank() {
            rhs = &CellValue::Number(0.0);
        }

        Ok(lhs
            .partial_cmp(rhs)?
            .unwrap_or_else(|| type_id(lhs).cmp(&type_id(rhs))))
    }

    /// Returns whether `self == other` using `CellValue::cmp()`.
    pub fn eq(&self, other: &Self) -> CodeResult<bool> {
        Ok(self.cmp(other)? == std::cmp::Ordering::Equal)
    }
    /// Returns whether `self < other` using `CellValue::cmp()`.
    pub fn lt(&self, other: &Self) -> CodeResult<bool> {
        Ok(self.cmp(other)? == std::cmp::Ordering::Less)
    }
    /// Returns whether `self > other` using `CellValue::cmp()`.
    pub fn gt(&self, other: &Self) -> CodeResult<bool> {
        Ok(self.cmp(other)? == std::cmp::Ordering::Greater)
    }
    /// Returns whether `self <= other` using `CellValue::cmp()`.
    pub fn lte(&self, other: &Self) -> CodeResult<bool> {
        Ok(matches!(
            self.cmp(other)?,
            std::cmp::Ordering::Less | std::cmp::Ordering::Equal,
        ))
    }
    /// Returns whether `self >= other` using `CellValue::cmp()`.
    pub fn gte(&self, other: &Self) -> CodeResult<bool> {
        Ok(matches!(
            self.cmp(other)?,
            std::cmp::Ordering::Greater | std::cmp::Ordering::Equal,
        ))
    }

    /// Replaces NaN and Inf with an error; otherwise returns the value
    /// unchanged.
    pub fn purify_float(self, span: Span) -> CodeResult<Self> {
        match self {
            CellValue::Number(n) if n.is_nan() => Err(ErrorMsg::NotANumber.with_span(span)),
            CellValue::Number(n) if n.is_infinite() => Err(ErrorMsg::Infinity.with_span(span)),
            other_single_value => Ok(other_single_value),
        }
    }
}
