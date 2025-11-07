use deno_core::ModuleSpecifier;
use deno_core::PollEventLoopOptions;
use deno_core::{JsRuntime, RuntimeOptions, serde_v8, v8};
use quadratic_core::controller::GridController;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Response;
use quadratic_core::controller::transaction_types::{JsCellValueResult, JsCodeResult};
use std::rc::Rc;
use std::sync::{Arc, Mutex, OnceLock};
use tokio::sync::Mutex as TokioMutex;

use crate::error::{CoreCloudError, Result};
use crate::javascript::imports::{QuadraticModuleLoader, extract_imports};

type GetCellsFunction = Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>;

// Global state for get_cells function and current position
static GET_CELLS_FUNCTION: OnceLock<Arc<Mutex<Option<GetCellsFunction>>>> = OnceLock::new();
static CURRENT_POSITION: OnceLock<Arc<Mutex<(i32, i32)>>> = OnceLock::new();

// JS code
static GLOBALS_JS: &str = include_str!("js_code/globals.js");
static PROCESS_OUTPUT_JS: &str = include_str!("js_code/process_output.js");
static QUADRATIC_JS: &str = include_str!("js_code/quadratic.js");

pub fn empty_js_code_result(transaction_id: &str) -> JsCodeResult {
    JsCodeResult {
        transaction_id: transaction_id.to_string(),
        success: false,
        ..Default::default()
    }
}

pub(crate) async fn run_javascript(
    grid: Arc<TokioMutex<GridController>>,
    code: &str,
    transaction_id: &str,
    get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
) -> Result<()> {
    let js_code_result = execute(code, transaction_id, get_cells).await?;

    grid.lock()
        .await
        .calculation_complete(js_code_result)
        .map_err(|e| CoreCloudError::Core(e.to_string()))
}

