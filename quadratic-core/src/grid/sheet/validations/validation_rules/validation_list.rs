use itertools::Itertools;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{a1::A1Selection, grid::Sheet, CellValue};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum ValidationListSource {
    Selection(A1Selection),
    List(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationList {
    pub source: ValidationListSource,
    pub ignore_blank: bool,
    pub drop_down: bool,
}

impl ValidationList {
    /// Compares all CellValues within a Selection to the provided CellValue.
    fn validate_selection(sheet: &Sheet, selection: &A1Selection, value: &CellValue) -> bool {
        if let Some(values) = sheet.selection_values(selection, None, false, true) {
            values.iter().any(|(_, search)| *search == value)
        } else {
            false
        }
    }

    /// Validates a CellValue against a ValidationList.
    pub(crate) fn validate(&self, sheet: &Sheet, value: Option<&CellValue>) -> bool {
        if let Some(value) = value {
            match &self.source {
                ValidationListSource::Selection(selection) => {
                    ValidationList::validate_selection(sheet, selection, value)
                }
                ValidationListSource::List(list) => list.contains(&value.to_string()),
            }
        } else {
            self.ignore_blank
        }
    }

    /// Gets the drop down list.
    pub fn to_drop_down(&self, sheet: &Sheet) -> Option<Vec<String>> {
        if !self.drop_down {
            return None;
        }
        match &self.source {
            ValidationListSource::Selection(selection) => {
                let values = sheet.selection_values(selection, None, false, false)?;
                Some(
                    values
                        .values()
                        .map(|value| value.to_display())
                        .unique()
                        .collect(),
                )
            }
            ValidationListSource::List(ref list) => Some(list.iter().cloned().unique().collect()),
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn validate_list_strings() {
        let sheet = Sheet::test();
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string()]),
            ignore_blank: true,
            drop_down: true,
        };

        assert!(list.validate(&sheet, Some(&CellValue::Text("test".to_string()))));
        assert!(!list.validate(&sheet, Some(&CellValue::Text("test2".to_string()))));
        assert!(list.validate(&sheet, None));
    }

    #[test]
    fn validate_list_selection() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), "test");
        let selection = A1Selection::test_a1("A1");

        assert!(ValidationList::validate_selection(
            &sheet,
            &selection,
            &CellValue::Text("test".to_string())
        ));

        assert!(!ValidationList::validate_selection(
            &sheet,
            &selection,
            &CellValue::Text("test2".to_string())
        ));

        let list = ValidationList {
            source: ValidationListSource::Selection(selection),
            ignore_blank: false,
            drop_down: true,
        };
        assert!(!list.validate(&sheet, None));
    }

    #[test]
    fn to_drop_down_strings() {
        let sheet = Sheet::test();
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string(), "test".to_string()]),
            ignore_blank: true,
            drop_down: true,
        };

        assert_eq!(list.to_drop_down(&sheet), Some(vec!["test".to_string()]));
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string(), "test2".to_string()]),
            ignore_blank: true,
            drop_down: false,
        };
        assert_eq!(list.to_drop_down(&sheet), None);
    }

    #[test]
    fn to_drop_down_values() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), "test");
        sheet.set_cell_value((1, 2).into(), "test2");
        let selection = A1Selection::test_a1("A1:A2");

        let list = ValidationList {
            source: ValidationListSource::Selection(selection),
            ignore_blank: true,
            drop_down: true,
        };

        assert_eq!(
            list.to_drop_down(&sheet),
            Some(vec!["test".to_string(), "test2".to_string()])
        );
    }
}
