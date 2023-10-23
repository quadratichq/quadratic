use std::{collections::HashMap, str::FromStr};

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridSchema {
    pub sheets: Vec<Sheet>,
    pub dependencies: Vec<(Dependency, Vec<DependencyRange>)>,
    pub version: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pos {
    pub x: i64,
    pub y: i64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Dependency {
    pub x: i64,
    pub y: i64,
    pub sheet_id: Id,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DependencyRange {
    pub min: Pos,
    pub max: Pos,
    pub sheet_id: Id,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sheet {
    pub id: Id,
    pub name: String,
    pub color: Option<String>,
    pub order: String,
    pub offsets: (Vec<(i64, f64)>, Vec<(i64, f64)>),
    pub columns: Vec<(i64, Column)>,
    pub rows: Vec<(i64, Id)>,
    pub borders: Borders,
    #[serde(rename = "code_cells")]
    pub code_cells: Vec<(CellRef, CodeCellValue)>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellRef {
    pub sheet: Id,
    pub column: Id,
    pub row: Id,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CodeCellValue {
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
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub enum CodeCellRunResult {
    Ok {
        output_value: OutputValue,
        cells_accessed: Vec<CellRef>,
    },
    Err {
        error: Error,
    },
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub enum OutputValue {
    Single(OutputValueValue),
    Array(OutputArray),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutputArray {
    pub size: OutputSize,
    pub values: Vec<OutputValueValue>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSize {
    pub w: i64,
    pub h: i64,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputValueValue {
    #[serde(rename = "type")]
    pub type_field: String,
    pub value: String,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Error {
    pub span: Option<Span>,
    pub msg: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub id: Id,
    pub values: HashMap<String, ColumnValues>,
    pub spills: HashMap<String, ColumnFormatType<String>>,
    pub align: HashMap<String, ColumnFormatType<String>>,
    pub wrap: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "numeric_format")]
    pub numeric_format: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "numeric_decimals")]
    pub numeric_decimals: HashMap<String, ColumnFormatType<String>>,
    pub bold: HashMap<String, ColumnFormatType<bool>>,
    pub italic: HashMap<String, ColumnFormatType<bool>>,
    #[serde(rename = "text_color")]
    pub text_color: HashMap<String, ColumnFormatType<String>>,
    #[serde(rename = "fill_color")]
    pub fill_color: HashMap<String, ColumnFormatType<String>>,
}
impl Column {
    pub fn with_id(id: Id) -> Self {
        Column {
            id,
            ..Default::default()
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnValues {
    pub y: i64,
    pub content: ColumnContent,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnContent {
    #[serde(rename = "Values")]
    pub values: Vec<ColumnValue>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnValue {
    #[serde(rename = "type")]
    pub type_field: String,
    pub value: String,
}
impl From<(i64, ColumnValue)> for ColumnValues {
    fn from((y, values): (i64, ColumnValue)) -> Self {
        Self {
            y,
            content: ColumnContent {
                values: vec![values],
            },
        }
    }
}

// pub enum ColumnFormat {
//     Bool,
//     String,
// }

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnFormatType<T> {
    pub y: i64,
    pub content: ColumnFormatContent<T>,
}
#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnFormatContent<T> {
    pub value: T,
    pub len: i64,
}
impl<T> From<T> for ColumnFormatType<T> {
    fn from(value: T) -> Self {
        ColumnFormatType {
            y: 0,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}
impl From<(i64, String)> for ColumnFormatType<String> {
    fn from((y, value): (i64, String)) -> Self {
        // TODO(ddimaria): set len to a value
        ColumnFormatType {
            y,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}
impl From<(i64, bool)> for ColumnFormatType<bool> {
    fn from((y, value): (i64, bool)) -> Self {
        // TODO(ddimaria): set len to a value
        ColumnFormatType {
            y,
            content: ColumnFormatContent { value, len: 1 },
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumericFormat {
    #[serde(rename = "type")]
    pub kind: String,
    pub symbol: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub id: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Borders {
    pub horizontal: HashMap<i64, Horizontal>,
    pub vertical: HashMap<i64, Vertical>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Horizontal {}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vertical {}
