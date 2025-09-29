use crate::grid::{SheetId, file::v1_4::schema as v1_4};
use chrono::{DateTime, Utc, serde::ts_seconds_option};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;

pub(crate) use super::run_error::RunError;
pub(crate) use super::run_error::RunErrorMsg;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GridSchema {
    pub(crate) sheets: Vec<Sheet>,
    pub(crate) version: Option<String>,
}

pub(crate) type Id = v1_4::Id;

impl From<SheetId> for Id {
    fn from(id: SheetId) -> Self {
        Self { id: id.to_string() }
    }
}

impl From<Id> for SheetId {
    fn from(id: Id) -> Self {
        SheetId::from_str(&id.id).unwrap()
    }
}

pub(crate) type Pos = v1_4::Pos;

impl From<crate::Pos> for Pos {
    fn from(pos: crate::Pos) -> Self {
        Self { x: pos.x, y: pos.y }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct SheetPos {
    pub(crate) x: i64,
    pub(crate) y: i64,
    pub(crate) sheet_id: Id,
}
impl From<crate::SheetPos> for SheetPos {
    fn from(pos: crate::SheetPos) -> Self {
        Self {
            x: pos.x,
            y: pos.y,
            sheet_id: pos.sheet_id.into(),
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct SheetRect {
    pub(crate) min: Pos,
    pub(crate) max: Pos,
    pub(crate) sheet_id: Id,
}
impl From<crate::SheetRect> for SheetRect {
    fn from(sheet_rect: crate::SheetRect) -> Self {
        Self {
            min: Pos {
                x: sheet_rect.min.x,
                y: sheet_rect.min.y,
            },
            max: Pos {
                x: sheet_rect.max.x,
                y: sheet_rect.max.y,
            },
            sheet_id: sheet_rect.sheet_id.into(),
        }
    }
}

impl From<SheetRect> for crate::SheetRect {
    fn from(sheet_rect: SheetRect) -> Self {
        Self {
            min: crate::Pos {
                x: sheet_rect.min.x,
                y: sheet_rect.min.y,
            },
            max: crate::Pos {
                x: sheet_rect.max.x,
                y: sheet_rect.max.y,
            },
            sheet_id: sheet_rect.sheet_id.into(),
        }
    }
}

pub(crate) type Offsets = v1_4::Offsets;

pub(crate) type Borders = HashMap<String, Vec<(i64, Vec<Option<CellBorder>>)>>;

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
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct Sheet {
    pub(crate) id: Id,
    pub(crate) name: String,
    pub(crate) color: Option<String>,
    pub(crate) order: String,
    pub(crate) offsets: Offsets,
    pub(crate) columns: Vec<(i64, Column)>,
    pub(crate) borders: Borders,
    pub(crate) code_runs: Vec<(Pos, CodeRun)>,

    // The following skips are necessary since we're adding it mid-version. Next
    // version we should remove them.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub(crate) formats_all: Option<Format>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) formats_columns: Vec<(i64, (Format, i64))>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) formats_rows: Vec<(i64, (Format, i64))>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) rows_resize: Vec<(i64, Resize)>,
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

    // the Option is necessary to use serde
    #[serde(with = "ts_seconds_option")]
    pub(crate) last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub(crate) enum CodeRunResult {
    Ok(OutputValue),
    Err(RunError),
}

pub(crate) type OutputValue = v1_4::OutputValue;
pub(crate) type OutputSize = v1_4::OutputSize;
pub(crate) type Span = v1_4::Span;
pub(crate) type RenderSize = v1_4::RenderSize;

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
    Duration(String),
    Error(RunError),
    Image(String),
}

pub(crate) fn string_bool(s: String) -> bool {
    match s.to_ascii_lowercase().as_str() {
        "true" => true,
        _ => false,
    }
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
    #[serde(rename = "type")]
    pub(crate) kind: NumericFormatKind,
    pub(crate) symbol: Option<String>,
}

pub(crate) type CellBorder = v1_4::CellBorder;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CodeCellLanguage {
    Python,
    Formula,
    Javascript,
    Connection { kind: ConnectionKind, id: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum ConnectionKind {
    Postgres,
    Mysql,
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
