use core::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use super::cells_accessed::JsCellsAccessed;
use super::data_table::{column_header::DataTableColumnHeader, sort::DataTableSort};
use super::formats::Format;
use super::formatting::{CellAlign, CellVerticalAlign, CellWrap};
use super::sheet::validations::validation::ValidationStyle;
use super::{CodeCellLanguage, NumericFormat};
use crate::Pos;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub enum JsRenderCellSpecial {
    Chart,
    SpillError,
    RunError,
    Logical,
    Checkbox,
    List,
    TableColumnHeader,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
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

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellValue {
    pub value: String,
    pub kind: String,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellValuePos {
    pub value: String,
    pub kind: String,
    pub pos: String,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellValuePosAIContext {
    pub sheet_name: String,
    pub rect_origin: String,
    pub rect_width: u32,
    pub rect_height: u32,
    pub starting_rect_values: Vec<Vec<JsCellValuePos>>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub special: Option<JsRenderCellSpecial>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<JsNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strike_through: Option<bool>,
}

#[cfg(test)]
impl JsRenderCell {
    pub fn new_number(
        x: i64,
        y: i64,
        value: isize,
        language: Option<CodeCellLanguage>,
        special: Option<JsRenderCellSpecial>,
        table: bool,
    ) -> Self {
        Self {
            x,
            y,
            value: value.to_string(),
            language,
            align: Some(CellAlign::Right),
            number: Some(JsNumber::default()),
            special,
            wrap: if table { Some(CellWrap::Clip) } else { None },
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

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
pub struct JsRenderFill {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,

    pub color: String,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsSheetFill {
    pub x: u32,
    pub y: u32,
    pub w: Option<u32>,
    pub h: Option<u32>,
    pub color: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, TS)]
pub enum CellType {
    Date,
    DateTime,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash, TS)]
#[serde(rename_all = "camelCase")]
pub struct CellFormatSummary {
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub commas: Option<bool>,

    pub text_color: Option<String>,
    pub fill_color: Option<String>,

    pub align: Option<CellAlign>,
    pub vertical_align: Option<CellVerticalAlign>,
    pub wrap: Option<CellWrap>,

    pub date_time: Option<String>,
    pub cell_type: Option<CellType>,

    pub underline: Option<bool>,
    pub strike_through: Option<bool>,
}

#[derive(Serialize, PartialEq, Debug, TS)]
pub struct JsReturnInfo {
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
}

#[derive(Serialize, PartialEq, Debug, TS)]
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
    pub cells_accessed: Option<Vec<JsCellsAccessed>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsRenderCodeCell {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub language: CodeCellLanguage,
    pub state: JsRenderCodeCellState,
    pub spill_error: Option<Vec<Pos>>,
    pub name: String,
    pub columns: Vec<JsDataTableColumnHeader>,
    pub first_row_header: bool,
    pub show_header: bool,
    pub sort: Option<Vec<DataTableSort>>,
    pub alternating_colors: bool,
    pub readonly: bool,
    pub is_html_image: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsHtmlOutput {
    pub sheet_id: String,
    pub x: i64,
    pub y: i64,
    pub html: Option<String>,
    pub w: Option<f32>,
    pub h: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
pub enum JsRenderCodeCellState {
    NotYetRun,
    RunError,
    SpillError,
    Success,
    HTML,
    Image,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
pub struct JsDataTableColumnHeader {
    pub name: String,
    pub display: bool,
    pub value_index: u32,
}

impl From<DataTableColumnHeader> for JsDataTableColumnHeader {
    fn from(column: DataTableColumnHeader) -> Self {
        JsDataTableColumnHeader {
            name: column.name.to_string(),
            display: column.display,
            value_index: column.value_index,
        }
    }
}

impl From<JsDataTableColumnHeader> for DataTableColumnHeader {
    fn from(column: JsDataTableColumnHeader) -> Self {
        DataTableColumnHeader {
            name: column.name.into(),
            display: column.display,
            value_index: column.value_index,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, TS)]
pub struct JsRowHeight {
    pub row: i64,
    pub height: f64,
}

impl fmt::Display for JsRowHeight {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "JsRowHeight(row: {}, height: {})", self.row, self.height)
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Copy, Clone, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
pub struct JsOffset {
    pub column: Option<i32>,
    pub row: Option<i32>,
    pub size: f64,
}

impl fmt::Display for JsOffset {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "JsOffset(column: {:?}, row: {:?}, size: {})",
            self.column, self.row, self.size
        )
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsValidationWarning {
    pub x: i64,
    pub y: i64,
    pub validation: Option<Uuid>,
    pub style: Option<ValidationStyle>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsSummarizeSelectionResult {
    pub count: i64,
    pub sum: Option<f64>,
    pub average: Option<f64>,
}

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use super::JsNumber;
    use crate::grid::formats::Format;
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
