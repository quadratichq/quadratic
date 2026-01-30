use quadratic_core::controller::GridController;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Response;
use quadratic_core::controller::transaction_types::{JsCellValueResult, JsCodeResult};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::process::Command;
use tokio::sync::Mutex as TokioMutex;
use tokio::task::JoinHandle;

use crate::error::{CoreCloudError, Result};

/// Type alias for the get_cells callback function
type GetCellsCallback =
    Arc<TokioMutex<Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>>>;

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

/// A persistent JavaScript TCP server that stays alive across multiple executions
pub struct JavaScriptTcpServer {
    port: u16,
    server_handle: JoinHandle<Result<()>>,
}

impl JavaScriptTcpServer {
    /// Create and start a new TCP server for JavaScript get_cells communication
    pub async fn start(
        get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
    ) -> Result<Self> {
        let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| {
            CoreCloudError::Javascript(format!("Failed to bind TCP listener: {}", e))
        })?;

        let port = listener
            .local_addr()
            .map_err(|e| CoreCloudError::Javascript(format!("Failed to get local address: {}", e)))?
            .port();

        let get_cells = Arc::new(TokioMutex::new(get_cells));

        let server_handle =
            tokio::spawn(async move { handle_get_cells_server(listener, get_cells).await });

        tracing::info!("[JavaScript TCP Server] Started on port {}", port);

        Ok(Self {
            port,
            server_handle,
        })
    }

    /// Get the port number of the running server
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Shutdown the server gracefully
    pub async fn shutdown(self) {
        tracing::info!(
            "[JavaScript TCP Server] Shutting down on port {}",
            self.port
        );

        // Give any in-flight connections time to complete
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        self.server_handle.abort();
    }
}

pub(crate) async fn run_javascript(
    grid: Arc<TokioMutex<GridController>>,
    code: &str,
    transaction_id: &str,
    get_cells_port: u16,
) -> Result<()> {
    tracing::info!(
        "[JavaScript] Starting execution for transaction: {}",
        transaction_id
    );

    // Execute JavaScript with the provided server port
    let js_code_result = execute(code, transaction_id, get_cells_port).await?;

    grid.lock()
        .await
        .calculation_complete(js_code_result)
        .map_err(|e| CoreCloudError::Core(e.to_string()))
}

async fn execute(code: &str, transaction_id: &str, get_cells_port: u16) -> Result<JsCodeResult> {
    // Check if code is empty
    if code.trim().is_empty() {
        return Ok(empty_js_code_result(transaction_id));
    }

    // Build the complete JavaScript code with all dependencies
    let full_code = build_javascript_wrapper(code, get_cells_port)?;

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

fn build_javascript_wrapper(user_code: &str, get_cells_port: u16) -> Result<String> {
    // Transform q.cells() calls to await q.cells() if not already awaited
    let transformed_code = add_await_to_qcells(user_code);

    // Create a wrapper that includes all necessary globals and the user code
    let wrapped_code = format!(
        r#"
// Inject Quadratic globals
{}

// Inject process output functions
{}

// Inject Quadratic API
{}

// Implement q.cells() with HTTP communication to Rust server
const GET_CELLS_PORT = {};
globalThis.q = {{
    cells: async (a1, firstRowHeader = false) => {{
        try {{
            const response = await fetch(`http://127.0.0.1:${{GET_CELLS_PORT}}/get_cells`, {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ a1, firstRowHeader }})
            }});

            if (!response.ok) {{
                throw new Error(`HTTP error! status: ${{response.status}}`);
            }}

            const result = await response.json();

            if (result.error) {{
                throw new Error(result.error.core_error || result.error);
            }}

            if (!result.values) {{
                return null;
            }}

            // Convert the response
            const {{ cells, w, h, x, y, one_dimensional, two_dimensional }} = result.values;

            const startY = y;
            const startX = x;
            const height = h;
            const width = w;

            // Initialize 2D array
            const cellsArray = Array(height)
                .fill(null)
                .map(() => Array(width).fill(undefined));

            // Populate cells from response
            for (const cell of cells) {{
                const typed = convertCellValue(cell.v, cell.t);
                cellsArray[cell.y - startY][cell.x - startX] = typed === null ? undefined : typed;
            }}

            // Always return a single cell as a single value
            if (cellsArray.length === 1 && cellsArray[0].length === 1 && !one_dimensional) {{
                return cellsArray[0][0];
            }}

            // Convert to one-dimensional if not explicitly two-dimensional
            if (!two_dimensional) {{
                // one column result
                if (cellsArray.every((row) => row.length === 1)) {{
                    return cellsArray.map((row) => row[0]);
                }}

                // one row result
                else if (cellsArray.length === 1) {{
                    return cellsArray[0];
                }}
            }}

            return cellsArray;
        }} catch (e) {{
            console.error(`Error in q.cells(): ${{e.message}}`);
            throw e;
        }}
    }},
    pos: () => [0, 0]
}};

