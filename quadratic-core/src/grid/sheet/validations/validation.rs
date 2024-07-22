use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{grid::Sheet, CellValue};

use super::validation_rules::ValidationRule;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ValidationMessage {
    pub show: bool,
    pub title: Option<String>,
    pub message: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationStyle {
    #[default]
    Warning,
    Stop,
    Information,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationError {
    pub show: bool,
    pub style: ValidationStyle,
    pub title: Option<String>,
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Validation {
    pub name: Option<String>,
    pub rule: ValidationRule,
    pub message: ValidationMessage,
    pub error: ValidationError,
}

impl Validation {
    /// Validate a cell value against its validation rule.
    pub fn validate(&self, sheet: &Sheet, value: &CellValue) -> bool {
        self.rule.validate(sheet, value)
    }
}

/// Used to display a validation in the UI.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ValidationCell {
    pub title: Option<String>,
    pub message: Option<String>,
    pub drop_down: Option<Vec<String>>,
}
