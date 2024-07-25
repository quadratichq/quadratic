use serde::{Deserialize, Serialize};
use ts_rs::TS;

// this version is deprecated. See JsRunResult below for new implementation
#[derive(Debug, Serialize, Deserialize, TS)]
pub struct JsCodeResult {
    pub transaction_id: String,
    pub success: bool,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub line_number: Option<u32>,
    pub output_value: Option<Vec<String>>,
    pub output_array: Option<Vec<Vec<Vec<String>>>>,
    pub output_display_type: Option<String>,
    pub cancel_compute: Option<bool>,
}

impl JsCodeResult {
    #[cfg(test)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        transaction_id: String,
        success: bool,
        std_err: Option<String>,
        std_out: Option<String>,
        output_value: Option<Vec<String>>,
        output_array: Option<Vec<Vec<Vec<String>>>>,
        line_number: Option<u32>,
        output_display_type: Option<String>,
        cancel_compute: Option<bool>,
    ) -> Self {
        JsCodeResult {
            transaction_id,
            success,
            std_err,
            std_out,
            output_value,
            output_array,
            line_number,
            output_display_type,
            cancel_compute,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsConnectionResult {
    pub transaction_id: String,
    pub data: Vec<u8>,
}