function convertCellValue(value, cellType) {{
    switch (cellType) {{
        case 0: return undefined; // blank
        case 2: return parseFloat(value); // number
        case 9: // date
        case 11: // datetime
            return new Date(value);
        default:
            return value;
    }}
}}

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
        GLOBALS_JS, PROCESS_OUTPUT_JS, QUADRATIC_JS, get_cells_port, transformed_code
    );

    Ok(wrapped_code)
}

/// Automatically wraps q.cells() calls with (await q.cells(...)) if not already awaited.
/// This ensures method chaining like q.cells("A1").flat() works correctly.
///
/// Handles:
/// - Adding `(await ...)` around q.cells() calls
/// - Wrapping existing `await q.cells(...)` with parentheses when method chaining is detected
/// - Properly skipping string literals (including escaped quotes and template literals)
fn add_await_to_qcells(code: &str) -> String {
    let pattern = "q.cells(";
    let pattern_chars: Vec<char> = pattern.chars().collect();
    let mut result = String::with_capacity(code.len() + 100);
    let chars: Vec<char> = code.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        // Check if we're at the start of "q.cells(" (efficient pattern matching)
        let matches_pattern = i + pattern_chars.len() <= chars.len()
            && chars[i..i + pattern_chars.len()]
                .iter()
                .zip(pattern_chars.iter())
                .all(|(a, b)| a == b);

        if matches_pattern {
            // Look backwards to see if "await" is already there
            let before_start = result.trim_end();
            let has_await = before_start.ends_with("await");

            // Find the matching closing parenthesis for q.cells(...)
            let start_idx = i + pattern_chars.len(); // Position after "q.cells("
            let end_idx = find_matching_paren(&chars, start_idx);

            if has_await {
                // Check if there's method chaining after the q.cells(...) call
                let has_chaining = end_idx < chars.len() && chars[end_idx] == '.';

                if has_chaining {
                    // Need to wrap with parentheses: await q.cells(...).flat() -> (await q.cells(...)).flat()
                    // Remove the trailing "await" and whitespace from result, then add "(await "
                    let trimmed = result.trim_end();
                    let await_start = trimmed.len() - "await".len();
                    result.truncate(await_start);
                    // Preserve the whitespace before "await"
                    result.push_str("(await ");
                    result.push_str(pattern);
                    for ch in chars.iter().take(end_idx).skip(start_idx) {
                        result.push(*ch);
                    }
                    result.push(')');
                    i = end_idx;
                } else {
                    // No chaining, keep as-is
                    result.push_str(pattern);
                    i += pattern_chars.len();
                }
            } else {
                // No await present, wrap with (await q.cells(...))
                result.push_str("(await ");
                result.push_str(pattern);
                for ch in chars.iter().take(end_idx).skip(start_idx) {
                    result.push(*ch);
                }
                result.push(')');
                i = end_idx;
            }
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }

    result
}

/// Find the matching closing parenthesis, properly handling nested parens and string literals.
fn find_matching_paren(chars: &[char], start_idx: usize) -> usize {
    let mut paren_depth = 1;
    let mut idx = start_idx;

    while idx < chars.len() && paren_depth > 0 {
        match chars[idx] {
            '(' => paren_depth += 1,
            ')' => paren_depth -= 1,
            '"' | '\'' => {
                // Skip regular string literals
                let quote = chars[idx];
                idx += 1;
                while idx < chars.len() {
                    if chars[idx] == quote && !is_escaped(chars, idx) {
                        break;
                    }
                    idx += 1;
                }
            }
            '`' => {
                // Skip template literals, handling ${...} expressions
                idx += 1;
                idx = skip_template_literal(chars, idx);
                continue; // Don't increment idx again
            }
            _ => {}
        }
        idx += 1;
    }

    idx
}

