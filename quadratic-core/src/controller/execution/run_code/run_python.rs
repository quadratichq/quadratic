use wasm_bindgen::JsValue;

use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    Error, ErrorMsg, SheetPos,
};

impl GridController {
    fn python_not_loaded(&mut self, sheet_pos: SheetPos, code_cell: &CodeCellValue) {
        let error = Error {
            span: None,
            msg: ErrorMsg::PythonNotLoaded,
        };
        let result = CodeCellRunResult::Err { error };
        let spill = false;
        let new_code_cell = CodeCellValue {
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: Some(ErrorMsg::PythonNotLoaded.to_string()),
                result,
                spill,
            }),
            ..code_cell.clone()
        };
        if let Some(sheet) = self.grid.try_sheet_mut_from_id(sheet_pos.sheet_id) {
            sheet.set_code_cell(sheet_pos.into(), Some(new_code_cell.clone()));
        }
        self.add_code_cell_operations(sheet_pos, Some(code_cell), Some(&new_code_cell));
    }

    pub(crate) fn run_python(&mut self, sheet_pos: SheetPos, code_cell: &CodeCellValue) {
        if !cfg!(test) {
            let result = crate::wasm_bindings::js::runPython(code_cell.code_string.clone());

            // run python will return false if python is not loaded (this can be generalized if we need to return a different error)
            if result == JsValue::FALSE {
                self.python_not_loaded(sheet_pos, code_cell);
                return;
            }
        }
        self.has_async = true;

        // stop the computation cycle until async returns
        self.current_sheet_pos = Some(sheet_pos);
        self.waiting_for_async = Some(CodeCellLanguage::Python);
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::{transaction_types::JsCodeResult, GridController},
        grid::{CodeCellLanguage, CodeCellValue},
        ArraySize, CellValue, Pos, Rect, SheetPos,
    };

    #[test]
    fn test_run_python() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let code_string = "print(1)".to_string();
        gc.set_code_cell(
            sheet_pos.clone(),
            CodeCellLanguage::Python,
            code_string.clone(),
            None,
        );
        gc.calculation_complete(JsCodeResult::new(
            true,
            None,
            None,
            None,
            Some("test".to_string()),
            None,
            None,
            None,
        ));

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        let code_cell = sheet.get_code_cell(sheet_pos.into()).unwrap();
        assert_eq!(code_cell.language, CodeCellLanguage::Python);
        assert_eq!(code_cell.code_string, code_string);
        assert_eq!(code_cell.output_size(), ArraySize::_1X1);
        assert_eq!(
            code_cell.get_output_value(0, 0),
            Some(CellValue::Text("test".to_string()))
        );
        assert_eq!(code_cell.has_spill_error(), false);
    }

    #[test]
    fn test_run_python_not_loaded() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let code_cell = CodeCellValue {
            language: CodeCellLanguage::Python,
            code_string: "print(1)".to_string(),
            formatted_code_string: None,
            output: None,
            last_modified: "".to_string(),
        };
        let sheet = gc.grid.try_sheet_mut_from_id(sheet_id).unwrap();
        sheet.set_code_cell(sheet_pos.into(), Some(code_cell.clone()));
        gc.python_not_loaded(sheet_pos, &code_cell);

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        let cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));
        let cell = cells.get(0);
        assert_eq!(cell.unwrap().value, " ERROR".to_string());
        let cell_value = sheet.get_cell_value(Pos { x: 0, y: 0 });
        assert_eq!(cell_value, Some(CellValue::Blank));
    }
}
