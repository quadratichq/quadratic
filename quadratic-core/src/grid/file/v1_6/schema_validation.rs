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
pub enum NumberRange {
    Range(Option<f64>, Option<f64>),
    Equal(Vec<f64>),
    NotEqual(Vec<f64>),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationNumber {
    pub ignore_blank: bool,
    pub ranges: Vec<NumberRange>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TextCase {
    CaseInsensitive(Vec<String>),
    CaseSensitive(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TextMatch {
    Exactly(TextCase),

    Contains(TextCase),
    NotContains(TextCase),

    TextLength { min: Option<i16>, max: Option<i16> },
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationText {
    pub ignore_blank: bool,
    pub text_match: Vec<TextMatch>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum DateTimeRange {
    DateRange(Option<i64>, Option<i64>),
    DateEqual(Vec<i64>),
    DateNotEqual(Vec<i64>),

    TimeRange(Option<i32>, Option<i32>),
    TimeEqual(Vec<i32>),
    TimeNotEqual(Vec<i32>),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ValidationDateTime {
    pub ignore_blank: bool,
    pub require_date: bool,
    pub require_time: bool,
    pub prohibit_date: bool,
    pub prohibit_time: bool,
    pub ranges: Vec<DateTimeRange>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ValidationRule {
    None,
    List(ValidationList),
    Logical(ValidationLogical),
    Text(ValidationText),
    Number(ValidationNumber),
    DateTime(ValidationDateTime),
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
