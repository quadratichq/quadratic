use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::formulas::{Array, BasicValue, FormulaError, Value};

use super::{
    formatting::{CellAlign, CellBorderStyle, CellWrap, NumericFormat},
    CellCode, CellCodeLanguage, CellCodeRunOk, CellCodeRunOutput, CellRef, CellValue, Sheet,
};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct JsCoordinate {
    pub x: i64,
    pub y: i64,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct JsMinMax {
    pub min: i64,
    pub max: i64,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct JsRectangle {
    pub x: i64,
    pub y: i64,
    pub width: i64,
    pub height: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsCell {
    pub x: i64,
    pub y: i64,
    pub r#type: JsCellType,
    pub value: String,
    pub array_cells: Option<Vec<(i64, i64)>>,
    pub dependent_cells: Option<Vec<(i64, i64)>>,
    pub evaluation_result: Option<JsCellEvalResult>,
    pub formula_code: Option<String>,
    pub last_modified: Option<String>,
    pub ai_prompt: Option<String>,
    pub python_code: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsCellEvalResult {
    pub success: bool,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub output_value: Option<String>,
    pub cells_accessed: Vec<(i64, i64)>,
    pub array_output: Option<JsArrayOutput>,
    pub formatted_code: String,
    pub error_span: Option<(u32, u32)>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum JsArrayOutput {
    Array(Vec<Option<Any>>),
    Block(Vec<Vec<Option<Any>>>),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JsCellFormat {
    pub x: i64,
    pub y: i64,
    pub alignment: Option<CellAlign>,
    pub bold: Option<bool>,
    pub fill_color: Option<String>,
    pub italic: Option<bool>,
    pub text_color: Option<String>,
    pub text_format: Option<NumericFormat>,
    pub wrapping: Option<CellWrap>, // default is overflow
}
impl JsCellFormat {
    pub fn is_default(&self) -> bool {
        self.alignment.is_none()
            && self.bold.is_none()
            && self.fill_color.is_none()
            && self.italic.is_none()
            && self.text_color.is_none()
            && self.text_format.is_none()
            && self.wrapping.is_none()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsBorders {
    pub x: i64,
    pub y: i64,
    pub horizontal: Option<JsBorderDirectionSchema>,
    pub vertical: Option<JsBorderDirectionSchema>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsBorderDirectionSchema {
    pub color: Option<String>,
    pub r#type: Option<CellBorderStyle>,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
pub struct JsHeadingSchema {
    pub id: i64,
    pub size: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JsCellType {
    Text,
    Formula,
    JavaScript,
    Python,
    Sql,
    Computed,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum Any {
    Number(f64),
    String(String),
    Boolean(bool),
}
impl Into<BasicValue> for Any {
    fn into(self) -> BasicValue {
        match self {
            Any::Number(n) => BasicValue::Number(n),
            Any::String(s) => BasicValue::String(s),
            Any::Boolean(b) => BasicValue::Bool(b),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GridFileV1_2 {
    pub borders: Vec<JsBorders>,
    pub cells: Vec<JsCell>,
    pub cell_dependency: String,
    pub columns: Vec<JsHeadingSchema>,
    pub created: f64,

    pub filename: String,

    pub formats: Vec<JsCellFormat>,
    pub id: String,
    pub modified: f64,
    pub rows: Vec<JsHeadingSchema>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "version")]
pub enum GridFile {
    #[serde(rename = "1.2")]
    V1_2(GridFileV1_2),
}

impl JsCell {
    pub fn to_cell_value(&self) -> Option<CellValue> {
        match self.r#type {
            JsCellType::Text => Some(CellValue::Text(self.value.clone())),

            // we add computed cells with the original code that produced them
            JsCellType::Computed => None,

            _ => None,
        }
    }
    pub fn to_cell_code(&self, sheet: &mut Sheet) -> Option<CellCode> {
        let language = match self.r#type {
            JsCellType::Text | JsCellType::Computed => return None,
            JsCellType::Formula => CellCodeLanguage::Formula,
            JsCellType::JavaScript => CellCodeLanguage::JavaScript,
            JsCellType::Python => CellCodeLanguage::Python,
            JsCellType::Sql => CellCodeLanguage::Sql,
        };

        Some(CellCode {
            language,
            code_string: match language {
                CellCodeLanguage::Python => self.python_code.clone().unwrap_or_default(),
                CellCodeLanguage::Formula => self.formula_code.clone().unwrap_or_default(),
                CellCodeLanguage::JavaScript | CellCodeLanguage::Sql => String::new(),
            },
            formatted_code_string: self
                .evaluation_result
                .as_ref()
                .map(|result| result.formatted_code.clone()),
            last_modified: self.last_modified.clone().unwrap_or_default(),
            output: self.evaluation_result.clone().and_then(|js_result| {
                let result = match js_result.success {
                    true => Ok(CellCodeRunOk {
                        output_value: if let Some(s) = js_result.output_value.clone() {
                            Value::Single(BasicValue::String(s))
                        } else if let Some(array) = js_result.array_output {
                            let width;
                            let height;
                            let array_contents;

                            match array {
                                JsArrayOutput::Array(values) => {
                                    width = 1;
                                    height = values.len() as u32;
                                    array_contents =
                                        values.iter().map(|v| v.clone().into()).collect();
                                }
                                JsArrayOutput::Block(values) => {
                                    width = values.get(0)?.len() as u32;
                                    height = values.len() as u32;
                                    array_contents =
                                        values.iter().flatten().map(|v| v.clone().into()).collect();
                                }
                            }

                            Value::Array(Array::new_row_major(width, height, array_contents).ok()?)
                        } else {
                            Value::Single(BasicValue::Blank)
                        },
                        cells_accessed: js_result
                            .cells_accessed
                            .iter()
                            .map(|&(x, y)| CellRef {
                                sheet: sheet.id,
                                column: sheet.get_or_create_column(x).0.id,
                                row: sheet.get_or_create_row(y).id,
                            })
                            .collect(),
                    }),
                    false => Err(FormulaError {
                        span: js_result
                            .error_span
                            .map(|(start, end)| crate::formulas::Span { start, end }),
                        msg: crate::formulas::FormulaErrorMsg::UnknownError,
                    }),
                };

                Some(CellCodeRunOutput {
                    std_out: js_result.std_out,
                    std_err: js_result.std_err,
                    result,
                })
            }),
        })
    }
}
