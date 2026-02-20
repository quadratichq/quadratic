use serde::{Deserialize, Serialize};
use ts_rs::TS;

/*
  Blank = 0,
  Text = 1,
  Number = 2,
  Logical = 3,
  Duration = 4,
  Error = 5,
  Html = 6,
  Code = 7,
  Image = 8,
  Date = 9,
  Time = 10,
  DateTime = 11,
  Import = 12,
*/

#[derive(Default, Debug, Serialize, Deserialize, Clone, TS, PartialEq)]
pub struct JsCellValueResult(pub String, pub u8);

#[derive(Default, Clone, Debug, Serialize, Deserialize, TS, PartialEq)]
pub struct JsCodeResult {
    pub transaction_id: String,
    pub success: bool,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub line_number: Option<u32>,
    pub output_value: Option<JsCellValueResult>,
    pub output_array: Option<Vec<Vec<JsCellValueResult>>>,
    pub output_display_type: Option<String>,
    // DEPRECATED: Use chart_output (cell dimensions) with sheet offsets to calculate pixels.
    // Kept for backwards compatibility.
    pub chart_pixel_output: Option<(f32, f32)>,
    pub chart_image: Option<String>,
    pub has_headers: bool,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct JsConnectionResult {
    pub transaction_id: String,
    pub data: Vec<u8>,
}
