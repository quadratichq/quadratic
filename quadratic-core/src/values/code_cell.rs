//! Single-cell code cell containing the code run and its computed output value.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::CellValue;
use crate::RunError;
use crate::grid::{CodeCellLanguage, CodeRun};

/// Single-cell code cell containing the code run and its computed output value.
/// Used for code cells with 1x1 output and no visible table UI.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCell {
    /// The code run containing language, code, cells_accessed, error info, etc.
    pub code_run: CodeRun,
    /// The computed output value (single cell). When there's an error, this should
    /// contain CellValue::Error with the error info.
    pub output: Box<CellValue>,
    /// When the code cell was last modified/run.
    pub last_modified: DateTime<Utc>,
}

impl CodeCell {
    /// Creates a new CodeCell with the given code run and output value.
    pub fn new(code_run: CodeRun, output: CellValue) -> Self {
        Self {
            code_run,
            output: Box::new(output),
            last_modified: Utc::now(),
        }
    }

    /// Creates a new CodeCell with an error output.
    pub fn with_error(code_run: CodeRun, error: RunError) -> Self {
        Self {
            code_run,
            output: Box::new(CellValue::Error(Box::new(error))),
            last_modified: Utc::now(),
        }
    }

    /// Apply a new last modified date to the CodeCell.
    pub fn with_last_modified(mut self, last_modified: DateTime<Utc>) -> Self {
        self.last_modified = last_modified;
        self
    }

    /// Returns the language of the code cell.
    pub fn language(&self) -> &CodeCellLanguage {
        &self.code_run.language
    }

    /// Returns the code string.
    pub fn code(&self) -> &str {
        &self.code_run.code
    }

    /// Returns true if the code run has an error.
    pub fn has_error(&self) -> bool {
        self.code_run.error.is_some()
    }

    /// Returns the error if present.
    pub fn error(&self) -> Option<&RunError> {
        self.code_run.error.as_ref()
    }

    /// Returns the output value (may be an error).
    pub fn output_value(&self) -> &CellValue {
        &self.output
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{RunErrorMsg, Span};

    fn test_code_run(language: CodeCellLanguage, code: &str) -> CodeRun {
        CodeRun {
            language,
            code: code.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn test_code_cell_new() {
        let code_run = test_code_run(CodeCellLanguage::Formula, "A1 + B1");
        let output = CellValue::Number(42.into());
        let code_cell = CodeCell::new(code_run.clone(), output.clone());

        assert_eq!(code_cell.code_run, code_run);
        assert_eq!(*code_cell.output, output);
    }

    #[test]
    fn test_code_cell_with_error() {
        let code_run = test_code_run(CodeCellLanguage::Python, "invalid code");
        let error = RunError {
            span: Some(Span { start: 0, end: 12 }),
            msg: RunErrorMsg::CodeRunError("SyntaxError".into()),
        };
        let code_cell = CodeCell::with_error(code_run.clone(), error.clone());

        assert_eq!(code_cell.code_run, code_run);
        assert!(matches!(&*code_cell.output, CellValue::Error(e) if **e == error));
    }

    #[test]
    fn test_code_cell_language() {
        let code_run = test_code_run(CodeCellLanguage::Javascript, "return 1;");
        let code_cell = CodeCell::new(code_run, CellValue::Number(1.into()));

        assert_eq!(code_cell.language(), &CodeCellLanguage::Javascript);
    }

    #[test]
    fn test_code_cell_code() {
        let code = "SUM(A1:A10)";
        let code_run = test_code_run(CodeCellLanguage::Formula, code);
        let code_cell = CodeCell::new(code_run, CellValue::Number(100.into()));

        assert_eq!(code_cell.code(), code);
    }

    #[test]
    fn test_code_cell_has_error() {
        // No error
        let code_run = test_code_run(CodeCellLanguage::Formula, "1+1");
        let code_cell = CodeCell::new(code_run, CellValue::Number(2.into()));
        assert!(!code_cell.has_error());

        // With error in code_run
        let mut code_run_with_error = test_code_run(CodeCellLanguage::Python, "bad code");
        code_run_with_error.error = Some(RunError {
            span: None,
            msg: RunErrorMsg::CodeRunError("Error".into()),
        });
        let code_cell_with_error = CodeCell::new(code_run_with_error, CellValue::Blank);
        assert!(code_cell_with_error.has_error());
    }

    #[test]
    fn test_code_cell_error() {
        // No error
        let code_run = test_code_run(CodeCellLanguage::Formula, "1+1");
        let code_cell = CodeCell::new(code_run, CellValue::Number(2.into()));
        assert!(code_cell.error().is_none());

        // With error
        let error = RunError {
            span: Some(Span { start: 5, end: 10 }),
            msg: RunErrorMsg::DivideByZero,
        };
        let mut code_run_with_error = test_code_run(CodeCellLanguage::Formula, "1/0");
        code_run_with_error.error = Some(error.clone());
        let code_cell_with_error = CodeCell::new(code_run_with_error, CellValue::Blank);
        assert_eq!(code_cell_with_error.error(), Some(&error));
    }

    #[test]
    fn test_code_cell_output_value() {
        let code_run = test_code_run(CodeCellLanguage::Formula, "\"hello\"");
        let output = CellValue::Text("hello".to_string());
        let code_cell = CodeCell::new(code_run, output.clone());

        assert_eq!(code_cell.output_value(), &output);
    }

    #[test]
    fn test_code_cell_clone() {
        let code_run = test_code_run(CodeCellLanguage::Formula, "A1");
        let code_cell = CodeCell::new(code_run, CellValue::Number(10.into()));
        let cloned = code_cell.clone();

        assert_eq!(code_cell, cloned);
    }

    #[test]
    fn test_code_cell_debug() {
        let code_run = test_code_run(CodeCellLanguage::Formula, "1");
        let code_cell = CodeCell::new(code_run, CellValue::Number(1.into()));
        let debug_str = format!("{:?}", code_cell);

        assert!(debug_str.contains("CodeCell"));
        assert!(debug_str.contains("code_run"));
        assert!(debug_str.contains("output"));
    }

}
