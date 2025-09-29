use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{self, Display};

use super::schema_validation::Validations;
pub(crate) use crate::grid::file::v1_5::run_error::Axis;
use crate::grid::file::v1_5::schema as v1_5;
pub(crate) use v1_5::RunErrorMsg;
pub(crate) use v1_5::Span;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct GridSchema {
    pub(crate) sheets: Vec<Sheet>,
    pub(crate) version: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Hash, Eq)]
pub(crate) struct Id {
    pub(crate) id: String,
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
pub(crate) struct Pos {
    pub(crate) x: i64,
    pub(crate) y: i64,
}

impl From<crate::Pos> for Pos {
    fn from(pos: crate::Pos) -> Self {
        Self { x: pos.x, y: pos.y }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct Rect {
    pub(crate) min: Pos,
    pub(crate) max: Pos,
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

pub(crate) type SheetRect = v1_5::SheetRect;
pub(crate) type Offsets = v1_5::Offsets;
pub(crate) type Borders = v1_5::Borders;
pub(crate) type RunError = v1_5::RunError;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct Format {
    pub(crate) align: Option<CellAlign>,
    pub(crate) vertical_align: Option<CellVerticalAlign>,
    pub(crate) wrap: Option<CellWrap>,
    pub(crate) numeric_format: Option<NumericFormat>,
    pub(crate) numeric_decimals: Option<i16>,
    pub(crate) numeric_commas: Option<bool>,
    pub(crate) bold: Option<bool>,
    pub(crate) italic: Option<bool>,
    pub(crate) text_color: Option<String>,
    pub(crate) fill_color: Option<String>,
    pub(crate) render_size: Option<RenderSize>,

    #[serde(default)]
    pub(crate) date_time: Option<String>,
    #[serde(default)]
    pub(crate) underline: Option<bool>,
    #[serde(default)]
    pub(crate) strike_through: Option<bool>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Sheet {
    pub(crate) id: Id,
    pub(crate) name: String,
    pub(crate) color: Option<String>,
    pub(crate) order: String,
    pub(crate) offsets: Offsets,
    pub(crate) columns: Vec<(i64, Column)>,
    pub(crate) borders: Borders,
    pub(crate) code_runs: Vec<(Pos, CodeRun)>,
    pub(crate) formats_all: Option<Format>,
    pub(crate) formats_columns: Vec<(i64, (Format, i64))>,
    pub(crate) formats_rows: Vec<(i64, (Format, i64))>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) rows_resize: Vec<(i64, Resize)>,

    #[serde(default)]
    pub(crate) validations: Validations,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum Resize {
    #[default]
    Auto,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CodeRun {
    pub(crate) formatted_code_string: Option<String>,
    pub(crate) std_out: Option<String>,
    pub(crate) std_err: Option<String>,
    pub(crate) cells_accessed: Vec<SheetRect>,
    pub(crate) result: CodeRunResult,
    pub(crate) return_type: Option<String>,
    pub(crate) line_number: Option<u32>,
    pub(crate) output_type: Option<String>,
    pub(crate) spill_error: bool,
    pub(crate) last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CodeRunResult {
    Ok(OutputValue),
    Err(RunError),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum OutputValue {
    Single(CellValue),
    Array(OutputArray),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct OutputArray {
    pub(crate) size: OutputSize,
    pub(crate) values: Vec<CellValue>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct OutputSize {
    pub(crate) w: i64,
    pub(crate) h: i64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct OutputValueValue {
    pub(crate) type_field: String,
    pub(crate) value: String,
}

pub(crate) type RenderSize = v1_5::RenderSize;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct Column {
    pub(crate) values: HashMap<String, CellValue>,
    pub(crate) align: HashMap<String, ColumnRepeat<CellAlign>>,

    // This skip is necessary since we're adding it mid-version.
    // Next version we should remove them.
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub(crate) vertical_align: HashMap<String, ColumnRepeat<CellVerticalAlign>>,

    pub(crate) wrap: HashMap<String, ColumnRepeat<CellWrap>>,
    pub(crate) numeric_format: HashMap<String, ColumnRepeat<NumericFormat>>,
    pub(crate) numeric_decimals: HashMap<String, ColumnRepeat<i16>>,
    pub(crate) numeric_commas: HashMap<String, ColumnRepeat<bool>>,
    pub(crate) bold: HashMap<String, ColumnRepeat<bool>>,
    pub(crate) italic: HashMap<String, ColumnRepeat<bool>>,
    pub(crate) text_color: HashMap<String, ColumnRepeat<String>>,
    pub(crate) fill_color: HashMap<String, ColumnRepeat<String>>,
    pub(crate) render_size: HashMap<String, ColumnRepeat<RenderSize>>,
    #[serde(default)]
    pub(crate) date_time: HashMap<String, ColumnRepeat<String>>,

    // Same as comment for `vertical_align`
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub(crate) underline: HashMap<String, ColumnRepeat<bool>>,

    // Same as comment for `vertical_align`
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub(crate) strike_through: HashMap<String, ColumnRepeat<bool>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellValue {
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
pub(crate) struct ColumnRepeat<T> {
    pub(crate) value: T,
    pub(crate) len: u32,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum NumericFormatKind {
    #[default]
    Number,
    Currency,
    Percentage,
    Exponential,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct NumericFormat {
    pub(crate) kind: NumericFormatKind,
    pub(crate) symbol: Option<String>,
}

pub(crate) type CellBorder = v1_5::CellBorder;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CodeCellLanguage {
    Python,
    Formula,
    Javascript,
    Connection { kind: ConnectionKind, id: String },
    Import,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum ConnectionKind {
    Postgres,
    Mysql,
    Mssql,
    Snowflake,
    Cockroachdb,
    Bigquery,
    Mariadb,
    Supabase,
    Neon,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CodeCell {
    pub(crate) language: CodeCellLanguage,
    pub(crate) code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellAlign {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellVerticalAlign {
    Top,
    Middle,
    Bottom,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellWrap {
    Overflow,
    Wrap,
    Clip,
}
