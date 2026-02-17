use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use itertools::Itertools;
use rust_decimal::prelude::*;

use super::{CellValue, Duration, IsBlank, Value};
use crate::number::decimal_from_str;
use crate::{CodeResult, CodeResultExt, RunErrorMsg, Span, Spanned, Unspan};

const DECIMAL_PRECISION: u32 = 14; // just enough to not lose information

/// Parses a text string as a number.
pub fn parse_value_text(s: &str) -> Option<f64> {
    let s = s.trim();

    if s.is_empty() {
        return Some(0.0);
    }

    if let Ok(n) = s.parse::<f64>() {
        return Some(n);
    }

    if s.ends_with('%') {
        let num_part = s.trim_end_matches('%').trim();
        if let Ok(n) = num_part.parse::<f64>() {
            return Some(n / 100.0);
        }
        let cleaned: String = num_part.chars().filter(|&c| c != ',').collect();
        if let Ok(n) = cleaned.parse::<f64>() {
            return Some(n / 100.0);
        }
    }

    let cleaned: String = s
        .chars()
        .filter(|&c| c.is_ascii_digit() || c == '.' || c == '-' || c == '+')
        .collect();

    if let Ok(n) = cleaned.parse::<f64>() {
        if s.starts_with('(') && s.ends_with(')') {
            return Some(-n);
        }
        if (s.starts_with('-') || s.contains("-$") || s.contains("-€"))
            && n > 0.0
            && !cleaned.starts_with('-')
        {
            return Some(-n);
        }
        return Some(n);
    }

    if let Ok(d) = decimal_from_str(s) {
        return d.to_f64();
    }

    None
}

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

impl From<Decimal> for CellValue {
    fn from(value: Decimal) -> Self {
        CellValue::Number(
            value
                .round_sf(DECIMAL_PRECISION)
                .unwrap_or(value)
                .normalize(),
        )
    }
}
impl From<f64> for CellValue {
    fn from(value: f64) -> Self {
        match Decimal::from_f64_retain(value) {
            Some(n) => n.into(),
            None => CellValue::Error(Box::new(RunErrorMsg::NaN.without_span())),
        }
    }
}
impl From<i64> for CellValue {
    fn from(value: i64) -> Self {
        CellValue::Number(Decimal::from(value))
    }
}
impl From<i32> for CellValue {
    fn from(value: i32) -> Self {
        CellValue::Number(Decimal::from(value))
    }
}
impl From<u32> for CellValue {
    fn from(value: u32) -> Self {
        CellValue::Number(Decimal::from(value))
    }
}
impl From<usize> for CellValue {
    fn from(value: usize) -> Self {
        CellValue::Number(Decimal::from(value as u64))
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
            CellValue::Image(_) => Ok(String::new()),
            CellValue::RichText(spans) => Ok(spans.iter().map(|s| s.text.as_str()).collect()),
            CellValue::Code(code_cell) => String::try_from(code_cell.output.as_ref()),
        }
    }
}
impl<'a> TryFrom<&'a CellValue> for Decimal {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        match value {
            CellValue::Blank => Ok(Decimal::zero()),
            CellValue::Text(s) => {
                parse_value_text(s)
                    .and_then(Decimal::from_f64)
                    .ok_or_else(|| RunErrorMsg::Expected {
                        expected: "number".into(),
                        got: Some(value.type_name().into()),
                    })
            }
            // todo: this may be wrong
            CellValue::Number(n) => Ok(*n),
            CellValue::Logical(true) => Ok(Decimal::one()),
            CellValue::Logical(false) => Ok(Decimal::zero()),
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
            CellValue::Html(_) => Ok(Decimal::zero()),
            CellValue::Image(_) => Ok(Decimal::zero()),
            CellValue::RichText(_) => Err(RunErrorMsg::Expected {
                expected: "number".into(),
                got: Some(value.type_name().into()),
            }),
            CellValue::Code(code_cell) => Decimal::try_from(code_cell.output.as_ref()),
        }
    }
}
impl<'a> TryFrom<&'a CellValue> for f64 {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        Decimal::try_from(value)?
            .to_f64()
            .ok_or(RunErrorMsg::InternalError(
                "error converting Decimal to f64".into(),
            ))
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

impl<'a> TryFrom<&'a CellValue> for NaiveDateTime {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        match value {
            CellValue::DateTime(naive_date_time) => Ok(*naive_date_time),
            CellValue::Date(naive_date) => Ok((*naive_date).into()),
            CellValue::Text(s) => {
                // First try to parse as a full datetime
                if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s) {
                    return Ok(dt);
                }
                // Fall back to parsing as just a date (with midnight time)
                if let Some(CellValue::Date(d)) = CellValue::unpack_date(s) {
                    return Ok(d.into());
                }
                Err(RunErrorMsg::Expected {
                    expected: "date time".into(),
                    got: Some(value.type_name().into()),
                })
            }
            _ => Err(RunErrorMsg::Expected {
                expected: "date time".into(),
                got: Some(value.type_name().into()),
            }),
        }
    }
}
impl<'a> TryFrom<&'a CellValue> for NaiveDate {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        Ok(NaiveDateTime::try_from(value)?.date())
    }
}
impl<'a> TryFrom<&'a CellValue> for NaiveTime {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        match value {
            CellValue::DateTime(naive_date_time) => Ok(naive_date_time.time()),
            CellValue::Date(_) => Ok(NaiveTime::MIN),
            CellValue::Time(naive_time) => Ok(*naive_time),
            CellValue::Text(s) => {
                // First try to parse as time
                if let Some(CellValue::Time(t)) = CellValue::unpack_time(s) {
                    return Ok(t);
                }
                // Fall back to parsing as datetime and extracting the time
                if let Some(CellValue::DateTime(dt)) = CellValue::unpack_date_time(s) {
                    return Ok(dt.time());
                }
                Err(RunErrorMsg::Expected {
                    expected: "time".into(),
                    got: Some(value.type_name().into()),
                })
            }
            _ => Err(RunErrorMsg::Expected {
                expected: "time".into(),
                got: Some(value.type_name().into()),
            }),
        }
    }
}
impl<'a> TryFrom<&'a CellValue> for Duration {
    type Error = RunErrorMsg;

