use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::grid::SheetId;

use super::schema::{Pos, Rect};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Selection {
    pub sheet_id: SheetId,

    // cursor position
    pub x: i64,
    pub y: i64,

    // These are used instead of an Enum to make the TS conversion easier.
    pub rects: Option<Vec<Rect>>,
    pub rows: Option<Vec<i64>>,
    pub columns: Option<Vec<i64>>,
    pub all: bool,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
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

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationLogical {
    pub show_checkbox: bool,
    pub ignore_blank: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationListSource {
    Selection(Selection),
    List(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationList {
    pub source: ValidationListSource,
    pub ignore_blank: bool,
    pub drop_down: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationRule {
    None,
    List(ValidationList),
    Logical(ValidationLogical),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Validation {
    pub selection: Selection,
    pub id: Uuid,
    pub rule: ValidationRule,
    pub message: ValidationMessage,
    pub error: ValidationError,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Validations {
    #[serde(default)]
    pub validations: Vec<Validation>,

    #[serde(default)]
    pub warnings: Vec<(Pos, Uuid)>,
}
