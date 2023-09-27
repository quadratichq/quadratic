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
    // cellsAccessed: Coordinate[];
    success: boolean;
    error_span?: number[];
    error_msg?: string;
    output_value?: string;
    // array_output: Option<Vec<Vec<String>>>;
}
"#;

// struct JsCodeResult {
//     pub language: CodeCellLanguage,
//     pub cells_accessed: Array,
//     pub success: bool,
//     pub formatted_code: Option<String>,
//     pub error_span_start: Option<u32>,
//     pub error_span_end: Option<u32>,
//     pub error_msg: Option<String>,
//     pub output_value: Option<String>,
//     pub array_output: Option<Array>,
// }

#[wasm_bindgen(module = "/../src/web-workers/webWorkers.ts")]
extern "C" {
    pub async fn runPython(code_string: String) -> JsValue;
}
