use wasm_bindgen::prelude::wasm_bindgen;

use crate::Rect;

// todo: this should also be reworked with ts-rs
#[derive(Debug)]
#[wasm_bindgen]
pub struct JsCodeResult {
    transaction_id: String,
    success: bool,
    error_msg: Option<String>,
    input_python_std_out: Option<String>,
    output_value: Option<Vec<String>>,
    array_output: Option<Vec<Vec<Vec<String>>>>,
    line_number: Option<u32>,
    output_type: Option<String>,
    pub cancel_compute: Option<bool>,
}

impl JsCodeResult {
    pub fn transaction_id(&self) -> String {
        self.transaction_id.clone()
    }
    pub fn success(&self) -> bool {
        self.success
    }
    pub fn output_value(&self) -> Option<Vec<String>> {
        self.output_value.clone()
    }
    pub fn array_output(&self) -> Option<Vec<Vec<Vec<String>>>> {
        self.array_output.clone()
    }
    pub fn error_msg(&self) -> Option<String> {
        self.error_msg.clone()
    }
    pub fn output_type(&self) -> Option<String> {
        self.output_type.clone()
    }
    pub fn line_number(&self) -> Option<u32> {
        self.line_number
    }
    pub fn input_python_std_out(&self) -> Option<String> {
        self.input_python_std_out.clone()
    }

    #[cfg(test)]
    #[allow(clippy::too_many_arguments)]
    pub fn new_from_rust(
        transaction_id: String,
        success: bool,
        error_msg: Option<String>,
        input_python_std_out: Option<String>,
        output_value: Option<Vec<String>>,
        array_output: Option<Vec<Vec<Vec<String>>>>,
        line_number: Option<u32>,
        output_type: Option<String>,
        cancel_compute: Option<bool>,
    ) -> Self {
        JsCodeResult {
            transaction_id,
            success,
            error_msg,
            input_python_std_out,
            output_value,
            array_output,
            line_number,
            output_type,
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
        error_msg: Option<String>,
        input_python_std_out: Option<String>,
        output_value: Option<Vec<String>>,
        array_output: Option<String>,
        line_number: Option<u32>,
        output_type: Option<String>,
        cancel_compute: Option<bool>,
    ) -> Self {
        let array_output: Option<Vec<Vec<Vec<String>>>> = if let Some(output_value) = array_output {
            match serde_json::from_str(&output_value) {
                Ok(array) => Some(array),
                Err(e) => {
                    crate::util::dbgjs(format!(
                        "Could not parse array_output in JsCodeResult::new: {:?}",
                        e
                    ));
                    panic!("Could not parse array_output in JsCodeResult::new")
                }
            }
        } else {
            None
        };

        JsCodeResult {
            transaction_id,
            success,
            error_msg,
            input_python_std_out,
            output_value,
            array_output,
            line_number,
            output_type,
            cancel_compute: cancel_compute.or(Some(false)),
        }
    }
}

#[wasm_bindgen]
pub struct JsComputeGetCells {
    transaction_id: String,
    rect: Rect,
    sheet_name: Option<String>,
    line_number: Option<u32>,
}

#[wasm_bindgen]
impl JsComputeGetCells {
    #[wasm_bindgen(constructor)]
    pub fn new(
        transaction_id: String,
        rect: Rect,
        sheet_name: Option<String>,
        line_number: Option<u32>,
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
    pub fn line_number(&self) -> Option<u32> {
        self.line_number
    }
}
