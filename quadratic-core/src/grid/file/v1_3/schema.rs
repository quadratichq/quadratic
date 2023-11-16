use serde::{Deserialize, Serialize};

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridSchema {
    pub borders: Vec<Border>,
    pub cells: Vec<Cell>,
    #[serde(rename = "cell_dependency")]
    pub cell_dependency: String,
    pub columns: Vec<Column>,
    pub formats: Vec<Format>,
    pub rows: Vec<Row>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cell {
    pub x: i64,
    pub y: i64,
    #[serde(rename = "type")]
    pub type_field: String,
    pub value: String,
    #[serde(rename = "last_modified")]
    pub last_modified: Option<String>,
    #[serde(rename = "array_cells")]
    #[serde(default)]
    pub array_cells: Vec<Vec<i64>>,
    #[serde(rename = "dependent_cells")]
    #[serde(default)]
    pub dependent_cells: Vec<Vec<i64>>,
    #[serde(rename = "evaluation_result")]
    pub evaluation_result: Option<EvaluationResult>,
    #[serde(rename = "python_code")]
    pub python_code: Option<String>,
    #[serde(rename = "formula_code")]
    pub formula_code: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Border {
    pub x: i64,
    pub y: i64,
    pub horizontal: Option<CellBorder>,
    pub vertical: Option<CellBorder>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellBorder {
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub border_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationResult {
    pub success: bool,
    #[serde(rename = "std_out")]
    pub std_out: Option<String>,
    #[serde(rename = "output_value")]
    pub output_value: Option<String>,
    #[serde(rename = "cells_accessed")]
    pub cells_accessed: Vec<(i64, i64)>,
    #[serde(rename = "formatted_code")]
    pub formatted_code: String,
    #[serde(rename = "error_span")]
    pub error_span: Option<(u32, u32)>,
    #[serde(rename = "array_output")]
    pub array_output: Option<ArrayOutput>,
    #[serde(rename = "std_err")]
    pub std_err: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ArrayOutput {
    Block(Vec<Vec<Option<Any>>>),
    Array(Vec<Option<Any>>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Any {
    Number(f64),
    String(String),
    Boolean(bool),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Value {
    #[serde(rename = "type")]
    pub type_field: String,
    pub value: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub id: i64,
    pub size: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub id: i64,
    pub size: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Format {
    pub x: i64,
    pub y: i64,
    pub alignment: Option<String>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub fill_color: Option<String>,
    pub text_color: Option<String>,
    pub text_format: Option<TextFormat>,
    pub wrapping: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFormat {
    #[serde(rename = "type")]
    pub type_field: String,
    pub display: Option<String>,
    pub symbol: Option<String>,
    pub decimal_places: Option<i64>,
}
