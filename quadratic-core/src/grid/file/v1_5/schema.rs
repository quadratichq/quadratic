use std::collections::HashMap;
use std::str::FromStr;

use crate::grid::{file::v1_4::schema as v1_4, SheetId};
use serde::{Deserialize, Serialize};

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
#[serde(rename_all = "camelCase")]
pub struct Sheet {
    pub id: Id,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: Offsets,
    pub columns: Vec<(i64, Column)>,
    pub borders: Borders,
    #[serde(rename = "code_cells")]
    pub code_cells: Vec<(Pos, CodeCellValue)>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeRun {
    pub language: String,
    pub code_string: String,
    pub formatted_code_string: Option<String>,
    pub last_modified: String,
    pub output: Option<CodeCellRunOutput>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeCellRunOutput {
    pub std_out: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,
    pub result: CodeCellRunResult,
    pub spill: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub enum CodeCellRunResult {
    Ok {
        output_value: OutputValue,
        cells_accessed: Vec<SheetRect>,
    },
    Err {
        error: Error,
    },
}

pub type OutputValue = v1_4::OutputValue;
pub type OutputArray = v1_4::OutputArray;
pub type OutputSize = v1_4::OutputSize;
pub type OutputValueValue = v1_4::OutputValueValue;
pub type Error = v1_4::Error;
pub type Span = v1_4::Span;
pub type RenderSize = v1_4::RenderSize;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub x: i64,
    pub values: HashMap<String, ColumnValues>,
    pub align: HashMap<String, ColumnFormatType<String>>,
    pub wrap: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "numeric_format")]
    pub numeric_format: HashMap<String, ColumnFormatType<NumericFormat>>,
    #[serde(rename = "numeric_decimals")]
    pub numeric_decimals: HashMap<String, ColumnFormatType<i16>>,
    #[serde(rename = "numeric_commas")]
    pub numeric_commas: HashMap<String, ColumnFormatType<bool>>,
    pub bold: HashMap<String, ColumnFormatType<bool>>,
    pub italic: HashMap<String, ColumnFormatType<bool>>,
    #[serde(rename = "text_color")]
    pub text_color: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "fill_color")]
    pub fill_color: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "render_size")]
    pub render_size: HashMap<String, ColumnFormatType<RenderSize>>,
}

pub type ColumnValues = v1_4::ColumnValues;
pub type ColumnValue = v1_4::ColumnValue;
pub type ColumnFormatType<T> = v1_4::ColumnFormatType<T>;
pub type ColumnFormatContent<T> = v1_4::ColumnFormatContent<T>;
pub type NumericFormat = v1_4::NumericFormat;
pub type CellBorder = v1_4::CellBorder;
