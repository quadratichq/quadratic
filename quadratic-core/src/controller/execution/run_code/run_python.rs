use wasm_bindgen::JsValue;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    Error, ErrorMsg, SheetPos,
};

impl GridController {
    fn python_not_loaded(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code_cell: &CodeCellValue,
    ) {
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
        self.add_code_cell_operations(
            transaction,
            sheet_pos,
            Some(code_cell),
            Some(&new_code_cell),
        );
    }

    pub(crate) fn run_python(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code_cell: &CodeCellValue,
    ) -> bool {
        if !cfg!(test) {
            let result = crate::wasm_bindings::js::runPython(code_cell.code_string.clone());

            // run python will return false if python is not loaded (this can be generalized if we need to return a different error)
            if result == JsValue::FALSE {
                self.python_not_loaded(transaction, sheet_pos, code_cell);
                return false;
            }
        }
        transaction.waiting_for_async = Some(CodeCellLanguage::Python);
        transaction.has_async = true;

        // stop the computation cycle until async returns
        transaction.current_sheet_pos = Some(sheet_pos);
        true
    }
}

#[cfg(test)]
mod tests {
    use bigdecimal::BigDecimal;

    use super::*;
    use crate::{
        controller::transaction_types::{CellForArray, JsCodeResult, JsComputeGetCells},
        grid::js_types::JsRenderCell,
        ArraySize, CellValue, Pos, Rect,
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
            sheet_pos,
            CodeCellLanguage::Python,
            code_string.clone(),
            None,
        );
        let transaction = gc.async_transactions().get(0).unwrap();
        gc.calculation_complete(JsCodeResult::new(
            transaction.id.to_string(),
            true,
            None,
            None,
            None,
            Some("test".to_string()),
            None,
            None,
            None,
        ))
        .ok();

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        let code_cell = sheet.get_code_cell(sheet_pos.into()).unwrap();
        assert_eq!(code_cell.language, CodeCellLanguage::Python);
        assert_eq!(code_cell.code_string, code_string);
        assert_eq!(code_cell.output_size(), ArraySize::_1X1);
        assert_eq!(
            code_cell.get_output_value(0, 0),
            Some(CellValue::Text("test".to_string()))
        );
        assert!(!code_cell.has_spill_error());
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
        gc.set_code_cell(
            sheet_pos,
            code_cell.language,
            code_cell.code_string.clone(),
            None,
        );
        let transaction_id = gc.async_transactions()[0].id;
        let mut transaction = gc
            .transactions
            .remove_awaiting_async(transaction_id)
            .ok()
            .unwrap();
        gc.python_not_loaded(&mut transaction, sheet_pos, &code_cell);

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        let cells = sheet.get_render_cells(crate::Rect::single_pos(Pos { x: 0, y: 0 }));
        let cell = cells.get(0);
        assert_eq!(cell.unwrap().value, " ERROR".to_string());
        let cell_value = sheet.get_cell_value(Pos { x: 0, y: 0 });
        assert_eq!(cell_value, Some(CellValue::Blank));
    }

    #[test]
    fn test_python_hello_world() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "print('hello world')".into(),
            None,
        );

        // transaction for its id
        let transaction_id = gc.async_transactions()[0].id;

        assert!(gc
            .calculation_complete(JsCodeResult::new_from_rust(
                transaction_id.to_string(),
                true,
                None,
                None,
                None,
                Some("hello world".to_string()),
                None,
                None,
                None,
            ))
            .is_ok());
        let sheet = gc.try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_code_cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("hello world".into()))
        );
    }

    #[test]
    fn test_python_addition_with_cell_reference() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        // set (0, 0) = 9
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "9".into(),
            None,
        );

        // create a python program at (0, 1) that adds (0, 0) + 1
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "c(0, 0) + 1".into(),
            None,
        );

        // get the transaction id for the awaiting python async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the get_cells request from python
        let cells = gc.calculation_get_cells(JsComputeGetCells::new(
            transaction_id.to_string(),
            Rect::from_numbers(0, 0, 1, 1),
            None,
            None,
        ));
        assert!(cells.is_ok());
        assert_eq!(
            cells.unwrap().get_cells(),
            &vec![CellForArray::new(0, 0, Some("9".to_string()))]
        );

        // mock the python calculation returning the result
        assert!(gc
            .calculation_complete(JsCodeResult::new_from_rust(
                transaction_id.to_string(),
                true,
                None,
                None,
                None,
                Some("10".to_string()),
                None,
                None,
                None,
            ))
            .is_ok());

        // check that the value at (0, 1) contains the expected output
        let sheet = gc.try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(10)))
        );
    }

    fn python_array(input: Vec<isize>) -> Vec<Vec<String>> {
        input.iter().map(|i| vec![i.to_string()]).collect()
    }

    #[test]
    fn test_python_array_output_variable_length() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        // creates a python program that outputs an array of length 10 from (0, 0) -> (2, 0)
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "create an array output".into(),
            None,
        );

        // get the transaction id for the awaiting python async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the python calculation returning the result
        assert!(gc
            .calculation_complete(JsCodeResult::new_from_rust(
                transaction_id.to_string(),
                true,
                None,
                None,
                None,
                None,
                Some(python_array(vec![1, 2, 3])),
                None,
                None,
            ))
            .is_ok());

        let sheet = gc.try_sheet_from_id(sheet_id).unwrap();
        let cells = sheet.get_render_cells(Rect::from_numbers(0, 0, 1, 3));
        assert_eq!(cells.len(), 3);
        assert_eq!(
            cells[0],
            JsRenderCell::new_number(0, 0, 1, Some(CodeCellLanguage::Python))
        );
        assert_eq!(cells[1], JsRenderCell::new_number(0, 1, 2, None));
        assert_eq!(cells[2], JsRenderCell::new_number(0, 2, 3, None));
    }

    #[test]
    fn test_python_cancellation() {
        // creates a dummy python program
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "dummy calculation".into(),
            None,
        );
        let transaction_id = gc.async_transactions()[0].id;
        // mock the python result
        let result = JsCodeResult::new(
            transaction_id.to_string(),
            true,
            None,
            None,
            None,
            Some("".into()),
            None,
            None,
            Some(true),
        );
        gc.calculation_complete(result).unwrap();
        assert!(gc.async_transactions().is_empty());
        let sheet = gc.try_sheet_from_id(sheet_id).unwrap();
        assert!(sheet
            .get_cell_value(Pos { x: 0, y: 0 })
            .unwrap()
            .is_blank_or_empty_string());
    }
}
