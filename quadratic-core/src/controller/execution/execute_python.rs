use wasm_bindgen::JsValue;

use crate::{
    controller::{operations::operation::Operation, GridController},
    grid::{CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    util::date_string,
    Error, ErrorMsg, SheetPos,
};

impl GridController {
    pub(crate) fn execute_python(
        &mut self,
        sheet_pos: SheetPos,
        code_cell: &CodeCellValue,
    ) -> bool {
        if !cfg!(test) {
            let result = crate::wasm_bindings::js::runPython(code_cell.code_string);

            // run python will return false if python is not loaded (this can be generalized if we need to return a different error)
            if result == JsValue::FALSE {
                let error_msg = "Python interpreter not yet loaded (please run again)".to_string();
                let error = Error {
                    span: None,
                    msg: ErrorMsg::PythonError(error_msg.into()),
                };
                let result = CodeCellRunResult::Err { error };
                let code_cell_run = Some(CodeCellRunOutput {
                    std_out: None,
                    std_err: Some(error_msg),
                    result,
                    spill: false,
                });

                self.operations.insert(
                    0,
                    Operation::SetCodeCellRun {
                        sheet_pos,
                        code_cell_run,
                        last_modified: date_string(),
                    },
                );
                return false;
            }
        }
        self.has_async = true;
        true
    }
}
