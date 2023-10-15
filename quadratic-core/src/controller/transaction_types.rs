use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::Rect;

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
}

#[wasm_bindgen]
pub struct CellsForArray {
    cells: Vec<CellForArray>,
    i: usize,
}

impl CellsForArray {
    pub fn new(cells: Vec<CellForArray>) -> Self {
        Self { cells, i: 0 }
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

    pub fn reset(&mut self) {
        self.i = 0;
    }
}

#[wasm_bindgen]
pub struct JsCodeResult {
    success: bool,
    cells_accessed: Vec<[i64; 2]>,
    formatted_code: Option<String>,
    error_span: Option<[u32; 2]>,
    error_msg: Option<String>,
    input_python_std_out: Option<String>,
    output_value: Option<String>,
    array_output: Option<Vec<Vec<String>>>,
}

impl JsCodeResult {
    pub fn success(&self) -> bool {
        self.success
    }
    pub fn cells_accessed(&self) -> &Vec<[i64; 2]> {
        self.cells_accessed.as_ref()
    }
    pub fn formatted_code(&self) -> Option<String> {
        self.formatted_code.clone()
    }
    pub fn error_span(&self) -> Option<[u32; 2]> {
        self.error_span
    }
    pub fn error_msg(&self) -> Option<String> {
        self.error_msg.clone()
    }
    pub fn input_python_std_out(&self) -> Option<String> {
        self.input_python_std_out.clone()
    }
    pub fn output_value(&self) -> Option<String> {
        self.output_value.clone()
    }
    pub fn array_output(&self) -> Option<Vec<Vec<String>>> {
        self.array_output.clone()
    }
}

#[wasm_bindgen]
impl JsCodeResult {
    #[wasm_bindgen(constructor)]
    pub fn new(
        success: bool,
        cells_accessed_start: i64,
        cells_accessed_end: i64,
        formatted_code: Option<String>,
        error_span_start: Option<u32>,
        error_span_end: Option<u32>,
        error_msg: Option<String>,
        input_python_std_out: Option<String>,
        output_value: Option<String>,
        array_output: Option<String>,
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
            cells_accessed: vec![[cells_accessed_start, cells_accessed_end]],
            formatted_code,
            error_span: match (error_span_start, error_span_end) {
                (Some(start), Some(end)) => Some([start, end]),
                _ => None,
            },
            error_msg,
            input_python_std_out,
            output_value,
            array_output,
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
    #[wasm_bindgen]
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
