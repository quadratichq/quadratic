use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{
    grid::{CellRef, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    Error, ErrorMsg, Pos, Rect, Span, Value,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[wasm_bindgen]
pub struct CellForArray {
    pub x: i64,
    pub y: i64,
    value: String,
}

impl CellForArray {
    pub fn new(x: i64, y: i64, value: Option<String>) -> Self {
        Self {
            x,
            y,
            value: match value {
                Some(value) => value,
                None => String::new(),
            },
        }
    }
}

#[wasm_bindgen]
impl CellForArray {
    #[wasm_bindgen(js_name = "getValue")]
    pub fn get_value(&self) -> String {
        self.value.clone()
    }
    #[wasm_bindgen(js_name = "getPos")]
    pub fn get_pos(&self) -> Pos {
        Pos {
            x: self.x,
            y: self.y,
        }
    }
}

#[wasm_bindgen]
pub struct CellsForArray {
    cells: Vec<CellForArray>,
    i: usize,
    pub transaction_response: bool,
}

impl CellsForArray {
    pub fn new(cells: Vec<CellForArray>, transaction_response: bool) -> Self {
        Self {
            cells,
            i: 0,
            transaction_response,
        }
    }
}

#[wasm_bindgen]
impl CellsForArray {
    #[wasm_bindgen]
    pub fn next(&mut self) -> Option<CellForArray> {
        let i = self.i;
        self.i += 1;
        self.cells.get(i).cloned()
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.i = 0;
    }
}

#[wasm_bindgen]
pub struct JsCodeResult {
    success: bool,
    formatted_code: Option<String>,
    error_msg: Option<String>,
    input_python_std_out: Option<String>,
    output_value: Option<String>,
    array_output: Option<Vec<Vec<String>>>,
    line_number: Option<u32>,
}

impl JsCodeResult {
    pub fn into_code_cell_value(
        &self,
        language: CodeCellLanguage,
        code_string: String,
        cells_accessed: &Vec<CellRef>,
    ) -> CodeCellValue {
        let result = if self.success {
            CodeCellRunResult::Ok {
                output_value: if let Some(array_output) = self.array_output.to_owned() {
                    Value::Array(array_output.into())
                } else {
                    self.output_value.to_owned().into()
                },
                cells_accessed: cells_accessed.to_owned(),
            }
        } else {
            let error_msg = self
                .error_msg
                .to_owned()
                .unwrap_or_else(|| "Unknown Python Error".into());
            let msg = ErrorMsg::PythonError(error_msg.into());
            let span = self.line_number.map(|line_number| Span {
                    start: line_number,
                    end: line_number,
                });
            CodeCellRunResult::Err {
                error: Error { span, msg },
            }
        };
        CodeCellValue {
            language,
            code_string,
            formatted_code_string: self.formatted_code.clone(),
            output: Some(CodeCellRunOutput {
                std_out: self.input_python_std_out.clone(),
                std_err: self.error_msg.clone(),
                result,
            }),

            // todo: figure out how to handle modified dates in cells
            last_modified: String::new(),
        }
    }
}

#[wasm_bindgen]
impl JsCodeResult {
    #[wasm_bindgen(constructor)]
    pub fn new(
        success: bool,
        formatted_code: Option<String>,
        error_msg: Option<String>,
        input_python_std_out: Option<String>,
        output_value: Option<String>,
        array_output: Option<String>,
        line_number: Option<u32>,
    ) -> Self {
        let array_output: Option<Vec<Vec<String>>> = if let Some(output_value) = array_output {
            match serde_json::from_str(&output_value) {
                Ok(array) => Some(array),
                Err(_) => {
                    panic!("Could not parse array_output in JsCodeResult::new")
                }
            }
        } else {
            None
        };
        JsCodeResult {
            success,
            formatted_code,
            error_msg,
            input_python_std_out,
            output_value,
            array_output,
            line_number,
        }
    }
}

#[wasm_bindgen]
pub struct JsComputeGetCells {
    rect: Rect,
    sheet_name: Option<String>,
    line_number: Option<i64>,
}

#[wasm_bindgen]
impl JsComputeGetCells {
    #[wasm_bindgen(constructor)]
    pub fn new(rect: Rect, sheet_name: Option<String>, line_number: Option<i64>) -> Self {
        Self {
            rect,
            sheet_name,
            line_number,
        }
    }
}

impl JsComputeGetCells {
    pub fn sheet_name(&self) -> Option<String> {
        self.sheet_name.clone()
    }
    pub fn rect(&self) -> Rect {
        self.rect
    }
    pub fn line_number(&self) -> Option<i64> {
        self.line_number
    }
}
