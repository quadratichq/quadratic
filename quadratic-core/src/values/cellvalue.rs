use std::{fmt, str::FromStr};

use bigdecimal::{BigDecimal, Zero};
use serde::{Deserialize, Serialize};

use super::{Duration, Instant, IsBlank};
use crate::{
    controller::{formatting::CellFmtArray, operation::Operation},
    grid::{NumericFormat, NumericFormatKind, RegionRef},
    CodeResult, Error, RunLengthEncoding,
};

// todo: fill this out
const CURRENCY_SYMBOLS: &str = "$€£¥";
const PERCENTAGE_SYMBOL: char = '%';

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
    Error(Box<Error>),
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
            CellValue::Number(n) => n.to_string(),
            CellValue::Logical(true) => "TRUE".to_string(),
            CellValue::Logical(false) => "FALSE".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => "[error]".to_string(),
        }
    }

    pub fn to_display(
        &self,
        numeric_format: Option<NumericFormat>,
        numeric_decimals: Option<i16>,
    ) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => s.to_string(),
            CellValue::Number(n) => {
                let is_percentage = numeric_format.as_ref().is_some_and(|numeric_format| {
                    numeric_format.kind == NumericFormatKind::Percentage
                });
                let result: BigDecimal = if is_percentage { n * 100 } else { n.clone() };
                let mut number = if let Some(decimals) = numeric_decimals {
                    result
                        .with_scale_round(decimals as i64, bigdecimal::RoundingMode::HalfUp)
                        .to_string()
                } else if is_percentage {
                    let s = result.to_string();
                    if s.contains('.') {
                        s.trim_end_matches('0').to_string()
                    } else {
                        s
                    }
                } else {
                    result.to_string()
                };
                if let Some(numeric_format) = numeric_format {
                    match numeric_format.kind {
                        NumericFormatKind::Currency => {
                            let mut currency = if let Some(symbol) = numeric_format.symbol {
                                symbol
                            } else {
                                String::from("")
                            };
                            currency.push_str(&number);
                            currency
                        }
                        NumericFormatKind::Percentage => {
                            number.push('%');
                            number
                        }
                        NumericFormatKind::Number => number.to_string(),
                        NumericFormatKind::Exponential => todo!(),
                    }
                } else {
                    number.to_string()
                }
            }
            CellValue::Logical(true) => "true".to_string(),
            CellValue::Logical(false) => "false".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => "[error]".to_string(),
        }
    }

    pub fn to_edit(&self) -> String {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Text(s) => s.to_string(),
            CellValue::Number(n) => n.to_string(),
            CellValue::Logical(true) => "true".to_string(),
            CellValue::Logical(false) => "false".to_string(),
            CellValue::Instant(_) => todo!("repr of Instant"),
            CellValue::Duration(_) => todo!("repr of Duration"),
            CellValue::Error(_) => "[error]".to_string(),
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
            | (CellValue::Blank, _) => return Ok(None),
        }))
    }

    /// Compares two values using a total ordering that propogates errors and
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

    pub fn from_string(s: &String, region: RegionRef) -> (CellValue, Vec<Operation>) {
        let mut ops = vec![];
        let value: CellValue;
        // check for currency
        if let Some((currency, number)) = CellValue::unpack_currency(s) {
            value = CellValue::Number(number);
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some(currency),
            };
            ops.push(Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
            ops.push(Operation::SetCellFormats {
                region,
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(Some(2), 1)),
            });
        } else if let Ok(bd) = BigDecimal::from_str(s) {
            value = CellValue::Number(bd);
        } else if let Some(percent) = CellValue::unpack_percentage(s) {
            value = CellValue::Number(percent);
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            };
            ops.push(Operation::SetCellFormats {
                region,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
        }
        // todo: include other types here
        else {
            value = CellValue::Text(s.to_string());
        }
        (value, ops)
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
        assert_eq!(cv.to_display(None, None), String::from("hello"));
    }

    #[test]
    fn test_cell_value_to_display_currency() {
        let cv = CellValue::Number(BigDecimal::from_str("123.1233").unwrap());
        assert_eq!(
            cv.to_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2)
            ),
            String::from("$123.12")
        );

        let cv = CellValue::Number(BigDecimal::from_str("123.1255").unwrap());
        assert_eq!(
            cv.to_display(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(String::from("$")),
                }),
                Some(2)
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
                Some(2)
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
            ),
            String::from("99.1224%")
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
}