pub(crate) async fn execute(
    code: &str,
    transaction_id: &str,
    get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
) -> Result<JsCodeResult> {
    // Check if code is empty
    if code.trim().is_empty() {
        return Ok(empty_js_code_result(transaction_id));
    }

    // Store the get_cells function in global state
    let get_cells_store = GET_CELLS_FUNCTION.get_or_init(|| Arc::new(Mutex::new(None)));
    *get_cells_store.lock()? = Some(get_cells);

    // Initialize current position (could be passed as parameter in the future)
    let pos_store = CURRENT_POSITION.get_or_init(|| Arc::new(Mutex::new((0, 0))));
    *pos_store.lock()? = (0, 0);

    // Create Deno runtime with module loader if ES imports are detected
    let mut runtime = JsRuntime::new(RuntimeOptions {
        module_loader: Some(Rc::new(QuadraticModuleLoader)),
        ..Default::default()
    });

    // First, inject basic global functions that should always be available
    let _ = runtime.execute_script("globals.js", GLOBALS_JS);

    // Inject the actual callback functions using v8 function injection
    {
        let scope = &mut runtime.handle_scope();
        let global = scope.get_current_context().global(scope);

        // Create the get_cells callback function
        let get_cells_name = v8::String::new(scope, "__get_cells__").ok_or_else(|| {
            CoreCloudError::Javascript("Failed to create get_cells name".to_string())
        })?;
        let get_cells_func = v8::Function::new(
            scope,
            |scope: &mut v8::HandleScope,
             args: v8::FunctionCallbackArguments,
             mut retval: v8::ReturnValue| {
                // Extract arguments
                let a1 = if args.length() > 0 {
                    match args.get(0).to_string(scope) {
                        Some(s) => s.to_rust_string_lossy(scope),
                        None => return,
                    }
                } else {
                    return;
                };

                let first_row_header = if args.length() > 1 {
                    args.get(1).boolean_value(scope)
                } else {
                    false
                };

                // Call the Rust function
                let response_json = call_get_cells_from_js(a1, first_row_header);

                // Parse and return the response
                match v8::String::new(scope, &response_json) {
                    Some(response_str) => {
                        let maybe_parsed = v8::json::parse(scope, response_str);
                        if let Some(parsed) = maybe_parsed {
                            retval.set(parsed);
                        } else {
                            let null_val = v8::null(scope);
                            retval.set(null_val.into());
                        }
                    }
                    None => {
                        let null_val = v8::null(scope);
                        retval.set(null_val.into());
                    }
                }
            },
        );

        if let Some(func) = get_cells_func {
            global.set(scope, get_cells_name.into(), func.into());
        }

        // Create the current_pos callback function
        let pos_name = v8::String::new(scope, "__current_pos__").ok_or_else(|| {
            CoreCloudError::Javascript("Failed to create current_pos name".to_string())
        })?;
        let pos_func = v8::Function::new(
            scope,
            |scope: &mut v8::HandleScope,
             _args: v8::FunctionCallbackArguments,
             mut retval: v8::ReturnValue| {
                // Call the Rust function
                let pos_json = get_current_position_from_js();

                // Parse and return the position
                match v8::String::new(scope, &pos_json) {
                    Some(pos_str) => {
                        let maybe_parsed = v8::json::parse(scope, pos_str);
                        if let Some(parsed) = maybe_parsed {
                            retval.set(parsed);
                        } else {
                            let default_pos = v8::Array::new(scope, 2);
                            let zero = v8::Integer::new(scope, 0);
                            default_pos.set_index(scope, 0, zero.into());
                            default_pos.set_index(scope, 1, zero.into());
                            retval.set(default_pos.into());
                        }
                    }
                    None => {
                        let default_pos = v8::Array::new(scope, 2);
                        let zero = v8::Integer::new(scope, 0);
                        default_pos.set_index(scope, 0, zero.into());
                        default_pos.set_index(scope, 1, zero.into());
                        retval.set(default_pos.into());
                    }
                }
            },
        );

        if let Some(func) = pos_func {
            global.set(scope, pos_name.into(), func.into());
        }
    }

    // Setup quadratic module
    let result = runtime.execute_script("quadratic.js", QUADRATIC_JS);
    if let Err(e) = result {
        return Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: false,
            std_err: Some(format!("Setup error: {}", e)),
            ..Default::default()
        });
    }

    // Load process output functions
    let result = runtime.execute_script("process_output.js", PROCESS_OUTPUT_JS);
    if let Err(e) = result {
        return Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: false,
            std_err: Some(format!("Process output setup error: {}", e)),
            ..Default::default()
        });
    }

    // Use AST-based analysis to determine if code ends with an expression
    let analysis_code = format!("analyzeCode({:?})", code);
    let analysis_result = runtime.execute_script("analyze_code.js", analysis_code);

    let (_has_expression, setup_code, expr_code) = match analysis_result {
        Ok(global_value) => {
            let scope = &mut runtime.handle_scope();
            let local_value = v8::Local::new(scope, global_value);

            let analysis_obj =
                serde_v8::from_v8::<serde_json::Value>(scope, local_value).map_err(|e| {
                    CoreCloudError::Javascript(format!(
                        "Failed to extract AST analysis result: {}",
                        e
                    ))
                })?;

            let has_expression = analysis_obj
                .get("hasExpression")
                .and_then(|v| v.as_bool())
                .ok_or_else(|| {
                    CoreCloudError::Javascript(
                        "AST analysis missing hasExpression field".to_string(),
                    )
                })?;

            let setup_code = analysis_obj
                .get("setupCode")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    CoreCloudError::Javascript("AST analysis missing setupCode field".to_string())
                })?
                .to_string();

            let expr_code = analysis_obj
                .get("exprCode")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            (
                has_expression,
                Some(setup_code).filter(|s| !s.is_empty()),
                expr_code,
            )
        }
        Err(e) => {
            return Ok(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: false,
                std_err: Some(format!("AST analysis failed: {}", e)),
                ..Default::default()
            });
        }
    };

    execute_module(&mut runtime, code, transaction_id, setup_code, expr_code).await
}

async fn wrap_module(code: &str, setup_code: Option<String>, expr_code: Option<String>) -> String {
    // prepare the module code with proper ES module syntax

    let setup = setup_code.unwrap_or_else(|| "".to_string());
    let expr = expr_code.unwrap_or_else(|| "undefined".to_string());

    // Extract imports from setup code
    let (imports, setup_without_imports) = extract_imports(&setup);
    let imports_section = imports.join("\n");

    format!(
        r#"{}

let __result__;
let __stdout__ = [];

await (async () => {{
    // Capture output
    const originalLog = console.log;
    console.log = (...args) => {{
        __stdout__.push(args.map(String).join(' '));
        originalLog(...args);
    }};

    try {{
        {}
        __result__ = {};
    }} finally {{
        console.log = originalLog;
    }}
}})();

// Store result for global retrieval
globalThis.__quadratic_result__ = {{ result: __result__, stdout: __stdout__.join('\\n') }};

// Export the result
export default __result__;
"#,
        imports_section, setup_without_imports, expr
    )
}

