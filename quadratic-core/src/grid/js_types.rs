use core::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use super::formats::format::Format;
use super::formatting::{CellAlign, CellVerticalAlign, CellWrap};
use super::sheet::validations::validation::ValidationStyle;
use super::{CodeCellLanguage, NumericFormat};
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

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, ts_rs::TS)]
pub struct JsNumber {
    pub decimals: Option<i16>,
    pub commas: Option<bool>,
    pub format: Option<NumericFormat>,
}

impl JsNumber {
    /// Create a JsNumber for dollars with 2 decimal places.
    #[cfg(test)]
    pub fn dollars() -> Self {
        JsNumber {
            format: Some(NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }),
            ..Default::default()
        }
    }
}

impl From<&Format> for JsNumber {
    fn from(format: &Format) -> Self {
        JsNumber {
            decimals: format.numeric_decimals,
            commas: format.numeric_commas,
            format: format.numeric_format.clone(),
        }
    }
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
    pub vertical_align: Option<CellVerticalAlign>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap: Option<CellWrap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,

    pub special: Option<JsRenderCellSpecial>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<JsNumber>,
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
            number: Some(JsNumber::default()),
            ..Default::default()
        }
    }
}

impl From<Pos> for JsRenderCell {
    fn from(pos: Pos) -> Self {
        Self {
            x: pos.x,
            y: pos.y,
            ..Default::default()
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

    pub align: Option<CellAlign>,
    pub vertical_align: Option<CellVerticalAlign>,
    pub wrap: Option<CellWrap>,
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

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct JsRowHeight {
    pub row: i64,
    pub height: f64,
}

impl fmt::Display for JsRowHeight {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "JsRowHeight(row: {}, height: {})", self.row, self.height)
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct JsPos {
    pub x: i64,
    pub y: i64,
}
impl fmt::Display for JsPos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "JsPos(x: {}, x: {})", self.x, self.x)
    }
}
impl From<Pos> for JsPos {
    fn from(pos: Pos) -> Self {
        JsPos { x: pos.x, y: pos.y }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsValidationWarning {
    pub x: i64,
    pub y: i64,
    pub validation: Option<Uuid>,
    pub style: Option<ValidationStyle>,
}

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use super::JsNumber;
    use crate::grid::formats::format::Format;
    use crate::grid::NumericFormat;

    #[test]
    #[parallel]
    fn to_js_number() {
        let format = Format {
            numeric_decimals: Some(2),
            numeric_commas: Some(true),
            numeric_format: Some(NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("€".to_string()),
            }),
            ..Default::default()
        };

        let js_number: JsNumber = (&format).into();
        assert_eq!(js_number.decimals, Some(2));
        assert_eq!(js_number.commas, Some(true));
        assert_eq!(
            js_number.format,
            Some(NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("€".to_string()),
            })
        );

        let js_number: JsNumber = (&Format::default()).into();
        assert_eq!(js_number, JsNumber::default());
    }
}
