use sheet::keyboard::Direction;
use ts_rs::TS;
use wasm_bindgen::prelude::*;

use super::*;

#[derive(Serialize, Deserialize, Debug, TS)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct MinMax {
    pub min: i32,
    pub max: i32,
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "moveCursor")]
    pub fn js_move_cursor(
        &self,
        sheet_id: String,
        pos: String,
        direction: String,
    ) -> Result<Pos, JsValue> {
        let sheet = self
            .try_sheet_from_string_id(&sheet_id)
            .ok_or_else(|| JsValue::from_str("Sheet not found"))?;
        let pos: Pos = serde_json::from_str(&pos)
            .map_err(|e| JsValue::from_str(&format!("Invalid current position: {}", e)))?;
        let direction: Direction = serde_json::from_str(&direction)
            .map_err(|e| JsValue::from_str(&format!("Invalid direction: {}", e)))?;
        Ok(sheet.move_cursor(pos, direction))
    }

    #[wasm_bindgen(js_name = "jumpCursor")]
    pub fn js_jump_cursor(
        &self,
        sheet_id: String,
        pos: String,
        jump: bool,
        direction: String,
    ) -> Result<Pos, JsValue> {
        let sheet = self
            .try_sheet_from_string_id(&sheet_id)
            .ok_or_else(|| JsValue::from_str("Sheet not found"))?;
        let pos: Pos = serde_json::from_str(&pos)
            .map_err(|e| JsValue::from_str(&format!("Invalid current position: {}", e)))?;
        let direction: Direction = serde_json::from_str(&direction)
            .map_err(|e| JsValue::from_str(&format!("Invalid direction: {}", e)))?;
        if jump {
            Ok(sheet.jump_cursor(pos, direction))
        } else {
            Ok(sheet.move_cursor(pos, direction))
        }
    }
}
