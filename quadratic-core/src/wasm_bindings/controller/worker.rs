use std::collections::HashMap;

use js_sys::wasm_bindgen;
use serde::{Deserialize, Serialize};
use wasm_bindgen::JsValue;

use crate::sheet_offsets::SheetOffsets;

use super::*;

#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
/// Information shared between the core thread and the render thread. Note: in
/// v2 of workers, this will be Rust to Rust communication instead of going
/// through TS.
pub struct RendererWorker {
    offsets: HashMap<String, String>,
}

#[wasm_bindgen]
impl GridController {
    /// Prepares the data to be sent to the Renderer worker from the Core worker.
    #[wasm_bindgen(js_name = "rendererWorker")]
    pub fn renderer_worker(&self) -> Result<JsValue, JsValue> {
        let offsets = self
            .sheet_ids()
            .iter()
            .flat_map(|s| {
                self.try_sheet(*s).map(|sheet| {
                    if let Ok(offsets) = serde_json::to_string(&sheet.offsets) {
                        Some((s.to_string(), offsets))
                    } else {
                        None
                    }
                })
            })
            .flatten()
            .collect();

        let output = RendererWorker { offsets };
        Ok(serde_wasm_bindgen::to_value(&output)?)
    }

    /// Renderer gets a Sheet's offsets from the Core worker.
    #[wasm_bindgen(js_name = "rendererSheetOffsets")]
    pub fn renderer_sheet_offsets(
        sheet_id: String,
        value: JsValue,
    ) -> Result<SheetOffsets, JsValue> {
        let value: RendererWorker = serde_wasm_bindgen::from_value(value)?;
        value.offsets.get(&sheet_id).map_or_else(
            || Err(JsValue::from_str("Sheet not found")),
            |offsets| serde_json::from_str::<SheetOffsets>(offsets).map_err(|_| JsValue::UNDEFINED),
        )
    }
}
