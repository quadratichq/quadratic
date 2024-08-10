use bigdecimal::ToPrimitive;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{grid::Sheet, CellValue, Pos};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum NumberEntry {
    Number(f64),
    Cell(Pos),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum NumberInclusive {
    Inclusive(NumberEntry),
    Exclusive(NumberEntry),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum NumberRange {
    Range(Option<NumberInclusive>, Option<NumberInclusive>),
    Equal(NumberEntry),
    NotEqual(NumberEntry),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationNumber {
    pub ignore_blank: bool,

    // if any range is valid, then the number is valid.
    pub ranges: Vec<NumberRange>,
}

impl ValidationNumber {
    fn validate_number_inclusive(sheet: &Sheet, entry: &NumberInclusive) -> (f64, bool) {
        match entry {
            NumberInclusive::Inclusive(entry) => (Self::validate_number_entry(sheet, entry), true),
            NumberInclusive::Exclusive(entry) => (Self::validate_number_entry(sheet, entry), false),
        }
    }

    fn validate_number_entry(sheet: &Sheet, entry: &NumberEntry) -> f64 {
        match entry {
            NumberEntry::Number(n) => *n,
            NumberEntry::Cell(pos) => {
                if let Some(cell_value) = sheet.cell_value_ref(*pos) {
                    if let CellValue::Number(n) = cell_value {
                        n.to_f64().unwrap_or(0f64)
                    } else {
                        0f64
                    }
                } else {
                    0f64
                }
            }
        }
    }

    // Validate a CellValue against the validation rule.
    pub fn validate(&self, sheet: &Sheet, value: Option<&CellValue>) -> bool {
        if let Some(cell_value) = value {
            match cell_value {
                CellValue::Number(n) => {
                    let n = n.to_f64().unwrap_or(0f64);

                    if self.ranges.is_empty() {
                        return true;
                    }

                    // we're looking for one valid range.
                    self.ranges.iter().any(|range| match range {
                        NumberRange::Equal(entry) => {
                            let equal = Self::validate_number_entry(sheet, entry);
                            n == equal
                        }
                        NumberRange::Range(min, max) => {
                            if let Some(min) = min.as_ref() {
                                let (min, inclusive) = Self::validate_number_inclusive(sheet, min);
                                if inclusive {
                                    if n < min {
                                        return false;
                                    }
                                } else {
                                    if n <= min {
                                        return false;
                                    }
                                }
                            }
                            if let Some(max) = max.as_ref() {
                                let (max, inclusive) = Self::validate_number_inclusive(sheet, max);
                                if inclusive {
                                    if n > max {
                                        return false;
                                    }
                                } else {
                                    if n >= max {
                                        return false;
                                    }
                                }
                            }
                            true
                        }
                        NumberRange::NotEqual(entry) => {
                            let not_equal = Self::validate_number_entry(sheet, entry);
                            n != not_equal
                        }
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
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn validate_number_ignore_blank() {
        let sheet = Sheet::test();

        let rule = ValidationNumber {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(rule.validate(&sheet, None));

        let rule = ValidationNumber {
            ignore_blank: false,
            ..Default::default()
        };
        assert!(!rule.validate(&sheet, None));
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
    }

    #[test]
    #[parallel]
    fn validate_number_less_than() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(
                None,
                Some(NumberInclusive::Inclusive(NumberEntry::Number(9f64))),
            )],
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(
                None,
                Some(NumberInclusive::Exclusive(NumberEntry::Number(9f64))),
            )],
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));

        sheet.set_cell_value(
            (0, 0).into(),
            CellValue::Number(BigDecimal::from(10).into()),
        );
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(
                None,
                Some(NumberInclusive::Inclusive(NumberEntry::Cell((0, 0).into()))),
            )],
            ..Default::default()
        };
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(11).into()))
        ));

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(
                None,
                Some(NumberInclusive::Exclusive(NumberEntry::Cell((0, 0).into()))),
            )],
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));
    }

    #[test]
    #[parallel]
    fn validate_number_greater_than() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(
                Some(NumberInclusive::Inclusive(NumberEntry::Number(9f64))),
                None,
            )],
            ..Default::default()
        };
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(
                Some(NumberInclusive::Exclusive(NumberEntry::Number(9f64))),
                None,
            )],
            ..Default::default()
        };
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));

        // greater than 10 (0,0)'s value
        sheet.set_cell_value(
            (0, 0).into(),
            CellValue::Number(BigDecimal::from(10).into()),
        );
        let rule = ValidationNumber {
            ranges: vec![NumberRange::Range(
                Some(NumberInclusive::Inclusive(NumberEntry::Cell((0, 0).into()))),
                None,
            )],
            ..Default::default()
        };
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(11).into()))
        ));
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(11).into()))
        ));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
    }

    #[test]
    #[parallel]
    fn validate_number_equal_to() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            ranges: vec![NumberRange::Equal(NumberEntry::Number(9f64))],
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));

        // equal to 10 (0,0)'s value
        sheet.set_cell_value(
            (0, 0).into(),
            CellValue::Number(BigDecimal::from(10).into()),
        );
        let rule = ValidationNumber {
            ignore_blank: false,
            ranges: vec![NumberRange::NotEqual(NumberEntry::Cell((0, 0).into()))],
            ..Default::default()
        };
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(11).into()))
        ));
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
    }
}
