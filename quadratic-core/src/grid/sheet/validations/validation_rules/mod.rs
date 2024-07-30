//! Data Validation for individual cells. This is held by Sheet and is used to
//! validate the value of a cell.

use crate::CellValue;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use validation_checkbox::ValidationCheckbox;
use validation_list::ValidationList;

use super::super::Sheet;

pub mod validation_checkbox;
pub mod validation_list;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum ValidationRule {
    #[default]
    None,
    List(ValidationList),
    Checkbox(ValidationCheckbox),
}

impl ValidationRule {
    /// Validate a CellValue against the validation rule.
    pub fn validate(&self, sheet: &Sheet, value: &CellValue) -> bool {
        match &self {
            ValidationRule::None => true,
            ValidationRule::List(list) => ValidationList::validate(sheet, list, value),
            ValidationRule::Checkbox(_) => ValidationCheckbox::validate(value),
        }
    }

    pub fn is_list(&self) -> bool {
        matches!(self, ValidationRule::List(_))
    }

    pub fn is_checkbox(&self) -> bool {
        matches!(self, ValidationRule::Checkbox(_))
    }

    pub fn allow_blank(&self) -> bool {
        match self {
            ValidationRule::None => true,
            ValidationRule::List(list) => list.ignore_blank,
            ValidationRule::Checkbox(_) => true,
        }
    }
}

#[cfg(test)]
mod tests {
    use validation_list::ValidationListSource;

    use crate::selection::Selection;

    use super::*;

    #[test]
    fn validate_list_strings() {
        let sheet = Sheet::test();
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string()]),
            ignore_blank: true,
            drop_down: false,
        };

        assert!(ValidationRule::List(list.clone())
            .validate(&sheet, &CellValue::Text("test".to_string())));
        assert!(!ValidationRule::List(list).validate(&sheet, &CellValue::Text("test2".to_string())));
    }

    #[test]
    fn validate_list_selection() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((0, 0).into(), "test");
        let selection = Selection::pos(0, 0, sheet.id);

        let list = ValidationList {
            source: ValidationListSource::Selection(selection),
            ignore_blank: true,
            drop_down: false,
        };
        let rule = ValidationRule::List(list);

        assert!(rule.validate(&sheet, &CellValue::Text("test".to_string())));
        assert!(!rule.validate(&sheet, &CellValue::Text("test2".to_string())));
    }

    #[test]
    fn validation_none() {
        let sheet = Sheet::test();
        let rule = ValidationRule::None;
        assert!(rule.validate(&sheet, &CellValue::Text("test".to_string())));
    }

    #[test]
    fn is_list() {
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string()]),
            ignore_blank: true,
            drop_down: false,
        };
        let rule = ValidationRule::List(list);
        assert!(rule.is_list());

        let checkbox = ValidationCheckbox {};
        let rule = ValidationRule::Checkbox(checkbox);
        assert!(!rule.is_list());
    }

    #[test]
    fn is_checkbox() {
        let checkbox = ValidationCheckbox {};
        let rule = ValidationRule::Checkbox(checkbox);
        assert!(rule.is_checkbox());

        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string()]),
            ignore_blank: true,
            drop_down: false,
        };
        let rule = ValidationRule::List(list);
        assert!(!rule.is_checkbox());
    }
}
