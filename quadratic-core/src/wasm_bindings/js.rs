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

#[wasm_bindgen(
    module = "/../quadratic-client/src/web-workers/quadraticCore/worker/rustCallbacks.ts"
)]
extern "C" {
    pub fn runPython(
        transactionId: String,
        x: i32,
        y: i32,
        sheet_id: String,
        code: String,
    ) -> JsValue;
    pub fn addUnsentTransaction(transaction_id: String, transaction: String);
    pub fn sendTransaction(transaction_id: String, transaction: String);

    pub fn jsTime(name: String);
    pub fn jsTimeEnd(name: String);

    pub fn jsImportProgress(
        file_name: &str,
        current: u32,
        total: u32,
        x: i64,
        y: i64,
        w: u32,
        h: u32,
    );

    // cells: Vec<JsRenderCell>
    pub fn jsRenderCellSheets(
        sheet_id: String,
        hash_x: i64,
        hash_y: i64,
        cells: String, /*Vec<JsRenderCell>*/
    );
}
