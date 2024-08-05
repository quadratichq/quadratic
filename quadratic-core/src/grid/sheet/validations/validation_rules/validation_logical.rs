use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellValue;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationLogical {
    pub show_checkbox: bool,
    pub ignore_blank: bool,
}

impl ValidationLogical {
    // Validate a CellValue against the validation rule.
    pub fn validate(&self, value: Option<&CellValue>) -> bool {
        if let Some(value) = value {
            matches!(value, CellValue::Logical(_))
        } else {
            self.ignore_blank
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_logical() {
        let logical = ValidationLogical::default();
        assert!(logical.validate(Some(&CellValue::Logical(true))));
        assert!(logical.validate(Some(&CellValue::Logical(false))));
        assert!(!logical.validate(Some(&CellValue::Number(1.into()))));
        assert!(!logical.validate(Some(&CellValue::Text("test".to_string()))));
        assert!(!logical.validate(None));
    }

    #[test]
    fn validate_logical_ignore_blank() {
        let logical = ValidationLogical {
            ignore_blank: true,
            ..Default::default()
        };
        assert!(logical.validate(None));
        assert!(logical.validate(Some(&CellValue::Logical(true))));
        assert!(logical.validate(Some(&CellValue::Logical(false))));
        assert!(!logical.validate(Some(&CellValue::Number(1.into()))));
        assert!(!logical.validate(Some(&CellValue::Text("test".to_string()))));
    }
}
