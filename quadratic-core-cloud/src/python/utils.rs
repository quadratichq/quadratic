use pyo3::prelude::*;
use std::ffi::CString;

static IMPORTS: &str = include_str!("py_code/imports.py");
static SPLIT_CODE: &str = include_str!("py_code/split_code.py");

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

    use super::*;
}
