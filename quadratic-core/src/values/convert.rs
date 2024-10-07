use bigdecimal::{BigDecimal, ToPrimitive, Zero};
use itertools::Itertools;

use super::{CellValue, Duration, IsBlank, Value};
use crate::{CodeResult, CodeResultExt, RunErrorMsg, Span, Spanned, Unspan};

const CURRENCY_PREFIXES: &[char] = &['$', '¥', '£', '€'];

const F64_DECIMAL_PRECISION: u64 = 14; // just enough to not lose information

/*
 * CONVERSIONS (specific type -> Value)
 */

impl From<()> for CellValue {
    fn from(_: ()) -> Self {
        CellValue::Blank
    }
}
impl<T> From<Option<T>> for CellValue
where
    T: Into<CellValue>,
{
    fn from(value: Option<T>) -> Self {
        match value {
            Some(v) => v.into(),
            None => CellValue::Blank,
        }
    }
}
impl From<String> for CellValue {
    fn from(value: String) -> Self {
        CellValue::Text(value)
    }
}
impl From<&str> for CellValue {
    fn from(value: &str) -> Self {
        CellValue::Text(value.to_string())
    }
}
impl From<f64> for CellValue {
    fn from(value: f64) -> Self {
        match BigDecimal::try_from(value) {
            Ok(n) => CellValue::Number(if n.digits() > F64_DECIMAL_PRECISION {
                n.with_prec(F64_DECIMAL_PRECISION)
            } else {
                n
            }),
            // TODO: add span information
            Err(_) => CellValue::Error(Box::new(RunErrorMsg::NaN.without_span())),
        }
    }
}
impl From<i64> for CellValue {
    fn from(value: i64) -> Self {
        CellValue::Number(BigDecimal::from(value))
    }
}
impl From<i32> for CellValue {
    fn from(value: i32) -> Self {
        CellValue::Number(BigDecimal::from(value))
    }
}
impl From<u32> for CellValue {
    fn from(value: u32) -> Self {
        CellValue::Number(BigDecimal::from(value))
    }
}
impl From<usize> for CellValue {
    fn from(value: usize) -> Self {
        CellValue::Number(BigDecimal::from(value as u64))
    }
}
impl From<bool> for CellValue {
    fn from(value: bool) -> Self {
        CellValue::Logical(value)
    }
}
impl From<chrono::NaiveDateTime> for CellValue {
    fn from(value: chrono::NaiveDateTime) -> Self {
        CellValue::DateTime(value)
    }
}
impl From<chrono::NaiveDate> for CellValue {
    fn from(value: chrono::NaiveDate) -> Self {
        CellValue::Date(value)
    }
}
impl From<chrono::NaiveTime> for CellValue {
    fn from(value: chrono::NaiveTime) -> Self {
        CellValue::Time(value)
    }
}
impl From<Duration> for CellValue {
    fn from(value: Duration) -> Self {
        CellValue::Duration(value)
    }
}
impl<T> From<CodeResult<T>> for CellValue
where
    CellValue: From<T>,
{
    fn from(result: CodeResult<T>) -> Self {
        match result {
            Ok(v) => v.into(),
            Err(e) => CellValue::Error(Box::new(e)),
        }
    }
}

/*
 * CONVERSIONS (Value -> specific type)
 */

