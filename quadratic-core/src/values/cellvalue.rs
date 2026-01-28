use std::hash::Hash;
use std::{fmt, fmt::Display};

use anyhow::Result;
use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use rust_decimal::prelude::*;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::currency;
use super::number::decimal_from_str;
use super::{CodeCell, Duration, Instant, IsBlank};
use crate::grid::CodeCellLanguage;
use crate::grid::formats::FormatUpdate;
use crate::{
    CodeResult, Pos, RunError, RunErrorMsg, Span, Spanned,
    date_time::{DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT, DEFAULT_TIME_FORMAT},
    grid::{NumericFormat, NumericFormatKind, js_types::JsCellValuePos},
};

const PERCENTAGE_SYMBOL: char = '%';

// when a number's decimal is larger than this value, then it will treat it as text (this avoids an attempt to allocate a huge vector)
// there is an unmerged alternative that might be interesting: https://github.com/declanvk/decimal-rs/commit/b0a2ea3a403ddeeeaeef1ddfc41ff2ae4a4252d6
// see original issue here: https://github.com/akubera/decimal-rs/issues/108
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

/// A span of text with optional inline formatting overrides.
/// When rendered, span formatting overrides the cell-level format.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash, TS)]
pub struct TextSpan {
    pub text: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strike_through: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_size: Option<i16>,
}