/// Check if the character at `idx` is escaped by counting preceding backslashes.
/// A character is escaped if preceded by an odd number of backslashes.
fn is_escaped(chars: &[char], idx: usize) -> bool {
    let mut backslash_count = 0;
    let mut check_idx = idx;
    while check_idx > 0 && chars[check_idx - 1] == '\\' {
        backslash_count += 1;
        check_idx -= 1;
    }
    backslash_count % 2 == 1
}

/// Skip a template literal, handling nested ${...} expressions.
/// Returns the index after the closing backtick.
fn skip_template_literal(chars: &[char], start_idx: usize) -> usize {
    let mut idx = start_idx;

    while idx < chars.len() {
        if chars[idx] == '`' && !is_escaped(chars, idx) {
            // End of template literal
            return idx;
        } else if idx + 1 < chars.len() && chars[idx] == '$' && chars[idx + 1] == '{' {
            // Start of template expression ${...}
            idx += 2; // Skip "${"
            let mut brace_depth = 1;
            while idx < chars.len() && brace_depth > 0 {
                match chars[idx] {
                    '{' => brace_depth += 1,
                    '}' => brace_depth -= 1,
                    '"' | '\'' => {
                        // Skip string inside expression
                        let quote = chars[idx];
                        idx += 1;
                        while idx < chars.len() {
                            if chars[idx] == quote && !is_escaped(chars, idx) {
                                break;
                            }
                            idx += 1;
                        }
                    }
                    '`' => {
                        // Nested template literal inside expression
                        idx += 1;
                        idx = skip_template_literal(chars, idx);
                        continue;
                    }
                    _ => {}
                }
                idx += 1;
            }
        } else {
            idx += 1;
        }
    }

    idx
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
            chart_image: None,
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
            chart_image: None,
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
            chart_image: None,
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
        chart_image: None,
        has_headers: false,
    })
}

// TCP server to handle get_cells requests from Deno
async fn handle_get_cells_server(listener: TcpListener, get_cells: GetCellsCallback) -> Result<()> {
    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                tracing::debug!("Accepted q.cells connection from {}", addr);
                let get_cells = Arc::clone(&get_cells);
                tokio::spawn(async move {
                    match handle_connection(stream, get_cells).await {
                        Ok(_) => {
                            tracing::debug!(
                                "Successfully handled q.cells connection from {}",
                                addr
                            );
                        }
                        Err(e) => {
                            tracing::error!(
                                "Error handling q.cells connection from {}: {}",
                                addr,
                                e
                            );
                        }
                    }
                });
            }
            Err(e) => {
                tracing::error!("Error accepting q.cells connection: {}", e);
                break;
            }
        }
    }
    Ok(())
}

