use bigdecimal::ToPrimitive;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{grid::Sheet, CellValue, Pos};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum NumberEntry {
    Number(f64),
    Cell(Pos),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationNumber {
    pub ignore_blank: bool,

    // greater_than_or_equal_to is just a flag using greater_than for the
    // comparison.
    pub greater_than: Option<NumberEntry>,
    pub greater_than_or_equal_to: bool,

    // less_than_or_equal_to is just a flag using less_than for the
    // comparison.
    pub less_than: Option<NumberEntry>,
    pub less_than_or_equal_to: bool,

    // not_equal_to is just a flag using equal_to for the comparison.
    pub equal_to: Option<NumberEntry>,
    pub not_equal_to: bool,
}

impl ValidationNumber {
    // Validate a CellValue against the validation rule.
    pub fn validate(&self, sheet: &Sheet, value: Option<&CellValue>) -> bool {
        if let Some(cell_value) = value {
            match cell_value {
                CellValue::Number(n) => {
                    let n = n.to_f64().unwrap_or(0f64);

                    if let Some(comparison) =
                        self.greater_than
                            .as_ref()
                            .map(|greater_than| match greater_than {
                                NumberEntry::Number(value) => *value,
                                NumberEntry::Cell(pos) => {
                                    if let Some(CellValue::Number(value)) =
                                        sheet.cell_value_ref(*pos)
                                    {
                                        value.to_f64().unwrap_or(0f64)
                                    } else {
                                        0f64
                                    }
                                }
                            })
                    {
                        if self.greater_than_or_equal_to {
                            if !(n >= comparison) {
                                return false;
                            }
                        } else {
                            if !(n > comparison) {
                                return false;
                            }
                        }
                    }

                    if let Some(comparison) =
                        self.less_than.as_ref().map(|less_than| match less_than {
                            NumberEntry::Number(value) => *value,
                            NumberEntry::Cell(pos) => {
                                if let Some(CellValue::Number(value)) = sheet.cell_value_ref(*pos) {
                                    value.to_f64().unwrap_or(0f64)
                                } else {
                                    0f64
                                }
                            }
                        })
                    {
                        if self.less_than_or_equal_to {
                            if !(n <= comparison) {
                                return false;
                            }
                        } else {
                            if !(n < comparison) {
                                return false;
                            }
                        }
                    }

                    if let Some(comparison) =
                        self.equal_to.as_ref().map(|equal_to| match equal_to {
                            NumberEntry::Number(value) => *value,
                            NumberEntry::Cell(pos) => {
                                if let Some(CellValue::Number(value)) = sheet.cell_value_ref(*pos) {
                                    value.to_f64().unwrap_or(0f64)
                                } else {
                                    0f64
                                }
                            }
                        })
                    {
                        if self.not_equal_to {
                            if n == comparison {
                                return false;
                            }
                        } else if n != comparison {
                            return false;
                        }
                    }

                    return true;
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
        let sheet = Sheet::test();

        let rule = ValidationNumber {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(rule.validate(&sheet, None));

        let rule = ValidationNumber {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(!rule.validate(&sheet, None));
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
    }

    #[test]
    fn validate_number_less_than() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            less_than: Some(NumberEntry::Number(9f64)),
            ..Default::default()
        };
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
            less_than: Some(NumberEntry::Cell((0, 0).into())),
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(11).into()))
        ));
    }

    #[test]
    fn validate_number_less_than_or_equal_to() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            less_than: Some(NumberEntry::Number(9f64)),
            less_than_or_equal_to: true,
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));

        sheet.set_cell_value(
            (0, 0).into(),
            CellValue::Number(BigDecimal::from(10).into()),
        );
        let rule = ValidationNumber {
            less_than: Some(NumberEntry::Cell((0, 0).into())),
            less_than_or_equal_to: true,
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(11).into()))
        ));
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
    }

    #[test]
    fn validate_number_greater_than() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            greater_than: Some(NumberEntry::Number(9f64)),
            ..Default::default()
        };
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));

        // greater than 10 (0,0)'s value
        sheet.set_cell_value(
            (0, 0).into(),
            CellValue::Number(BigDecimal::from(10).into()),
        );
        let rule = ValidationNumber {
            greater_than: Some(NumberEntry::Cell((0, 0).into())),
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
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
    }

    #[test]
    fn validate_number_greater_than_or_equal_to() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            greater_than: Some(NumberEntry::Number(9f64)),
            greater_than_or_equal_to: true,
            ..Default::default()
        };
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(8).into()))));

        // greater than or equal to 10 (0,0)'s value
        sheet.set_cell_value(
            (0, 0).into(),
            CellValue::Number(BigDecimal::from(10).into()),
        );
        let rule = ValidationNumber {
            greater_than: Some(NumberEntry::Cell((0, 0).into())),
            greater_than_or_equal_to: true,
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
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
    }

    #[test]
    fn validate_number_equal_to() {
        let mut sheet = Sheet::test();

        let rule = ValidationNumber {
            equal_to: Some(NumberEntry::Number(9f64)),
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
            equal_to: Some(NumberEntry::Cell((0, 0).into())),
            ..Default::default()
        };
        assert!(!rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(11).into()))
        ));
        assert!(rule.validate(
            &sheet,
            Some(&CellValue::Number(BigDecimal::from(10).into()))
        ));
        assert!(!rule.validate(&sheet, Some(&CellValue::Number(BigDecimal::from(9).into()))));
    }
}
