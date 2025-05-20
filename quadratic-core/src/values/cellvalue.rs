use std::hash::Hash;
use std::str::FromStr;
use std::{fmt, fmt::Display};

use anyhow::Result;
use bigdecimal::{BigDecimal, Signed, ToPrimitive, Zero};
use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};

use super::{Duration, Instant, IsBlank};
use crate::grid::formats::FormatUpdate;
use crate::grid::{CodeCellLanguage, CodeCellValue};
use crate::{
    CodeResult, Pos, RunError, RunErrorMsg, Span, Spanned,
    date_time::{DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT, DEFAULT_TIME_FORMAT},
    grid::{NumericFormat, NumericFormatKind, js_types::JsCellValuePos},
};

// todo: fill this out
const CURRENCY_SYMBOLS: &str = "$€£¥";
const PERCENTAGE_SYMBOL: char = '%';

// when a number's decimal is larger than this value, then it will treat it as text (this avoids an attempt to allocate a huge vector)
// there is an unmerged alternative that might be interesting: https://github.com/declanvk/bigdecimal-rs/commit/b0a2ea3a403ddeeeaeef1ddfc41ff2ae4a4252d6
// see original issue here: https://github.com/akubera/bigdecimal-rs/issues/108
const MAX_BIG_DECIMAL_SIZE: usize = 10000000;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Import {
    pub file_name: String,
}

impl Display for Import {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Import({})", self.file_name)
    }
}

