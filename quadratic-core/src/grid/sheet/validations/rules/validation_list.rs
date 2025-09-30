use itertools::Itertools;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    CellValue,
    a1::{A1Context, A1Selection},
    grid::Sheet,
};

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
    fn validate_selection(
        sheet: &Sheet,
        selection: &A1Selection,
        value: CellValue,
        a1_context: &A1Context,
    ) -> bool {
        if let Some(values) = sheet.selection_values(selection, None, false, true, true, a1_context)
        {
            values.iter().any(|(_, search)| *search == &value)
        } else {
            false
        }
    }

    /// Validates a CellValue against a ValidationList.
    pub(crate) fn validate(
        &self,
        sheet: &Sheet,
        value: Option<CellValue>,
        a1_context: &A1Context,
    ) -> bool {
        if let Some(value) = value {
            // handle cases of blank text
            match &value {
                CellValue::Blank => return self.ignore_blank,
                CellValue::Text(text) => {
                    if text.is_empty() && self.ignore_blank {
                        return true;
                    }
                }
                _ => {}
            }

            match &self.source {
                ValidationListSource::Selection(selection) => {
                    ValidationList::validate_selection(sheet, selection, value, a1_context)
                }
                ValidationListSource::List(list) => list.contains(&value.to_string()),
            }
        } else {
            self.ignore_blank
        }
    }

    /// Gets the drop down list.
    pub(crate) fn to_drop_down(
        &self,
        sheet: &Sheet,
        a1_context: &A1Context,
    ) -> Option<Vec<String>> {
        if !self.drop_down {
            return None;
        }
        match &self.source {
            ValidationListSource::Selection(selection) => {
                let values =
                    sheet.selection_values(selection, None, false, false, true, a1_context)?;
                Some(
                    values
                        .values()
                        .map(|value| value.to_display())
                        .unique()
                        .collect(),
                )
            }
            ValidationListSource::List(list) => Some(list.iter().cloned().unique().collect()),
        }
    }
}

#[cfg(test)]
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

        let a1_context = sheet.expensive_make_a1_context();

        assert!(list.validate(
            &sheet,
            Some(CellValue::Text("test".to_string())),
            &a1_context
        ));
        assert!(!list.validate(
            &sheet,
            Some(CellValue::Text("test2".to_string())),
            &a1_context
        ));
        assert!(list.validate(&sheet, None, &a1_context));
    }

    #[test]
    fn validate_list_selection() {
        let mut sheet = Sheet::test();
        sheet.set_value((1, 1).into(), "test");
        let selection = A1Selection::test_a1("A1");

        let a1_context = sheet.expensive_make_a1_context();

        assert!(ValidationList::validate_selection(
            &sheet,
            &selection,
            CellValue::Text("test".to_string()),
            &a1_context
        ));

        assert!(!ValidationList::validate_selection(
            &sheet,
            &selection,
            CellValue::Text("test2".to_string()),
            &a1_context
        ));

        let list = ValidationList {
            source: ValidationListSource::Selection(selection),
            ignore_blank: false,
            drop_down: true,
        };
        assert!(!list.validate(&sheet, None, &a1_context));
    }

    #[test]
    fn to_drop_down_strings() {
        let sheet = Sheet::test();
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string(), "test".to_string()]),
            ignore_blank: true,
            drop_down: true,
        };

        let a1_context = sheet.expensive_make_a1_context();

        assert_eq!(
            list.to_drop_down(&sheet, &a1_context),
            Some(vec!["test".to_string()])
        );
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string(), "test2".to_string()]),
            ignore_blank: true,
            drop_down: false,
        };
        assert_eq!(list.to_drop_down(&sheet, &a1_context), None);
    }

    #[test]
    fn to_drop_down_values() {
        let mut sheet = Sheet::test();
        sheet.set_value((1, 1).into(), "test");
        sheet.set_value((1, 2).into(), "test2");
        let selection = A1Selection::test_a1("A1:A2");

        let list = ValidationList {
            source: ValidationListSource::Selection(selection),
            ignore_blank: true,
            drop_down: true,
        };

        let a1_context = sheet.expensive_make_a1_context();

        assert_eq!(
            list.to_drop_down(&sheet, &a1_context),
            Some(vec!["test".to_string(), "test2".to_string()])
        );
    }

    #[test]
    fn validate_blank_and_empty_text() {
        let sheet = Sheet::test();
        let list = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string()]),
            ignore_blank: true,
            drop_down: true,
        };

        let a1_context = sheet.expensive_make_a1_context();

        // Test with ignore_blank = true
        assert!(list.validate(&sheet, Some(CellValue::Blank), &a1_context));
        assert!(list.validate(&sheet, Some(CellValue::Text("".to_string())), &a1_context));
        assert!(list.validate(&sheet, None, &a1_context));

        // Test with ignore_blank = false
        let list_no_ignore = ValidationList {
            source: ValidationListSource::List(vec!["test".to_string()]),
            ignore_blank: false,
            drop_down: true,
        };

        assert!(!list_no_ignore.validate(&sheet, Some(CellValue::Blank), &a1_context));
        assert!(!list_no_ignore.validate(
            &sheet,
            Some(CellValue::Text("".to_string())),
            &a1_context
        ));
        assert!(!list_no_ignore.validate(&sheet, None, &a1_context));
    }
}
