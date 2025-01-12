use quadratic_core::{controller::GridController, sheet_offsets::SheetOffsets};
use wasm_bindgen::prelude::*;

pub use quadratic_core::a1::js_selection::JsSelection;

pub mod date_time;
pub mod jsexpr;
pub mod lsp;
pub mod parse_formula;

#[wasm_bindgen]
pub struct SheetOffsetsWasm {}

#[wasm_bindgen]
impl SheetOffsetsWasm {
    #[wasm_bindgen(js_name = "load")]
    pub fn js_load(data: &str) -> Result<SheetOffsets, JsValue> {
        let sheet_offsets = serde_json::from_str(data);
        match sheet_offsets {
            Ok(sheet_offsets) => Ok(sheet_offsets),
            Err(err) => Err(JsValue::from_str(&err.to_string())),
        }
    }

    #[wasm_bindgen(js_name = "empty")]
    pub fn new_sheet_offsets() -> SheetOffsets {
        SheetOffsets::default()
    }
}

#[wasm_bindgen]
pub struct GridControllerWasm {}

#[wasm_bindgen]
impl GridControllerWasm {
    #[wasm_bindgen(js_name = "getCSVPreview")]
    pub fn js_get_csv_preview(
        file: Vec<u8>,
        max_rows: u32,
        delimiter: Option<u8>,
    ) -> Result<JsValue, JsValue> {
        let preview = GridController::get_csv_preview(file, max_rows, delimiter);
        match preview {
            Ok(preview) => Ok(serde_wasm_bindgen::to_value(&preview)?),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}
