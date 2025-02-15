use bigdecimal::ToPrimitive;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellValue;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum NumberRange {
    Range(Option<f64>, Option<f64>),
    Equal(Vec<f64>),
    NotEqual(Vec<f64>),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationNumber {
    pub ignore_blank: bool,

    // if any range is valid, then the number is valid.
    pub ranges: Vec<NumberRange>,
}

impl ValidationNumber {
    // Validate a CellValue against the validation rule.
    pub fn validate(&self, value: Option<&CellValue>) -> bool {
        if let Some(cell_value) = value {
            match cell_value {
                CellValue::Number(n) => {
                    let n = n.to_f64().unwrap_or(0f64);

                    if self.ranges.is_empty() {
                        return true;
                    }

                    // we're looking for one valid range.
                    self.ranges.iter().any(|range| match range {
                        NumberRange::Equal(equal) => equal.iter().any(|v| n == *v),
                        NumberRange::Range(min, max) => {
                            if let Some(min) = min.as_ref() {
                                if n < *min {
                                    return false;
                                }
                            }
                            if let Some(max) = max.as_ref() {
                                if n > *max {
                                    return false;
                                }
                            }
                            true
                        }
                        NumberRange::NotEqual(not_equal) => not_equal.iter().all(|v| n != *v),
                    })
                }
                _ => false,
            }
        } else {
            self.ignore_blank
        }
    }
}

#[cfg(test)]
mod tests {
    use bigdecimal::BigDecimal;

    use super::*;

    #[test]
    fn validate_number_ignore_blank() {
        let rule = ValidationNumber {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(rule.validate(None));

        let rule = ValidationNumber {
            ignore_blank: false,
            ..Default::default()
        };
        assert!(!rule.validate(None));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));
    }

    #[test]
    fn validate_number_less_than() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(None, Some(9f64))],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(9)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(8)))));
    }

    #[test]
    fn validate_number_greater_than() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(Some(9f64), None)],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(9)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(8)))));
    }

    #[test]
    fn validate_number_equal_to() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Equal(vec![9f64, -10f64])],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(9)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(8)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(-10)))));
    }

    #[test]
    fn validate_number_not_equal_to() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::NotEqual(vec![9f64, -10f64])],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(9)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(8)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(-10)))));
    }

    #[test]
    fn validate_ranges() {
        let rule = ValidationNumber {
            ranges: vec![
                NumberRange::Range(Some(1f64), Some(10f64)),
                NumberRange::Range(Some(20f64), Some(30f64)),
            ],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(0)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(1)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(11)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(19)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(20)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(30)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(31)))));

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(Some(1f64), None)],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(0)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(1)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(10)))));

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(None, Some(10f64))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(0)))));
        assert!(rule.validate(Some(&CellValue::Number(BigDecimal::from(1)))));
        assert!(!rule.validate(Some(&CellValue::Number(BigDecimal::from(11)))));
    }
}
