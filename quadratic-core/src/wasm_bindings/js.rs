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

#[wasm_bindgen(module = "/../quadratic-client/src/grid/controller/rustCallbacks.ts")]
extern "C" {
    pub fn runPython(
        transactionId: String,
        x: i32,
        y: i32,
        sheet_id: String,
        code: String,
    ) -> JsValue;
}

#[wasm_bindgen(module = "/../quadratic-client/src/grid/controller/rustCallbacks.ts")]
extern "C" {
    pub fn addUnsentTransaction(transaction_id: String, transaction: String);
}

#[wasm_bindgen(module = "/../quadratic-client/src/grid/controller/rustCallbacks.ts")]
extern "C" {
    pub fn sendTransaction(transaction_id: String, transaction: String);
}