impl<'a> TryFrom<&'a CellValue> for String {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        // All types can coerce to string.
        match value {
            CellValue::Blank => Ok(String::new()),
            CellValue::Text(s) => Ok(s.clone()),
            CellValue::Number(n) => Ok(n.to_string()),
            CellValue::Logical(true) => Ok("TRUE".to_string()),
            CellValue::Logical(false) => Ok("FALSE".to_string()),
            CellValue::Instant(i) => Ok(i.to_string()),
            CellValue::Duration(d) => Ok(d.to_string()),
            CellValue::Date(d) => Ok(d.to_string()),
            CellValue::Time(t) => Ok(t.to_string()),
            CellValue::DateTime(dt) => Ok(dt.to_string()),
            CellValue::Error(e) => Err(e.msg.clone()),
            CellValue::Html(s) => Ok(s.clone()),
            CellValue::Code(_) => Ok(String::new()),
            CellValue::Image(_) => Ok(String::new()),
        }
    }
}
impl<'a> TryFrom<&'a CellValue> for f64 {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        // TODO: maybe remove string conversions once we have a stricter type system?
        match value {
            CellValue::Blank => Ok(0.0),
            CellValue::Text(s) => {
                let mut s = s.trim();
                if s.is_empty() {
                    return Ok(0.0);
                }
                if let Some(rest) = s.strip_prefix(CURRENCY_PREFIXES) {
                    s = rest;
                }
                s.parse().map_err(|_| RunErrorMsg::Expected {
                    expected: "number".into(),
                    got: Some(value.type_name().into()),
                })
            }
            // todo: this may be wrong
            CellValue::Number(n) => Ok(n.to_f64().unwrap()),
            CellValue::Logical(true) => Ok(1.0),
            CellValue::Logical(false) => Ok(0.0),
            CellValue::Instant(_) | CellValue::Duration(_) => Err(RunErrorMsg::Expected {
                expected: "number".into(),
                got: Some(value.type_name().into()),
            }),
            CellValue::Time(_) | CellValue::Date(_) => Err(RunErrorMsg::Expected {
                expected: "number".into(),
                got: Some(value.type_name().into()),
            }),
            CellValue::DateTime(_) => Err(RunErrorMsg::Expected {
                expected: "number".into(),
                got: Some(value.type_name().into()),
            }),
            CellValue::Error(e) => Err(e.msg.clone()),
            CellValue::Html(_) => Ok(0.0),
            CellValue::Code(_) => Ok(0.0),
            CellValue::Image(_) => Ok(0.0),
        }
    }
}

impl<'a> TryFrom<&'a CellValue> for i64 {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        Ok(f64::try_from(value)?.round() as i64) // TODO: should be floor for excel compat
    }
}
impl<'a> TryFrom<&'a CellValue> for u32 {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        Ok(f64::try_from(value)?.round() as u32) // TODO: should be floor for excel compat
    }
}
impl<'a> TryFrom<&'a CellValue> for bool {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        // TODO: remove string conversions once we have a stricter type system
        match value {
            CellValue::Blank => Ok(false),
            CellValue::Text(s) if s.eq_ignore_ascii_case("TRUE") => Ok(true),
            CellValue::Text(s) if s.eq_ignore_ascii_case("FALSE") => Ok(false),
            CellValue::Number(n) => Ok(!n.is_zero()),
            CellValue::Logical(b) => Ok(*b),
            _ => Err(RunErrorMsg::Expected {
                expected: "boolean".into(),
                got: Some(value.type_name().into()),
            }),
        }
    }
}

impl TryFrom<CellValue> for String {
    type Error = RunErrorMsg;

    fn try_from(value: CellValue) -> Result<Self, Self::Error> {
        // All types can coerce to string.
        match value {
            CellValue::Text(s) => Ok(s),
            other => String::try_from(&other),
        }
    }
}

impl<'a> TryFrom<&'a CellValue> for chrono::NaiveDate {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        match value {
            CellValue::Text(s) => {
                if let Some(date) = crate::date_time::parse_date(s) {
                    return Ok(date);
                }
            }
            CellValue::DateTime(dt) => return Ok(dt.date()),
            CellValue::Date(d) => return Ok(*d),
            _ => (),
        }
        Err(RunErrorMsg::Expected {
            expected: "date".into(),
            got: Some(value.type_name().into()),
        })
    }
}
impl TryFrom<CellValue> for chrono::NaiveDate {
    type Error = RunErrorMsg;

    fn try_from(value: CellValue) -> Result<Self, Self::Error> {
        chrono::NaiveDate::try_from(&value)
    }
}

macro_rules! impl_try_from_cell_value_for {
    ($type:ty) => {
        impl TryFrom<CellValue> for $type {
            type Error = RunErrorMsg;

            fn try_from(value: CellValue) -> Result<Self, Self::Error> {
                <$type>::try_from(&value)
            }
        }
    };
}
impl_try_from_cell_value_for!(f64);
impl_try_from_cell_value_for!(i64);
impl_try_from_cell_value_for!(bool);

