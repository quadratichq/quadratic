use std::{fmt, str::FromStr};

use bigdecimal::{BigDecimal, Signed, ToPrimitive, Zero};
use serde::{Deserialize, Serialize};

use super::{Duration, Instant, IsBlank};
use crate::{
    controller::operations::operation::Operation,
    grid::{
        formatting::CellFmtArray, CodeCellLanguage, NumericDecimals, NumericFormat,
        NumericFormatKind, Sheet,
    },
    CodeResult, Pos, RunError, RunLengthEncoding, SheetRect,
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
            CellValue::Code(_) => "python",
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
            CellValue::Code(_) => todo!("repr of python"),
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

    pub fn to_display(
        &self,
        numeric_format: Option<NumericFormat>,
        numeric_decimals: Option<i16>,
        numeric_commas: Option<bool>,
    ) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => s.to_string(),
            CellValue::Html(s) => s.to_string(),
            CellValue::Number(n) => {
                let numeric_format = numeric_format.unwrap_or_default();
                let use_commas = numeric_commas.is_some_and(|c| c)
                    || (numeric_commas.is_none()
                        && numeric_format.kind == NumericFormatKind::Currency);
                let result: BigDecimal = if numeric_format.kind == NumericFormatKind::Percentage {
                    n * 100
                } else {
                    n.clone()
                };
                let mut number = if numeric_format.kind == NumericFormatKind::Exponential {
                    let num = result.to_f64().unwrap_or_default();
                    if let Some(decimals) = numeric_decimals {
                        format!("{:.precision$e}", num, precision = decimals as usize)
                    } else {
                        format!("{:.e}", num)
                    }
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
            CellValue::Logical(true) => "true".to_string(),
            CellValue::Logical(false) => "false".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => "[error]".to_string(),

            // this should not render
            CellValue::Code(_) => String::new(),
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

    pub fn strip_percentage(value: &str) -> &str {
        value.strip_suffix(PERCENTAGE_SYMBOL).unwrap_or(value)
    }

    pub fn unpack_currency(s: &str) -> Option<(String, BigDecimal)> {
        if s.is_empty() {
            return None;
        }

        for char in CURRENCY_SYMBOLS.chars() {
            if let Some(stripped) = s.strip_prefix(char) {
                if let Ok(bd) = BigDecimal::from_str(stripped) {
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
            | (CellValue::Html(_), _)
            | (CellValue::Code(_), _)
            | (CellValue::Blank, _) => return Ok(None),
        }))
    }

    /// Compares two values using a total ordering that propagates errors and
    /// converts blanks to zeros.
    #[allow(clippy::should_implement_trait)]
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
                CellValue::Html(_) => 7,
                CellValue::Code(_) => 8,
            }
        }

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

    /// Generic conversion from &str to CellValue
    /// This would normally be an implementation of FromStr, but we are holding
    /// off as we want formatting to happen with conversions in most places
    pub fn to_cell_value(value: &str) -> CellValue {
        let parsed = CellValue::strip_percentage(CellValue::strip_currency(value)).trim();
        let number = BigDecimal::from_str(parsed);
        let is_true = parsed.eq_ignore_ascii_case("true");
        let is_false = parsed.eq_ignore_ascii_case("false");
        let is_bool = is_true || is_false;

        match (number, is_bool) {
            (Ok(number), false) => CellValue::Number(number),
            (_, true) => CellValue::Logical(is_true),
            _ => CellValue::Text(String::from(value)),
        }
    }

    // todo: this needs to be reworked under the new paradigm
    /// Converts a string to a CellValue, updates number formatting, and returns reverse Ops
    pub fn from_string(s: &String, pos: Pos, sheet: &mut Sheet) -> (CellValue, Vec<Operation>) {
        let mut ops = vec![];
        let value: CellValue;
        let sheet_rect = SheetRect::single_pos(pos, sheet.id);

        // check for currency
        if let Some((currency, number)) = CellValue::unpack_currency(s) {
            value = CellValue::Number(number);
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

            // only change decimals if it hasn't already been set
            if sheet.get_formatting_value::<NumericDecimals>(pos).is_none() {
                sheet.set_formatting_value::<NumericDecimals>(pos, Some(2));
                ops.push(Operation::SetCellFormats {
                    sheet_rect,
                    attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(Some(2), 1)),
                });
            }
        } else if let Ok(bd) = BigDecimal::from_str(s) {
            value = CellValue::Number(bd);
        } else if let Some(percent) = CellValue::unpack_percentage(s) {
            value = CellValue::Number(percent);
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

        // todo: probably use a crate here to detect html
        } else if s.to_lowercase().starts_with("<html>") || s.to_lowercase().starts_with("<div>") {
            value = CellValue::Html(s.to_string());
        }
        // todo: include other types here
        else {
            value = CellValue::Text(s.to_string());
        }
        (value, ops)
    }

    pub fn is_html(&self) -> bool {
        matches!(self, CellValue::Html(_))
    }
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::{
        grid::{NumericFormat, NumericFormatKind},
        CellValue,
    };

    #[test]
    fn test_cell_value_to_display_text() {
        let cv = CellValue::Text(String::from("hello"));
        assert_eq!(cv.to_display(None, None, None), String::from("hello"));
    }

    #[test]
    fn test_cell_value_to_display_currency() {
        let cv = CellValue::Number(BigDecimal::from_str("123123.1233").unwrap());
        assert_eq!(
            cv.to_display(
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
            cv.to_display(
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
            cv.to_display(
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
            cv.to_display(
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
            cv.to_display(
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
            cv.to_display(
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
            cv.to_display(
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
    fn test_cell_value_to_display_percentage() {
        let cv = CellValue::Number(BigDecimal::from_str("0.015").unwrap());
        assert_eq!(
            cv.to_display(
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
            cv.to_display(
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
            cv.to_display(
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
        assert_eq!(
            value.to_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None
                }),
                None,
                None
            ),
            "9.817293719273972e19"
        );
        assert_eq!(
            value.to_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None
                }),
                Some(2),
                None
            ),
            "9.82e19"
        );
    }

    #[test]
    fn test_with_commas() {
        let value = BigDecimal::from_str("123123123");
        assert_eq!(CellValue::with_commas(value.unwrap()), "123,123,123");

        let value = BigDecimal::from_str("123123123.123456");
        assert_eq!(CellValue::with_commas(value.unwrap()), "123,123,123.123456");

        let value = BigDecimal::from_str("-123123123.123456");
        assert_eq!(
            CellValue::with_commas(value.unwrap()),
            "-123,123,123.123456"
        );
    }
}
