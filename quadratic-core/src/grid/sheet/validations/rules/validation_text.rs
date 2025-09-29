//! Text Validation. This is a validation rule that includes a list of possible scenarios:
//!
//! 1. Exactly: the cell value must match exactly one of the strings in the list.
//! 2. Contains: the cell value must contain one of the strings in the list.
//! 3. Not Contains: the cell value must not contain any of the strings in the list.
//! 4. Text Length: the cell value must have a length within the specified range.
//!
//! Rules 2, 3, and 4 may be combined in any way. All rules can be applied as case
//! sensitive or insensitive.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellValue;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum TextCase {
    CaseInsensitive(Vec<String>),
    CaseSensitive(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum TextMatch {
    Exactly(TextCase),

    Contains(TextCase),
    NotContains(TextCase),

    // this is inclusive, eg if min is 5, then 5 is valid
    TextLength { min: Option<i16>, max: Option<i16> },
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationText {
    pub ignore_blank: bool,
    pub text_match: Vec<TextMatch>,
}

impl ValidationText {
    // Validate a CellValue against the validation rule.
    pub(crate) fn validate(&self, value: Option<&CellValue>) -> bool {
        if let Some(value) = value {
            match value {
                CellValue::Text(text) => {
                    for match_rule in &self.text_match {
                        match match_rule {
                            TextMatch::Exactly(TextCase::CaseInsensitive(cases)) => {
                                if cases
                                    .iter()
                                    .any(|case| case.to_lowercase() == text.to_lowercase())
                                {
                                    continue;
                                } else {
                                    return false;
                                }
                            }
                            TextMatch::Exactly(TextCase::CaseSensitive(cases)) => {
                                if cases.iter().any(|case| case == text) {
                                    continue;
                                } else {
                                    return false;
                                }
                            }
                            TextMatch::Contains(TextCase::CaseInsensitive(cases)) => {
                                if cases
                                    .iter()
                                    .any(|case| text.to_lowercase().contains(&case.to_lowercase()))
                                {
                                    continue;
                                } else {
                                    return false;
                                }
                            }
                            TextMatch::Contains(TextCase::CaseSensitive(cases)) => {
                                if cases.iter().any(|case| text.contains(case)) {
                                    continue;
                                } else {
                                    return false;
                                }
                            }
                            TextMatch::NotContains(TextCase::CaseInsensitive(cases)) => {
                                if cases
                                    .iter()
                                    .all(|case| !text.to_lowercase().contains(&case.to_lowercase()))
                                {
                                    continue;
                                } else {
                                    return false;
                                }
                            }
                            TextMatch::NotContains(TextCase::CaseSensitive(cases)) => {
                                if cases.iter().all(|case| !text.contains(case)) {
                                    continue;
                                } else {
                                    return false;
                                }
                            }
                            TextMatch::TextLength { min, max } => {
                                let text_len = text.len();
                                if let Some(min) = min
                                    && text_len < *min as usize {
                                        return false;
                                    }
                                if let Some(max) = max
                                    && text_len > *max as usize {
                                        return false;
                                    }
                                return true;
                            }
                        }
                    }
                    true
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

    use super::*;

    #[test]
    fn validate_exactly() {
        let v = ValidationText {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![TextMatch::Exactly(TextCase::CaseSensitive(vec![
                "hello".to_string(),
                "world".to_string(),
            ]))],
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(!v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![TextMatch::Exactly(TextCase::CaseInsensitive(vec![
                "hello".to_string(),
                "world".to_string(),
            ]))],
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("not in list".to_string()))));
        assert!(!v.validate(None));
    }

    #[test]
    fn validate_contains() {
        let v = ValidationText {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![TextMatch::Contains(TextCase::CaseSensitive(vec![
                "hello".to_string(),
                "world".to_string(),
            ]))],
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("hello worldly".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("wide world".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(!v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![TextMatch::Contains(TextCase::CaseInsensitive(vec![
                "hello".to_string(),
                "world".to_string(),
            ]))],
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("Hello worldly".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("not in list".to_string()))));
        assert!(!v.validate(None));
    }

    #[test]
    fn validate_not_contains() {
        let v = ValidationText {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![TextMatch::NotContains(TextCase::CaseSensitive(vec![
                "hello".to_string(),
                "world".to_string(),
            ]))],
        };
        assert!(!v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("hello worldly".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("wide world".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(!v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![TextMatch::NotContains(TextCase::CaseInsensitive(vec![
                "hello".to_string(),
                "world".to_string(),
            ]))],
        };
        assert!(!v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("Hello worldly".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("not in list".to_string()))));
        assert!(!v.validate(None));
    }

    #[test]
    fn validate_contains_not_contains() {
        let v = ValidationText {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![
                TextMatch::Contains(TextCase::CaseSensitive(vec!["hello".to_string()])),
                TextMatch::NotContains(TextCase::CaseSensitive(vec!["world".to_string()])),
            ],
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("hello dolly".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("hello worldly".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("wide world".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(!v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![
                TextMatch::Contains(TextCase::CaseInsensitive(vec!["hello".to_string()])),
                TextMatch::NotContains(TextCase::CaseInsensitive(vec!["world".to_string()])),
            ],
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("hello there".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("Hello".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("Hello worldly".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("Hello Worldly".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("world".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("World".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("not in list".to_string()))));
        assert!(!v.validate(None));
    }

    #[test]
    fn validate_text_length() {
        let v = ValidationText {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            text_match: vec![TextMatch::TextLength {
                min: Some(5),
                max: Some(10),
            }],
        };
        assert!(!v.validate(Some(&CellValue::Text("".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("1234".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("12345".to_string()))));
        assert!(v.validate(Some(&CellValue::Text("1234567890".to_string()))));
        assert!(!v.validate(Some(&CellValue::Text("12345678901".to_string()))));
        assert!(!v.validate(None));
    }
}
