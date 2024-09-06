use std::str::FromStr;

use uuid::Uuid;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::{execution::ai_assist::AIAssistResponse, GridController},
    grid::SheetId,
    Pos,
};

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "setAIAssistResponse")]
    pub fn js_set_ai_assist_response(
        &mut self,
        sheet_id: String,
        x: i32,
        y: i32,
        response: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            let pos = Pos {
                x: x as i64,
                y: y as i64,
            };
            let ai_assist_response =
                serde_json::from_str::<AIAssistResponse>(&response).map_err(|e| e.to_string())?;
            Ok(serde_wasm_bindgen::to_value(&self.set_ai_assist_response(
                pos.to_sheet_pos(sheet_id),
                ai_assist_response,
                cursor,
            ))?)
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    #[wasm_bindgen(js_name = "confirmAIAssistResponse")]
    pub fn js_confirm_ai_assist_response(
        &mut self,
        transaction_id: String,
        accept: bool,
    ) -> Result<JsValue, JsValue> {
        if let Ok(transaction_id) = Uuid::from_str(&transaction_id) {
            Ok(serde_wasm_bindgen::to_value(
                &self.confirm_ai_assist_response(transaction_id, accept),
            )?)
        } else {
            Err(JsValue::from_str("Invalid transaction id"))
        }
    }
}
