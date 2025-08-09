use pyo3::prelude::*;
use quadratic_core::controller::execution::run_code::get_cells::JsCellsA1Response;
use quadratic_core::controller::transaction_types::{JsCellValueResult, JsCodeResult};

use crate::error::{CoreCloudError, Result};
use crate::python::quadratic::{create_get_cells_function, pos};
use crate::python::utils::{analyze_code, c_string, process_imports};

static PROCESS_OUTPUT_CODE: &str = include_str!("py_code/process_output.py");
static QUADRATIC: &str = include_str!("py_code/quadratic.py");

pub(crate) fn execute(
    code: &str,
    transaction_id: &str,
    get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
) -> Result<JsCodeResult> {
    Python::with_gil(|py| {
        let empty_result = JsCodeResult::default();

        // split code into lines
        let lines: Vec<&str> = code.trim().lines().collect();

        if lines.is_empty() {
            return Ok::<JsCodeResult, pyo3::PyErr>(empty_result);
        }

        // auto-install missing modules helper
        process_imports(&py, code)?;

        // use AST to determine if the last statement is an expression
        let (setup_code, expr_code, has_expression) = analyze_code(&py, code)?;

        // create a globals dict to capture q.cells("A1") call early
        let globals = pyo3::types::PyDict::new(py);

        // create a Python callable that uses the get_cells closure and returns converted values/DataFrames
        let get_cells_py = create_get_cells_function(py, get_cells)?;

        globals.set_item("rust_cells", get_cells_py)?;
        globals.set_item("rust_pos", wrap_pyfunction!(pos, py)?)?;

        // quadratic (`q`) module
        let quadratic = c_string(QUADRATIC)?;
        py.run(&quadratic, Some(&globals), None)?;

        // execute the setup code if it exists
        if let Some(setup) = setup_code {
            if !setup.trim().is_empty() {
                let c_setup = c_string(&setup)?;
                py.run(&c_setup, Some(&globals), None)?;
            }
        }

        // if the last line is an expression, evaluate it
        if has_expression {
            if let Some(expr) = expr_code {
                let c_expr = c_string(&expr)?;
                let result = py.eval(&c_expr, Some(&globals), None)?;

                // process the output code
                let c_process_output = c_string(PROCESS_OUTPUT_CODE)?;
                py.run(&c_process_output, Some(&globals), None)?;

                // set the result as a variable and call the function
                let locals = pyo3::types::PyDict::new(py);
                locals.set_item("output_value", result)?;
                let c_call_process =
                    c_string("processed_result = process_output_value(output_value)")?;
                py.run(&c_call_process, Some(&globals), Some(&locals))?;

                // get the processed result from Python
                let c_get_result = c_string("processed_result")?;
                let processed_result = py.eval(&c_get_result, Some(&globals), Some(&locals))?;

                // extract fields from Python dictionary
                let output_type = processed_result.get_item("output_type")?.extract()?;
                let has_headers = processed_result.get_item("has_headers")?.extract()?;

                // convert to JsCellValueResult format (tuple struct with value, type_id)
                let output_value = processed_result
                    .get_item("output_value")?
                    .extract::<Option<(pyo3::Bound<pyo3::PyAny>, u8)>>()?
                    .map(|(value, cell_type)| JsCellValueResult(value.to_string(), cell_type));

                // convert array_output to JsCellValueResult format
                let mut js_output_array = None;

                if output_value.is_none() {
                    let processed_result = processed_result.get_item("typed_array_output")?;

                    // first, try to extract as a 2D array
                    // if that fails, try to extract as a 1D array as a 2D array
                    let typed_array_output = match processed_result
                        .extract::<Vec<Vec<(pyo3::Bound<pyo3::PyAny>, u8)>>>()
                    {
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
                                    .map(|(cell, cell_type)| {
                                        JsCellValueResult(cell.to_string(), cell_type)
                                    })
                                    .collect()
                            })
                            .collect()
                    });
                }

                Ok(JsCodeResult {
                    transaction_id: transaction_id.to_string(),
                    success: true,
                    std_out: None,
                    std_err: None,
                    line_number: None,
                    output_value,
                    output_array: js_output_array,
                    output_display_type: Some(output_type),
                    chart_pixel_output: None,
                    has_headers,
                })
            } else {
                Ok(empty_result)
            }
        } else {
            // no expression to evaluate, just run the remaining code and return None
            Ok(empty_result)
        }
    })
    .map_err(CoreCloudError::from)
}

#[cfg(test)]

mod tests {
    use std::time::Instant;

    use super::*;

    fn test_get_cells(a1: String) -> Result<JsCellsA1Response> {
        println!("get_cells: {:?}", a1);
        Ok(JsCellsA1Response {
            values: None,
            error: None,
        })
    }

    #[test]
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
        let start = Instant::now();
        let result = execute(code, "test", Box::new(test_get_cells)).unwrap();
        let end = Instant::now();
        println!("time: {:?}", end.duration_since(start));
        println!("result: {:#?}", result);
    }

    #[test]
    fn test_execute_micropip() {
        let code = r#"
import micropip
await micropip.install("faker")
from faker import Faker
fake = Faker()
fake.name()
"#;
        let start = Instant::now();
        let result = execute(code, "test", Box::new(test_get_cells)).unwrap();
        let end = Instant::now();
        println!("time: {:?}", end.duration_since(start));
        println!("result: {:#?}", result);
    }
}
