use crate::grid::{file::v1_4::schema as v1_4, SheetId};
use chrono::{serde::ts_seconds_option, DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;

pub use super::run_error::RunError;
pub use super::run_error::RunErrorMsg;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridSchema {
    pub sheets: Vec<Sheet>,
    pub version: Option<String>,
}

pub type Id = v1_4::Id;

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

pub type Pos = v1_4::Pos;

impl From<crate::Pos> for Pos {
    fn from(pos: crate::Pos) -> Self {
        Self { x: pos.x, y: pos.y }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetPos {
    pub x: i64,
    pub y: i64,
    pub sheet_id: Id,
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
pub struct SheetRect {
    pub min: Pos,
    pub max: Pos,
    pub sheet_id: Id,
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

pub type Offsets = v1_4::Offsets;

pub type Borders = HashMap<String, Vec<(i64, Vec<Option<CellBorder>>)>>;

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
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRun {
    pub formatted_code_string: Option<String>,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: Vec<SheetRect>,
    pub result: CodeRunResult,
    pub spill_error: bool,

    // the Option is necessary to use serde
    #[serde(with = "ts_seconds_option")]
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum CodeRunResult {
    Ok(OutputValue),
    Err(RunError),
}

pub type OutputValue = v1_4::OutputValue;
pub type OutputArray = v1_4::OutputArray;
pub type OutputSize = v1_4::OutputSize;
pub type OutputValueValue = v1_4::OutputValueValue;
pub type Span = v1_4::Span;
pub type RenderSize = v1_4::RenderSize;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Column {
    pub values: HashMap<i64, ColumnValue>,
    pub align: HashMap<i64, ColumnRepeat<CellAlign>>,
    pub wrap: HashMap<i64, ColumnRepeat<CellWrap>>,
    pub numeric_format: HashMap<i64, ColumnRepeat<NumericFormat>>,
    pub numeric_decimals: HashMap<i64, ColumnRepeat<i16>>,
    pub numeric_commas: HashMap<i64, ColumnRepeat<bool>>,
    pub bold: HashMap<i64, ColumnRepeat<bool>>,
    pub italic: HashMap<i64, ColumnRepeat<bool>>,
    pub text_color: HashMap<i64, ColumnRepeat<String>>,
    pub fill_color: HashMap<i64, ColumnRepeat<String>>,
    pub render_size: HashMap<i64, ColumnRepeat<RenderSize>>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColumnValue {
    #[serde(rename = "type")]
    pub type_field: String,
    pub value: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColumnRepeat<T> {
    pub value: T,
    pub len: u32,
}
pub type NumericFormat = v1_4::NumericFormat;
pub type CellBorder = v1_4::CellBorder;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeCell {
    pub language: String,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellAlign {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellWrap {
    Overflow,
    Wrap,
    Clip,
}
