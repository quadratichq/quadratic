use super::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = JSON)]
    pub(crate) fn stringify(value: &JsValue) -> String;
}

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    pub(crate) fn log(s: &str);
}

#[wasm_bindgen(module = "/../src/web-workers/rustWorker.ts")]
extern "C" {
    pub fn runPython(code_string: String) -> JsValue;
}

#[wasm_bindgen(module = "/../src/web-workers/rustWorker.ts")]
extern "C" {
    pub fn getCellsPython(code_string: String) -> JsValue;
}

// todo: how do i send this???

// #[wasm_bindgen(module = "/../src/web-workers/rustWorker.ts")]
// extern "C" {
//     pub fn transactionResponse(transactionResponse: TransactionSummary) -> JsValue;
// }
