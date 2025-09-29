use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::grid::SheetId;

use super::schema::{Pos, Rect};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct Selection {
    pub(crate) sheet_id: SheetId,

    // cursor position
    pub(crate) x: i64,
    pub(crate) y: i64,

    // These are used instead of an Enum to make the TS conversion easier.
    pub(crate) rects: Option<Vec<Rect>>,
    pub(crate) rows: Option<Vec<i64>>,
    pub(crate) columns: Option<Vec<i64>>,
    pub(crate) all: bool,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationMessage {
    pub(crate) show: bool,
    pub(crate) title: Option<String>,
    pub(crate) message: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum ValidationStyle {
    #[default]
    Warning,
    Stop,
    Information,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationError {
    pub(crate) show: bool,
    pub(crate) style: ValidationStyle,
    pub(crate) title: Option<String>,
    pub(crate) message: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationLogical {
    pub(crate) show_checkbox: bool,
    pub(crate) ignore_blank: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum ValidationListSource {
    Selection(Selection),
    List(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationList {
    pub(crate) source: ValidationListSource,
    pub(crate) ignore_blank: bool,
    pub(crate) drop_down: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum NumberRange {
    Range(Option<f64>, Option<f64>),
    Equal(Vec<f64>),
    NotEqual(Vec<f64>),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationNumber {
    pub(crate) ignore_blank: bool,
    pub(crate) ranges: Vec<NumberRange>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum TextCase {
    CaseInsensitive(Vec<String>),
    CaseSensitive(Vec<String>),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum TextMatch {
    Exactly(TextCase),

    Contains(TextCase),
    NotContains(TextCase),

    TextLength { min: Option<i16>, max: Option<i16> },
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationText {
    pub(crate) ignore_blank: bool,
    pub(crate) text_match: Vec<TextMatch>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum DateTimeRange {
    DateRange(Option<i64>, Option<i64>),
    DateEqual(Vec<i64>),
    DateNotEqual(Vec<i64>),

    TimeRange(Option<i32>, Option<i32>),
    TimeEqual(Vec<i32>),
    TimeNotEqual(Vec<i32>),
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct ValidationDateTime {
    pub(crate) ignore_blank: bool,
    pub(crate) require_date: bool,
    pub(crate) require_time: bool,
    pub(crate) prohibit_date: bool,
    pub(crate) prohibit_time: bool,
    pub(crate) ranges: Vec<DateTimeRange>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum ValidationRule {
    None,
    List(ValidationList),
    Logical(ValidationLogical),
    Text(ValidationText),
    Number(ValidationNumber),
    DateTime(ValidationDateTime),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct Validation {
    pub(crate) selection: Selection,
    pub(crate) id: Uuid,
    pub(crate) rule: ValidationRule,
    pub(crate) message: ValidationMessage,
    pub(crate) error: ValidationError,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct Validations {
    #[serde(default)]
    pub(crate) validations: Vec<Validation>,

    #[serde(default)]
    pub(crate) warnings: Vec<(Pos, Uuid)>,
}
