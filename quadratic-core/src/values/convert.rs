use bigdecimal::{BigDecimal, ToPrimitive, Zero};

use super::{CellValue, IsBlank, Value};
use crate::{CodeResult, CodeResultExt, RunErrorMsg, Span, Spanned, Unspan};

const CURRENCY_PREFIXES: &[char] = &['$', '¥', '£', '€'];

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
// todo: this might be wrong for formulas
impl From<f64> for CellValue {
    fn from(value: f64) -> Self {
        BigDecimal::try_from(value)
            .map_or_else(|_| CellValue::Text(value.to_string()), CellValue::Number)
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
impl From<bool> for CellValue {
    fn from(value: bool) -> Self {
        CellValue::Logical(value)
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
            CellValue::Error(e) => Err(e.msg.clone()),
            CellValue::Html(s) => Ok(s.clone()),
            CellValue::Code(_) => Ok(String::new()),
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
            CellValue::Error(e) => Err(e.msg.clone()),
            CellValue::Html(_) => Ok(0.0),
            CellValue::Code(_) => Ok(0.0),
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
        value.cell_value()
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
                value.cell_value()?.try_into()
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
    fn into_non_error_value(self) -> CodeResult<Self::Unspanned>;

    /// Coerces a value, returning an error if the value has the wrong type.
    fn try_coerce<T>(self) -> CodeResult<Spanned<T>>
    where
        Self::Unspanned: TryInto<T, Error = RunErrorMsg>,
    {
        let span = (&self).into();

        // If coercion fails, return an error.
        self.into_non_error_value()?.try_into().with_span(span)
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
        match self.inner {
            CellValue::Error(e) => Err((**e).clone()),
            other => Ok(other),
        }
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
        match &self.inner {
            Value::Single(CellValue::Error(e)) => Err((**e).clone()),
            other => Ok(other),
        }
    }
}
impl CoerceInto for Spanned<Value> {
    fn into_non_error_value(self) -> CodeResult<Value> {
        match self.inner {
            Value::Single(CellValue::Error(e)) => Err(*e),
            other => Ok(other),
        }
    }
}

#[cfg(test)]
mod test {
    use crate::CellValue;

    #[test]
    fn test_convert_from_str_to_cell_value() {
        assert_eq!(CellValue::from("$1.22"), CellValue::Text("$1.22".into()));

        assert_eq!(CellValue::from("10%"), CellValue::Text("10%".into()));
    }
}
