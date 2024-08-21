use std::fmt;
use std::hash::Hash;
use std::str::FromStr;

use anyhow::{bail, Result};
use bigdecimal::{BigDecimal, Signed, ToPrimitive, Zero};
use chrono::{TimeZone, Utc};
use serde::{Deserialize, Serialize};

use super::{Duration, Instant, IsBlank};
use crate::{
    controller::operations::operation::Operation,
    grid::{formatting::CellFmtArray, CodeCellLanguage, NumericFormat, NumericFormatKind, Sheet},
    CodeResult, Pos, RunError, RunErrorMsg, RunLengthEncoding, SheetRect,
};

// todo: fill this out
const CURRENCY_SYMBOLS: &str = "$€£¥";
const PERCENTAGE_SYMBOL: char = '%';

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCellValue {
    pub language: CodeCellLanguage,
    pub code: String,
}

/// Non-array value in the formula language.
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
// #[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(tag = "type", content = "value")]
#[serde(rename_all = "camelCase")]
pub enum CellValue {
    /// Blank cell, which contains nothing.
    #[default]
    Blank,
    /// Empty string.
    Text(String),
    /// Numeric value.
    #[cfg_attr(test, proptest(skip))]
    Number(BigDecimal),
    /// Logical value.
    Logical(bool),
    /// Instant in time.
    Instant(Instant),
    /// Duration of time.
    Duration(Duration),
    /// Error value.
    #[cfg_attr(test, proptest(skip))]
    Error(Box<RunError>),
    Html(String),
    #[cfg_attr(test, proptest(skip))]
    Code(CodeCellValue),
    #[cfg_attr(test, proptest(skip))]
    Image(String),
}
impl fmt::Display for CellValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CellValue::Blank => write!(f, ""),
            CellValue::Text(s) => write!(f, "{s}"),
            CellValue::Number(nd) => write!(f, "{nd}"),
            CellValue::Logical(true) => write!(f, "TRUE"),
            CellValue::Logical(false) => write!(f, "FALSE"),
            CellValue::Instant(i) => write!(f, "{i}"),
            CellValue::Duration(d) => write!(f, "{d}"),
            CellValue::Error(e) => write!(f, "{}", e.msg),
            CellValue::Html(s) => write!(f, "{}", s),
            CellValue::Code(code) => write!(f, "{:?}", code),
            CellValue::Image(s) => write!(f, "{}", s),
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
            CellValue::Html(_) => "html",
            CellValue::Code(_) => "code",
            CellValue::Image(_) => "image",
        }
    }
    /// Returns a formula-source-code representation of the value.
    pub fn repr(&self) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => format!("{s:?}"),
            CellValue::Number(n) => n.to_string(),
            CellValue::Logical(true) => "TRUE".to_string(),
            CellValue::Logical(false) => "FALSE".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => "[error]".to_string(),
            CellValue::Html(s) => s.clone(),
            CellValue::Code(_) => todo!("repr of code"),
            CellValue::Image(_) => todo!("repr of image"),
        }
    }

    fn add_commas(s: &str) -> String {
        s.as_bytes()
            .rchunks(3)
            .rev()
            .map(std::str::from_utf8)
            .collect::<Result<Vec<&str>, _>>()
            .unwrap()
            .join(",")
    }

    /// converts a BigDecimal to a String w/commas
    fn with_commas(bd: BigDecimal) -> String {
        let mut s = bd.to_string();
        let negative = s.starts_with('-');
        s = s.trim_start_matches('-').to_string();
        let n = if s.contains('.') {
            let mut parts = s.split('.');
            let left = parts.next().unwrap();
            let right = parts.next().unwrap();
            format!("{}.{}", CellValue::add_commas(left), right)
        } else {
            CellValue::add_commas(&s)
        };
        if negative {
            format!("-{}", n)
        } else {
            n
        }
    }

    pub fn to_display(&self) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => s.to_string(),
            CellValue::Html(s) => s.to_string(),
            CellValue::Number(n) => n.to_string(),
            CellValue::Logical(true) => "true".to_string(),
            CellValue::Logical(false) => "false".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => "[error]".to_string(),

            // these should not render
            CellValue::Code(_) => String::new(),
            CellValue::Image(_) => String::new(),
        }
    }

    pub fn to_number_display(
        &self,
        numeric_format: Option<NumericFormat>,
        numeric_decimals: Option<i16>,
        numeric_commas: Option<bool>,
    ) -> String {
        match self {
            CellValue::Number(n) => {
                let numeric_format = numeric_format.unwrap_or_default();
                let use_commas = numeric_commas.is_some_and(|c| c)
                    || (numeric_commas.is_none()
                        && numeric_format.kind == NumericFormatKind::Currency);
                let numeric_decimals = numeric_decimals.or({
                    if matches!(
                        numeric_format,
                        NumericFormat {
                            kind: NumericFormatKind::Currency,
                            ..
                        }
                    ) {
                        Some(2)
                    } else {
                        None
                    }
                });
                let result: BigDecimal = if numeric_format.kind == NumericFormatKind::Percentage {
                    n * 100
                } else {
                    n.clone()
                };
                let mut number = if numeric_format.kind == NumericFormatKind::Exponential {
                    let num = result.to_f64().unwrap_or_default();
                    let decimals = numeric_decimals.unwrap_or(2);
                    format!("{:.precision$e}", num, precision = decimals as usize)
                } else if let Some(decimals) = numeric_decimals {
                    let scaled =
                        result.with_scale_round(decimals as i64, bigdecimal::RoundingMode::HalfUp);
                    if use_commas {
                        CellValue::with_commas(scaled)
                    } else {
                        scaled.to_string()
                    }
                } else if numeric_format.kind == NumericFormatKind::Percentage {
                    let s = result.to_string();
                    if s.contains('.') {
                        s.trim_end_matches('0').to_string()
                    } else {
                        s
                    }
                } else if use_commas {
                    CellValue::with_commas(result)
                } else {
                    result.to_string()
                };
                match numeric_format.kind {
                    NumericFormatKind::Currency => {
                        let mut currency = if n.is_negative() {
                            number = number.trim_start_matches('-').to_string();
                            String::from("-")
                        } else {
                            String::new()
                        };
                        if let Some(symbol) = numeric_format.symbol.as_ref() {
                            currency.push_str(&symbol.clone());
                        }
                        currency.push_str(&number);
                        currency
                    }
                    NumericFormatKind::Percentage => {
                        number.push('%');
                        number
                    }
                    NumericFormatKind::Number => number,
                    NumericFormatKind::Exponential => number,
                }
            }
            _ => String::new(),
        }
    }

    pub fn to_edit(&self) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => s.to_string(),
            CellValue::Html(_) => String::new(),
            CellValue::Number(n) => n.to_string(),
            CellValue::Logical(true) => "true".to_string(),
            CellValue::Logical(false) => "false".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => "[error]".to_string(),

            // this should not be editable
            CellValue::Code(_) => String::new(),
            CellValue::Image(_) => String::new(),
        }
    }

    pub fn unpack_percentage(s: &str) -> Option<BigDecimal> {
        if s.is_empty() {
            return None;
        }
        if let Some(number) = s.strip_suffix('%') {
            if let Ok(bd) = BigDecimal::from_str(number) {
                return Some(bd / 100.0);
            }
        }
        None
    }

    pub fn unpack_boolean(s: &str) -> Option<CellValue> {
        match s.to_ascii_lowercase().as_str() {
            "true" => Some(CellValue::Logical(true)),
            "false" => Some(CellValue::Logical(false)),
            _ => None,
        }
    }

    pub fn strip_percentage(value: &str) -> &str {
        value.strip_suffix(PERCENTAGE_SYMBOL).unwrap_or(value)
    }

    pub fn strip_commas(value: &str) -> String {
        value.to_string().replace(',', "")
    }

    pub fn unpack_currency(s: &str) -> Option<(String, BigDecimal)> {
        if s.is_empty() {
            return None;
        }

        for char in CURRENCY_SYMBOLS.chars() {
            if let Some(stripped) = s.strip_prefix(char) {
                let without_commas = CellValue::strip_commas(stripped);
                if let Ok(bd) = BigDecimal::from_str(&without_commas) {
                    return Some((char.to_string(), bd));
                }
            }
        }
        None
    }

    pub fn strip_currency(value: &str) -> &str {
        CURRENCY_SYMBOLS.chars().fold(value, |acc: &str, char| {
            acc.strip_prefix(char).unwrap_or(acc)
        })
    }

    pub fn unpack_str_unix_timestamp(value: &str) -> anyhow::Result<CellValue> {
        let parsed: i64 = value.parse()?;
        Self::unpack_unix_timestamp(parsed)
    }

    pub fn unpack_unix_timestamp(value: i64) -> anyhow::Result<CellValue> {
        let timestamp = match Utc.timestamp_opt(value, 0) {
            chrono::LocalResult::Single(timestamp) => timestamp,
            _ => bail!("Could not parse timestamp: {}", value),
        };
        // TODO(ddimaria): convert to Instant when they're implement
        Ok(CellValue::Text(
            timestamp.format("%Y-%m-%d %H:%M:%S").to_string(),
        ))
    }

    pub fn unpack_str_float(value: &str, default: CellValue) -> CellValue {
        BigDecimal::from_str(value).map_or_else(|_| default, CellValue::Number)
    }

    pub fn is_blank_or_empty_string(&self) -> bool {
        self.is_blank() || *self == CellValue::Text(String::new())
    }
    /// Returns the contained error, if this is an error value.
    pub fn error(&self) -> Option<&RunError> {
        match self {
            CellValue::Error(e) => Some(e),
            _ => None,
        }
    }
    /// Converts an error value into an actual error.
    pub fn into_non_error_value(self) -> CodeResult<Self> {
        match self {
            CellValue::Error(e) => Err(*e),
            other => Ok(other),
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

    /// Compares two values but propagates errors and returns `None` in the case
    /// of disparate types.
    pub fn partial_cmp(&self, other: &Self) -> CodeResult<Option<std::cmp::Ordering>> {
        Ok(Some(match (self, other) {
            (CellValue::Error(e), _) | (_, CellValue::Error(e)) => return Err((**e).clone()),

            (CellValue::Number(a), CellValue::Number(b)) => a.cmp(b),
            (CellValue::Text(a), CellValue::Text(b)) => {
                let a = crate::util::case_fold(a);
                let b = crate::util::case_fold(b);
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
            | (CellValue::Html(_), _)
            | (CellValue::Code(_), _)
            | (CellValue::Image(_), _)
            | (CellValue::Blank, _) => return Ok(None),
        }))
    }

    /// Returns the sort order of a value, based on the results of Excel's
    /// `SORT()` function. The comparison operators are the same, except that
    /// blank coerces to `0`, `FALSE`, or `""` before comparison.
    fn type_id(&self) -> u8 {
        match self {
            CellValue::Number(_) => 0,
            CellValue::Text(_) => 1,
            CellValue::Logical(_) => 2,
            CellValue::Error(_) => 3,
            CellValue::Instant(_) => 4,
            CellValue::Duration(_) => 5,
            CellValue::Blank => 6,
            CellValue::Html(_) => 7,
            CellValue::Code(_) => 8,
            CellValue::Image(_) => 9,
        }
    }

    /// Compares two values using a total ordering that propagates errors and
    /// converts blanks to zeros.
    #[allow(clippy::should_implement_trait)]
    pub fn cmp(&self, other: &Self) -> CodeResult<std::cmp::Ordering> {
        // Coerce blank to zero.
        let mut lhs = self;
        let mut rhs = other;
        let lhs_cell_value: CellValue;
        let rhs_cell_value: CellValue;
        if lhs.is_blank() {
            lhs_cell_value = CellValue::Number(BigDecimal::zero());
            lhs = &lhs_cell_value;
        }
        if rhs.is_blank() {
            rhs_cell_value = CellValue::Number(BigDecimal::zero());
            rhs = &rhs_cell_value;
        }

        Ok(lhs
            .partial_cmp(rhs)?
            .unwrap_or_else(|| lhs.type_id().cmp(&rhs.type_id())))
    }

    /// Returns whether `self == other` using a case-insensitive and
    /// blank-coercing comparison.
    ///
    /// Returns an error if either argument is [`CellValue::Error`].
    pub fn eq(&self, other: &Self) -> CodeResult<bool> {
        Ok(self.is_blank() && other.eq_blank()
            || other.is_blank() && self.eq_blank()
            || self.cmp(other)? == std::cmp::Ordering::Equal)
    }
    /// Returns whether blank can coerce to this cell value.
    fn eq_blank(&self) -> bool {
        match self {
            CellValue::Blank => true,
            CellValue::Text(s) => s.is_empty(),
            CellValue::Number(n) => n.is_zero(),
            CellValue::Logical(b) => !b,
            _ => false,
        }
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

    /// Generic conversion from &str to CellValue
    /// This would normally be an implementation of FromStr, but we are holding
    /// off as we want formatting to happen with conversions in most places
    pub fn to_cell_value(value: &str) -> CellValue {
        // check for number
        let parsed = CellValue::strip_percentage(CellValue::strip_currency(value)).trim();
        let without_commas = CellValue::strip_commas(parsed);
        let number = BigDecimal::from_str(&without_commas);

        let is_true = value.eq_ignore_ascii_case("true");
        let is_false = value.eq_ignore_ascii_case("false");
        let is_bool = is_true || is_false;

        match (number, is_bool) {
            (Ok(number), false) => CellValue::Number(number),
            (_, true) => CellValue::Logical(is_true),
            _ => CellValue::Text(String::from(value)),
        }
    }

    /// Convert stringified values and types from JS to CellValue
    ///
    /// `value` is the stringified value
    /// `js_type` is the stringified CelLValue type
    pub fn from_js(
        value: &String,
        js_type: &str,
        pos: Pos,
        sheet: &mut Sheet,
    ) -> Result<(CellValue, Vec<Operation>)> {
        let mut ops = vec![];
        let sheet_rect = SheetRect::single_pos(pos, sheet.id);

        let cell_value = match js_type {
            "text" => {
                let is_html = value.to_lowercase().starts_with("<html>")
                    || value.to_lowercase().starts_with("<div>");

                match is_html {
                    true => CellValue::Html(value.to_string()),
                    false => CellValue::Text(value.to_string()),
                }
            }
            "number" => {
                if let Some((currency, number)) = CellValue::unpack_currency(value) {
                    let numeric_format = NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol: Some(currency),
                    };
                    sheet.set_formatting_value::<NumericFormat>(pos, Some(numeric_format.clone()));

                    ops.push(Operation::SetCellFormats {
                        sheet_rect,
                        attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                            Some(numeric_format),
                            1,
                        )),
                    });

                    // We no longer automatically set numeric decimals for
                    // currency; instead, we handle changes in currency decimal
                    // length by using 2 if currency is set by default.

                    CellValue::Number(number)
                } else if let Ok(number) = BigDecimal::from_str(value) {
                    CellValue::Number(number)
                } else if let Some(number) = CellValue::unpack_percentage(value) {
                    let numeric_format = NumericFormat {
                        kind: NumericFormatKind::Percentage,
                        symbol: None,
                    };
                    sheet.set_formatting_value::<NumericFormat>(pos, Some(numeric_format.clone()));
                    ops.push(Operation::SetCellFormats {
                        sheet_rect,
                        attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                            Some(numeric_format),
                            1,
                        )),
                    });

                    CellValue::Number(number)
                } else {
                    bail!("Could not parse number: {}", value);
                }
            }
            "logical" => {
                let is_true = value.eq_ignore_ascii_case("true");
                CellValue::Logical(is_true)
            }
            "instant" => CellValue::unpack_str_unix_timestamp(value)?,
            "duration" => CellValue::Text("not implemented".into()),
            "image" => CellValue::Image(value.into()),
            _ => CellValue::Text(value.into()),
        };

        Ok((cell_value, ops))
    }

    pub fn is_html(&self) -> bool {
        matches!(self, CellValue::Html(_))
    }

    pub fn is_image(&self) -> bool {
        matches!(self, CellValue::Image(_))
    }

    /// Returns the contained error, or panics the value is not an error.
    #[cfg(test)]
    #[track_caller]
    pub fn unwrap_err(self) -> RunError {
        match self {
            CellValue::Error(e) => *e,
            other => panic!("expected error value; got {other:?}"),
        }
    }

    /// Returns a hashable value that is unique per-value for most common types,
    /// but may not always be unique.
    pub fn hash(&self) -> CellValueHash {
        match self {
            CellValue::Blank => CellValueHash::Blank,
            CellValue::Text(s) => CellValueHash::Text(crate::util::case_fold(s)),
            CellValue::Number(n) => CellValueHash::Number(n.clone()),
            CellValue::Logical(b) => CellValueHash::Logical(*b),
            CellValue::Instant(Instant { seconds }) => {
                CellValueHash::Instant(seconds.to_ne_bytes())
            }
            CellValue::Duration(Duration {
                years,
                months,
                seconds,
            }) => CellValueHash::Duration(*years, *months, seconds.to_ne_bytes()),
            CellValue::Error(e) => CellValueHash::Error(e.msg.clone()),
            _ => CellValueHash::Unknown(self.type_id()),
        }
    }
}

