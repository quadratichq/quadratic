use rust_decimal::prelude::*;
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
                        NumberRange::Equal(equal) => equal.contains(&n),
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
                CellValue::Blank => self.ignore_blank,
                CellValue::Text(text) => text.is_empty() && self.ignore_blank,
                _ => false,
            }
        } else {
            self.ignore_blank
        }
    }
}

#[cfg(test)]
mod tests {
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
        assert!(rule.validate(Some(&CellValue::Number(10.into()))));
    }

    #[test]
    fn validate_number_less_than() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(None, Some(9f64))],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Number(10.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(10.into()))));
        assert!(rule.validate(Some(&CellValue::Number(9.into()))));
        assert!(rule.validate(Some(&CellValue::Number(8.into()))));
    }

    #[test]
    fn validate_number_greater_than() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(Some(9f64), None)],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Number(10.into()))));
        assert!(rule.validate(Some(&CellValue::Number(9.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(8.into()))));
    }

    #[test]
    fn validate_number_equal_to() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Equal(vec![9f64, -10f64])],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Number(10.into()))));
        assert!(rule.validate(Some(&CellValue::Number(9.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(8.into()))));
        assert!(rule.validate(Some(&CellValue::Number((-10).into()))));
    }

    #[test]
    fn validate_number_not_equal_to() {
        let rule = ValidationNumber {
            ranges: vec![NumberRange::NotEqual(vec![9f64, -10f64])],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Number(10.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(9.into()))));
        assert!(rule.validate(Some(&CellValue::Number(8.into()))));
        assert!(!rule.validate(Some(&CellValue::Number((-10).into()))));
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
        assert!(!rule.validate(Some(&CellValue::Number(0.into()))));
        assert!(rule.validate(Some(&CellValue::Number(1.into()))));
        assert!(rule.validate(Some(&CellValue::Number(10.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(11.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(19.into()))));
        assert!(rule.validate(Some(&CellValue::Number(20.into()))));
        assert!(rule.validate(Some(&CellValue::Number(30.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(31.into()))));

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(Some(1f64), None)],
            ..Default::default()
        };
        assert!(!rule.validate(Some(&CellValue::Number(0.into()))));
        assert!(rule.validate(Some(&CellValue::Number(1.into()))));
        assert!(rule.validate(Some(&CellValue::Number(10.into()))));

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(None, Some(10f64))],
            ..Default::default()
        };
        assert!(rule.validate(Some(&CellValue::Number(0.into()))));
        assert!(rule.validate(Some(&CellValue::Number(1.into()))));
        assert!(!rule.validate(Some(&CellValue::Number(11.into()))));
    }
}
