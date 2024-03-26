use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsCodeResult {
    pub transaction_id: String,
    pub success: bool,
    pub formatted_code: Option<String>,
    pub error_msg: Option<String>,
    pub input_python_std_out: Option<String>,
    pub output_value: Option<Vec<String>>,
    pub array_output: Option<Vec<Vec<Vec<String>>>>,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
    pub cancel_compute: Option<bool>,
}

impl JsCodeResult {
    #[cfg(test)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        transaction_id: String,
        success: bool,
        formatted_code: Option<String>,
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
            formatted_code,
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