/// Unique hash of [`CellValue`], for performance optimization. This is
/// **case-folded**, so strings with the same contents in a different case will
/// hash to the same value.
#[derive(Debug, Default, Clone, PartialEq, Eq, Hash)]
pub enum CellValueHash {
    #[default]
    Blank,
    Text(String),
    // If we ever switch to using `f64`, replace this with `[u8; 8]`.
    Number(BigDecimal),
    Logical(bool),
    Instant([u8; 8]),
    Duration(i32, i32, [u8; 8]),
    Error(RunErrorMsg),
    Unknown(u8),
}

#[cfg(test)]
mod test {
    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_cell_value_to_display_text() {
        let cv = CellValue::Text(String::from("hello"));
        assert_eq!(cv.to_display(), String::from("hello"));
    }

    #[test]
    #[parallel]
    fn test_cell_value_to_display_number() {
        let cv = CellValue::Number(BigDecimal::from_str("123123.1233").unwrap());
        assert_eq!(cv.to_display(), String::from("123123.1233"));

        let cv = CellValue::Number(BigDecimal::from_str("-123123.1233").unwrap());
        assert_eq!(cv.to_display(), String::from("-123123.1233"));

        let cv = CellValue::Number(BigDecimal::from_str("123.1255").unwrap());
        assert_eq!(cv.to_display(), String::from("123.1255"));

        let cv = CellValue::Number(BigDecimal::from_str("123.0").unwrap());
        assert_eq!(cv.to_display(), String::from("123.0"));
    }