    fn try_from(value: &'a CellValue) -> Result<Self, Self::Error> {
        match value {
            CellValue::Number(big_decimal) => Ok(Duration::from_days_bigdec(big_decimal)),
            CellValue::Duration(duration) => Ok(*duration),
            _ => Err(RunErrorMsg::Expected {
                expected: "duration".into(),
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
            Value::Lambda(_) => None,
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
            Value::Lambda(l) => Ok(Value::Lambda(l)),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_convert_from_str_to_cell_value() {
        assert_eq!(CellValue::from("$1.22"), CellValue::Text("$1.22".into()));

        assert_eq!(CellValue::from("10%"), CellValue::Text("10%".into()));
    }

    #[test]
    fn test_datetime_conversions() {
        let time = NaiveTime::from_hms_opt(3, 15, 6).unwrap();
        let date = NaiveDate::from_ymd_opt(2010, 4, 1).unwrap();
        let datetime = NaiveDateTime::new(date, time);
        let duration = Duration::from_days(30.5);

        let datetime_value = CellValue::from(datetime);
        let date_value = CellValue::from(date);
        let time_value = CellValue::from(time);
        let duration_value = CellValue::from(duration);
        let number_value = CellValue::from(30.5);
        let string_value = CellValue::from("hi!");

        let midnight = NaiveTime::from_hms_opt(0, 0, 0).unwrap();

        // Test conversion to datetime
        assert_eq!(
            NaiveDateTime::new(date, midnight),
            NaiveDateTime::try_from(&date_value).unwrap()
        );
        NaiveDateTime::try_from(&time_value).unwrap_err();
        assert_eq!(datetime, NaiveDateTime::try_from(&datetime_value).unwrap());
        NaiveDateTime::try_from(&duration_value).unwrap_err();
        NaiveDateTime::try_from(&number_value).unwrap_err();
        NaiveDateTime::try_from(&string_value).unwrap_err();

        // Test conversion to date
        assert_eq!(date, NaiveDate::try_from(&date_value).unwrap());
        NaiveDate::try_from(&time_value).unwrap_err();
        assert_eq!(date, NaiveDate::try_from(&datetime_value).unwrap());
        NaiveDate::try_from(&duration_value).unwrap_err();
        NaiveDate::try_from(&number_value).unwrap_err();
        NaiveDate::try_from(&string_value).unwrap_err();

        // Test conversion to time
        assert_eq!(midnight, NaiveTime::try_from(&date_value).unwrap());
        assert_eq!(time, NaiveTime::try_from(&time_value).unwrap());
        assert_eq!(time, NaiveTime::try_from(&datetime_value).unwrap());
        NaiveTime::try_from(&duration_value).unwrap_err();
        NaiveTime::try_from(&number_value).unwrap_err();
        NaiveTime::try_from(&string_value).unwrap_err();

        // Test conversion to duration
        Duration::try_from(&date_value).unwrap_err();
        Duration::try_from(&time_value).unwrap_err();
        Duration::try_from(&datetime_value).unwrap_err();
        assert_eq!(duration, Duration::try_from(&duration_value).unwrap());
        assert_eq!(duration, Duration::try_from(&number_value).unwrap());
        Duration::try_from(&string_value).unwrap_err();
    }

    #[test]
    fn test_rich_text_to_string() {
        use crate::cellvalue::TextSpan;

        let rich = CellValue::RichText(vec![
            TextSpan::plain("Hello "),
            TextSpan::link("world", "https://example.com"),
        ]);

        // RichText should convert to concatenated string
        let s: String = String::try_from(&rich).unwrap();
        assert_eq!(s, "Hello world");
    }

    #[test]
    fn test_rich_text_to_decimal_fails() {
        use crate::cellvalue::TextSpan;
        use rust_decimal::Decimal;

        let rich = CellValue::RichText(vec![TextSpan::plain("123")]);

        // RichText should NOT convert to Decimal (returns error)
        let result = Decimal::try_from(&rich);
        assert!(result.is_err());
    }

    #[test]
    fn test_rich_text_to_bool_fails() {
        use crate::cellvalue::TextSpan;

        let rich = CellValue::RichText(vec![TextSpan::plain("true")]);

        // RichText should NOT convert to bool (returns error)
        let result = bool::try_from(&rich);
        assert!(result.is_err());
    }
    #[test]
    fn test_string_to_date_conversions() {
        // Test string to datetime conversion
        let datetime_string = CellValue::from("2024-12-25 14:30:00");
        let expected_dt = NaiveDate::from_ymd_opt(2024, 12, 25)
            .unwrap()
            .and_hms_opt(14, 30, 0)
            .unwrap();
        assert_eq!(
            expected_dt,
            NaiveDateTime::try_from(&datetime_string).unwrap()
        );

        // Test string to date conversion (from date-only string)
        let date_string = CellValue::from("2024-12-25");
        let expected_date = NaiveDate::from_ymd_opt(2024, 12, 25).unwrap();
        assert_eq!(expected_date, NaiveDate::try_from(&date_string).unwrap());

        // Test string to date conversion (from various formats)
        let date_string_slash = CellValue::from("12/25/2024");
        assert_eq!(
            expected_date,
            NaiveDate::try_from(&date_string_slash).unwrap()
        );

        // Test string to time conversion
        let time_string = CellValue::from("14:30:00");
        let expected_time = NaiveTime::from_hms_opt(14, 30, 0).unwrap();
        assert_eq!(expected_time, NaiveTime::try_from(&time_string).unwrap());

        // Test string to time conversion (from 12-hour format)
        let time_string_12h = CellValue::from("2:30 PM");
        let expected_time_pm = NaiveTime::from_hms_opt(14, 30, 0).unwrap();
        assert_eq!(
            expected_time_pm,
            NaiveTime::try_from(&time_string_12h).unwrap()
        );

        // Test invalid string conversion
        let invalid_string = CellValue::from("not a date");
        NaiveDateTime::try_from(&invalid_string).unwrap_err();
        NaiveDate::try_from(&invalid_string).unwrap_err();
        NaiveTime::try_from(&invalid_string).unwrap_err();
    }
}
