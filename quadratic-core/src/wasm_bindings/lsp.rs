use super::*;

#[wasm_bindgen(js_name = "provideCompletionItems")]
pub fn provide_completion_items(
    _text_model: JsValue,
    _position: JsValue,
    _context: JsValue,
    _token: JsValue,
) -> Result<JsValue, JsValue> {
    Ok(serde_wasm_bindgen::to_value(
        &crate::formulas::lsp::provide_completion_items(),
    )?)
}

#[wasm_bindgen(js_name = "provideHover")]
pub async fn provide_hover(
    text_model: JsValue,
    position: JsValue,
    _token: JsValue,
) -> Result<JsValue, JsValue> {
    let partial_function_name = jsexpr!(text_model.getWordAtPosition(position).word)
        .as_string()
        .unwrap_or_default();
    let result = crate::formulas::lsp::provide_hover(&partial_function_name);
    Ok(serde_wasm_bindgen::to_value(&result)?)
}
