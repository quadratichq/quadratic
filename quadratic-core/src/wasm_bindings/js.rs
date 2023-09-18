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
const IJS_CODE_RESULT: &'static str = r#"
interface JsCodeResult {
    cellsAccessed: Pos[],
    pub success: boolean,
    pub error_span: Option<[u32; 2]>,
    pub error_msg: Option<String>,
    pub output_value: Option<String>,
    pub array_output: Option<Vec<Vec<String>>>,
}
"#;

#[wasm_bindgen]
struct JsCodeResult {
    cells_accessed: Vec<Pos>,
    success: bool,
    formatted_code: Option<String>,
    error_span: Option<[u32; 2]>,
    error_msg: Option<String>,
    output_value: Option<String>,
    array_output: Option<Vec<Vec<String>>>,
}

#[wasm_bindgen(module = "/../src/web-workers/webWorkers.ts")]
extern "C" {

    type WebWorkers;

    pub fn runPython(code_string: String) -> JsCodeResult;
}