async fn execute_module(
    runtime: &mut JsRuntime,
    code: &str,
    transaction_id: &str,
    setup_code: Option<String>,
    expr_code: Option<String>,
) -> Result<JsCodeResult> {
    // prepare the module code with proper ES module syntax
    let module_code = wrap_module(code, setup_code, expr_code).await;

    // Create a data URL for in-memory module execution
    let encoded_code = urlencoding::encode(&module_code);
    let data_url = format!("data:text/javascript;charset=utf-8,{}", encoded_code);

    let data_module_specifier = ModuleSpecifier::parse(&data_url).map_err(|e| {
        CoreCloudError::Javascript(format!("Failed to create data module specifier: {}", e))
    })?;

    // Load the module
    match runtime.load_main_es_module(&data_module_specifier).await {
        Ok(module_id) => {
            // Evaluate the module
            match runtime.mod_evaluate(module_id).await {
                Ok(_) => {
                    // Run the event loop to complete any async operations
                    match runtime
                        .run_event_loop(PollEventLoopOptions::default())
                        .await
                    {
                        Ok(_) => {
                            // Get the result from global variable
                            let resolved_result = runtime
                                .execute_script("get_result.js", "globalThis.__quadratic_result__");

                            match resolved_result {
                                Ok(result_global) => {
                                    let result = extract_async_result(
                                        runtime,
                                        result_global,
                                        transaction_id,
                                    )?;
                                    Ok(result)
                                }
                                Err(e) => Ok(JsCodeResult {
                                    transaction_id: transaction_id.to_string(),
                                    success: false,
                                    std_err: Some(format!("Failed to get module result: {}", e)),
                                    ..Default::default()
                                }),
                            }
                        }
                        Err(e) => {
                            let error_string = format!("{}", e);
                            let cleaned_error = decode_data_url_error(&error_string);
                            let line_number = extract_line_number_from_error(&cleaned_error);

                            Ok(JsCodeResult {
                                transaction_id: transaction_id.to_string(),
                                success: false,
                                std_err: Some(cleaned_error),
                                line_number,
                                ..Default::default()
                            })
                        }
                    }
                }
                Err(e) => {
                    let error_string = format!("{}", e);
                    let cleaned_error = decode_data_url_error(&error_string);
                    let line_number = extract_line_number_from_error(&cleaned_error);

                    Ok(JsCodeResult {
                        transaction_id: transaction_id.to_string(),
                        success: false,
                        std_err: Some(cleaned_error),
                        line_number,
                        ..Default::default()
                    })
                }
            }
        }
        Err(e) => {
            let error_string = e.to_string();
            let cleaned_error = decode_data_url_error(&error_string);
            let line_number = extract_line_number_from_error(&cleaned_error);

            Ok(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: false,
                std_err: Some(cleaned_error),
                line_number,
                ..Default::default()
            })
        }
    }
}

/// Extracts the result from an async JavaScript execution
fn extract_async_result(
    runtime: &mut JsRuntime,
    global_value: v8::Global<v8::Value>,
    transaction_id: &str,
) -> Result<JsCodeResult> {
    // extract the wrapped result object
    let (stdout, result_value) = {
        let scope = &mut runtime.handle_scope();
        let local_value = v8::Local::new(scope, global_value);

        if let Ok(result_obj) = serde_v8::from_v8::<serde_json::Value>(scope, local_value) {
            let stdout = result_obj
                .get("stdout")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(String::from);

            let result_value = result_obj.get("result").cloned();
            (stdout, result_value)
        } else {
            // fallback: treat the global value as the result directly
            let result_value = serde_v8::from_v8::<serde_json::Value>(scope, local_value).ok();
            (None, result_value)
        }
    };

    if let Some(result_value) = result_value {
        // process the output using our JavaScript processing function
        let processed_result = process_javascript_output(runtime, &result_value)?;

        Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            std_out: stdout,
            std_err: None,
            line_number: None,
            output_value: processed_result.output_value,
            output_array: processed_result.output_array,
            output_display_type: Some(processed_result.output_type),
            chart_pixel_output: None,
            has_headers: processed_result.has_headers,
        })
    } else {
        // no result value, return success with captured output
        Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            std_out: stdout,
            std_err: None,
            line_number: None,
            output_value: None,
            output_array: None,
            output_display_type: Some("undefined".to_string()),
            chart_pixel_output: None,
            has_headers: false,
        })
    }
}

