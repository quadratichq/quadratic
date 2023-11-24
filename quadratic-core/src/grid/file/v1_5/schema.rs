use std::collections::HashMap;

use crate::grid::file::v1_4::schema as v1_4;
use serde::{Deserialize, Serialize};

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridSchema {
    pub sheets: Vec<Sheet>,
    pub version: Option<String>,
}

pub type Pos = v1_4::Pos;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetPos {
    pub x: i64,
    pub y: i64,
    pub sheet_id: Id,
}

pub type Offsets = v1_4::Offsets;
pub type Borders = v1_4::Borders;

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
    pub code_cells: Vec<(SheetPos, CodeCellValue)>,
}

pub type Id = v1_4::Id;

pub type CodeCellValue = v1_4::CodeCellValue;
pub type CodeCellRunOutput = v1_4::CodeCellRunOutput;
pub type CodeCellRunResult = v1_4::CodeCellRunResult;
pub type OutputValue = v1_4::OutputValue;
pub type OutputArray = v1_4::OutputArray;
pub type OutputSize = v1_4::OutputSize;
pub type OutputValueValue = v1_4::OutputValueValue;
pub type Error = v1_4::Error;
pub type Span = v1_4::Span;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub values: HashMap<String, ColumnValues>,
    pub spills: HashMap<String, ColumnFormatType<String>>,
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
}

pub type ColumnValues = v1_4::ColumnValues;
pub type ColumnContent = v1_4::ColumnContent;
pub type ColumnValue = v1_4::ColumnValue;
pub type ColumnFormatType<T> = v1_4::ColumnFormatType<T>;
pub type ColumnFormatContent<T> = v1_4::ColumnFormatContent<T>;
pub type NumericFormat = v1_4::NumericFormat;
pub type CellBorder = v1_4::CellBorder;
pub type CellSide = v1_4::CellSide;
