use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::{
    grid::{js_types::JsRenderCellSpecial, Sheet},
    selection::Selection,
    CellValue,
};

use super::validation_rules::ValidationRule;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationMessage {
    pub show: bool,
    pub title: Option<String>,
    pub message: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum ValidationStyle {
    #[default]
    Warning,
    Stop,
    Information,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationError {
    pub show: bool,
    pub style: ValidationStyle,
    pub title: Option<String>,
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct Validation {
    pub id: Uuid,
    pub selection: Selection,
    pub rule: ValidationRule,
    pub message: ValidationMessage,
    pub error: ValidationError,
}

impl Validation {
    /// Validate a cell value against its validation rule.
    pub fn validate(&self, sheet: &Sheet, value: &CellValue) -> bool {
        self.rule.validate(sheet, value)
    }

    /// Gets the JsRenderCellSpecial for a cell based on Validation.
    pub fn render_special(&self) -> Option<JsRenderCellSpecial> {
        match &self.rule {
            ValidationRule::List(list) => {
                if list.drop_down {
                    Some(JsRenderCellSpecial::List)
                } else {
                    None
                }
            }
            ValidationRule::Logical(logical) => {
                if logical.show_checkbox {
                    Some(JsRenderCellSpecial::Checkbox)
                } else {
                    None
                }
            }
        }
    }
}

/// Used to render a validation on the sheet.
#[derive(Default, Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ValidationDisplay {
    pub checkbox: bool,
    pub list: bool,
}

impl ValidationDisplay {
    pub fn is_default(&self) -> bool {
        !self.checkbox && !self.list
    }
}

/// Used for sheet-level validations (ie, Selection.all, Selection.columns, or
/// Selection.rows).
/// todo: also need to include exceptions
#[derive(Default, Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ValidationDisplaySheet {
    pub columns: Option<Vec<(i64, ValidationDisplay)>>,
    pub rows: Option<Vec<(i64, ValidationDisplay)>>,
    pub all: Option<ValidationDisplay>,
}

impl ValidationDisplaySheet {
    pub fn is_default(&self) -> bool {
        self.columns.is_none() && self.rows.is_none() && self.all.is_none()
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::sheet::validations::validation_rules::{
        validation_list::{ValidationList, ValidationListSource},
        validation_logical::ValidationLogical,
    };

    use super::*;

    #[test]
    fn validation_display_sheet_is_default() {
        let v = ValidationDisplaySheet::default();
        assert!(v.is_default());

        let v = ValidationDisplaySheet {
            columns: Some(vec![(
                0,
                ValidationDisplay {
                    checkbox: true,
                    list: false,
                },
            )]),
            ..Default::default()
        };
        assert!(!v.is_default());
    }

    #[test]
    fn validation_display_is_default() {
        let v = ValidationDisplay::default();
        assert!(v.is_default());

        let v = ValidationDisplay {
            checkbox: true,
            list: false,
        };
        assert!(!v.is_default());
    }

    #[test]
    fn validation_render_special() {
        let v = Validation {
            id: Uuid::new_v4(),
            selection: Selection::default(),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        assert_eq!(v.render_special(), Some(JsRenderCellSpecial::Checkbox));

        let v = Validation {
            id: Uuid::new_v4(),
            selection: Selection::default(),
            rule: ValidationRule::List(ValidationList {
                source: ValidationListSource::List(vec!["test".to_string()]),
                ignore_blank: true,
                drop_down: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        assert_eq!(v.render_special(), Some(JsRenderCellSpecial::List));
    }
}
