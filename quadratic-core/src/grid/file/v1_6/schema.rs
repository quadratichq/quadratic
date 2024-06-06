use crate::grid::file::v1_5::schema as v1_5;
pub use crate::grid::file::v1_5::schema::ColumnRepeat;

pub use crate::grid::file::v1_5::run_error::RunError;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridSchema {
    pub sheets: Vec<Sheet>,
    pub version: Option<String>,
}

pub type Id = v1_5::Id;
pub type Pos = v1_5::Pos;
pub type SheetRect = v1_5::SheetRect;
pub type Offsets = v1_5::Offsets;
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

pub type CodeRun = v1_5::CodeRun;
pub type CodeRunResult = v1_5::CodeRunResult;
pub type OutputValue = v1_5::OutputValue;
pub type OutputArray = v1_5::OutputArray;
pub type OutputSize = v1_5::OutputSize;
pub type OutputValueValue = v1_5::OutputValueValue;
pub type RenderSize = v1_5::RenderSize;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Column {
    pub values: HashMap<String, CellValue>,
    pub align: HashMap<String, ColumnRepeat<CellAlign>>,
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
}

pub type CellValue = v1_5::CellValue;
pub type NumericFormatKind = v1_5::NumericFormatKind;
pub type NumericFormat = v1_5::NumericFormat;
pub type CellBorder = v1_5::CellBorder;
pub type CodeCellLanguage = v1_5::CodeCellLanguage;
pub type CodeCell = v1_5::CodeCell;
pub type CellAlign = v1_5::CellAlign;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellVerticalAlign {
    Top,
    Middle,
    Bottom,
}

pub type CellWrap = v1_5::CellWrap;
