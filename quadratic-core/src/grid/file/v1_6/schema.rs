use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{self, Display};
use uuid::Uuid;

use super::schema_validation::Validations;
pub use crate::grid::file::v1_5::run_error::Axis;
use crate::grid::file::v1_5::schema as v1_5;
pub use v1_5::RunErrorMsg;
pub use v1_5::Span;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GridSchema {
    pub sheets: Vec<Sheet>,
    pub version: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Hash, Eq)]
pub struct Id {
    pub id: String,
}
impl Id {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
        }
    }
}
impl From<String> for Id {
    fn from(id: String) -> Self {
        Self { id }
    }
}
impl Display for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.id)
    }
}

#[derive(Default, Debug, Clone, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub struct Pos {
    pub x: i64,
    pub y: i64,
}

impl From<crate::Pos> for Pos {
    fn from(pos: crate::Pos) -> Self {
        Self { x: pos.x, y: pos.y }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub min: Pos,
    pub max: Pos,
}

impl From<&crate::Rect> for Rect {
    fn from(rect: &crate::Rect) -> Self {
        Self {
            min: Pos {
                x: rect.min.x,
                y: rect.min.y,
            },
            max: Pos {
                x: rect.max.x,
                y: rect.max.y,
            },
        }
    }
}

impl From<&Rect> for crate::Rect {
    fn from(rect: &Rect) -> Self {
        Self {
            min: crate::Pos {
                x: rect.min.x,
                y: rect.min.y,
            },
            max: crate::Pos {
                x: rect.max.x,
                y: rect.max.y,
            },
        }
    }
}

pub type SheetRect = v1_5::SheetRect;
pub type Offsets = v1_5::Offsets;
pub type Borders = v1_5::Borders;
pub type RunError = v1_5::RunError;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Format {
    pub align: Option<CellAlign>,
    pub vertical_align: Option<CellVerticalAlign>,
    pub wrap: Option<CellWrap>,
    pub numeric_format: Option<NumericFormat>,
    pub numeric_decimals: Option<i16>,
    pub numeric_commas: Option<bool>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub text_color: Option<String>,
    pub fill_color: Option<String>,
    pub render_size: Option<RenderSize>,

    #[serde(default)]
    pub date_time: Option<String>,
    #[serde(default)]
    pub underline: Option<bool>,
    #[serde(default)]
    pub strike_through: Option<bool>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Sheet {
    pub id: Id,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: Offsets,
    pub columns: Vec<(i64, Column)>,
    pub borders: Borders,
    pub code_runs: Vec<(Pos, CodeRun)>,
    pub formats_all: Option<Format>,
    pub formats_columns: Vec<(i64, (Format, i64))>,
    pub formats_rows: Vec<(i64, (Format, i64))>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub rows_resize: Vec<(i64, Resize)>,

    #[serde(default)]
    pub validations: Validations,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Resize {
    #[default]
    Auto,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRun {
    pub formatted_code_string: Option<String>,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: Vec<SheetRect>,
    pub result: CodeRunResult,
    pub return_type: Option<String>,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CodeRunResult {
    Ok(OutputValue),
    Err(RunError),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum OutputValue {
    Single(CellValue),
    Array(OutputArray),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutputArray {
    pub size: OutputSize,
    pub values: Vec<CellValue>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutputSize {
    pub w: i64,
    pub h: i64,
}

pub type RenderSize = v1_5::RenderSize;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Column {
    pub values: HashMap<String, CellValue>,
    pub align: HashMap<String, ColumnRepeat<CellAlign>>,

    // This skip is necessary since we're adding it mid-version.
    // Next version we should remove them.
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub vertical_align: HashMap<String, ColumnRepeat<CellVerticalAlign>>,

    pub wrap: HashMap<String, ColumnRepeat<CellWrap>>,
    pub numeric_format: HashMap<String, ColumnRepeat<NumericFormat>>,
    pub numeric_decimals: HashMap<String, ColumnRepeat<i16>>,
    pub numeric_commas: HashMap<String, ColumnRepeat<bool>>,
    pub bold: HashMap<String, ColumnRepeat<bool>>,
    pub italic: HashMap<String, ColumnRepeat<bool>>,
    pub text_color: HashMap<String, ColumnRepeat<String>>,
    pub fill_color: HashMap<String, ColumnRepeat<String>>,
    pub render_size: HashMap<String, ColumnRepeat<RenderSize>>,
    #[serde(default)]
    pub date_time: HashMap<String, ColumnRepeat<String>>,

    // Same as comment for `vertical_align`
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub underline: HashMap<String, ColumnRepeat<bool>>,

    // Same as comment for `vertical_align`
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub strike_through: HashMap<String, ColumnRepeat<bool>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValue {
    Blank,
    Text(String),
    Number(String),
    Html(String),
    Code(CodeCell),
    Logical(bool),
    Instant(String),
    Date(NaiveDate),
    Time(NaiveTime),
    DateTime(NaiveDateTime),
    Duration(String),
    Error(RunError),
    Image(String),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColumnRepeat<T> {
    pub value: T,
    pub len: u32,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum NumericFormatKind {
    #[default]
    Number,
    Currency,
    Percentage,
    Exponential,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NumericFormat {
    pub kind: NumericFormatKind,
    pub symbol: Option<String>,
}

pub type CellBorder = v1_5::CellBorder;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CodeCellLanguage {
    Python,
    Formula,
    Javascript,
    Connection { kind: ConnectionKind, id: String },
    Import,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConnectionKind {
    Postgres,
    Mysql,
    Mssql,
    Snowflake,
    Cockroachdb,
    Bigquery,
    Mariadb,
    Supabase,
    Neon,
    Mixpanel,
    #[serde(rename = "GOOGLE_ANALYTICS")]
    GoogleAnalytics,
    Plaid,
    /// Financial data connection for STOCKHISTORY formula
    StockHistory,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeCell {
    pub language: CodeCellLanguage,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellAlign {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellVerticalAlign {
    Top,
    Middle,
    Bottom,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellWrap {
    Overflow,
    Wrap,
    Clip,
}