impl TextSpan {
    /// Creates a plain text span with no formatting overrides.
    pub fn plain(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            ..Default::default()
        }
    }

    /// Creates a hyperlink span.
    pub fn link(text: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            link: Some(url.into()),
            ..Default::default()
        }
    }

    /// Returns true if this span has no formatting overrides.
    pub fn is_plain(&self) -> bool {
        self.link.is_none()
            && self.bold.is_none()
            && self.italic.is_none()
            && self.underline.is_none()
            && self.strike_through.is_none()
            && self.text_color.is_none()
            && self.font_size.is_none()
    }

    /// Clears the bold formatting from this span.
    /// Returns true if the value was changed.
    pub fn clear_bold(&mut self) -> bool {
        if self.bold.is_some() {
            self.bold = None;
            true
        } else {
            false
        }
    }

    /// Clears the italic formatting from this span.
    /// Returns true if the value was changed.
    pub fn clear_italic(&mut self) -> bool {
        if self.italic.is_some() {
            self.italic = None;
            true
        } else {
            false
        }
    }

    /// Clears the strikethrough formatting from this span.
    /// Returns true if the value was changed.
    pub fn clear_strike_through(&mut self) -> bool {
        if self.strike_through.is_some() {
            self.strike_through = None;
            true
        } else {
            false
        }
    }

    /// Clears the text color formatting from this span.
    /// Returns true if the value was changed.
    pub fn clear_text_color(&mut self) -> bool {
        if self.text_color.is_some() {
            self.text_color = None;
            true
        } else {
            false
        }
    }

    /// Clears the underline formatting from this span.
    /// Returns true if the value was changed.
    pub fn clear_underline(&mut self) -> bool {
        if self.underline.is_some() {
            self.underline = None;
            true
        } else {
            false
        }
    }

    /// Clears all text formatting (bold, italic, underline, strikethrough, text_color, font_size)
    /// but preserves links.
    /// Returns true if any value was changed.
    pub fn clear_all_formatting(&mut self) -> bool {
        let changed = self.bold.is_some()
            || self.italic.is_some()
            || self.underline.is_some()
            || self.strike_through.is_some()
            || self.text_color.is_some()
            || self.font_size.is_some();

        self.bold = None;
        self.italic = None;
        self.underline = None;
        self.strike_through = None;
        self.text_color = None;
        self.font_size = None;

        changed
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
    Number(Decimal),
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
    #[cfg_attr(test, proptest(skip))]
    Html(String),
    #[cfg_attr(test, proptest(skip))]
    Image(String),
    /// Rich text with inline formatting (links, bold, italic, etc. per span).
    #[cfg_attr(test, proptest(skip))]
    RichText(Vec<TextSpan>),
    /// Single-cell code (1x1 output, no table UI).
    /// Contains the code run and its computed output value.
    #[cfg_attr(test, proptest(skip))]
    Code(Box<CodeCell>),
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
            CellValue::Html(s) => write!(f, "{s}"),
            CellValue::Image(s) => write!(f, "{s}"),
            CellValue::RichText(spans) => {
                for span in spans {
                    write!(f, "{}", span.text)?;
                }
                Ok(())
            }
            CellValue::Code(code_cell) => write!(f, "{}", code_cell.output),
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
            CellValue::Image(_) => "image",
            CellValue::Date(_) => "date",
            CellValue::Time(_) => "time",
            CellValue::DateTime(_) => "date time",
            CellValue::RichText(_) => "rich text",
            CellValue::Code(_) => "code",
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
            CellValue::Image(_) => 8,
            CellValue::Date(_) => 9,
            CellValue::Time(_) => 10,
            CellValue::Instant(_) | CellValue::DateTime(_) => 11,
            CellValue::RichText(_) => 12,
            CellValue::Code(_) => 13,
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
            CellValue::Image(_) => "[image]".to_string(),
            CellValue::Date(d) => d.to_string(),
            CellValue::Time(d) => d.to_string(),
            CellValue::DateTime(d) => d.to_string(),
            CellValue::RichText(spans) => {
                // Return the concatenated text for repr
                spans.iter().map(|s| s.text.as_str()).collect()
            }
            CellValue::Code(code_cell) => code_cell.output.repr(),
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

    /// converts a Decimal to a String w/commas
    fn with_commas(decimal: Decimal) -> String {
        let mut s = decimal.to_string();
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
        if negative { format!("-{n}") } else { n }
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
            CellValue::RichText(spans) => spans.iter().map(|s| s.text.as_str()).collect(),
            CellValue::Code(code_cell) => code_cell.output.to_display(),

            // these should not render
            CellValue::Image(_) => String::new(),
        }
    }

    /// Returns the value as an f64 if it represents a number.
    pub fn to_number(&self) -> Option<f64> {
        use rust_decimal::prelude::ToPrimitive;
        match self {
            CellValue::Number(n) => n.to_f64(),
            CellValue::Logical(true) => Some(1.0),
            CellValue::Logical(false) => Some(0.0),
            CellValue::Code(code_cell) => code_cell.output.to_number(),
            _ => None,
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
                let result: Decimal = if numeric_format.kind == NumericFormatKind::Percentage {
                    n * Decimal::from(100)
                } else {
                    *n
                };
                let mut number = if numeric_format.kind == NumericFormatKind::Exponential {
                    let num = result.to_f64().unwrap_or_default();
                    let decimals = numeric_decimals.unwrap_or(2);
                    format!("{:.precision$e}", num, precision = decimals as usize)
                } else if let Some(decimals) = numeric_decimals {
                    let mut scaled = result.to_owned();
                    scaled.rescale(decimals as u32);
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
                        if let Some(symbol) = numeric_format.symbol.as_ref() {
                            let is_negative = n.is_sign_negative();
                            let number_str = if is_negative {
                                number.trim_start_matches('-').to_string()
                            } else {
                                number.clone()
                            };
                            currency::format_currency(&number_str, symbol, is_negative)
                        } else {
                            number
                        }
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
            CellValue::RichText(spans) => spans.iter().map(|s| s.text.as_str()).collect(),

            // For code cells, return the code string (for formula editing)
            CellValue::Code(code_cell) => {
                if code_cell.code_run.language == CodeCellLanguage::Formula {
                    format!("={}", code_cell.code_run.code)
                } else {
                    code_cell.output.to_edit()
                }
            }

            // this should not be editable
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
            CellValue::RichText(spans) => spans.iter().map(|s| s.text.as_str()).collect(),
            CellValue::Code(code_cell) => code_cell.output.to_get_cells(),

            // these should not return a value
            CellValue::Image(_) => String::new(),
        }
    }

    pub fn to_cell_value_pos(self, pos: Pos) -> JsCellValuePos {
        JsCellValuePos {
            value: self.to_string(),
            kind: self.into(),
            pos: pos.a1_string(),
        }
    }

    pub fn unpack_percentage(s: &str) -> Option<Decimal> {
        if s.is_empty() {
            return None;
        }
        let without_parentheses = CellValue::strip_parentheses(s);
        if without_parentheses.ends_with("%") {
            let without_percentage = CellValue::strip_percentage(&without_parentheses);
            let without_commas = CellValue::strip_commas(without_percentage);
            if let Ok(decimal) = decimal_from_str(&without_commas) {
                return Some(decimal / Decimal::from(100));
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
        currency::strip_currency(value)
    }

    pub fn unpack_currency(s: &str) -> Option<(String, Decimal)> {
        currency::unpack_currency(s)
    }

    pub fn unpack_str_float(value: &str, default: CellValue) -> CellValue {
        decimal_from_str(value).map_or_else(|_| default, CellValue::Number)
    }

    pub fn is_blank_or_empty_string(&self) -> bool {
        self.is_blank() || *self == CellValue::Text(String::new())
    }
    /// Returns the contained error, if this is an error value.
    pub fn error(&self) -> Option<&RunError> {
        match self {
            CellValue::Error(e) => Some(e),
            CellValue::Code(code_cell) => code_cell.output.error(),
            _ => None,
        }
    }
    /// Converts an error value into an actual error.
    pub fn into_non_error_value(self) -> CodeResult<Self> {
        match self {
            CellValue::Error(e) => Err(*e),
            CellValue::Code(code_cell) => {
                // Check if output is an error
                if let CellValue::Error(e) = *code_cell.output {
                    Err(*e)
                } else {
                    Ok(CellValue::Code(code_cell))
                }
            }
            other => Ok(other),
        }
    }
    /// Converts an error value into an actual error.
    pub fn as_non_error_value(&self) -> CodeResult<&Self> {
        match self {
            CellValue::Error(e) => Err((**e).clone()),
            CellValue::Code(code_cell) => {
                // Check if output is an error
                if let CellValue::Error(e) = code_cell.output.as_ref() {
                    Err((**e).clone())
                } else {
                    Ok(self)
                }
            }
            other => Ok(other),
        }
    }

    /// If this is a RichText value, clears the bold formatting from all spans.
    /// Returns true if any changes were made, false if not RichText or no changes.
    pub fn clear_richtext_bold(&mut self) -> bool {
        if let CellValue::RichText(spans) = self {
            let mut changed = false;
            for span in spans.iter_mut() {
                if span.clear_bold() {
                    changed = true;
                }
            }
            changed
        } else {
            false
        }
    }

    /// If this is a RichText value, clears the italic formatting from all spans.
    /// Returns true if any changes were made, false if not RichText or no changes.
    pub fn clear_richtext_italic(&mut self) -> bool {
        if let CellValue::RichText(spans) = self {
            let mut changed = false;
            for span in spans.iter_mut() {
                if span.clear_italic() {
                    changed = true;
                }
            }
            changed
        } else {
            false
        }
    }

    /// If this is a RichText value, clears the strikethrough formatting from all spans.
    /// Returns true if any changes were made, false if not RichText or no changes.
    pub fn clear_richtext_strike_through(&mut self) -> bool {
        if let CellValue::RichText(spans) = self {
            let mut changed = false;
            for span in spans.iter_mut() {
                if span.clear_strike_through() {
                    changed = true;
                }
            }
            changed
        } else {
            false
        }
    }

    /// If this is a RichText value, clears the text color formatting from all spans.
    /// Returns true if any changes were made, false if not RichText or no changes.
    pub fn clear_richtext_text_color(&mut self) -> bool {
        if let CellValue::RichText(spans) = self {
            let mut changed = false;
            for span in spans.iter_mut() {
                if span.clear_text_color() {
                    changed = true;
                }
            }
            changed
        } else {
            false
        }
    }

    /// If this is a RichText value, clears the underline formatting from all spans.
    /// Returns true if any changes were made, false if not RichText or no changes.
    pub fn clear_richtext_underline(&mut self) -> bool {
        if let CellValue::RichText(spans) = self {
            let mut changed = false;
            for span in spans.iter_mut() {
                if span.clear_underline() {
                    changed = true;
                }
            }
            changed
        } else {
            false
        }
    }

    /// If this is a RichText value, clears all text formatting from all spans
    /// (bold, italic, underline, strikethrough, text_color, font_size) but preserves links.
    /// Returns true if any changes were made, false if not RichText or no changes.
    pub fn clear_all_richtext_formatting(&mut self) -> bool {
        if let CellValue::RichText(spans) = self {
            let mut changed = false;
            for span in spans.iter_mut() {
                if span.clear_all_formatting() {
                    changed = true;
                }
            }
            changed
        } else {
            false
        }
    }

    /// If this is a RichText value, converts it to plain Text by concatenating all spans.
    /// Also clears all formatting and links. Returns the original if not RichText.
    pub fn richtext_to_plain_text(self) -> CellValue {
        if let CellValue::RichText(spans) = self {
            let text: String = spans.iter().map(|s| s.text.as_str()).collect();
            CellValue::Text(text)
        } else {
            self
        }
    }

    /// Returns true if this is a RichText value with any inline formatting.
    pub fn has_richtext_formatting(&self) -> bool {
        if let CellValue::RichText(spans) = self {
            spans.iter().any(|s| !s.is_plain())
        } else {
            false
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
            CellValue::Image(_) => 11,
            CellValue::RichText(_) => 12,
            CellValue::Code(code_cell) => code_cell.output.type_id(),
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
            lhs_cell_value = CellValue::Number(Decimal::zero());
            lhs = &lhs_cell_value;
        }
        if rhs.is_blank() {
            rhs_cell_value = CellValue::Number(Decimal::zero());
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
            CellValue::Code(code_cell) => code_cell.output.eq_blank(),
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
        if let Some(time) = CellValue::unpack_time(value) {
            return time;
        }
        if let Some(date) = CellValue::unpack_date(value) {
            return date;
        }
        if let Some(date_time) = CellValue::unpack_date_time(value) {
            return date_time;
        }
        if let Some(duration) = CellValue::unpack_duration(value) {
            return duration;
        }

        // check for number
        let without_parentheses = CellValue::strip_parentheses(value);
        let without_currency = CellValue::strip_currency(&without_parentheses);
        let parsed = CellValue::strip_percentage(&without_currency);
        let without_commas = CellValue::strip_commas(parsed);
        let number = decimal_from_str(&without_commas);

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
    pub fn string_to_cell_value(
        value: &str,
        user_entered_percent: bool,
    ) -> (CellValue, FormatUpdate) {
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
        } else if let Ok(bd) = decimal_from_str(&CellValue::strip_commas(
            &CellValue::strip_parentheses(value),
        )) {
            if (bd.scale() as usize) > MAX_BIG_DECIMAL_SIZE {
                CellValue::Text(value.into())
            } else {
                if value.contains(',') {
                    format_update = FormatUpdate {
                        numeric_commas: Some(Some(true)),
                        ..Default::default()
                    };
                }
                if user_entered_percent {
                    CellValue::Number(bd / Decimal::from(100))
                } else {
                    CellValue::Number(bd)
                }
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

    /// Returns a reference to the CodeCell if this is a Code value.
    pub fn as_code_cell(&self) -> Option<&CodeCell> {
        match self {
            CellValue::Code(code_cell) => Some(code_cell),
            _ => None,
        }
    }

    /// Returns a mutable reference to the CodeCell if this is a Code value.
    pub fn as_code_cell_mut(&mut self) -> Option<&mut CodeCell> {
        match self {
            CellValue::Code(code_cell) => Some(code_cell),
            _ => None,
        }
    }

    /// Returns the output value of a code cell, or self if not a code cell.
    /// This is useful for getting the "display" value of any cell.
    pub fn output_value(&self) -> &CellValue {
        match self {
            CellValue::Code(code_cell) => &code_cell.output,
            _ => self,
        }
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
            CellValue::Number(n) => CellValueHash::Number(*n),
            CellValue::Logical(b) => CellValueHash::Logical(*b),
            CellValue::Instant(Instant { seconds }) => {
                CellValueHash::Instant(seconds.to_ne_bytes())
            }
            CellValue::Duration(Duration { months, seconds }) => {
                CellValueHash::Duration(*months, seconds.to_ne_bytes())
            }
            CellValue::Error(e) => CellValueHash::Error(e.msg.clone()),
            CellValue::Code(code_cell) => code_cell.output.hash(),
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
                // number is more consistent with other spreadsheets.
                // will coerce to a duration when used.
                CellValue::from(Duration::from(*d1 - *d2).to_fractional_days())
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
    Number(Decimal),
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
        let cv = CellValue::Number(decimal_from_str("123123.1233").unwrap());
        assert_eq!(cv.to_display(), String::from("123123.1233"));

        let cv = CellValue::Number(decimal_from_str("-123123.1233").unwrap());
        assert_eq!(cv.to_display(), String::from("-123123.1233"));

        let cv = CellValue::Number(decimal_from_str("123.1255").unwrap());
        assert_eq!(cv.to_display(), String::from("123.1255"));

        let cv = CellValue::Number(decimal_from_str("123.0").unwrap());
        assert_eq!(cv.to_display(), String::from("123.0"));
    }

    #[test]
    fn test_cell_value_to_display_currency() {
        let cv = CellValue::Number(decimal_from_str("123123.1233").unwrap());
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
        let cv = CellValue::Number(decimal_from_str("-123123.1233").unwrap());
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
        let cv = CellValue::Number(decimal_from_str("123.1255").unwrap());
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
        let cv = CellValue::Number(decimal_from_str("123.0").unwrap());
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
        let cv = CellValue::Number(decimal_from_str("0.015").unwrap());
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

        let cv = CellValue::Number(decimal_from_str("0.9912239").unwrap());
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
        let cv = CellValue::Number(decimal_from_str("1231123123.9912239").unwrap());
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
        let cv = CellValue::Number(decimal_from_str("12345678").unwrap());
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

        let cv = CellValue::Number(decimal_from_str("-12345678").unwrap());
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

        let cv = CellValue::Number(decimal_from_str("1000000").unwrap());
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
            Some(decimal_from_str("12.3812232").unwrap()),
        );
    }

    #[test]
    fn test_unpack_currency() {
        let value = String::from("$123.123");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("$"), decimal_from_str("123.123").unwrap()))
        );

        let value = String::from("test");
        assert_eq!(CellValue::unpack_currency(&value), None);

        let value = String::from("$123$123");
        assert_eq!(CellValue::unpack_currency(&value), None);

        let value = String::from("$123.123abc");
        assert_eq!(CellValue::unpack_currency(&value), None);

        // Test multi-character currency symbols
        let value = String::from("CHF123.45");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("CHF"), decimal_from_str("123.45").unwrap()))
        );

        let value = String::from("R$123.45");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("R$"), decimal_from_str("123.45").unwrap()))
        );

        let value = String::from("kr123.45");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("kr"), decimal_from_str("123.45").unwrap()))
        );

        // Test that longer symbols are matched before shorter ones
        // "R$" should match before "R" for "R$123.45" (Brazilian Real)
        let value = String::from("R$123.45");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("R$"), decimal_from_str("123.45").unwrap()))
        );

        // Test that "R 123" (South African Rand with space) correctly matches "R" and not "R$"
        let value = String::from("R 123.45");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("R"), decimal_from_str("123.45").unwrap()))
        );
    }

    #[test]
    fn test_exponential_display() {
        let value = CellValue::Number(decimal_from_str("98172937192739718923.12312").unwrap());
        assert_eq!(value.to_display(), "98172937192739718923.12312");
    }

    #[test]
    fn test_is_html() {
        let value = CellValue::Html("test".to_string());
        assert!(value.is_html());
        assert!(!value.is_image());

        let value = CellValue::Text("test".into());
        assert!(!value.is_html());
    }

    #[test]
    fn test_is_image() {
        let value = CellValue::Image("test".to_string());
        assert!(!value.is_html());
        assert!(value.is_image());

        let value = CellValue::Text("test".into());
        assert!(!value.is_image());
    }

    #[test]
    fn to_get_cells() {
        let value = CellValue::Number(decimal_from_str("123123.1233").unwrap());
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
            CellValue::Number(decimal_from_str("-123.123").unwrap())
        );

        let value = CellValue::parse_from_str("(123.123)%");
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123.123").unwrap())
        );
    }

    #[test]
    fn test_percentage_14() {
        let (value, format) = CellValue::string_to_cell_value("14%", false);
        assert_eq!(value, CellValue::Number(decimal_from_str("0.14").unwrap()));
        assert_eq!(
            format,
            FormatUpdate {
                numeric_format: Some(Some(NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                })),
                ..Default::default()
            }
        );
        assert_eq!(value.to_edit(), "0.14");
    }

    #[test]
    fn boolean_to_cell_value() {
        let (value, format_update) = CellValue::string_to_cell_value("true", true);
        assert_eq!(value, CellValue::Logical(true));
        assert!(format_update.is_default());

        let (value, format_update) = CellValue::string_to_cell_value("false", true);
        assert_eq!(value, CellValue::Logical(false));
        assert!(format_update.is_default());

        let (value, format_update) = CellValue::string_to_cell_value("TRUE", true);
        assert_eq!(value, CellValue::Logical(true));
        assert!(format_update.is_default());

        let (value, format_update) = CellValue::string_to_cell_value("FALSE", true);
        assert_eq!(value, CellValue::Logical(false));
        assert!(format_update.is_default());

        let (value, format_update) = CellValue::string_to_cell_value("tRue", true);
        assert_eq!(value, CellValue::Logical(true));
        assert!(format_update.is_default());

        let (value, format_update) = CellValue::string_to_cell_value("FaLse", true);
        assert_eq!(value, CellValue::Logical(false));
        assert!(format_update.is_default());
    }

    #[test]
    fn number_to_cell_value() {
        let (value, format_update) = CellValue::string_to_cell_value("123", false);
        assert_eq!(value, 123.into());
        assert!(format_update.is_default());

        let (value, format_update) = CellValue::string_to_cell_value("123.45", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123.45").unwrap())
        );
        assert!(format_update.is_default());

        let (value, format_update) = CellValue::string_to_cell_value("123,456.78", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456.78").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        let (value, format_update) = CellValue::string_to_cell_value("123,456,789.01", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456789.01").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        // currency with comma
        let (value, format_update) = CellValue::string_to_cell_value("$123,456", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // parentheses with comma
        let (value, format_update) = CellValue::string_to_cell_value("(123,456)", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(format_update.numeric_commas, Some(Some(true)));

        // parentheses with -ve
        let (value, format_update) = CellValue::string_to_cell_value("(-123,456)", false);
        assert_eq!(value, CellValue::Text("(-123,456)".to_string()));
        assert!(format_update.is_default());

        // currency with a space
        let (value, format_update) = CellValue::string_to_cell_value("$ 123,456", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with a space and -ve outside
        let (value, format_update) = CellValue::string_to_cell_value("- $ 123,456", true);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with a space and -ve inside
        let (value, format_update) = CellValue::string_to_cell_value("$ -123,456", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with parentheses outside
        let (value, format_update) = CellValue::string_to_cell_value("($ 123,456)", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with parentheses inside
        let (value, format_update) = CellValue::string_to_cell_value("$(123,456)", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // currency with parentheses and space
        let (value, format_update) = CellValue::string_to_cell_value("$ ( 123,456)", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("-123456").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }))
        );

        // parentheses with -ve
        let (value, format_update) = CellValue::string_to_cell_value("(-$123,456)", false);
        assert_eq!(value, CellValue::Text("(-$123,456)".to_string()));
        assert!(format_update.is_default());

        // percent with a space
        let (value, format_update) = CellValue::string_to_cell_value("123456 %", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("1234.56").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            }))
        );

        // percent with a comma
        let (value, format_update) = CellValue::string_to_cell_value("123,456%", false);
        assert_eq!(
            value,
            CellValue::Number(decimal_from_str("1234.56").unwrap())
        );
        assert_eq!(
            format_update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            }))
        );
    }

    #[test]
    fn test_problematic_number() {
        let value = "980E92207901934";
        let (cell_value, _) = CellValue::string_to_cell_value(value, false);
        assert_eq!(cell_value.to_string(), value.to_string());
    }

    #[test]
    fn test_text_span_plain() {
        let span = TextSpan::plain("Hello");
        assert_eq!(span.text, "Hello");
        assert!(span.link.is_none());
        assert!(span.bold.is_none());
        assert!(span.italic.is_none());
        assert!(span.is_plain());
    }

    #[test]
    fn test_text_span_link() {
        let span = TextSpan::link("Click here", "https://example.com");
        assert_eq!(span.text, "Click here");
        assert_eq!(span.link, Some("https://example.com".to_string()));
        assert!(!span.is_plain());
    }

    #[test]
    fn test_text_span_with_formatting() {
        let span = TextSpan {
            text: "Bold text".to_string(),
            bold: Some(true),
            italic: Some(false),
            ..Default::default()
        };
        assert_eq!(span.text, "Bold text");
        assert_eq!(span.bold, Some(true));
        assert_eq!(span.italic, Some(false));
        assert!(!span.is_plain());
    }

    #[test]
    fn test_rich_text_display() {
        let rich = CellValue::RichText(vec![
            TextSpan::plain("Hello "),
            TextSpan::link("world", "https://example.com"),
            TextSpan::plain("!"),
        ]);
        assert_eq!(rich.to_string(), "Hello world!");
        assert_eq!(rich.to_display(), "Hello world!");
    }

    #[test]
    fn test_rich_text_type_name() {
        let rich = CellValue::RichText(vec![TextSpan::plain("test")]);
        assert_eq!(rich.type_name(), "rich text");
        assert_eq!(rich.type_u8(), 12);
        assert_eq!(rich.type_id(), 12);
    }

    #[test]
    fn test_rich_text_to_edit() {
        let rich = CellValue::RichText(vec![TextSpan::plain("Part 1"), TextSpan::plain(" Part 2")]);
        assert_eq!(rich.to_edit(), "Part 1 Part 2");
    }

    #[test]
    fn test_rich_text_to_get_cells() {
        let rich = CellValue::RichText(vec![TextSpan::link("Link text", "https://example.com")]);
        assert_eq!(rich.to_get_cells(), "Link text");
    }

    #[test]
    fn test_rich_text_repr() {
        let rich = CellValue::RichText(vec![TextSpan::plain("Hello"), TextSpan::plain(" World")]);
        assert_eq!(rich.repr(), "Hello World");
    }

    #[test]
    fn test_rich_text_empty_spans() {
        let rich = CellValue::RichText(vec![]);
        assert_eq!(rich.to_string(), "");
        assert_eq!(rich.to_display(), "");
    }

    #[test]
    fn test_text_span_serialization() {
        let span = TextSpan::link("Click", "https://example.com");
        let json = serde_json::to_string(&span).unwrap();
        // Should skip None fields
        assert!(json.contains("\"text\":\"Click\""));
        assert!(json.contains("\"link\":\"https://example.com\""));
        assert!(!json.contains("\"bold\""));

        let deserialized: TextSpan = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, span);
    }

    #[test]
    fn test_rich_text_serialization() {
        let rich = CellValue::RichText(vec![
            TextSpan::plain("Normal "),
            TextSpan {
                text: "bold".to_string(),
                bold: Some(true),
                ..Default::default()
            },
        ]);
        let json = serde_json::to_string(&rich).unwrap();
        let deserialized: CellValue = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, rich);
    }

    #[test]
    fn test_to_number() {
        // Number values return the f64 equivalent
        let cv = CellValue::Number(decimal_from_str("123.456").unwrap());
        assert_eq!(cv.to_number(), Some(123.456));

        let cv = CellValue::Number(decimal_from_str("-99.5").unwrap());
        assert_eq!(cv.to_number(), Some(-99.5));

        let cv = CellValue::Number(decimal_from_str("0").unwrap());
        assert_eq!(cv.to_number(), Some(0.0));

        // Logical true returns 1.0
        let cv = CellValue::Logical(true);
        assert_eq!(cv.to_number(), Some(1.0));

        // Logical false returns 0.0
        let cv = CellValue::Logical(false);
        assert_eq!(cv.to_number(), Some(0.0));

        // Other types return None
        let cv = CellValue::Text(String::from("hello"));
        assert_eq!(cv.to_number(), None);

        let cv = CellValue::Blank;
        assert_eq!(cv.to_number(), None);
    }

    #[test]
    fn test_text_span_clear_bold() {
        let mut span = TextSpan {
            text: "test".to_string(),
            bold: Some(true),
            italic: Some(true),
            ..Default::default()
        };
        assert!(span.clear_bold());
        assert!(span.bold.is_none());
        assert_eq!(span.italic, Some(true)); // Other formatting preserved

        // No change when already None
        assert!(!span.clear_bold());
    }

    #[test]
    fn test_text_span_clear_italic() {
        let mut span = TextSpan {
            text: "test".to_string(),
            italic: Some(false),
            ..Default::default()
        };
        assert!(span.clear_italic());
        assert!(span.italic.is_none());

        // No change when already None
        assert!(!span.clear_italic());
    }

    #[test]
    fn test_text_span_clear_strike_through() {
        let mut span = TextSpan {
            text: "test".to_string(),
            strike_through: Some(true),
            ..Default::default()
        };
        assert!(span.clear_strike_through());
        assert!(span.strike_through.is_none());

        // No change when already None
        assert!(!span.clear_strike_through());
    }

    #[test]
    fn test_text_span_clear_text_color() {
        let mut span = TextSpan {
            text: "test".to_string(),
            text_color: Some("red".to_string()),
            ..Default::default()
        };
        assert!(span.clear_text_color());
        assert!(span.text_color.is_none());

        // No change when already None
        assert!(!span.clear_text_color());
    }

    #[test]
    fn test_text_span_clear_underline() {
        let mut span = TextSpan {
            text: "test".to_string(),
            underline: Some(true),
            ..Default::default()
        };
        assert!(span.clear_underline());
        assert!(span.underline.is_none());

        // No change when already None
        assert!(!span.clear_underline());
    }

    #[test]
    fn test_text_span_clear_all_formatting() {
        let mut span = TextSpan {
            text: "test".to_string(),
            bold: Some(true),
            italic: Some(false),
            underline: Some(true),
            strike_through: Some(true),
            text_color: Some("blue".to_string()),
            font_size: Some(14),
            link: Some("https://example.com".to_string()),
        };

        assert!(span.clear_all_formatting());
        assert!(span.bold.is_none());
        assert!(span.italic.is_none());
        assert!(span.underline.is_none());
        assert!(span.strike_through.is_none());
        assert!(span.text_color.is_none());
        assert!(span.font_size.is_none());
        // Link should be preserved
        assert_eq!(span.link, Some("https://example.com".to_string()));
        // Text should be preserved
        assert_eq!(span.text, "test");

        // No change when already cleared
        assert!(!span.clear_all_formatting());
    }

    #[test]
    fn test_cellvalue_clear_richtext_bold() {
        let mut cv = CellValue::RichText(vec![
            TextSpan {
                text: "first".to_string(),
                bold: Some(true),
                ..Default::default()
            },
            TextSpan {
                text: "second".to_string(),
                bold: Some(false),
                italic: Some(true),
                ..Default::default()
            },
            TextSpan::plain("third"),
        ]);

        assert!(cv.clear_richtext_bold());
        if let CellValue::RichText(spans) = &cv {
            assert!(spans[0].bold.is_none());
            assert!(spans[1].bold.is_none());
            assert!(spans[1].italic.is_some()); // Other formatting preserved
            assert!(spans[2].bold.is_none());
        } else {
            panic!("Expected RichText");
        }

        // No change on second call
        assert!(!cv.clear_richtext_bold());

        // Non-RichText returns false
        let mut text_cv = CellValue::Text("hello".to_string());
        assert!(!text_cv.clear_richtext_bold());
    }

    #[test]
    fn test_cellvalue_clear_richtext_italic() {
        let mut cv = CellValue::RichText(vec![TextSpan {
            text: "test".to_string(),
            italic: Some(true),
            ..Default::default()
        }]);

        assert!(cv.clear_richtext_italic());
        if let CellValue::RichText(spans) = &cv {
            assert!(spans[0].italic.is_none());
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_cellvalue_clear_richtext_strike_through() {
        let mut cv = CellValue::RichText(vec![TextSpan {
            text: "test".to_string(),
            strike_through: Some(true),
            ..Default::default()
        }]);

        assert!(cv.clear_richtext_strike_through());
        if let CellValue::RichText(spans) = &cv {
            assert!(spans[0].strike_through.is_none());
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_cellvalue_clear_richtext_text_color() {
        let mut cv = CellValue::RichText(vec![TextSpan {
            text: "test".to_string(),
            text_color: Some("red".to_string()),
            ..Default::default()
        }]);

        assert!(cv.clear_richtext_text_color());
        if let CellValue::RichText(spans) = &cv {
            assert!(spans[0].text_color.is_none());
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_cellvalue_clear_richtext_underline() {
        let mut cv = CellValue::RichText(vec![TextSpan {
            text: "test".to_string(),
            underline: Some(true),
            ..Default::default()
        }]);

        assert!(cv.clear_richtext_underline());
        if let CellValue::RichText(spans) = &cv {
            assert!(spans[0].underline.is_none());
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_cellvalue_clear_all_richtext_formatting() {
        let mut cv = CellValue::RichText(vec![
            TextSpan {
                text: "formatted".to_string(),
                bold: Some(true),
                italic: Some(true),
                text_color: Some("blue".to_string()),
                link: Some("https://example.com".to_string()),
                ..Default::default()
            },
            TextSpan::plain("plain"),
        ]);

        assert!(cv.clear_all_richtext_formatting());
        if let CellValue::RichText(spans) = &cv {
            assert!(spans[0].bold.is_none());
            assert!(spans[0].italic.is_none());
            assert!(spans[0].text_color.is_none());
            // Link preserved
            assert_eq!(spans[0].link, Some("https://example.com".to_string()));
            // Text preserved
            assert_eq!(spans[0].text, "formatted");
            assert_eq!(spans[1].text, "plain");
        } else {
            panic!("Expected RichText");
        }
    }

    #[test]
    fn test_cellvalue_richtext_to_plain_text() {
        let cv = CellValue::RichText(vec![
            TextSpan {
                text: "Hello ".to_string(),
                bold: Some(true),
                ..Default::default()
            },
            TextSpan::link("world", "https://example.com"),
            TextSpan::plain("!"),
        ]);

        let plain = cv.richtext_to_plain_text();
        assert_eq!(plain, CellValue::Text("Hello world!".to_string()));

        // Non-RichText returns original
        let text_cv = CellValue::Text("hello".to_string());
        let result = text_cv.clone().richtext_to_plain_text();
        assert_eq!(result, text_cv);
    }

    #[test]
    fn test_cellvalue_has_richtext_formatting() {
        // RichText with formatting
        let cv = CellValue::RichText(vec![TextSpan {
            text: "bold".to_string(),
            bold: Some(true),
            ..Default::default()
        }]);
        assert!(cv.has_richtext_formatting());

        // RichText with link only (link is formatting)
        let cv = CellValue::RichText(vec![TextSpan::link("link", "https://example.com")]);
        assert!(cv.has_richtext_formatting());

        // RichText with no formatting
        let cv = CellValue::RichText(vec![TextSpan::plain("plain")]);
        assert!(!cv.has_richtext_formatting());

        // Non-RichText
        let cv = CellValue::Text("hello".to_string());
        assert!(!cv.has_richtext_formatting());
    }
}
