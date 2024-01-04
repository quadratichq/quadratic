use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{Pos, Rect};

// todo: CellsForArray should be ts-rs type instead of rust type.
// It should be renamed to something more meaningful.
// TransactionResponse by js_calculation_get_cells instead of requiring a separate call.

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
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

#[derive(Debug)]
#[wasm_bindgen]
pub struct CellsForArray {
    cells: Vec<CellForArray>,
    i: usize,
    // todo: this should be the Option<TransactionSummary>
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
    pub fn get_cells(&self) -> &Vec<CellForArray> {
        &self.cells
    }
}

#[wasm_bindgen]
impl CellsForArray {
    #[wasm_bindgen]
    #[allow(clippy::should_implement_trait)]
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

// todo: this should also be reworked with ts-rs
#[wasm_bindgen]
pub struct JsCodeResult {
    transaction_id: String,
    success: bool,
    formatted_code: Option<String>,
    error_msg: Option<String>,
    input_python_std_out: Option<String>,
    output_value: Option<String>,
    array_output: Option<Vec<Vec<String>>>,
    line_number: Option<u32>,
    pub cancel_compute: Option<bool>,
}

impl JsCodeResult {
    pub fn transaction_id(&self) -> String {
        self.transaction_id.clone()
    }
    pub fn success(&self) -> bool {
        self.success
    }
    pub fn output_value(&self) -> Option<String> {
        self.output_value.clone()
    }
    pub fn array_output(&self) -> Option<Vec<Vec<String>>> {
        self.array_output.clone()
    }
    pub fn error_msg(&self) -> Option<String> {
        self.error_msg.clone()
    }
    pub fn line_number(&self) -> Option<u32> {
        self.line_number
    }
    pub fn formatted_code(&self) -> Option<String> {
        self.formatted_code.clone()
    }
    pub fn input_python_std_out(&self) -> Option<String> {
        self.input_python_std_out.clone()
    }

    #[cfg(test)]
    #[allow(clippy::too_many_arguments)]
    pub fn new_from_rust(
        transaction_id: String,
        success: bool,
        formatted_code: Option<String>,
        error_msg: Option<String>,
        input_python_std_out: Option<String>,
        output_value: Option<String>,
        array_output: Option<Vec<Vec<String>>>,
        line_number: Option<u32>,
        cancel_compute: Option<bool>,
    ) -> Self {
        JsCodeResult {
            transaction_id,
            success,
            formatted_code,
            error_msg,
            input_python_std_out,
            output_value,
            array_output,
            line_number,
            cancel_compute,
        }
    }
}

#[wasm_bindgen]
impl JsCodeResult {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        transaction_id: String,
        success: bool,
        formatted_code: Option<String>,
        error_msg: Option<String>,
        input_python_std_out: Option<String>,
        output_value: Option<String>,
        array_output: Option<String>,
        line_number: Option<u32>,
        cancel_compute: Option<bool>,
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
            transaction_id,
            success,
            formatted_code,
            error_msg,
            input_python_std_out,
            output_value,
            array_output,
            line_number,
            cancel_compute: cancel_compute.or(Some(false)),
        }
    }
}

#[wasm_bindgen]
pub struct JsComputeGetCells {
    transaction_id: String,
    rect: Rect,
    sheet_name: Option<String>,
    line_number: Option<i64>,
}

#[wasm_bindgen]
impl JsComputeGetCells {
    #[wasm_bindgen(constructor)]
    pub fn new(
        transaction_id: String,
        rect: Rect,
        sheet_name: Option<String>,
        line_number: Option<i64>,
    ) -> Self {
        Self {
            transaction_id,
            rect,
            sheet_name,
            line_number,
        }
    }
}

impl JsComputeGetCells {
    pub fn transaction_id(&self) -> String {
        self.transaction_id.clone()
    }
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