async fn handle_connection(mut stream: TcpStream, get_cells: GetCellsCallback) -> Result<()> {
    // Set TCP_NODELAY to disable Nagle's algorithm for more predictable latency
    stream.set_nodelay(true).ok();

    let mut reader = BufReader::new(&mut stream);
    let mut request_line = String::new();

    // Read request line
    reader
        .read_line(&mut request_line)
        .await
        .map_err(|e| CoreCloudError::Javascript(format!("Failed to read request: {}", e)))?;

    // Read headers until empty line
    let mut content_length = 0;
    loop {
        let mut header = String::new();
        reader
            .read_line(&mut header)
            .await
            .map_err(|e| CoreCloudError::Javascript(format!("Failed to read header: {}", e)))?;

        if header.trim().is_empty() || header == "\r\n" {
            break;
        }

        if header.to_lowercase().starts_with("content-length:")
            && let Some(len_str) = header.split(':').nth(1)
        {
            content_length = len_str.trim().parse().unwrap_or(0);
        }
    }

    // Read body
    let mut body = vec![0u8; content_length];
    reader
        .read_exact(&mut body)
        .await
        .map_err(|e| CoreCloudError::Javascript(format!("Failed to read body: {}", e)))?;

    let body_str = String::from_utf8_lossy(&body);

    // Parse request body
    let request: serde_json::Value = serde_json::from_str(&body_str)
        .map_err(|e| CoreCloudError::Javascript(format!("Failed to parse request: {}", e)))?;

    let a1 = request["a1"].as_str().unwrap_or("").to_string();
    let _first_row_header = request["firstRowHeader"].as_bool().unwrap_or(false);

    // Call get_cells
    tracing::debug!("Handling q.cells request for: {}", a1);
    let result = {
        let mut get_cells_fn = get_cells.lock().await;
        get_cells_fn(a1.clone())
    };
    tracing::debug!("Completed q.cells request for: {}", a1);

    // Convert result to JSON
    let response_json = match result {
        Ok(response) => serde_json::to_string(&response).unwrap_or_else(|_| {
            r#"{"error":{"core_error":"Failed to serialize response"}}"#.to_string()
        }),
        Err(e) => serde_json::to_string(&JsCellsA1Response {
            values: None,
            error: Some(
                quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Error {
                    core_error: e.to_string(),
                },
            ),
        })
        .unwrap_or_else(|_| r#"{"error":{"core_error":"Failed to serialize error"}}"#.to_string()),
    };

    // Send HTTP response with Connection: close to signal no keep-alive
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
        response_json.len(),
        response_json
    );

    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|e| CoreCloudError::Javascript(format!("Failed to write response: {}", e)))?;

    stream
        .flush()
        .await
        .map_err(|e| CoreCloudError::Javascript(format!("Failed to flush stream: {}", e)))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core::controller::execution::run_code::get_cells::{
        JsCellsA1Error, JsCellsA1Response, JsCellsA1Value, JsCellsA1Values,
    };

    async fn test_execute(code: &str) -> JsCodeResult {
        execute(code, "test", 0)
            .await
            .unwrap_or_else(|e| JsCodeResult {
                transaction_id: "test".to_string(),
                success: false,
                std_err: Some(format!("Execution error: {}", e)),
                ..Default::default()
            })
    }

    async fn test_execute_with_get_cells<F>(code: &str, get_cells: F) -> JsCodeResult
    where
        F: FnMut(String) -> Result<JsCellsA1Response> + Send + 'static,
    {
        // Start TCP server
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let server_addr = listener.local_addr().unwrap();

        let get_cells = Arc::new(TokioMutex::new(Box::new(get_cells)
            as Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>));
        let get_cells_clone = Arc::clone(&get_cells);

        // Spawn server task
        let server_handle =
            tokio::spawn(async move { handle_get_cells_server(listener, get_cells_clone).await });

        // Execute JavaScript
        let result = execute(code, "test", server_addr.port()).await;

        // Stop server
        server_handle.abort();

        result.unwrap_or_else(|e| JsCodeResult {
            transaction_id: "test".to_string(),
            success: false,
            std_err: Some(format!("Execution error: {}", e)),
            ..Default::default()
        })
    }

    #[test]
    fn test_add_await_to_qcells() {
        // Test: adds await and wraps with parentheses when missing
        let code = "const x = q.cells('A1')";
        let result = add_await_to_qcells(code);
        assert_eq!(result, "const x = (await q.cells('A1'))");

        // Test: doesn't duplicate await when no chaining (keeps existing await as-is)
        let code = "const x = await q.cells('A1')";
        let result = add_await_to_qcells(code);
        assert_eq!(result, "const x = await q.cells('A1')");

        // Test: wraps existing await with parentheses when method chaining is detected
        let code = "const x = await q.cells('A1').flat()";
        let result = add_await_to_qcells(code);
        assert_eq!(result, "const x = (await q.cells('A1')).flat()");

        // Test: existing await with multiple chained methods
        let code = "const x = await q.cells('A1:B2').flat().map(x => x * 2)";
        let result = add_await_to_qcells(code);
        assert_eq!(
            result,
            "const x = (await q.cells('A1:B2')).flat().map(x => x * 2)"
        );

        // Test: handles multiple calls
        let code = "const x = q.cells('A1')\nconst y = q.cells('B1')";
        let result = add_await_to_qcells(code);
        assert_eq!(
            result,
            "const x = (await q.cells('A1'))\nconst y = (await q.cells('B1'))"
        );

        // Test: handles mixed await and non-await
        let code = "const x = await q.cells('A1')\nconst y = q.cells('B1')";
        let result = add_await_to_qcells(code);
        assert_eq!(
            result,
            "const x = await q.cells('A1')\nconst y = (await q.cells('B1'))"
        );

        // Test: start of line
        let code = "q.cells('A1')";
        let result = add_await_to_qcells(code);
        assert_eq!(result, "(await q.cells('A1'))");

        // Test: method chaining works correctly
        let code = "const x = q.cells('A1').flat()";
        let result = add_await_to_qcells(code);
        assert_eq!(result, "const x = (await q.cells('A1')).flat()");

        // Test: nested parentheses in arguments
        let code = "const x = q.cells(foo(bar()))";
        let result = add_await_to_qcells(code);
        assert_eq!(result, "const x = (await q.cells(foo(bar())))");

        // Test: string with parentheses
        let code = r#"const x = q.cells("A1:B(2)")"#;
        let result = add_await_to_qcells(code);
        assert_eq!(result, r#"const x = (await q.cells("A1:B(2)"))"#);

        // Test: escaped backslash before quote (the backslash is escaped, so quote ends string)
        let code = r#"const x = q.cells("test\\")"#;
        let result = add_await_to_qcells(code);
        assert_eq!(result, r#"const x = (await q.cells("test\\"))"#);

        // Test: template literal with expression
        let code = r#"const x = q.cells(`${sheetName}:A1`)"#;
        let result = add_await_to_qcells(code);
        assert_eq!(result, r#"const x = (await q.cells(`${sheetName}:A1`))"#);

        // Test: template literal with nested template literal in expression
        let code = r#"const x = q.cells(`${foo(`nested`)}`)"#;
        let result = add_await_to_qcells(code);
        assert_eq!(result, r#"const x = (await q.cells(`${foo(`nested`)}`))"#);

        // Test: template literal with parentheses in expression
        let code = r#"const x = q.cells(`${func(a, b)}:A1`)"#;
        let result = add_await_to_qcells(code);
        assert_eq!(result, r#"const x = (await q.cells(`${func(a, b)}:A1`))"#);
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

    #[tokio::test]
    async fn test_q_cells_multiple_calls_without_await() {
        // Test the user's exact pattern - multiple q.cells() without await
        let code = r#"
const old = q.cells("A1")
const rooms = q.cells("B1")
const users = q.cells("C1")
return [old, rooms, users]
"#;

        let result = test_execute_with_get_cells(code, |a1| {
            // Return different values based on cell
            let value = match a1.as_str() {
                "A1" => "old_value",
                "B1" => "42",
                "C1" => "100",
                _ => "unknown",
            };

            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 1,
                        y: 1,
                        v: value.to_string(),
                        t: if a1 == "A1" { 1 } else { 2 }, // text or number
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
        })
        .await;

        println!("Result: {:?}", result);
        assert!(
            result.success,
            "Should succeed with multiple q.cells() calls"
        );
        assert!(result.output_array.is_some());
    }

    #[tokio::test]
    async fn test_q_cells_single_cell() {
        let code = r#"
const value = await q.cells("A1");
return value;
"#;

        let result = test_execute_with_get_cells(code, |a1| {
            assert_eq!(a1, "A1");
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 1,
                        y: 1,
                        v: "42".to_string(),
                        t: 2, // number type
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
        })
        .await;

        assert!(result.success, "q.cells should work for single cell");
        assert!(result.output_value.is_some());
        let output = result.output_value.unwrap();
        assert_eq!(output.0, "42");
        assert_eq!(output.1, 2); // number type
    }

    #[tokio::test]
    async fn test_q_cells_text_value() {
        let code = r#"
const value = await q.cells("B2");
return value;
"#;

        let result = test_execute_with_get_cells(code, |a1| {
            assert_eq!(a1, "B2");
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 2,
                        y: 2,
                        v: "Hello World".to_string(),
                        t: 1, // text type
                    }],
                    x: 2,
                    y: 2,
                    w: 1,
                    h: 1,
                    one_dimensional: false,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            })
        })
        .await;

        assert!(result.success);
        assert!(result.output_value.is_some());
        let output = result.output_value.unwrap();
        assert_eq!(output.0, "Hello World");
        assert_eq!(output.1, 1); // text type
    }

    #[tokio::test]
    async fn test_q_cells_one_dimensional_column() {
        let code = r#"
const values = await q.cells("A1:A3");
return values;
"#;

        let result = test_execute_with_get_cells(code, |a1| {
            assert_eq!(a1, "A1:A3");
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "1".to_string(),
                            t: 2,
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 2,
                            v: "2".to_string(),
                            t: 2,
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 3,
                            v: "3".to_string(),
                            t: 2,
                        },
                    ],
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 3,
                    one_dimensional: true,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            })
        })
        .await;

        assert!(result.success);
        assert!(result.output_array.is_some());
        let output_array = result.output_array.unwrap();
        // One-dimensional arrays are returned as a single row in output_array
        // The conversion happens in processOutput
        assert_eq!(output_array.len(), 3); // three rows (since it's returned as column)
        assert_eq!(output_array[0].len(), 1); // one column per row
    }

    #[tokio::test]
    async fn test_q_cells_one_dimensional_row() {
        let code = r#"
const values = await q.cells("A1:C1");
return values;
"#;

        let result = test_execute_with_get_cells(code, |a1| {
            assert_eq!(a1, "A1:C1");
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "A".to_string(),
                            t: 1,
                        },
                        JsCellsA1Value {
                            x: 2,
                            y: 1,
                            v: "B".to_string(),
                            t: 1,
                        },
                        JsCellsA1Value {
                            x: 3,
                            y: 1,
                            v: "C".to_string(),
                            t: 1,
                        },
                    ],
                    x: 1,
                    y: 1,
                    w: 3,
                    h: 1,
                    one_dimensional: true,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            })
        })
        .await;

        assert!(result.success);
        assert!(result.output_array.is_some());
    }

    #[tokio::test]
    async fn test_q_cells_two_dimensional() {
        let code = r#"
const values = await q.cells("A1:B2");
return values;
"#;

        let result = test_execute_with_get_cells(code, |a1| {
            assert_eq!(a1, "A1:B2");
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "1".to_string(),
                            t: 2,
                        },
                        JsCellsA1Value {
                            x: 2,
                            y: 1,
                            v: "2".to_string(),
                            t: 2,
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 2,
                            v: "3".to_string(),
                            t: 2,
                        },
                        JsCellsA1Value {
                            x: 2,
                            y: 2,
                            v: "4".to_string(),
                            t: 2,
                        },
                    ],
                    x: 1,
                    y: 1,
                    w: 2,
                    h: 2,
                    one_dimensional: false,
                    two_dimensional: true,
                    has_headers: false,
                }),
                error: None,
            })
        })
        .await;

        assert!(result.success);
        assert!(result.output_array.is_some());
        let output_array = result.output_array.unwrap();
        assert_eq!(output_array.len(), 2); // two rows
        assert_eq!(output_array[0].len(), 2); // two columns
    }

    #[tokio::test]
    async fn test_q_cells_with_empty_cells() {
        let code = r#"
const values = await q.cells("A1:B2");
return values;
"#;

        let result = test_execute_with_get_cells(code, |a1| {
            assert_eq!(a1, "A1:B2");
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "1".to_string(),
                            t: 2,
                        },
                        // B1 is empty
                        // A2 is empty
                        JsCellsA1Value {
                            x: 2,
                            y: 2,
                            v: "4".to_string(),
                            t: 2,
                        },
                    ],
                    x: 1,
                    y: 1,
                    w: 2,
                    h: 2,
                    one_dimensional: false,
                    two_dimensional: true,
                    has_headers: false,
                }),
                error: None,
            })
        })
        .await;

        assert!(result.success);
        assert!(result.output_array.is_some());
        let output_array = result.output_array.unwrap();
        assert_eq!(output_array.len(), 2); // two rows
        assert_eq!(output_array[0].len(), 2); // two columns
        // Empty cells should be filled with undefined
        assert_eq!(output_array[0][1].0, "undefined"); // B1
        assert_eq!(output_array[1][0].0, "undefined"); // A2
    }

    #[tokio::test]
    async fn test_q_cells_date_conversion() {
        let code = r#"
const value = await q.cells("A1");
// Check if it's a Date object
return value instanceof Date ? "DATE" : "NOT_DATE";
"#;

        let result = test_execute_with_get_cells(code, |_a1| {
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 1,
                        y: 1,
                        v: "2024-01-15T10:30:00Z".to_string(),
                        t: 11, // datetime type
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
        })
        .await;

        assert!(result.success);
        assert!(result.output_value.is_some());
        let output = result.output_value.unwrap();
        assert_eq!(output.0, "DATE");
    }

    #[tokio::test]
    async fn test_q_cells_error_handling() {
        let code = r#"
try {
    const value = await q.cells("INVALID");
    return "SHOULD_NOT_REACH";
} catch (error) {
    return "ERROR_CAUGHT";
}
"#;

        let result = test_execute_with_get_cells(code, |_a1| {
            Ok(JsCellsA1Response {
                values: None,
                error: Some(JsCellsA1Error {
                    core_error: "Invalid cell reference".to_string(),
                }),
            })
        })
        .await;

        assert!(result.success);
        assert!(result.output_value.is_some());
        let output = result.output_value.unwrap();
        assert_eq!(output.0, "ERROR_CAUGHT");
    }

    #[tokio::test]
    async fn test_q_cells_used_in_calculation() {
        let code = r#"
const values = await q.cells("A1:A3");
const sum = values.reduce((acc, val) => acc + val, 0);
return sum;
"#;

        let result = test_execute_with_get_cells(code, |_a1| {
            Ok(JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "10".to_string(),
                            t: 2,
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 2,
                            v: "20".to_string(),
                            t: 2,
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 3,
                            v: "30".to_string(),
                            t: 2,
                        },
                    ],
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 3,
                    one_dimensional: true,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            })
        })
        .await;

        assert!(result.success);
        assert!(result.output_value.is_some());
        let output = result.output_value.unwrap();
        assert_eq!(output.0, "60");
        assert_eq!(output.1, 2); // number type
    }

    #[tokio::test]
    async fn test_q_cells_multiple_calls() {
        let code = r#"
const a = await q.cells("A1");
const b = await q.cells("B1");
return a + b;
"#;

        let call_count = Arc::new(std::sync::Mutex::new(0));
        let call_count_clone = Arc::clone(&call_count);

        let result = test_execute_with_get_cells(code, move |a1| {
            let mut count = call_count_clone.lock().unwrap();
            *count += 1;
            drop(count); // Release lock before returning

            if a1 == "A1" {
                Ok(JsCellsA1Response {
                    values: Some(JsCellsA1Values {
                        cells: vec![JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "5".to_string(),
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
            } else if a1 == "B1" {
                Ok(JsCellsA1Response {
                    values: Some(JsCellsA1Values {
                        cells: vec![JsCellsA1Value {
                            x: 2,
                            y: 1,
                            v: "7".to_string(),
                            t: 2,
                        }],
                        x: 2,
                        y: 1,
                        w: 1,
                        h: 1,
                        one_dimensional: false,
                        two_dimensional: false,
                        has_headers: false,
                    }),
                    error: None,
                })
            } else {
                Ok(JsCellsA1Response {
                    values: None,
                    error: Some(JsCellsA1Error {
                        core_error: "Unexpected cell reference".to_string(),
                    }),
                })
            }
        })
        .await;

        assert!(result.success);
        assert!(result.output_value.is_some());
        let output = result.output_value.unwrap();
        assert_eq!(output.0, "12");

        // Verify both calls were made
        let final_count = call_count.lock().unwrap();
        assert_eq!(*final_count, 2);
    }
}
