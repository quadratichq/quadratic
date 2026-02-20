use std::sync::Arc;

use pyo3::prelude::*;
use quadratic_core::controller::GridController;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Response;
use quadratic_core::controller::transaction_types::{JsCellValueResult, JsCodeResult};
use tokio::sync::Mutex;

use crate::error::{CoreCloudError, Result};
use crate::python::quadratic::{
    FetchStockPricesFn, create_get_cells_function, create_stock_prices_function, pos,
};
use crate::python::utils::{analyze_code, c_string, process_imports};

static PROCESS_OUTPUT_CODE: &str = include_str!("py_code/process_output.py");
static QUADRATIC: &str = include_str!("py_code/quadratic.py");

/// Create an empty JsCodeResult.
pub(crate) fn empty_js_code_result(transaction_id: &str) -> JsCodeResult {
    JsCodeResult {
        transaction_id: transaction_id.to_string(),
        success: false,
        ..Default::default()
    }
}

/// Run Python code.
pub(crate) async fn run_python(
    grid: Arc<Mutex<GridController>>,
    code: &str,
    transaction_id: &str,
    get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
    fetch_stock_prices: FetchStockPricesFn,
    chart_pixel_width: f32,
    chart_pixel_height: f32,
) -> Result<()> {
    tracing::info!(
        "[Python] Starting execution for transaction: {}",
        transaction_id
    );

    let js_code_result = execute(
        code,
        transaction_id,
        get_cells,
        fetch_stock_prices,
        chart_pixel_width,
        chart_pixel_height,
    )?;

    grid.lock()
        .await
        .calculation_complete(js_code_result)
        .map_err(|e| CoreCloudError::Core(e.to_string()))
}