impl<'a> TryFrom<&'a Value> for &'a CellValue {
    type Error = RunErrorMsg;

    fn try_from(value: &'a Value) -> Result<Self, Self::Error> {
        value.as_cell_value()
    }
}
impl TryFrom<Value> for CellValue {
    type Error = RunErrorMsg;

    fn try_from(value: Value) -> Result<Self, RunErrorMsg> {
        value.into_cell_value()
    }
}

macro_rules! impl_try_from_value_for {
    ($type:ty) => {
        impl<'a> TryFrom<&'a Value> for $type {
            type Error = RunErrorMsg;

            fn try_from(value: &'a Value) -> Result<Self, Self::Error> {
                value.as_cell_value()?.try_into()
            }
        }
        impl TryFrom<Value> for $type {
            type Error = RunErrorMsg;

            fn try_from(value: Value) -> Result<Self, Self::Error> {
                value.into_cell_value()?.try_into()
            }
        }
    };
}
impl_try_from_value_for!(String);
impl_try_from_value_for!(f64);
impl_try_from_value_for!(i64);
impl_try_from_value_for!(bool);

/// Coercion from `Value` or `CellValue` into a particular Rust type.
pub trait CoerceInto: Sized + Unspan
where
    for<'a> &'a Self: Into<Span>,
    Self::Unspanned: IsBlank,
{
    /// Returns an error if the value contains **any** errors; otherwise,
    /// returns the value unchanged.
    ///
    /// Errors should be preserved whenever possible, so do not call this for
    /// intermediate results.
    fn into_non_error_value(self) -> CodeResult<Self::Unspanned>;

    /// Coerces a value, returning an error if the value has the wrong type.
    fn try_coerce<T>(self) -> CodeResult<Spanned<T>>
    where
        Self::Unspanned: TryInto<T, Error = RunErrorMsg>,
    {
        let span = (&self).into();
        self.without_span().try_into().with_span(span)
    }

    /// Coerces a value, returning `None` if the value has the wrong type and
    /// `Some(Err)` only if the value is itself an error value.
    fn coerce_or_none<T>(self) -> Option<CodeResult<Spanned<T>>>
    where
        Self::Unspanned: TryInto<T, Error = RunErrorMsg>,
    {
        let span = (&self).into();

        match self.into_non_error_value() {
            // Propagate errors.
            Err(e) => Some(Err(e)),
            // If coercion fails, return `None`.
            Ok(value) => value.coerce_nonblank().map(|v| Ok(v).with_span(span)),
        }
    }
}

impl<'a> CoerceInto for Spanned<&'a CellValue> {
    fn into_non_error_value(self) -> CodeResult<&'a CellValue> {
        self.inner.as_non_error_value()
    }
}
impl CoerceInto for Spanned<CellValue> {
    fn into_non_error_value(self) -> CodeResult<CellValue> {
        match self.inner {
            CellValue::Error(e) => Err(*e),
            other => Ok(other),
        }
    }
}

impl<'a> CoerceInto for Spanned<&'a Value> {
    fn into_non_error_value(self) -> CodeResult<&'a Value> {
        let error = match self.inner {
            Value::Single(v) => v.error(),
            Value::Array(a) => a.first_error(),
            Value::Tuple(t) => t.iter().find_map(|a| a.first_error()),
        };
        match error {
            Some(e) => Err(e.clone()),
            None => Ok(self.inner),
        }
    }
}
impl CoerceInto for Spanned<Value> {
    fn into_non_error_value(self) -> CodeResult<Value> {
        match self.inner {
            Value::Single(v) => v.into_non_error_value().map(Value::Single),
            Value::Array(a) => a.into_non_error_array().map(Value::Array),
            Value::Tuple(t) => t
                .into_iter()
                .map(|a| a.into_non_error_array())
                .try_collect()
                .map(Value::Tuple),
        }
    }
}

#[cfg(test)]
mod test {
    use crate::CellValue;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_convert_from_str_to_cell_value() {
        assert_eq!(CellValue::from("$1.22"), CellValue::Text("$1.22".into()));

        assert_eq!(CellValue::from("10%"), CellValue::Text("10%".into()));
    }
}
