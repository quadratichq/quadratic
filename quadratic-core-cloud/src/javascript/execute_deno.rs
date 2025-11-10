use quadratic_core::controller::GridController;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Response;
use quadratic_core::controller::transaction_types::{JsCellValueResult, JsCodeResult};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::sync::Mutex as TokioMutex;

use crate::error::{CoreCloudError, Result};

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

pub async fn run_javascript(
    grid: Arc<TokioMutex<GridController>>,
    code: &str,
    transaction_id: &str,
    _get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
) -> Result<()> {
    let js_code_result = execute(code, transaction_id).await?;

    grid.lock()
        .await
        .calculation_complete(js_code_result)
        .map_err(|e| CoreCloudError::Core(e.to_string()))
}

async fn execute(code: &str, transaction_id: &str) -> Result<JsCodeResult> {
    // Check if code is empty
    if code.trim().is_empty() {
        return Ok(empty_js_code_result(transaction_id));
    }

    // Build the complete JavaScript code with all dependencies
    let full_code = build_javascript_wrapper(code)?;

    // Spawn Deno process
    let mut child = Command::new("deno")
        .arg("run")
        .arg("--allow-net") // Allow fetch and network access
        .arg("--no-prompt")
        .arg("-") // Read from stdin
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| CoreCloudError::Javascript(format!("Failed to spawn Deno: {}", e)))?;

    // Write code to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(full_code.as_bytes()).await.map_err(|e| {
            CoreCloudError::Javascript(format!("Failed to write to Deno stdin: {}", e))
        })?;
        stdin.flush().await.ok();
    }

    // Wait for completion and capture output
    let output = child
        .wait_with_output()
        .await
        .map_err(|e| CoreCloudError::Javascript(format!("Failed to wait for Deno: {}", e)))?;

    // Parse the result
    parse_deno_output(transaction_id, output)
}

fn build_javascript_wrapper(user_code: &str) -> Result<String> {
    // Create a wrapper that includes all necessary globals and the user code
    let wrapped_code = format!(
        r#"
// Inject Quadratic globals
{}

// Inject process output functions
{}

// Inject Quadratic API
{}

// Placeholder for q.cells() - not yet supported in scheduled tasks
globalThis.q = {{
    cells: (a1) => {{
        console.warn("q.cells() is not yet supported in scheduled tasks");
        return null;
    }},
    pos: () => [0, 0]
}};

// User code wrapped in async context
(async () => {{
    try {{
        let __result__;
        let __stdout__ = [];

        // Capture console.log
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {{
            __stdout__.push(args.map(String).join(' '));
        }};
        console.warn = (...args) => {{
            __stdout__.push('[WARN] ' + args.map(String).join(' '));
        }};

        // Execute user code and get the last expression result
        __result__ = await (async () => {{
            {}
        }})();

        // Restore console
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;

        // Process output
        const processed = processOutput(__result__);

        // Output JSON result to stdout (not console.log which we redirected)
        Deno.stdout.writeSync(new TextEncoder().encode(
            "__QUADRATIC_RESULT__:" + JSON.stringify({{
                success: true,
                result: processed,
                stdout: __stdout__.join('\n')
            }}) + "\n"
        ));

    }} catch (error) {{
        // Output error to stderr
        Deno.stderr.writeSync(new TextEncoder().encode(
            "__QUADRATIC_ERROR__:" + JSON.stringify({{
                success: false,
                error: error.message,
                stack: error.stack
            }}) + "\n"
        ));
    }}
}})();
"#,
        GLOBALS_JS, PROCESS_OUTPUT_JS, QUADRATIC_JS, user_code
    );

    Ok(wrapped_code)
}

fn parse_deno_output(transaction_id: &str, output: std::process::Output) -> Result<JsCodeResult> {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Look for our JSON result marker
    if let Some(result_line) = stdout
        .lines()
        .find(|line| line.starts_with("__QUADRATIC_RESULT__:"))
    {
        let json_str = result_line.trim_start_matches("__QUADRATIC_RESULT__:");
        let result: serde_json::Value = serde_json::from_str(json_str).map_err(|e| {
            CoreCloudError::Javascript(format!("Failed to parse result JSON: {}", e))
        })?;

        let processed = result
            .get("result")
            .ok_or_else(|| CoreCloudError::Javascript("Missing result field".to_string()))?;

        let output_type = processed
            .get("outputType")
            .and_then(|v| v.as_str())
            .unwrap_or("undefined")
            .to_string();

        let has_headers = processed
            .get("hasHeaders")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // Extract output_value
        let output_value = processed
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

        // Extract output_array
        let output_array = processed
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

        let std_out = result
            .get("stdout")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from);

        return Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            std_out,
            std_err: None,
            line_number: None,
            output_value,
            output_array,
            output_display_type: Some(output_type),
            chart_pixel_output: None,
            has_headers,
        });
    }

    // Look for error marker
    if let Some(error_line) = stderr
        .lines()
        .find(|line| line.starts_with("__QUADRATIC_ERROR__:"))
    {
        let json_str = error_line.trim_start_matches("__QUADRATIC_ERROR__:");
        let error: serde_json::Value = serde_json::from_str(json_str).map_err(|e| {
            CoreCloudError::Javascript(format!("Failed to parse error JSON: {}", e))
        })?;

        return Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: false,
            std_out: None,
            std_err: error
                .get("error")
                .and_then(|v| v.as_str())
                .map(String::from),
            line_number: None,
            output_value: None,
            output_array: None,
            output_display_type: None,
            chart_pixel_output: None,
            has_headers: false,
        });
    }

    // Fallback: no markers found, check exit code
    if !output.status.success() {
        return Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: false,
            std_out: None,
            std_err: Some(format!("Deno execution failed:\n{}", stderr)),
            line_number: None,
            output_value: None,
            output_array: None,
            output_display_type: None,
            chart_pixel_output: None,
            has_headers: false,
        });
    }

    // Success but no result found
    Ok(JsCodeResult {
        transaction_id: transaction_id.to_string(),
        success: true,
        std_out: Some(stdout.to_string()),
        std_err: None,
        line_number: None,
        output_value: None,
        output_array: None,
        output_display_type: Some("undefined".to_string()),
        chart_pixel_output: None,
        has_headers: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_execute(code: &str) -> JsCodeResult {
        execute(code, "test")
            .await
            .unwrap_or_else(|e| JsCodeResult {
                transaction_id: "test".to_string(),
                success: false,
                std_err: Some(format!("Execution error: {}", e)),
                ..Default::default()
            })
    }

    #[tokio::test]
    async fn test_simple_expression() {
        let code = "42";
        let result = test_execute(code).await;
        println!("Result: {:?}", result);
        assert!(result.success);
    }

    #[tokio::test]
    async fn test_fetch() {
        let code = r#"
const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
const data = await response.json();
return data.title;
"#;
        let result = test_execute(code).await;
        println!("Fetch result: {:?}", result);
        assert!(result.success, "Fetch should work with Deno");
        assert!(result.output_value.is_some(), "Should have a title value");
        // The title should be a string
        let output = result.output_value.unwrap();
        assert_eq!(output.1, 1, "Should be string type");
        println!("Fetched title: {}", output.0);
    }
}
