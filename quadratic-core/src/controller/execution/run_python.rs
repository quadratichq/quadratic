use wasm_bindgen::JsValue;

use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    Error, ErrorMsg, SheetPos,
};

impl GridController {
    pub(crate) fn run_python(&mut self, sheet_pos: SheetPos, code_cell: &CodeCellValue) {
        if !cfg!(test) {
            let result = crate::wasm_bindings::js::runPython(code_cell.code_string.clone());

            // run python will return false if python is not loaded (this can be generalized if we need to return a different error)
            if result == JsValue::FALSE {
                let error_msg = "Python interpreter not yet loaded (please run again)".to_string();
                let error = Error {
                    span: None,
                    msg: ErrorMsg::PythonError(error_msg.clone().into()),
                };
                let result = CodeCellRunResult::Err { error };
                let spill = false; //self.check_is_spill_error(sheet_pos, code_cell.output_size());
                let new_code_cell = CodeCellValue {
                    output: Some(CodeCellRunOutput {
                        std_out: None,
                        std_err: Some(error_msg),
                        result,
                        spill,
                    }),
                    ..code_cell.clone()
                };
                self.add_code_cell_operations(sheet_pos, Some(code_cell), Some(&new_code_cell));
                return;
            }
        }
        self.has_async = true;

        // stop the computation cycle until async returns
        self.current_sheet_pos = Some(sheet_pos);
        self.waiting_for_async = Some(CodeCellLanguage::Python);
    }
}