/// Represents the processed output from JavaScript
#[derive(Debug, Clone)]
struct ProcessedJsOutput {
    output_type: String,
    has_headers: bool,
    output_value: Option<JsCellValueResult>,
    output_array: Option<Vec<Vec<JsCellValueResult>>>,
}

/// Processes JavaScript output using the processOutput function
fn process_javascript_output(
    runtime: &mut JsRuntime,
    result_value: &serde_json::Value,
) -> Result<ProcessedJsOutput> {
    // convert the result to a JavaScript-compatible string
    let js_value_str = serde_json::to_string(result_value)?;

    // call the processOutput function
    let process_code = format!("processOutput({})", js_value_str);
    let process_result = runtime
        .execute_script("process_result.js", process_code)
        .map_err(|e| CoreCloudError::Javascript(format!("Output processing error: {}", e)))?;

    // extract the processed result in a separate scope
    let processed_obj = {
        let scope = &mut runtime.handle_scope();
        let processed_local = v8::Local::new(scope, process_result);
        serde_v8::from_v8::<serde_json::Value>(scope, processed_local).map_err(|e| {
            CoreCloudError::Javascript(format!("Failed to extract processed result: {}", e))
        })?
    };

    let output_type = processed_obj
        .get("outputType")
        .and_then(|v| v.as_str())
        .unwrap_or("undefined")
        .to_string();

    let has_headers = processed_obj
        .get("hasHeaders")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // extract output_value
    let output_value = processed_obj
        .get("outputValue")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            if arr.len() >= 2 {
                let value_str = arr[0].as_str()?.to_string();
                let type_id = arr[1].as_u64()? as u8;
                Some(JsCellValueResult(value_str, type_id))
            } else {
                None
            }
        });

    // extract output_array
    let output_array = processed_obj
        .get("outputArray")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|row| row.as_array())
                .map(|row| {
                    row.iter()
                        .filter_map(|cell| cell.as_array())
                        .filter_map(|cell_arr| {
                            if cell_arr.len() >= 2 {
                                let value_str = cell_arr[0].as_str()?.to_string();
                                let type_id = cell_arr[1].as_u64()? as u8;
                                Some(JsCellValueResult(value_str, type_id))
                            } else {
                                None
                            }
                        })
                        .collect()
                })
                .collect()
        });

    Ok(ProcessedJsOutput {
        output_type,
        has_headers,
        output_value,
        output_array,
    })
}

// Use a simpler approach by storing the callback in a closure that can be called from JavaScript
fn call_get_cells_from_js(a1: String, _first_row_header: bool) -> String {
    let get_cells_store =
        match GET_CELLS_FUNCTION.get() {
            Some(store) => store,
            None => return serde_json::to_string(&JsCellsA1Response {
                values: None,
                error: Some(
                    quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Error {
                        core_error: "get_cells function not initialized".to_string(),
                    },
                ),
            })
            .unwrap_or_else(|_| "null".to_string()),
        };

    let mut get_cells_guard =
        match get_cells_store.lock() {
            Ok(guard) => guard,
            Err(e) => return serde_json::to_string(&JsCellsA1Response {
                values: None,
                error: Some(
                    quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Error {
                        core_error: format!("Failed to lock get_cells function: {}", e),
                    },
                ),
            })
            .unwrap_or_else(|_| "null".to_string()),
        };

    let get_cells_fn =
        match get_cells_guard.as_mut() {
            Some(func) => func,
            None => return serde_json::to_string(&JsCellsA1Response {
                values: None,
                error: Some(
                    quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Error {
                        core_error: "get_cells function not available".to_string(),
                    },
                ),
            })
            .unwrap_or_else(|_| "null".to_string()),
        };

    match get_cells_fn(a1) {
        Ok(response) => serde_json::to_string(&response).unwrap_or_else(|_| "null".to_string()),
        Err(e) => serde_json::to_string(&JsCellsA1Response {
            values: None,
            error: Some(
                quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Error {
                    core_error: format!("get_cells error: {}", e),
                },
            ),
        })
        .unwrap_or_else(|_| "null".to_string()),
    }
}