impl Import {
    pub fn new(file_name: String) -> Self {
        Self { file_name }
    }
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
    /// **Deprecated** Nov 2024 in favor of `DateTime`.
    #[cfg_attr(test, proptest(skip))]
    Instant(Instant),
    // Date + time.
    #[cfg_attr(test, proptest(skip))]
    DateTime(NaiveDateTime),
    // Date.
    #[cfg_attr(test, proptest(skip))]
    Date(NaiveDate),
    // Time.
    #[cfg_attr(test, proptest(skip))]
    Time(NaiveTime),
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
    #[cfg_attr(test, proptest(skip))]
    Import(Import),
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
            CellValue::Date(d) => write!(f, "{d}"),
            CellValue::Time(d) => write!(f, "{d}"),
            CellValue::DateTime(dt) => write!(f, "{dt}"),
            CellValue::Error(e) => write!(f, "{}", e.msg),
            CellValue::Html(s) => write!(f, "{}", s),
            CellValue::Code(code) => write!(f, "{:?}", code),
            CellValue::Image(s) => write!(f, "{}", s),
            CellValue::Import(import) => write!(f, "{:?}", import),
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
            CellValue::Duration(_) => "duration",
            CellValue::Error(_) => "error",
            CellValue::Html(_) => "html",
            CellValue::Code(_) => "code",
            CellValue::Image(_) => "image",
            CellValue::Date(_) => "date",
            CellValue::Time(_) => "time",
            CellValue::DateTime(_) => "date time",
            CellValue::Import(_) => "import",
        }
    }

    // Returns the type of the value as a u8 id, keep in sync quadratic_py/utils.py and javascript/runner/javascriptLibrary.ts
    pub fn type_u8(&self) -> u8 {
        match self {
            CellValue::Blank => 0,
            CellValue::Text(_) => 1,
            CellValue::Number(_) => 2,
            CellValue::Logical(_) => 3,
            CellValue::Duration(_) => 4,
            CellValue::Error(_) => 5,
            CellValue::Html(_) => 6,
            CellValue::Code(_) => 7,
            CellValue::Image(_) => 8,
            CellValue::Date(_) => 9,
            CellValue::Time(_) => 10,
            CellValue::Instant(_) | CellValue::DateTime(_) => 11,
            CellValue::Import(_) => 12,
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
            CellValue::Instant(_) => "[deprecated]".to_string(),
            CellValue::Duration(d) => d.to_string(),
            CellValue::Error(_) => "[error]".to_string(),
            CellValue::Html(s) => s.clone(),
            CellValue::Code(_) => "[code cell]".to_string(),
            CellValue::Image(_) => "[image]".to_string(),
            CellValue::Date(d) => d.to_string(),
            CellValue::Time(d) => d.to_string(),
            CellValue::DateTime(d) => d.to_string(),
            CellValue::Import(import) => import.to_string(),
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
        if negative { format!("-{}", n) } else { n }
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
            CellValue::Duration(d) => d.to_string(),
            CellValue::Error(_) => "[error]".to_string(),
            CellValue::Date(d) => d.format(DEFAULT_DATE_FORMAT).to_string(),
            CellValue::Time(d) => d.format(DEFAULT_TIME_FORMAT).to_string(),
            CellValue::DateTime(d) => d.format(DEFAULT_DATE_TIME_FORMAT).to_string(),
            CellValue::Import(import) => import.to_string(),

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

            // todo: these formats should be a user-definable format (we'll need it for localization)
            CellValue::Date(d) => d.format("%m/%d/%Y").to_string(),
            CellValue::Time(t) => t.format("%-I:%M %p").to_string(),
            CellValue::DateTime(t) => t.format("%m/%d/%Y %-I:%M %p").to_string(),

            CellValue::Duration(d) => d.to_string(),
            CellValue::Error(_) => "[error]".to_string(),
            CellValue::Import(import) => import.to_string(),

            // this should not be editable
            CellValue::Code(_) => String::new(),
            CellValue::Image(_) => String::new(),
        }
    }

    /// Returns the value as a string that can be used by get_cells in languages
    pub fn to_get_cells(&self) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => s.to_string(),
            CellValue::Html(_) => String::new(),
            CellValue::Number(n) => n.to_string(),
            CellValue::Logical(true) => "true".to_string(),
            CellValue::Logical(false) => "false".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Date(d) => d.format("%Y-%m-%d").to_string(),
            CellValue::Time(t) => t.format("%H:%M:%S%.3f").to_string(),
            CellValue::DateTime(t) => t.format("%Y-%m-%dT%H:%M:%S%.3f").to_string(),
            CellValue::Duration(d) => d.to_string(),
            CellValue::Error(_) => "[error]".to_string(),

            // these should not return a value
            CellValue::Code(_) => String::new(),
            CellValue::Import(_) => String::new(),
            CellValue::Image(_) => String::new(),
        }
    }

    pub fn to_cell_value_pos(self, pos: Pos) -> JsCellValuePos {
        JsCellValuePos {
            value: self.to_string(),
            kind: self.type_name().to_string(),
            pos: pos.a1_string(),
        }
    }

    pub fn unpack_percentage(s: &str) -> Option<BigDecimal> {
        if s.is_empty() {
            return None;
        }
        let without_parentheses = CellValue::strip_parentheses(s);
        if without_parentheses.ends_with("%") {
            let without_percentage = CellValue::strip_percentage(&without_parentheses);
            let without_commas = CellValue::strip_commas(without_percentage);
            if let Ok(bd) = BigDecimal::from_str(&without_commas) {
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

    fn strip_percentage(value: &str) -> &str {
        value
            .trim()
            .strip_suffix(PERCENTAGE_SYMBOL)
            .map_or(value, |stripped| stripped.trim())
    }

    fn strip_commas(value: &str) -> String {
        value.trim().to_string().replace(',', "")
    }

    fn strip_parentheses(value: &str) -> String {
        let mut trimmed = value.trim();

        let percent = if trimmed.ends_with("%") {
            trimmed = trimmed.strip_suffix("%").unwrap_or(trimmed);
            "%"
        } else {
            ""
        };
        if trimmed.starts_with("(") && trimmed.ends_with(")") {
            format!("-{}{}", trimmed[1..trimmed.len() - 1].trim(), percent)
        } else {
            value.to_string()
        }
    }

    fn strip_currency(value: &str) -> String {
        let (is_negative, absolute_value) = (
            value.starts_with("-"),
            value.strip_prefix("-").unwrap_or(value),
        );

        let stripped = CURRENCY_SYMBOLS
            .chars()
            .fold(absolute_value, |acc: &str, char| {
                acc.strip_prefix(char).unwrap_or(acc)
            });

        if is_negative {
            if let Some(stripped) = stripped.strip_prefix("-") {
                stripped.trim().to_string()
            } else {
                format!("-{}", stripped.trim())
            }
        } else {
            stripped.to_string()
        }
    }

    pub fn unpack_currency(s: &str) -> Option<(String, BigDecimal)> {
        if s.is_empty() {
            return None;
        }

        let without_parentheses = CellValue::strip_parentheses(s);
        let (is_negative, absolute_value) = (
            without_parentheses.starts_with("-"),
            without_parentheses
                .strip_prefix("-")
                .map_or(without_parentheses.as_str(), |absolute_value| {
                    absolute_value.trim()
                }),
        );

        for char in CURRENCY_SYMBOLS.chars() {
            if let Some(stripped) = absolute_value
                .strip_prefix(char)
                .map(|stripped| stripped.trim())
            {
                let without_commas =
                    CellValue::strip_commas(&CellValue::strip_parentheses(stripped));
                if let Ok(bd) = BigDecimal::from_str(&without_commas) {
                    let bd = if is_negative { -bd } else { bd };
                    return Some((char.to_string(), bd));
                }
            }
        }
        None
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
    /// Converts an error value into an actual error.
    pub fn as_non_error_value(&self) -> CodeResult<&Self> {
        match self {
            CellValue::Error(e) => Err((**e).clone()),
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

    /// Returns the sort order of a value, based on the results of Excel's
    /// `SORT()` function. The comparison operators are the same, except that
    /// blank coerces to `0`, `FALSE`, or `""` before comparison.
    pub fn type_id(&self) -> u8 {
        match self {
            CellValue::Number(_) => 0,
            CellValue::Text(_) => 1,
            CellValue::Logical(_) => 2,
            CellValue::Error(_) => 3,
            CellValue::Instant(_) | CellValue::DateTime(_) => 4,
            CellValue::Date(_) => 5,
            CellValue::Time(_) => 6,
            CellValue::Duration(_) => 7,
            CellValue::Blank => 8,
            CellValue::Html(_) => 9,
            CellValue::Code(_) => 10,
            CellValue::Image(_) => 11,
            CellValue::Import(_) => 12,
        }
    }

    /// Compares two values using a total ordering that propagates errors and
    /// converts blanks to zeros.
    #[allow(clippy::should_implement_trait)]
    pub fn partial_cmp(&self, other: &Self) -> CodeResult<std::cmp::Ordering> {
        if self.is_blank() && other.eq_blank() || other.is_blank() && self.eq_blank() {
            return Ok(std::cmp::Ordering::Equal);
        }

        // Coerce blank to zero.
        let mut lhs = self.as_non_error_value()?;
        let mut rhs = other.as_non_error_value()?;
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
        Ok(lhs.total_cmp(rhs))
    }

    /// Compares two values according to the total sort order, with no coercion
    /// and no errors.
    pub fn total_cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self, other) {
            (CellValue::Text(a), CellValue::Text(b)) => {
                let a = crate::util::case_fold(a);
                let b = crate::util::case_fold(b);
                a.cmp(&b)
            }
            (CellValue::Number(a), CellValue::Number(b)) => a.cmp(b),
            (CellValue::Logical(a), CellValue::Logical(b)) => a.cmp(b),
            (CellValue::DateTime(a), CellValue::DateTime(b)) => a.cmp(b),
            (CellValue::Date(a), CellValue::Date(b)) => a.cmp(b),
            (CellValue::Time(a), CellValue::Time(b)) => a.cmp(b),
            (CellValue::Duration(a), CellValue::Duration(b)) => a.cmp(b),
            _ => self.type_id().cmp(&other.type_id()),
        }
    }

    /// Returns whether `self == other` using a case-insensitive and
    /// blank-coercing comparison.
    ///
    /// Returns an error if either argument is [`CellValue::Error`].
    pub fn eq(&self, other: &Self) -> CodeResult<bool> {
        Ok(self.partial_cmp(other)? == std::cmp::Ordering::Equal)
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
        Ok(self.partial_cmp(other)? == std::cmp::Ordering::Less)
    }
    /// Returns whether `self > other` using `CellValue::cmp()`.
    pub fn gt(&self, other: &Self) -> CodeResult<bool> {
        Ok(self.partial_cmp(other)? == std::cmp::Ordering::Greater)
    }
    /// Returns whether `self <= other` using `CellValue::cmp()`.
    pub fn lte(&self, other: &Self) -> CodeResult<bool> {
        Ok(matches!(
            self.partial_cmp(other)?,
            std::cmp::Ordering::Less | std::cmp::Ordering::Equal,
        ))
    }
    /// Returns whether `self >= other` using `CellValue::cmp()`.
    pub fn gte(&self, other: &Self) -> CodeResult<bool> {
        Ok(matches!(
            self.partial_cmp(other)?,
            std::cmp::Ordering::Greater | std::cmp::Ordering::Equal,
        ))
    }

    /// Generic conversion from &str to CellValue
    /// This would normally be an implementation of FromStr, but we are holding
    /// off as we want formatting to happen with conversions in most places
    pub fn parse_from_str(value: &str) -> CellValue {
        // check for duration
        if let Ok(duration) = value.parse() {
            return CellValue::Duration(duration);
        }

        // check for number
        let without_parentheses = CellValue::strip_parentheses(value);
        let without_currency = CellValue::strip_currency(&without_parentheses);
        let parsed = CellValue::strip_percentage(&without_currency);
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

    /// Convert string to a cell_value and generate necessary operations
    pub fn string_to_cell_value(value: &str, allow_code: bool) -> (CellValue, FormatUpdate) {
        let mut format_update = FormatUpdate::default();

        let cell_value = if value.is_empty() {
            CellValue::Blank
        } else if let Some((currency, number)) = CellValue::unpack_currency(value) {
            format_update = FormatUpdate {
                numeric_format: Some(Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(currency),
                })),
                ..Default::default()
            };

            if value.contains(',') {
                format_update.numeric_commas = Some(Some(true));
            }

            // We no longer automatically set numeric decimals for
            // currency; instead, we handle changes in currency decimal
            // length by using 2 if currency is set by default.

            CellValue::Number(number)
        } else if let Some(bool) = CellValue::unpack_boolean(value) {
            bool
        } else if let Ok(bd) = BigDecimal::from_str(&CellValue::strip_commas(
            &CellValue::strip_parentheses(value),
        )) {
            if (bd.fractional_digit_count().unsigned_abs() as usize) > MAX_BIG_DECIMAL_SIZE {
                CellValue::Text(value.into())
            } else {
                if value.contains(',') {
                    format_update = FormatUpdate {
                        numeric_commas: Some(Some(true)),
                        ..Default::default()
                    };
                }
                CellValue::Number(bd)
            }
        } else if let Some(percent) = CellValue::unpack_percentage(value) {
            format_update = FormatUpdate {
                numeric_format: Some(Some(NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                })),
                ..Default::default()
            };
            CellValue::Number(percent)
        } else if let Some(time) = CellValue::unpack_time(value) {
            time
        } else if let Some(date) = CellValue::unpack_date(value) {
            date
        } else if let Some(date_time) = CellValue::unpack_date_time(value) {
            date_time
        } else if let Some(duration) = CellValue::unpack_duration(value) {
            duration
        } else if let Some(code) = value.strip_prefix("=") {
            if allow_code {
                CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code: code.to_string(),
                })
            } else {
                CellValue::Text(code.to_string())
            }
        } else {
            CellValue::Text(value.into())
        };

        (cell_value, format_update)
    }

    pub fn is_html(&self) -> bool {
        matches!(self, CellValue::Html(_))
    }

    pub fn is_image(&self) -> bool {
        matches!(self, CellValue::Image(_))
    }

    pub fn is_code(&self) -> bool {
        matches!(self, CellValue::Code(_))
    }

    pub fn is_import(&self) -> bool {
        matches!(self, CellValue::Import(_))
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
            CellValue::Duration(Duration { months, seconds }) => {
                CellValueHash::Duration(*months, seconds.to_ne_bytes())
            }
            CellValue::Error(e) => CellValueHash::Error(e.msg.clone()),
            _ => CellValueHash::Unknown(self.type_id()),
        }
    }

    fn to_numeric(&self) -> CodeResult<CellValue> {
        match self.as_non_error_value()? {
            CellValue::Blank => Ok(CellValue::Number(0.into())),
            CellValue::Text(s) => Ok(CellValue::parse_from_str(s)),
            CellValue::Logical(false) => Ok(CellValue::Number(0.into())),
            CellValue::Logical(true) => Ok(CellValue::Number(1.into())),
            _ => Ok(self.clone()),
        }
    }
    /// Returns whether the type is a date, time, datetime, or duration.
    fn has_date_or_time(&self) -> bool {
        matches!(
            self,
            CellValue::Date(_) | CellValue::Time(_) | CellValue::DateTime(_),
        )
    }

    /// Adds two values, casting them as needed.
    pub fn add(
        span: Span,
        lhs: Spanned<&CellValue>,
        rhs: Spanned<&CellValue>,
    ) -> CodeResult<Spanned<CellValue>> {
        let v = match (&lhs.inner.to_numeric()?, &rhs.inner.to_numeric()?) {
            // number + number
            (CellValue::Number(a), CellValue::Number(b)) => CellValue::Number(a + b),

            // datetime + number(days)
            (CellValue::Number(n), CellValue::DateTime(dt))
            | (CellValue::DateTime(dt), CellValue::Number(n)) => CellValue::DateTime(
                super::time::add_to_datetime(*dt, Duration::from_days_bigdec(n)),
            ),

            // date + number(days)
            (CellValue::Number(n), CellValue::Date(d))
            | (CellValue::Date(d), CellValue::Number(n)) => {
                CellValue::Date(super::time::add_to_date(*d, Duration::from_days_bigdec(n)))
            }

            // time + number(hours)
            (CellValue::Number(n), CellValue::Time(t))
            | (CellValue::Time(t), CellValue::Number(n)) => {
                CellValue::Time(super::time::add_to_time(*t, Duration::from_hours_bigdec(n)))
            }

            // duration + number(days)
            (CellValue::Duration(dur), CellValue::Number(n))
            | (CellValue::Number(n), CellValue::Duration(dur)) => {
                CellValue::Duration(*dur + Duration::from_days_bigdec(n))
            }

            // date + time
            (CellValue::Date(date), CellValue::Time(time))
            | (CellValue::Time(time), CellValue::Date(date)) => {
                CellValue::DateTime(date.and_time(*time))
            }

            // datetime + duration
            (CellValue::Duration(dur), CellValue::DateTime(dt))
            | (CellValue::DateTime(dt), CellValue::Duration(dur)) => {
                CellValue::DateTime(super::time::add_to_datetime(*dt, *dur))
            }

            // date + duration
            (CellValue::Duration(dur), CellValue::Date(d))
            | (CellValue::Date(d), CellValue::Duration(dur)) => {
                if dur.is_integer_days() {
                    CellValue::Date(super::time::add_to_date(*d, *dur))
                } else {
                    CellValue::DateTime(super::time::add_to_datetime(NaiveDateTime::from(*d), *dur))
                }
            }

            // time + duration
            (CellValue::Duration(dur), CellValue::Time(t))
            | (CellValue::Time(t), CellValue::Duration(dur)) => {
                CellValue::Time(super::time::add_to_time(*t, *dur))
            }

            // duration + duration
            (CellValue::Duration(dur1), CellValue::Duration(dur2)) => {
                CellValue::Duration(*dur1 + *dur2)
            }

            // other operation
            _ => {
                return Err(RunErrorMsg::BadOp {
                    op: "add".into(),
                    ty1: lhs.inner.type_name().into(),
                    ty2: Some(rhs.inner.type_name().into()),
                    use_duration_instead: (lhs.inner.has_date_or_time()
                        || rhs.inner.has_date_or_time())
                        && !matches!(lhs.inner, CellValue::Duration(_))
                        && !matches!(rhs.inner, CellValue::Duration(_)),
                }
                .with_span(span));
            }
        };

        Ok(Spanned { span, inner: v })
    }

    /// Subtracts two values, casting them as needed.
    pub fn sub(
        span: Span,
        lhs: Spanned<&CellValue>,
        rhs: Spanned<&CellValue>,
    ) -> CodeResult<Spanned<CellValue>> {
        let a = lhs.inner.to_numeric()?;
        let b = rhs.inner.to_numeric()?;

        let v = match (&a, &b) {
            // number - number
            (CellValue::Number(n1), CellValue::Number(n2)) => CellValue::Number(n1 - n2),

            // datetime - number(days)
            (CellValue::DateTime(dt), CellValue::Number(n)) => CellValue::DateTime(
                super::time::add_to_datetime(*dt, Duration::from_days_bigdec(&-n)),
            ),

            // date - number(days)
            (CellValue::Date(d), CellValue::Number(n)) => CellValue::Date(
                super::time::add_to_date(*d, Duration::from_days_bigdec(&-n)),
            ),

            // time - number(hours)
            (CellValue::Time(t), CellValue::Number(n)) => CellValue::Time(
                super::time::add_to_time(*t, Duration::from_hours_bigdec(&-n)),
            ),

            // duration - number(days)
            (CellValue::Duration(dur), CellValue::Number(n)) => {
                CellValue::Duration(*dur - Duration::from_days_bigdec(n))
            }

            // number(days) - duration
            (CellValue::Number(n), CellValue::Duration(dur)) => {
                CellValue::Duration(Duration::from_days_bigdec(n) - *dur)
            }

            // datetime - duration
            (CellValue::DateTime(dt), CellValue::Duration(dur)) => {
                CellValue::DateTime(super::time::add_to_datetime(*dt, -*dur))
            }

            // date - duration
            (CellValue::Date(d), CellValue::Duration(dur)) => {
                if dur.is_integer_days() {
                    CellValue::Date(super::time::add_to_date(*d, -*dur))
                } else {
                    CellValue::DateTime(super::time::add_to_datetime(
                        NaiveDateTime::from(*d),
                        -*dur,
                    ))
                }
            }

            // time - duration
            (CellValue::Time(t), CellValue::Duration(dur)) => {
                CellValue::Time(super::time::add_to_time(*t, -*dur))
            }

            // datetime - datetime
            (CellValue::DateTime(dt1), CellValue::DateTime(dt2)) => {
                CellValue::Duration(Duration::from(*dt1 - *dt2))
            }
            // datetime - date
            (CellValue::DateTime(dt), CellValue::Date(d)) => {
                CellValue::Duration(Duration::from(*dt - NaiveDateTime::from(*d)))
            }
            // date - datetime
            (CellValue::Date(d), CellValue::DateTime(dt)) => {
                CellValue::Duration(Duration::from(NaiveDateTime::from(*d) - *dt))
            }
            // date - date
            (CellValue::Date(d1), CellValue::Date(d2)) => {
                CellValue::Duration(Duration::from(*d1 - *d2))
            }

            // time - time
            (CellValue::Time(t1), CellValue::Time(t2)) => {
                CellValue::Duration(Duration::from(*t1 - *t2))
            }

            // duration - duration
            (CellValue::Duration(dur1), CellValue::Duration(dur2)) => {
                CellValue::Duration(*dur1 - *dur2)
            }

            // other operation
            _ => {
                return Err(RunErrorMsg::BadOp {
                    op: "subtract".into(),
                    ty1: a.type_name().into(),
                    ty2: Some(b.type_name().into()),
                    use_duration_instead: a.has_date_or_time()
                        && !matches!(b, CellValue::Duration(_)),
                }
                .with_span(span));
            }
        };

        Ok(Spanned { span, inner: v })
    }

    /// Negates a value.
    pub fn neg(value: Spanned<&CellValue>) -> CodeResult<Spanned<CellValue>> {
        let span = value.span;

        let v = match value.inner.to_numeric()? {
            CellValue::Number(n) => CellValue::Number(-n),
            CellValue::Duration(dur) => CellValue::Duration(-dur),
            _ => return Err(RunErrorMsg::InvalidArgument.with_span(value.span)),
        };

        Ok(Spanned { span, inner: v })
    }

    // Multiplies two values.
    pub fn mul(
        span: Span,
        lhs: Spanned<&CellValue>,
        rhs: Spanned<&CellValue>,
    ) -> CodeResult<Spanned<CellValue>> {
        let v = match (&lhs.inner.to_numeric()?, &rhs.inner.to_numeric()?) {
            (CellValue::Number(n1), CellValue::Number(n2)) => CellValue::Number(n1 * n2),

            (CellValue::Duration(d), CellValue::Number(n))
            | (CellValue::Number(n), CellValue::Duration(d)) => {
                CellValue::Duration(*d * n.to_f64().unwrap_or(0.0))
            }

            _ => {
                return Err(RunErrorMsg::BadOp {
                    op: "multiply".into(),
                    ty1: lhs.inner.type_name().into(),
                    ty2: Some(rhs.inner.type_name().into()),
                    use_duration_instead: (lhs.inner.has_date_or_time()
                        && matches!(rhs.inner, CellValue::Number(_)))
                        || (rhs.inner.has_date_or_time()
                            && matches!(lhs.inner, CellValue::Number(_))),
                }
                .with_span(span));
            }
        };

        Ok(Spanned { span, inner: v })
    }

    // Divides two values, returning an error in case of division by zero.
    pub fn checked_div(
        span: Span,
        lhs: Spanned<&CellValue>,
        rhs: Spanned<&CellValue>,
    ) -> CodeResult<Spanned<CellValue>> {
        let a = lhs.inner.to_numeric()?;
        let b = rhs.inner.to_numeric()?;

        let v = match (&a, &b) {
            (CellValue::Number(n1), CellValue::Number(n2)) => {
                CellValue::from(crate::formulas::util::checked_div(
                    span,
                    n1.to_f64().unwrap_or(0.0),
                    n2.to_f64().unwrap_or(0.0),
                )?)
            }
            (CellValue::Duration(d), CellValue::Number(n)) => {
                let recip = n.to_f64().unwrap_or(1.0).recip();
                match recip.is_finite() {
                    true => CellValue::Duration(*d * recip),
                    false => return Err(RunErrorMsg::DivideByZero.with_span(span)),
                }
            }

            _ => {
                return Err(RunErrorMsg::BadOp {
                    op: "divide".into(),
                    ty1: a.type_name().into(),
                    ty2: Some(b.type_name().into()),
                    use_duration_instead: a.has_date_or_time() && matches!(b, CellValue::Number(_)),
                }
                .with_span(span));
            }
        };

        Ok(Spanned { span, inner: v })
    }

    /// Returns the arithmetic mean of a sequence of values, or an error if
    /// there are no values. Ignores blank values.
    pub fn average(
        span: Span,
        values: impl IntoIterator<Item = CodeResult<f64>>,
    ) -> CodeResult<f64> {
        // This may someday be generalized to work with dates as well, but it's
        // important that it still ignores blanks.
        let mut sum = 0.0;
        let mut count = 0;
        for n in values {
            sum += n?;
            count += 1;
        }
        crate::formulas::util::checked_div(span, sum, count as f64)
    }

    pub fn code_cell_value(&self) -> Option<CodeCellValue> {
        match self {
            CellValue::Code(code) => Some(code.to_owned()),
            CellValue::Import(_) => Some(CodeCellValue::new(CodeCellLanguage::Import, "".into())),
            _ => None,
        }
    }

    pub fn code_cell_value_mut(&mut self) -> Option<&mut CodeCellValue> {
        match self {
            CellValue::Code(code) => Some(code),
            _ => None,
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
    Duration(i32, [u8; 8]),
    Error(RunErrorMsg),
    Unknown(u8),
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_cell_value_to_display_text() {
        let cv = CellValue::Text(String::from("hello"));
        assert_eq!(cv.to_display(), String::from("hello"));
    }

    #[test]
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
    fn test_cell_value_to_display_currency() {
        let cv = CellValue::Number(BigDecimal::from_str("123123.1233").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2),
                None,
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
                Some(false),
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
                None,
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
                Some(true),
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
                Some(false),
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
                None,
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
                None,
            ),
            String::from("$123.00")
        );
    }

    #[test]
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
    fn to_number_display_scientific() {
        let cv = CellValue::Number(BigDecimal::from_str("12345678").unwrap());
        assert_eq!(
            cv.to_number_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None,
                }),
                None,
                None,
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
                None,
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
                None,
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
                None,
            ),
            String::from("1.00e6")
        );
    }

    #[test]
    fn test_unpack_percentage() {
        let value = String::from("1238.12232%");
        assert_eq!(
            CellValue::unpack_percentage(&value),
            Some(BigDecimal::from_str("12.3812232").unwrap()),
        );
    }

    #[test]
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
    fn test_exponential_display() {
        let value = CellValue::Number(BigDecimal::from_str("98172937192739718923.12312").unwrap());
        assert_eq!(value.to_display(), "98172937192739718923.12312");
    }

    #[test]
    fn test_is_html() {
        let value = CellValue::Html("test".to_string());
        assert!(value.is_html());
        assert!(!value.is_image());
        assert!(!value.is_code());
        assert!(!value.is_import());

        let value = CellValue::Text("test".into());
        assert!(!value.is_html());
    }

    #[test]
    fn test_is_image() {
        let value = CellValue::Image("test".to_string());
        assert!(!value.is_html());
        assert!(value.is_image());
        assert!(!value.is_code());
        assert!(!value.is_import());

        let value = CellValue::Text("test".into());
        assert!(!value.is_image());
    }

    #[test]
    fn test_is_code() {
        let value = CellValue::Code(CodeCellValue::new(
            CodeCellLanguage::Python,
            "test".to_string(),
        ));
        assert!(!value.is_html());
        assert!(!value.is_image());
        assert!(value.is_code());
        assert!(!value.is_import());

        let value = CellValue::Text("test".into());
        assert!(!value.is_code());
    }

    #[test]
    fn test_is_import() {
        let value = CellValue::Import(Import::new("test".to_string()));
        assert!(!value.is_html());
        assert!(!value.is_image());
        assert!(!value.is_code());
        assert!(value.is_import());

        let value = CellValue::Text("test".into());
        assert!(!value.is_import());
    }

    #[test]
    fn to_get_cells() {
        let value = CellValue::Number(BigDecimal::from_str("123123.1233").unwrap());
        assert_eq!(value.to_get_cells(), "123123.1233");

        let value = CellValue::Logical(true);
        assert_eq!(value.to_get_cells(), "true");

        let value = CellValue::Logical(false);
        assert_eq!(value.to_get_cells(), "false");

        let value = CellValue::Text("test".into());
        assert_eq!(value.to_get_cells(), "test");

        let value = CellValue::Date(NaiveDate::parse_from_str("2021-09-01", "%Y-%m-%d").unwrap());
        assert_eq!(value.to_get_cells(), "2021-09-01");

        let value = CellValue::DateTime(
            NaiveDateTime::parse_from_str("2024-08-15T10:53:48.750", "%Y-%m-%dT%H:%M:%S%.f")
                .unwrap(),
        );
        assert_eq!(value.to_get_cells(), "2024-08-15T10:53:48.750");
    }

    #[test]
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

    #[test]
    fn test_strip_negative_percent() {
        let value = CellValue::parse_from_str("-123.123%");
        assert_eq!(
            value,
            CellValue::Number(BigDecimal::from_str("-123.123").unwrap())
        );

        let value = CellValue::parse_from_str("(123.123)%");
        assert_eq!(
            value,
            CellValue::Number(BigDecimal::from_str("-123.123").unwrap())
        );


    }
}
