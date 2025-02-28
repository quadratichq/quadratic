use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Default, Debug, Serialize, Deserialize, TS)]
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
    pub chart_pixel_output: Option<(f32, f32)>,
    pub has_headers: bool,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct JsConnectionResult {
    pub transaction_id: String,
    pub data: Vec<u8>,
}