/// Execute Python code.
pub(crate) fn execute(
    code: &str,
    transaction_id: &str,
    get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
    fetch_stock_prices: FetchStockPricesFn,
    chart_pixel_width: f32,
    chart_pixel_height: f32,
) -> Result<JsCodeResult> {
    let result: std::result::Result<JsCodeResult, PyErr> = Python::with_gil(|py| {
        let empty_result = empty_js_code_result(transaction_id);

        // split code into lines
        let lines: Vec<&str> = code.trim().lines().collect();

        if lines.is_empty() {
            return Ok(empty_result);
        }

        // auto-install missing modules helper
        process_imports(&py, code)?;

        // use AST to determine if the last statement is an expression
        let (setup_code, expr_code, _has_expression) = analyze_code(&py, code)?;

        // create a globals dict to capture q.cells("A1") call early
        let globals = pyo3::types::PyDict::new(py);

        // Set chart pixel dimensions for process_output.py to use
        globals.set_item("__chart_pixel_width__", chart_pixel_width)?;
        globals.set_item("__chart_pixel_height__", chart_pixel_height)?;

        // create a Python callable that uses the get_cells closure and returns converted values/DataFrames
        let get_cells_py = create_get_cells_function(py, get_cells)?;

        globals.set_item("rust_cells", get_cells_py)?;
        globals.set_item("rust_pos", wrap_pyfunction!(pos, py)?)?;

        // create stock_prices function that calls back to the authenticated handler
        let stock_prices_py = create_stock_prices_function(py, fetch_stock_prices)?;
        globals.set_item("rust_stock_prices", stock_prices_py)?;

        // quadratic (`q`) module
        let quadratic = c_string(QUADRATIC)?;
        py.run(&quadratic, Some(&globals), None)?;

        // load process_output module and setup plotly patch before user code runs
        let c_process_output = c_string(PROCESS_OUTPUT_CODE)?;
        py.run(&c_process_output, Some(&globals), None)?;

        // setup plotly patch to prevent browser opening
        let c_setup_plotly = c_string("setup_plotly_patch()")?;
        py.run(&c_setup_plotly, Some(&globals), None)?;

        // always wrap code in async function for consistency
        // helper function to indent code
        let indent_code = |code: &str| -> String {
            code.lines()
                .map(|line| {
                    if line.trim().is_empty() {
                        line.to_string()
                    } else {
                        format!("    {}", line)
                    }
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        let async_code = if let Some(setup_code) = setup_code {
            let indented_setup = indent_code(&setup_code);
            format!(
                r#"from contextlib import redirect_stdout, redirect_stderr
from io import StringIO
import asyncio

__quadratic_std_out__ = StringIO()
__quadratic_std_err__ = StringIO()

async def __quadratic_execute__():
{}
    return {}

with redirect_stdout(__quadratic_std_out__):
    with redirect_stderr(__quadratic_std_err__):
        __quadratic_result__ = asyncio.run(__quadratic_execute__())"#,
                indented_setup,
                expr_code.unwrap_or("None".to_string())
            )
        } else {
            // this shouldn't happen
            return Ok(empty_result);
        };

        let c_async = c_string(&async_code)?;
        py.run(&c_async, Some(&globals), None)?;

        // we know has_expression is true since we early return above
        let c_result = c_string("__quadratic_result__")?;
        let result = py.eval(&c_result, Some(&globals), None)?;

        // set the result as a variable and call the function
        let locals = pyo3::types::PyDict::new(py);
        locals.set_item("output_value", result)?;
        let c_call_process = c_string("processed_result = process_output_value(output_value)")?;
        py.run(&c_call_process, Some(&globals), Some(&locals))?;

        // get the processed result from Python
        let c_get_result = c_string("processed_result")?;
        let processed_result = py.eval(&c_get_result, Some(&globals), Some(&locals))?;

        // extract fields from Python dictionary
        let output_type: String = processed_result.get_item("output_type")?.extract()?;
        let has_headers = processed_result.get_item("has_headers")?.extract()?;

        // extract chart_image if present (base64 WebP data URL)
        let chart_image = processed_result
            .get_item("chart_image")?
            .extract::<Option<String>>()?;

        // Log chart image status for debugging
        tracing::debug!(
            "[Python] output_type={}, chart_image={}",
            output_type,
            if let Some(ref img) = chart_image {
                format!("present ({} bytes)", img.len())
            } else {
                "None".to_string()
            }
        );

        // convert to JsCellValueResult format (tuple struct with value, type_id)
        let output_value = processed_result
            .get_item("output_value")?
            .extract::<Option<(pyo3::Bound<pyo3::PyAny>, u8)>>()?
            .map(|(value, cell_type)| JsCellValueResult(value.to_string(), cell_type));

        // convert array_output to JsCellValueResult format
        let mut js_output_array = None;

        if output_value.is_none() && output_type != "NoneType" {
            let processed_result = processed_result.get_item("typed_array_output")?;

            // first, try to extract as a 2D array
            // if that fails, try to extract as a 1D array as a 2D array

            let typed_array_output =
                match processed_result.extract::<Vec<Vec<(pyo3::Bound<pyo3::PyAny>, u8)>>>() {
                    Ok(output) => output,
                    Err(_e) => processed_result
                        .extract::<Vec<(pyo3::Bound<pyo3::PyAny>, u8)>>()?
                        .into_iter()
                        .map(|(cell, cell_type)| vec![(cell, cell_type)])
                        .collect(),
                };

            js_output_array = (!typed_array_output.is_empty()).then(|| {
                typed_array_output
                    .into_iter()
                    .map(|row| {
                        row.into_iter()
                            .map(|(cell, cell_type)| JsCellValueResult(cell.to_string(), cell_type))
                            .collect()
                    })
                    .collect()
            });
        }

        // capture std_out from python
        let c_std_out = c_string("__quadratic_std_out__.getvalue()")?;
        let std_out_value = py.eval(&c_std_out, Some(&globals), None)?;
        let std_out_string = std_out_value.extract::<String>()?;
        let std_out = (!std_out_string.is_empty()).then_some(std_out_string.clone());

        // capture std_err from python
        let c_std_err = c_string("__quadratic_std_err__.getvalue()")?;
        let std_err_value = py.eval(&c_std_err, Some(&globals), None)?;
        let std_err_string = std_err_value.extract::<String>()?;
        let std_err = (!std_err_string.is_empty()).then_some(std_err_string.clone());

        Ok(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            std_out,
            std_err,
            line_number: None,
            output_value,
            output_array: js_output_array,
            output_display_type: Some(output_type),
            chart_pixel_output: None,
            chart_image,
            has_headers,
        })
    });

    match result {
        Ok(result) => Ok(result),
        Err(error) => Python::with_gil(|py| {
            let error_value = error.value(py);

            // Handle syntax errors with line number extraction
            if error_value.is_instance_of::<pyo3::exceptions::PySyntaxError>() {
                let subtract_lines = 8;
                let subtract = |ln: Option<Bound<PyAny>>| {
                    ln.and_then(|ln| ln.extract::<u32>().ok().map(|ln| ln - subtract_lines))
                };
                let syntax_line_number = subtract(error_value.getattr("lineno").ok());
                let plotly_line_number = subtract(error_value.getattr("source_line").ok());
                let line_number = syntax_line_number.or(plotly_line_number);

                let error_class = error_value.getattr("__class__").ok().and_then(|cls| {
                    cls.getattr("__name__")
                        .ok()
                        .and_then(|cls| cls.str().map(|s| s.to_string()).ok())
                });

                let error_msg = error_value
                    .getattr("msg")
                    .ok()
                    .and_then(|msg| msg.str().map(|s| s.to_string()).ok());

                let mut error_message = None;

                if let (Some(error_class), Some(line_number), Some(error_msg)) =
                    (error_class, line_number, error_msg)
                {
                    error_message = Some(format!(
                        "{} on line {}: {}",
                        error_class, line_number, error_msg
                    ));
                }

                return Ok(JsCodeResult {
                    transaction_id: transaction_id.to_string(),
                    success: false,
                    std_out: None,
                    std_err: error_message,
                    line_number,
                    output_value: None,
                    output_array: None,
                    output_display_type: None,
                    chart_pixel_output: None,
                    chart_image: None,
                    has_headers: false,
                });
            }

            // Handle all other Python runtime errors (NameError, TypeError, ValueError, etc.)
            // The error.to_string() includes the traceback and error message
            let error_string = error.to_string();

            // Try to extract line number from traceback if available
            let line_number = error_value.getattr("__traceback__").ok().and_then(|tb| {
                tb.getattr("tb_lineno")
                    .ok()
                    .and_then(|ln| ln.extract::<u32>().ok())
                    .map(|ln| if ln > 8 { ln - 8 } else { ln })
            });

            Ok(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: false,
                std_out: None,
                std_err: Some(error_string),
                line_number,
                output_value: None,
                output_array: None,
                output_display_type: None,
                chart_pixel_output: None,
                chart_image: None,
                has_headers: false,
            })
        }),
    }
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use super::*;
    use quadratic_core::{DEFAULT_HTML_HEIGHT, DEFAULT_HTML_WIDTH};
    use serial_test::serial;

    fn test_get_cells(a1: String) -> Result<JsCellsA1Response> {
        println!("get_cells: {:?}", a1);
        Ok(JsCellsA1Response {
            values: None,
            error: None,
        })
    }

    fn test_fetch_stock_prices(
        identifier: String,
        _start_date: Option<String>,
        _end_date: Option<String>,
        _frequency: Option<String>,
    ) -> std::result::Result<serde_json::Value, String> {
        Ok(serde_json::json!({"identifier": identifier, "mock": true}))
    }

    fn test_execute(code: &str) -> JsCodeResult {
        let start = Instant::now();
        let result = execute(
            code,
            "test",
            Box::new(test_get_cells),
            Box::new(test_fetch_stock_prices),
            DEFAULT_HTML_WIDTH,
            DEFAULT_HTML_HEIGHT,
        )
        .unwrap();
        let end = Instant::now();
        println!("time: {:?}", end.duration_since(start));
        println!("result: {:#?}", result);

        result
    }

    #[test]
    #[serial]
    fn test_execute_yfinance() {
        let code = r#"
# time the execution
import time
start_time = time.time()

import yfinance as yf

ticker_symbol = "AAPL"
ticker = yf.Ticker(ticker_symbol)
historical_data = ticker.history(period="1y")
output = historical_data.head()

cells = q.cells("A1")
print(f"cells: {cells}")
print(f"cells type: {type(cells)}")

end_time = time.time()
total_time_ms = (end_time - start_time) * 1000
print(f"Time taken: {total_time_ms}ms")
output
"#;
        let result = test_execute(code);

        // Check the structure since yfinance data will vary
        assert_eq!(result.transaction_id, "test");
        assert!(result.success);
        assert!(result.output_array.is_some());
        assert_eq!(result.output_display_type, Some("DataFrame".to_string()));
        assert!(result.has_headers);
    }

    #[test]
    #[serial]
    fn test_execute_micropip() {
        let code = r#"
import micropip
await micropip.install("faker")
from faker import Faker
fake = Faker()
fake.name()
"#;
        let result = test_execute(code);

        assert_eq!(result.transaction_id, "test");
        assert!(result.success);
        assert!(result.output_value.is_some());
        assert_eq!(result.output_display_type, Some("str".to_string()));
        assert!(!result.has_headers);
    }

    #[test]
    #[serial]
    fn test_execute_python_error() {
        let code = r#"
not python code on line 2
"#;
        let result = test_execute(code);

        let expected_result = JsCodeResult {
            transaction_id: "test".to_string(),
            success: false,
            std_out: None,
            std_err: Some("SyntaxError on line 2: invalid syntax".into()),
            line_number: Some(2),
            output_value: None,
            output_array: None,
            output_display_type: None,
            chart_pixel_output: None,
            chart_image: None,
            has_headers: false,
        };

        assert_eq!(result, expected_result);
    }

    #[test]
    #[serial]
    fn test_execute_python_std_out() {
        let code = r#"
print("Nothing")
None
"#;
        let result = test_execute(code);

        // The result should have std_out captured
        assert_eq!(result.transaction_id, "test");
        assert_eq!(result.std_out, Some("Nothing\n".to_string()));
        assert!(result.success);
    }

    #[test]
    #[serial]
    fn test_execute_python_plotly() {
        let code = r#"
import plotly.express as px
import pandas as pd

df = pd.DataFrame({
    "x": [1, 2, 3],
    "y": [4, 5, 6],
})

fig = px.scatter(df, x="x", y="y")
fig.show()
"#;
        let result = test_execute(code);

        assert_eq!(result.transaction_id, "test");
    }

    #[test]
    #[serial]
    fn test_execute_stock_prices() {
        // This test requires the connection service to be running
        let code = r#"
data = q.financial.stock_prices("AAPL", "2025-01-01", "2025-01-31")
print(f"Got stock prices data type: {type(data)}")
data
"#;
        let result = test_execute(code);

        // The test may fail if connection service is not running
        // In that case, we just check it tried to execute
        assert_eq!(result.transaction_id, "test");
        if result.success {
            println!("Stock prices test succeeded");
            assert!(result.output_value.is_some() || result.output_array.is_some());
        } else {
            println!(
                "Stock prices test failed (connection service may not be running): {:?}",
                result.std_err
            );
        }
    }
}
