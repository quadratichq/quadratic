#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use core::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use super::cells_accessed::JsCellsAccessed;
use super::data_table::{column_header::DataTableColumnHeader, sort::DataTableSort};
use super::formats::Format;
use super::formatting::{CellAlign, CellVerticalAlign, CellWrap};
use super::sheet::validations::validation::ValidationStyle;
use super::{CodeCellLanguage, NumericFormat, SheetId};
use crate::controller::execution::TransactionSource;
use crate::controller::operations::tracked_operation::TrackedOperation;
use crate::{CellValue, Pos};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub enum JsRenderCellSpecial {
    Chart,
    SpillError,
    RunError,
    Logical,
    Checkbox,
    List,
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
pub enum JsCellValueKind {
    #[default]
    Blank,
    Text,
    Number,
    Logical,
    DateTime,
    Date,
    Time,
    Duration,
    Error,
    Html,
    Image,
    RichText,
}

impl From<CellValue> for JsCellValueKind {
    fn from(value: CellValue) -> Self {
        match value {
            CellValue::Blank => JsCellValueKind::Blank,
            CellValue::Instant(_) => JsCellValueKind::DateTime, // deprecated
            CellValue::Number(_) => JsCellValueKind::Number,
            CellValue::Text(_) => JsCellValueKind::Text,
            CellValue::Logical(_) => JsCellValueKind::Logical,
            CellValue::DateTime(_) => JsCellValueKind::DateTime,
            CellValue::Date(_) => JsCellValueKind::Date,
            CellValue::Time(_) => JsCellValueKind::Time,
            CellValue::Duration(_) => JsCellValueKind::Duration,
            CellValue::Error(_) => JsCellValueKind::Error,
            CellValue::Html(_) => JsCellValueKind::Html,
            CellValue::Image(_) => JsCellValueKind::Image,
            CellValue::RichText(_) => JsCellValueKind::RichText,
            CellValue::Code(code_cell) => (*code_cell.output).clone().into(),
        }
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellValue {
    pub value: String,
    pub kind: JsCellValueKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spans: Option<Vec<crate::cellvalue::TextSpan>>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellValuePos {
    pub value: String,
    pub kind: JsCellValueKind,
    pub pos: String,
}

/// Information about a code cell for editing purposes
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct JsEditCellCodeCell {
    pub language: CodeCellLanguage,
    pub code: String,
}

/// Result of getting a cell for editing. If the cell is a single-cell code cell,
/// the code_cell field will be populated with the language and code.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct JsEditCell {
    /// The text representation of the cell value for editing
    pub text: String,
    /// If this is a single-cell code cell, contains the language and code
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code_cell: Option<JsEditCellCodeCell>,
}

#[derive(Serialize, Debug, PartialEq, TS)]
pub struct JsSummaryContext {
    pub sheet_name: String,
    pub data_rects: Vec<JsCellValueSummary>,
    pub errored_code_cells: Option<Vec<JsCodeCell>>,
    pub data_tables: Option<Vec<JsDataTableContext>>,
    pub code_tables: Option<Vec<JsCodeTableContext>>,
    pub connections: Option<Vec<JsCodeTableContext>>,
    pub charts: Option<Vec<JsChartContext>>,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsCodeErrorContext {
    pub sheet_name: String,
    pub pos: String,
    pub name: String,
    pub language: CodeCellLanguage,
    pub error: Option<String>,
    pub is_spill: bool,
    pub expected_bounds: Option<String>,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsDataTableContext {
    pub sheet_name: String,
    pub data_table_name: String,
    pub all_columns: Vec<String>,
    pub visible_columns: Vec<String>,
    pub values: Option<JsCellValueSummary>,
    pub bounds: String,
    pub intended_bounds: String,
    pub show_name: bool,
    pub show_columns: bool,
    pub spill: bool,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsCodeTableContext {
    pub sheet_name: String,
    pub code_table_name: String,
    pub all_columns: Vec<String>,
    pub visible_columns: Vec<String>,
    pub values: Option<JsCellValueSummary>,
    pub bounds: String,
    pub intended_bounds: String,
    pub show_name: bool,
    pub show_columns: bool,
    pub language: CodeCellLanguage,
    pub code_string: String,
    pub std_err: Option<String>,
    pub error: bool,
    pub spill: bool,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsChartContext {
    pub sheet_name: String,
    pub chart_name: String,
    pub bounds: String,
    pub intended_bounds: String,
    pub language: CodeCellLanguage,
    pub code_string: String,
    pub spill: bool,
}

/// A hyperlink span within a cell, with character range and URL.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct JsRenderCellLinkSpan {
    /// Start character index (inclusive).
    pub start: u32,
    /// End character index (exclusive).
    pub end: u32,
    /// The hyperlink URL.
    pub url: String,
}

/// A formatting span within a cell, with character range and style overrides.
/// These override the cell-level formatting for the specified character range.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct JsRenderCellFormatSpan {
    /// Start character index (inclusive).
    pub start: u32,
    /// End character index (exclusive).
    pub end: u32,
    /// Bold override (None means use cell default).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    /// Italic override (None means use cell default).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    /// Underline override (None means use cell default).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,
    /// Strike-through override (None means use cell default).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strike_through: Option<bool>,
    /// Text color override (None means use cell default).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
    /// Hyperlink URL (None means no link).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
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
    /// Error text to display (e.g., "#N/A", "#DIV/0!", "#REF!")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<JsNumber>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub underline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strike_through: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<i16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table_name: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column_header: Option<bool>,
    /// Hyperlink spans for RichText cells with hyperlinks (character ranges + URLs).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub link_spans: Vec<JsRenderCellLinkSpan>,
    /// Formatting spans for RichText cells with inline formatting overrides.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub format_spans: Vec<JsRenderCellFormatSpan>,
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

#[derive(Serialize, Debug, PartialEq, TS)]
pub struct JsHashRenderCells {
    pub sheet_id: SheetId,
    pub hash: Pos,
    pub cells: Vec<JsRenderCell>,
}

#[derive(Serialize, Debug, PartialEq, TS)]
pub struct JsHashesDirty {
    pub sheet_id: SheetId,
    pub hashes: Vec<Pos>,
}

#[derive(Serialize, Debug, PartialEq, TS)]
pub struct JsHashRenderFills {
    pub sheet_id: SheetId,
    pub hash: Pos,
    pub fills: Vec<JsRenderFill>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
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

    pub numeric_format: Option<NumericFormat>,
    pub font_size: Option<i16>,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsReturnInfo {
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
}

#[derive(Serialize, Debug, PartialEq, TS)]
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
    pub last_modified: i64,
}

#[derive(Serialize, Debug, PartialEq, TS)]
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
    pub sort: Option<Vec<DataTableSort>>,
    pub sort_dirty: bool,
    pub alternating_colors: bool,
    pub is_code: bool,
    pub is_html: bool,
    pub is_html_image: bool,
    pub show_name: bool,
    pub show_columns: bool,
    pub last_modified: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsHtmlOutput {
    pub sheet_id: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub html: Option<String>,
    pub name: String,
    pub show_name: bool,
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
pub struct JsColumnWidth {
    pub column: i64,
    pub width: f64,
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
    pub pos: Pos,
    pub validation: Option<Uuid>,
    pub style: Option<ValidationStyle>,
}

#[derive(Serialize, Debug, PartialEq, TS)]
pub struct JsHashValidationWarnings {
    pub sheet_id: SheetId,
    pub hash: Option<Pos>,
    pub warnings: Vec<JsValidationWarning>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsSummarizeSelectionResult {
    pub count: i64,
    pub sum: Option<f64>,
    pub average: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "lowercase")]
pub enum JsSnackbarSeverity {
    Error,
    Warning,
    Success,
}

impl fmt::Display for JsSnackbarSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", format!("{self:?}").to_lowercase())
    }
}

#[cfg(test)]
mod test {

    use super::JsNumber;
    use crate::grid::NumericFormat;
    use crate::grid::formats::Format;

    #[test]
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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsResponse {
    pub result: bool,
    pub error: Option<String>,
}
impl From<JsResponse> for wasm_bindgen::JsValue {
    fn from(response: JsResponse) -> Self {
        serde_wasm_bindgen::to_value(&response).unwrap_or(JsValue::UNDEFINED)
    }
}

#[derive(Serialize, Debug, PartialEq, TS)]
pub struct JsUpdateCodeCell {
    pub sheet_id: SheetId,
    pub pos: Pos,
    pub render_code_cell: Option<JsRenderCodeCell>,
}

#[derive(Debug, Clone, TS)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct JsCoordinate {
    pub x: u32,
    pub y: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct JsSheetNameToColor {
    pub sheet_name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
pub struct JsSheetPosText {
    pub sheet_id: String,
    pub x: i64,
    pub y: i64,
    pub text: Option<String>,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsCellValueCode {
    pub value: String,
    pub kind: JsCellValueKind,
    pub language: Option<CodeCellLanguage>,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsCellValueSummary {
    pub total_range: String,

    pub start_range: Option<String>,
    pub end_range: Option<String>,

    pub start_values: Option<Vec<Vec<JsCellValueCode>>>,
    pub end_values: Option<Vec<Vec<JsCellValueCode>>>,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsCellValueRanges {
    pub total_range: String,
    pub range: String,
    pub values: Option<Vec<Vec<JsCellValueCode>>>,
}

#[derive(Serialize, Debug, PartialEq, Eq, TS)]
pub struct JsGetAICellResult {
    pub selection: String,
    pub page: i32,
    pub total_pages: i32,

    pub values: Vec<JsCellValueRanges>,
}

#[derive(Debug, Serialize, TS, PartialEq)]
pub struct JsAITransactions {
    pub ops: Vec<TrackedOperation>,
    pub source: TransactionSource,
}
