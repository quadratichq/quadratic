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

#[wasm_bindgen(typescript_custom_section)]
const JS_CODE_RESULT: &'static str = r#"
interface JsComputeResult {
    complete: boolean;
    rect?: Rect;
    sheet_id?: String;
    line_number?: i64;
    result?: JsCodeResult;
}
"#;

#[wasm_bindgen(typescript_custom_section)]
const IJS_CODE_RESULT: &'static str = r#"
interface JsCodeResult {
    formatted_code?: String;
    success: boolean;
    error_span?: number[];
    error_msg?: string;
    std_out: string;
    output_value?: string;
    array_output?: String[][];
}
"#;

#[wasm_bindgen(module = "/../src/web-workers/rustWorker.ts")]
extern "C" {
    pub async fn runPython(code_string: String, cells: Option<String>) -> JsValue;
}
