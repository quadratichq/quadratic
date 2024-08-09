use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellValue;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationText {
    pub ignore_blank: bool,
    pub exactly: Option<String>,
    pub contains: Option<String>,
    pub not_contains: Option<String>,
}

impl ValidationText {
    // Validate a CellValue against the validation rule.
    pub fn validate(&self, value: Option<&CellValue>) -> bool {
        if let Some(value) = value {
            match value {
                CellValue::Text(text) => {
                    if let Some(exactly) = &self.exactly {
                        text == exactly
                    } else if let Some(contains) = &self.contains {
                        text.contains(contains)
                    } else if let Some(not_contains) = &self.not_contains {
                        !text.contains(not_contains)
                    } else {
                        true
                    }
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
    fn validate() {
        let v = ValidationText::default();
        assert!(v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            exactly: Some("hello".to_string()),
            contains: None,
            not_contains: None,
        };
        assert!(!v.validate(None));

        let v = ValidationText {
            ignore_blank: false,
            exactly: Some("hello".to_string()),
            contains: None,
            not_contains: None,
        };
        assert!(!v.validate(Some(&CellValue::Text("world".to_string()))));

        let v = ValidationText {
            ignore_blank: false,
            exactly: Some("hello".to_string()),
            contains: None,
            not_contains: None,
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));

        let v = ValidationText {
            ignore_blank: false,
            exactly: None,
            contains: Some("hello".to_string()),
            not_contains: None,
        };
        assert!(!v.validate(Some(&CellValue::Text("world".to_string()))));

        let v = ValidationText {
            ignore_blank: false,
            exactly: None,
            contains: Some("hello".to_string()),
            not_contains: None,
        };
        assert!(v.validate(Some(&CellValue::Text("hello".to_string()))));

        let v = ValidationText {
            ignore_blank: false,
            exactly: None,
            contains: None,
            not_contains: Some("hello".to_string()),
        };
        assert!(!v.validate(Some(&CellValue::Text("hello".to_string()))));

        let v = ValidationText {
            ignore_blank: false,
            exactly: None,
            contains: None,
            not_contains: Some("hello".to_string()),
        };
        assert!(v.validate(Some(&CellValue::Text("world".to_string()))));
    }
}
