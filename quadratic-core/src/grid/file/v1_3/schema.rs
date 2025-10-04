use serde::{Deserialize, Serialize};

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GridSchema {
    pub(crate) borders: Vec<Border>,
    pub(crate) cells: Vec<Cell>,
    #[serde(rename = "cell_dependency")]
    pub(crate) cell_dependency: String,
    pub(crate) columns: Vec<Column>,
    pub(crate) formats: Vec<Format>,
    pub(crate) rows: Vec<Row>,
    pub(crate) version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Cell {
    pub(crate) x: i64,
    pub(crate) y: i64,
    #[serde(rename = "type")]
    pub(crate) type_field: String,
    pub(crate) value: String,
    #[serde(rename = "last_modified")]
    pub(crate) last_modified: Option<String>,
    #[serde(rename = "array_cells")]
    #[serde(default)]
    pub(crate) array_cells: Vec<Vec<i64>>,
    #[serde(rename = "dependent_cells")]
    #[serde(default)]
    pub(crate) dependent_cells: Vec<Vec<i64>>,
    #[serde(rename = "evaluation_result")]
    pub(crate) evaluation_result: Option<EvaluationResult>,
    #[serde(rename = "python_code")]
    pub(crate) python_code: Option<String>,
    #[serde(rename = "formula_code")]
    pub(crate) formula_code: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Border {
    pub(crate) x: i64,
    pub(crate) y: i64,
    pub(crate) horizontal: Option<CellBorder>,
    pub(crate) vertical: Option<CellBorder>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CellBorder {
    pub(crate) color: Option<String>,
    #[serde(rename = "type")]
    pub(crate) border_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EvaluationResult {
    pub(crate) success: bool,
    #[serde(rename = "std_out")]
    pub(crate) std_out: Option<String>,
    #[serde(rename = "output_value")]
    pub(crate) output_value: Option<String>,
    #[serde(rename = "cells_accessed")]
    pub(crate) cells_accessed: Vec<(i64, i64)>,
    #[serde(rename = "formatted_code")]
    pub(crate) formatted_code: String,
    #[serde(rename = "error_span")]
    pub(crate) error_span: Option<(u32, u32)>,
    #[serde(rename = "array_output")]
    pub(crate) array_output: Option<ArrayOutput>,
    #[serde(rename = "std_err")]
    pub(crate) std_err: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub(crate) enum ArrayOutput {
    Block(Vec<Vec<Option<Any>>>),
    Array(Vec<Option<Any>>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub(crate) enum Any {
    Number(f64),
    String(String),
    Boolean(bool),
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Value {
    #[serde(rename = "type")]
    pub(crate) type_field: String,
    pub(crate) value: String,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Column {
    pub(crate) id: i64,
    pub(crate) size: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Row {
    pub(crate) id: i64,
    pub(crate) size: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Format {
    pub(crate) x: i64,
    pub(crate) y: i64,
    pub(crate) alignment: Option<String>,
    pub(crate) bold: Option<bool>,
    pub(crate) italic: Option<bool>,
    pub(crate) fill_color: Option<String>,
    pub(crate) text_color: Option<String>,
    pub(crate) text_format: Option<TextFormat>,
    pub(crate) wrapping: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextFormat {
    #[serde(rename = "type")]
    pub(crate) type_field: String,
    pub(crate) display: Option<String>,
    pub(crate) symbol: Option<String>,
    pub(crate) decimal_places: Option<i64>,
}