fn get_current_position_from_js() -> String {
    let pos_store = match CURRENT_POSITION.get() {
        Some(store) => store,
        None => return "[0, 0]".to_string(),
    };

    let pos_guard = match pos_store.lock() {
        Ok(guard) => guard,
        Err(_) => return "[0, 0]".to_string(),
    };

    serde_json::to_string(&*pos_guard).unwrap_or_else(|_| "[0, 0]".to_string())
}

/// Decodes URL-encoded data URLs in error messages to make them more readable
fn decode_data_url_error(error_string: &str) -> String {
    // Look for data URL patterns and decode them
    if error_string.contains("data:text/javascript;charset=utf-8,") {
        // Find the start of the encoded portion
        if let Some(start) = error_string.find("data:text/javascript;charset=utf-8,") {
            let prefix = &error_string[..start];
            let encoded_part = &error_string[start + "data:text/javascript;charset=utf-8,".len()..];

            // Find the end of the URL (usually at a space, quote, or colon)
            let end_pos = encoded_part
                .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ':')
                .unwrap_or(encoded_part.len());

            let encoded_url = &encoded_part[..end_pos];
            let suffix = &encoded_part[end_pos..];

            // Try to decode the URL
            if let Ok(_decoded) = urlencoding::decode(encoded_url) {
                // Replace the data URL with a cleaner reference
                return format!("{}user_code.js{}", prefix, suffix);
            }
        }
    }

    // If we can't decode or no data URL found, return original
    error_string.to_string()
}

/// Extracts line number from error string
fn extract_line_number_from_error(error_string: &str) -> Option<u32> {
    // look for pattern like "at user_code.js:15:7"
    if let Some(start) = error_string.find("user_code.js:") {
        let after_filename = &error_string[start + "user_code.js:".len()..];

        if let Some(colon_pos) = after_filename.find(':') {
            let line_str = &after_filename[..colon_pos];

            if let Ok(line_num) = line_str.parse::<u32>() {
                // adjust line number for our async wrapper function (subtract wrapper lines)
                return Some(1.max(line_num - 13));
            }
        }
    }

    // Fallback by looking for errors from AST analysis phase that might contain line info
    if error_string.contains("at eval") && error_string.contains("<anonymous>:") {
        // try to extract from patterns like "at eval (eval at analyzeCode (process_output.js:56:13), <anonymous>:5:7)"
        if let Some(anon_start) = error_string.find("<anonymous>:") {
            let after_anon = &error_string[anon_start + "<anonymous>:".len()..];

            if let Some(colon_pos) = after_anon.find(':') {
                let line_str = &after_anon[..colon_pos];

                if let Ok(line_num) = line_str.parse::<u32>() {
                    return Some(line_num);
                }
            }
        }
    }

    None
}

// /// Extracts structured error information from V8 errors
// fn extract_v8_error_info(_runtime: &mut JsRuntime, error: &JsError) -> (String, Option<u32>) {
//     let error_string = error.to_string();

//     // get line number from V8 error frames
//     for frame in &error.frames {
//         if let Some(line_number) = frame.line_number {
//             // adjust line number for our async wrapper function
//             let adjusted_line = if line_number > 13 {
//                 Some(line_number as u32 - 13)
//             } else {
//                 Some(1)
//             };

//             return (error_string, adjusted_line);
//         }
//     }

//     // fallback: try to extract from error string
//     let line_number = extract_line_number_from_error(&error_string);

//     (error_string, line_number)
// }

#[cfg(test)]
pub(crate) mod tests {
    use quadratic_core::controller::execution::run_code::get_cells::{
        JsCellsA1Value, JsCellsA1Values,
    };

    use super::*;
    use std::time::Instant;

    fn test_get_cells(_a1: String) -> Result<JsCellsA1Response> {
        Ok(JsCellsA1Response {
            values: Some(JsCellsA1Values {
                cells: vec![JsCellsA1Value {
                    x: 1,
                    y: 1,
                    v: "42".to_string(),
                    t: 2,
                }],
                x: 1,
                y: 1,
                w: 1,
                h: 1,
                one_dimensional: false,
                two_dimensional: false,
                has_headers: false,
            }),
            error: None,
        })
    }

