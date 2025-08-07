use pyo3::prelude::*;
use pyo3::types::PyDict;
use quadratic_core::controller::execution::run_code::get_cells::{
    JsCellsA1Error, JsCellsA1Response, JsCellsA1Value, JsCellsA1Values,
};
use quadratic_core::controller::transaction_types::{JsCellValueResult, JsCodeResult};
use std::cell::RefCell;
use std::ffi::CString;

use crate::error::{CoreCloudError, Result};
use crate::python::quadratic::pos;

// PyObject types that hold values from JsCellsA1Response
#[pyclass]
#[derive(Clone)]
pub struct PyCellValue {
    #[pyo3(get)]
    pub x: i32,
    #[pyo3(get)]
    pub y: i32,
    #[pyo3(get)]
    pub v: String,
    #[pyo3(get)]
    pub t: u8,
}

#[pymethods]
impl PyCellValue {
    #[new]
    fn new(x: i32, y: i32, v: String, t: u8) -> Self {
        Self { x, y, v, t }
    }

    fn __repr__(&self) -> String {
        format!(
            "PyCellValue(x={}, y={}, v='{}', t={})",
            self.x, self.y, self.v, self.t
        )
    }
}

impl From<&JsCellsA1Value> for PyCellValue {
    fn from(value: &JsCellsA1Value) -> Self {
        Self {
            x: value.x,
            y: value.y,
            v: value.v.clone(),
            t: value.t,
        }
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyCellValues {
    #[pyo3(get)]
    pub cells: Vec<PyCellValue>,
    #[pyo3(get)]
    pub x: i32,
    #[pyo3(get)]
    pub y: i32,
    #[pyo3(get)]
    pub w: i32,
    #[pyo3(get)]
    pub h: i32,
    #[pyo3(get)]
    pub one_dimensional: bool,
    #[pyo3(get)]
    pub two_dimensional: bool,
    #[pyo3(get)]
    pub has_headers: bool,
}

#[pymethods]
impl PyCellValues {
    #[new]
    fn new(
        cells: Vec<PyCellValue>,
        x: i32,
        y: i32,
        w: i32,
        h: i32,
        one_dimensional: bool,
        two_dimensional: bool,
        has_headers: bool,
    ) -> Self {
        Self {
            cells,
            x,
            y,
            w,
            h,
            one_dimensional,
            two_dimensional,
            has_headers,
        }
    }

    fn __repr__(&self) -> String {
        format!(
            "PyCellValues(cells={}, x={}, y={}, w={}, h={}, one_dimensional={}, two_dimensional={}, has_headers={})",
            self.cells.len(),
            self.x,
            self.y,
            self.w,
            self.h,
            self.one_dimensional,
            self.two_dimensional,
            self.has_headers
        )
    }
}

impl From<&JsCellsA1Values> for PyCellValues {
    fn from(values: &JsCellsA1Values) -> Self {
        Self {
            cells: values.cells.iter().map(|cell| cell.into()).collect(),
            x: values.x,
            y: values.y,
            w: values.w,
            h: values.h,
            one_dimensional: values.one_dimensional,
            two_dimensional: values.two_dimensional,
            has_headers: values.has_headers,
        }
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyCellError {
    #[pyo3(get)]
    pub core_error: String,
}

#[pymethods]
impl PyCellError {
    #[new]
    fn new(core_error: String) -> Self {
        Self { core_error }
    }

    fn __repr__(&self) -> String {
        format!("PyCellError(core_error='{}')", self.core_error)
    }
}

impl From<&JsCellsA1Error> for PyCellError {
    fn from(error: &JsCellsA1Error) -> Self {
        Self {
            core_error: error.core_error.clone(),
        }
    }
}

#[pyclass]
#[derive(Clone)]
pub struct PyCellsResponse {
    #[pyo3(get)]
    pub values: Option<PyCellValues>,
    #[pyo3(get)]
    pub error: Option<PyCellError>,
}

#[pymethods]
impl PyCellsResponse {
    #[new]
    fn new(values: Option<PyCellValues>, error: Option<PyCellError>) -> Self {
        Self { values, error }
    }

    fn __repr__(&self) -> String {
        format!(
            "PyCellsResponse(values={:?}, error={:?})",
            self.values.is_some(),
            self.error.is_some()
        )
    }
}

impl From<&JsCellsA1Response> for PyCellsResponse {
    fn from(response: &JsCellsA1Response) -> Self {
        Self {
            values: response.values.as_ref().map(|v| v.into()),
            error: response.error.as_ref().map(|e| e.into()),
        }
    }
}

static IMPORTS: &str = include_str!("imports.py");
static SPLIT_CODE: &str = include_str!("split_code.py");
static PROCESS_OUTPUT_CODE: &str = include_str!("process_output.py");
static QUADRATIC: &str = include_str!("quadratic.py");

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

        // Create a Python callable that uses the get_cells closure and returns PyObject types
        let get_cells_ref = RefCell::new(get_cells);
        let get_cells_py = pyo3::types::PyCFunction::new_closure(
            py,
            Some(c"rust_cells"),
            Some(c"Call rust get_cells function"),
            move |args, _kwargs| {
                let a1: String = args.get_item(0)?.extract()?;
                let result = match get_cells_ref.borrow_mut()(a1) {
                    Ok(response) => response,
                    Err(e) => JsCellsA1Response {
                        values: None,
                        error: Some(JsCellsA1Error {
                            core_error: e.to_string(),
                        }),
                    },
                };

                Python::with_gil(|py| {
                    let py_response = PyCellsResponse::from(&result);
                    Ok::<PyObject, PyErr>(Py::new(py, py_response)?.into())
                })
            },
        )?;

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

/// Convert a string to a CString
pub(crate) fn c_string(file: &str) -> std::result::Result<CString, pyo3::PyErr> {
    CString::new(file).map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(e.to_string()))
}

/// Process imports using AST-based parsing
pub(crate) fn process_imports(py: &Python, code: &str) -> std::result::Result<(), pyo3::PyErr> {
    // auto-install missing modules helper
    let c_auto_install = c_string(IMPORTS)?;
    py.run(&c_auto_install, None, None)?;

    // process imports using AST-based parsing
    let process_imports_call = format!("process_imports_ast({:?})", code);
    let c_process = c_string(&process_imports_call)?;
    py.run(&c_process, None, None)?;

    Ok(())
}

/// Analyze code using AST to determine if the last statement is an expression
pub(crate) fn analyze_code(
    py: &Python,
    code: &str,
) -> std::result::Result<(Option<String>, Option<String>, bool), pyo3::PyErr> {
    let ast_code = format!(
        "{}\nresult = split_code_for_execution({:?})",
        SPLIT_CODE, code
    );

    let c_ast = c_string(&ast_code)?;
    py.run(&c_ast, None, None)?;

    // get the result of code analysis
    let c_result = c_string("result")?;
    let result_tuple = py.eval(&c_result, None, None)?;

    Ok(result_tuple.extract()?)
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
    fn test_pyobject_types() {
        // Test the conversion from JsCellsA1Response to PyObject types (without Python runtime)
        let test_response = JsCellsA1Response {
            values: Some(JsCellsA1Values {
                cells: vec![
                    JsCellsA1Value {
                        x: 0,
                        y: 0,
                        v: "test_value".to_string(),
                        t: 1,
                    },
                    JsCellsA1Value {
                        x: 1,
                        y: 0,
                        v: "another_value".to_string(),
                        t: 2,
                    },
                ],
                x: 0,
                y: 0,
                w: 2,
                h: 1,
                one_dimensional: false,
                two_dimensional: true,
                has_headers: false,
            }),
            error: None,
        };

        let py_response = PyCellsResponse::from(&test_response);

        // Verify the conversion
        assert!(py_response.values.is_some());
        assert!(py_response.error.is_none());

        let values = py_response.values.unwrap();
        assert_eq!(values.cells.len(), 2);
        assert_eq!(values.x, 0);
        assert_eq!(values.y, 0);
        assert_eq!(values.w, 2);
        assert_eq!(values.h, 1);
        assert!(!values.one_dimensional);
        assert!(values.two_dimensional);
        assert!(!values.has_headers);

        assert_eq!(values.cells[0].x, 0);
        assert_eq!(values.cells[0].y, 0);
        assert_eq!(values.cells[0].v, "test_value");
        assert_eq!(values.cells[0].t, 1);

        // Test error conversion
        let error_response = JsCellsA1Response {
            values: None,
            error: Some(JsCellsA1Error {
                core_error: "Test error".to_string(),
            }),
        };

        let py_error_response = PyCellsResponse::from(&error_response);
        assert!(py_error_response.values.is_none());
        assert!(py_error_response.error.is_some());

        let error = py_error_response.error.unwrap();
        assert_eq!(error.core_error, "Test error");

        println!("PyObject types conversion test passed!");
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
