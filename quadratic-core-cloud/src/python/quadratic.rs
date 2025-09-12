use pyo3::exceptions::PyException;
use pyo3::prelude::*;
use pyo3::types::PyDict;
use quadratic_core::controller::execution::run_code::get_cells::{
    JsCellsA1Error, JsCellsA1Response,
};
use std::cell::RefCell;
use std::ffi::CString;

use crate::error::Result;

static CONVERT_CELL_VALUE: &str = include_str!("py_code/convert_cell_value.py");

/// Rust function to handle q.pos() calls from Python  
#[pyfunction]
pub(crate) fn pos() -> PyResult<(i32, i32)> {
    Ok((0, 0))
}

// Convert JsCellsA1Response to either a single value or a pandas DataFrame directly in Python
fn convert_cells_response(
    py: Python,
    result: JsCellsA1Response,
    first_row_header: bool,
) -> PyResult<PyObject> {
    if let Some(error) = &result.error {
        return Err(PyErr::new::<PyException, _>(error.core_error.to_string()));
    }

    // handle the None case
    let values = match &result.values {
        Some(v) => v,
        None => return Ok(py.None()),
    };

    // create a dictionary to store the values used in the Python code
    let locals = PyDict::new(py);
    locals.set_item("w", values.w)?;
    locals.set_item("h", values.h)?;
    locals.set_item("start_x", values.x)?;
    locals.set_item("start_y", values.y)?;
    locals.set_item("first_row_header", first_row_header)?;
    locals.set_item("has_headers", values.has_headers)?;

    // convert cells to Python objects
    let cells_list = pyo3::types::PyList::empty(py);
    for cell in &values.cells {
        let cell_dict = pyo3::types::PyDict::new(py);
        cell_dict.set_item("x", cell.x)?;
        cell_dict.set_item("y", cell.y)?;
        cell_dict.set_item("v", &cell.v)?;
        cell_dict.set_item("t", cell.t)?;
        cells_list.append(cell_dict)?;
    }
    locals.set_item("cells_data", cells_list)?;

    // create the conversion directly in Python - this is simpler and more reliable than trying
    // to convert through Rust types which have version-specific APIs
    let c_code = CString::new(CONVERT_CELL_VALUE)?;
    py.run(c_code.as_c_str(), None, Some(&locals))?;
    let result =
        locals
            .get_item("result")?
            .ok_or(PyErr::new::<pyo3::exceptions::PyException, _>(
                "Result should exist",
            ))?;

    Ok(result.into())
}

/// Creates a Python function that wraps the Rust get_cells closure
pub(crate) fn create_get_cells_function(
    py: Python,
    get_cells: Box<dyn FnMut(String) -> Result<JsCellsA1Response> + Send + 'static>,
) -> PyResult<PyObject> {
    let get_cells_ref = RefCell::new(get_cells);

    let function = pyo3::types::PyCFunction::new_closure(
        py,
        Some(c"rust_cells"),
        Some(c"Call rust get_cells function"),
        move |args, kwargs| {
            let a1: String = args.get_item(0)?.extract()?;

            // Extract first_row_header parameter (default: false)
            let first_row_header: bool = if args.len() > 1 {
                args.get_item(1)?.extract().unwrap_or(false)
            } else if let Some(kwargs) = kwargs {
                if let Ok(Some(value)) = kwargs.get_item("first_row_header") {
                    value.extract::<bool>().unwrap_or(false)
                } else {
                    false
                }
            } else {
                false
            };

            let result = match get_cells_ref.borrow_mut()(a1) {
                Ok(response) => response,
                Err(e) => JsCellsA1Response {
                    values: None,
                    error: Some(JsCellsA1Error {
                        core_error: e.to_string(),
                    }),
                },
            };

            Python::with_gil(|py| convert_cells_response(py, result, first_row_header))
        },
    )?;

    Ok(function.into())
}

#[cfg(test)]
mod tests {

    use quadratic_core::controller::execution::run_code::get_cells::{
        JsCellsA1Value, JsCellsA1Values,
    };

    use super::*;

    #[test]
    fn test_convert_cells_response() {
        Python::with_gil(|py| {
            // test single cell conversion
            let single_cell_response = JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 0,
                        y: 0,
                        v: "42".to_string(),
                        t: 2, // Number type
                    }],
                    x: 0,
                    y: 0,
                    w: 1,
                    h: 1,
                    one_dimensional: true,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            };

            let result = convert_cells_response(py, single_cell_response, false);
            assert!(result.is_ok());

            // test multiple cells conversion (should create DataFrame)
            let multi_cell_response = JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 0,
                            y: 0,
                            v: "Name".to_string(),
                            t: 1, // text type
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 0,
                            v: "Age".to_string(),
                            t: 1, // text type
                        },
                        JsCellsA1Value {
                            x: 0,
                            y: 1,
                            v: "Alice".to_string(),
                            t: 1, // text type
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "25".to_string(),
                            t: 2, // number type
                        },
                    ],
                    x: 0,
                    y: 0,
                    w: 2,
                    h: 2,
                    one_dimensional: false,
                    two_dimensional: true,
                    has_headers: true,
                }),
                error: None,
            };

            let result = convert_cells_response(py, multi_cell_response, true);
            assert!(result.is_ok());

            // test error case
            let error_response = JsCellsA1Response {
                values: None,
                error: Some(JsCellsA1Error {
                    core_error: "Test error".to_string(),
                }),
            };

            let result = convert_cells_response(py, error_response, false);
            assert!(result.is_err());
        });
    }
}