    pub(crate) async fn test_execute(code: &str) -> JsCodeResult {
        let start = Instant::now();
        let result = execute(code, "test", Box::new(test_get_cells))
            .await
            .unwrap_or_else(|e| JsCodeResult {
                transaction_id: "test".to_string(),
                success: false,
                std_err: Some(format!("Execution error: {}", e)),
                ..Default::default()
            });
        let end = Instant::now();

        println!("time: {:?}", end.duration_since(start));
        println!("result: {:#?}", result);

        result
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_execute_simple() {
        let code = r#"
console.log("Hello, World!");
42
"#;
        let result = test_execute(code).await;

        assert!(result.success);
        assert!(result.std_out.is_some());
        assert_eq!(
            result.output_value,
            Some(JsCellValueResult(String::from("42"), 2))
        );
        assert_eq!(result.output_display_type, Some("number".to_string()));
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_execute_error() {
        let code = r#"
throw new Error("Test error");
"#;
        let result = test_execute(code).await;

        assert!(!result.success);
        assert!(result.std_err.is_some());
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_execute_no_return() {
        let code = r#"
let x = 42;
let y = "hello";
"#;
        let result = test_execute(code).await;

        assert!(result.success);
        assert_eq!(result.output_display_type, Some("undefined".to_string()));
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_get_cells_integration() {
        let code = r#"
let cells = q.cells("A1:B2");
console.log("Cells:", cells);
"#;
        let result = test_execute(code).await;

        assert_eq!(
            result,
            JsCodeResult {
                transaction_id: "test".into(),
                success: true,
                std_out: Some("Cells: 42".into()),
                std_err: None,
                line_number: None,
                output_value: None,
                output_array: None,
                output_display_type: Some("undefined".into()),
                chart_pixel_output: None,
                has_headers: false,
            }
        );
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_execute_array_output() {
        let code = r#"
[["Name", "Age"], ["Alice", 25], ["Bob", 30]]
"#;
        let result = test_execute(code).await;

        assert!(result.success);
        assert!(result.has_headers);
        assert_eq!(result.output_display_type, Some("Array".into()));
        assert_eq!(
            result.output_array,
            Some(vec![
                vec![
                    JsCellValueResult("Name".into(), 1),
                    JsCellValueResult("Age".into(), 1)
                ],
                vec![
                    JsCellValueResult("Alice".into(), 1),
                    JsCellValueResult("25".into(), 2)
                ],
                vec![
                    JsCellValueResult("Bob".into(), 1),
                    JsCellValueResult("30".into(), 2)
                ],
            ])
        );
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_execute_async_code() {
        let code = r#"
await new Promise(resolve => setTimeout(resolve, 100));
"async result"
"#;
        let result = test_execute(code).await;

        assert!(result.success);
        assert!(result.std_err.is_none());
        assert_eq!(
            result.output_value,
            Some(JsCellValueResult("async result".into(), 1))
        );
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_v8_error_extraction() {
        let code = r#"
let x = 42;
throw new Error("Test error");
"#;

        let result = test_execute(code).await;
        assert!(!result.success);
        assert!(result.std_err.is_some());
        assert_eq!(result.line_number, Some(3));
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_in_memory_module_loading() {
        let mut runtime = JsRuntime::new(RuntimeOptions {
            module_loader: Some(Rc::new(QuadraticModuleLoader)),
            ..Default::default()
        });

        let test_code = r#"
console.log("Hello from in-memory module!");
const result = 42 * 2;
export default result;
"#;

        // create a data URL for the module code
        let encoded_code = urlencoding::encode(test_code);
        let data_url = format!("data:text/javascript;charset=utf-8,{}", encoded_code);

        // parse the data URL as a module specifier
        let module_specifier = ModuleSpecifier::parse(&data_url).expect("Should parse data URL");

        // load and evaluate the module
        let module_id = runtime
            .load_main_es_module(&module_specifier)
            .await
            .expect("Should load module");

        // evaluate the module
        runtime
            .mod_evaluate(module_id)
            .await
            .expect("Should evaluate module");

        // run the event loop to complete any async operations
        runtime
            .run_event_loop(deno_core::PollEventLoopOptions::default())
            .await
            .expect("Event loop should complete");
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_execute_date() {
        let code = r#"
        return Date();
"#;
        let result = test_execute(code).await;
        assert!(result.success);
    }
}
