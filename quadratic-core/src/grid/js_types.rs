use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::formatting::{CellAlign, CellWrap};
use super::CodeCellLanguage;
use crate::grid::BorderStyle;
use crate::{Pos, SheetRect};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum JsRenderCellSpecial {
    Chart,
    SpillError,
    RunError,
    Logical,
    Checkbox,
    List,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct JsRenderCell {
    pub x: i64,
    pub y: i64,

    pub value: String,

    /// Code language, set only for the top left cell of a code output.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<CodeCellLanguage>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<CellAlign>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap: Option<CellWrap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,

    pub special: Option<JsRenderCellSpecial>,
}

#[cfg(test)]
impl JsRenderCell {
    pub fn new_number(x: i64, y: i64, value: isize, language: Option<CodeCellLanguage>) -> Self {
        Self {
            x,
            y,
            value: value.to_string(),
            language,
            align: Some(CellAlign::Right),
            wrap: None,
            bold: None,
            italic: None,
            text_color: None,
            special: None,
        }
    }
}

impl From<Pos> for JsRenderCell {
    fn from(pos: Pos) -> Self {
        Self {
            x: pos.x,
            y: pos.y,
            value: "".to_string(),
            language: None,
            align: None,
            wrap: None,
            bold: None,
            italic: None,
            text_color: None,
            special: None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, ts_rs::TS)]
pub struct JsRenderFill {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,

    pub color: String,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, ts_rs::TS, PartialEq)]
pub struct JsSheetFill {
    pub columns: Vec<(i64, (String, i64))>,
    pub rows: Vec<(i64, (String, i64))>,
    pub all: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsRenderBorders {
    pub horizontal: Vec<JsRenderBorder>,
    pub vertical: Vec<JsRenderBorder>,
}

impl JsRenderBorders {
    pub fn new(horizontal: Vec<JsRenderBorder>, vertical: Vec<JsRenderBorder>) -> Self {
        JsRenderBorders {
            horizontal,
            vertical,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Eq, PartialEq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsRenderBorder {
    pub x: i64,
    pub y: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub w: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<usize>,
    pub style: BorderStyle,
}

impl JsRenderBorder {
    pub fn new(x: i64, y: i64, w: Option<usize>, h: Option<usize>, style: BorderStyle) -> Self {
        Self { x, y, w, h, style }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct CellFormatSummary {
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub commas: Option<bool>,

    pub text_color: Option<String>,
    pub fill_color: Option<String>,
}

#[derive(Serialize, PartialEq, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsReturnInfo {
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
}

#[derive(Serialize, PartialEq, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsCodeCell {
    pub x: i64,
    pub y: i64,
    pub code_string: String,
    pub language: CodeCellLanguage,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub evaluation_result: Option<String>,
    pub spill_error: Option<Vec<Pos>>,
    pub return_info: Option<JsReturnInfo>,
    pub cells_accessed: Option<Vec<SheetRect>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsRenderCodeCell {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub language: CodeCellLanguage,
    pub state: JsRenderCodeCellState,
    pub spill_error: Option<Vec<Pos>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsHtmlOutput {
    pub sheet_id: String,
    pub x: i64,
    pub y: i64,
    pub html: Option<String>,
    pub w: Option<String>,
    pub h: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum JsRenderCodeCellState {
    NotYetRun,
    RunError,
    SpillError,
    Success,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct JsClipboard {
    pub plain_text: String,
    pub html: String,
}

// Used to serialize the checkboxes contained within a sheet.
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
pub struct JsValidationSheet {
    // checkboxes that need to be rendered
    checkboxes: Vec<(Pos, bool)>,

    // validation errors that will be displayed
    errors: Vec<(Pos, String)>,
}