    #[test]
    #[parallel]
    fn test_cell_value_to_display_currency() {
        let cv = CellValue::Number(BigDecimal::from_str("123123.1233").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                None
            ),
            String::from("$123,123.12")
        );
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                Some(false)
            ),
            String::from("$123123.12")
        );
        let cv = CellValue::Number(BigDecimal::from_str("-123123.1233").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                None
            ),
            String::from("-$123,123.12")
        );
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                Some(true)
            ),
            String::from("-$123,123.12")
        );
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                Some(false)
            ),
            String::from("-$123123.12")
        );
        let cv = CellValue::Number(BigDecimal::from_str("123.1255").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                None
            ),
            String::from("$123.13")
        );
        let cv = CellValue::Number(BigDecimal::from_str("123.0").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                None
            ),
            String::from("$123.00")
        );
    }

    #[test]
    #[parallel]
    fn test_cell_value_to_display_percentage() {
        let cv = CellValue::Number(BigDecimal::from_str("0.015").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                }),
                None,
                None,
            ),
            String::from("1.5%")
        );

        let cv = CellValue::Number(BigDecimal::from_str("0.9912239").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                }),
                Some(4),
                Some(false),
            ),
            String::from("99.1224%")
        );
        let cv = CellValue::Number(BigDecimal::from_str("1231123123.9912239").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                }),
                Some(4),
                Some(true),
            ),
            String::from("123,112,312,399.1224%")
        );
    }

    #[test]
    #[parallel]
    fn to_number_display_scientific() {
        let cv = CellValue::Number(BigDecimal::from_str("12345678").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None,
                }),
                None,
                None
            ),
            String::from("1.23e7")
        );

        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None,
                }),
                Some(3),
                None
            ),
            String::from("1.235e7")
        );

        let cv = CellValue::Number(BigDecimal::from_str("-12345678").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None,
                }),
                None,
                None
            ),
            String::from("-1.23e7")
        );

        let cv = CellValue::Number(BigDecimal::from_str("1000000").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None,
                }),
                None,
                None
            ),
            String::from("1.00e6")
        );
    }

    #[test]
    #[parallel]
    fn test_unpack_percentage() {
        let value = String::from("1238.12232%");
        assert_eq!(
            CellValue::unpack_percentage(&value),
            Some(BigDecimal::from_str("12.3812232").unwrap()),
        );
    }

    #[test]
    #[parallel]
    fn test_unpack_currency() {
        let value = String::from("$123.123");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("$"), BigDecimal::from_str("123.123").unwrap()))
        );

        let value = String::from("test");
        assert_eq!(CellValue::unpack_currency(&value), None);

        let value = String::from("$123$123");
        assert_eq!(CellValue::unpack_currency(&value), None);

        let value = String::from("$123.123abc");
        assert_eq!(CellValue::unpack_currency(&value), None);
    }

    #[test]
    #[parallel]
    fn test_exponential_display() {
        let value = CellValue::Number(BigDecimal::from_str("98172937192739718923.12312").unwrap());
        assert_eq!(value.to_display(), "98172937192739718923.12312");
    }

    #[test]
    #[parallel]
    fn test_image() {
        let value = CellValue::Image("test".into());
        assert_eq!(value.to_string(), "test");
        assert_eq!(value.type_name(), "image");

        let sheet = &mut Sheet::test();
        let value = CellValue::from_js(&"test".to_string(), "image", (0, 1).into(), sheet);
        assert_eq!(value.unwrap().0, CellValue::Image("test".into()));
    }

    #[test]
    #[parallel]
    fn test_is_image() {
        let value = CellValue::Image("test".into());
        assert!(value.is_image());
        let value = CellValue::Text("test".into());
        assert!(!value.is_image());
    }

    #[test]
    #[parallel]
    fn test_cell_value_equality() {
        for ([l, r], expected) in [
            // Reflexivity
            ([CellValue::Blank, CellValue::Blank], true),
            (["".into(), "".into()], true),
            ([0.into(), 0.into()], true),
            // Blank coercion
            ([CellValue::Blank, "".into()], true),
            ([CellValue::Blank, 0.into()], true),
            // Case-insensitivity
            (["a".into(), "A".into()], true),
            // ("ß", "SS", true), // TODO: proper Unicode case folding
            // Other cases
            ([0.into(), "".into()], false),
            (["a".into(), "ab".into()], false),
            ([CellValue::Blank, 1.into()], false),
            ([CellValue::Blank, (-1).into()], false),
            ([CellValue::Blank, "a".into()], false),
        ] {
            println!("Comparing {l:?} to {r:?}");
            assert_eq!(expected, l.eq(&r).unwrap());
            assert_eq!(expected, r.eq(&l).unwrap());
        }
    }
}
