use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::CodeCellLanguage,
    SheetPos,
};

impl GridController {
    pub(crate) fn run_python(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
    ) {
        if !cfg!(test) {
            crate::wasm_bindings::js::runPython(
                transaction.id.to_string(),
                sheet_pos.x as i32,
                sheet_pos.y as i32,
                sheet_pos.sheet_id.to_string(),
                code,
            );
        }
        // stop the computation cycle until async returns
        transaction.summary.transaction_id = Some(transaction.id.to_string());
        transaction.current_sheet_pos = Some(sheet_pos);
        transaction.waiting_for_async = Some(CodeCellLanguage::Python);
        transaction.has_async = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::{
            execution::run_code::get_cells::{GetCellResponse, GetCellsResponse},
            transaction_types::{JsCodeResult, JsComputeGetCells},
        },
        grid::js_types::JsRenderCell,
        ArraySize, CellValue, Pos, Rect,
    };
    use bigdecimal::BigDecimal;

    #[test]
    fn test_run_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let code = "print(1)".to_string();
        gc.set_code_cell(sheet_pos, CodeCellLanguage::Python, code.clone(), None);

        let transaction = gc.async_transactions().first().unwrap();
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

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        let pos = sheet_pos.into();
        let code_cell = sheet.cell_value(pos).unwrap();
        match code_cell {
            CellValue::Code(code_cell) => {
                assert_eq!(code_cell.language, CodeCellLanguage::Python);
                assert_eq!(code_cell.code, code);
            }
            _ => panic!("expected code cell"),
        }
        let code_run = sheet.code_runs.get(&pos).unwrap();
        assert_eq!(code_run.output_size(), ArraySize::_1X1);
        assert_eq!(
            code_run.cell_value_at(0, 0),
            Some(CellValue::Text("test".to_string()))
        );
        assert!(!code_run.spill_error);
    }

    #[test]
    fn test_python_hello_world() {
        let mut gc = GridController::test();
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

        let summary = gc.calculation_complete(JsCodeResult::new_from_rust(
            transaction_id.to_string(),
            true,
            None,
            None,
            None,
            Some("hello world".to_string()),
            None,
            None,
            None,
        ));
        assert!(summary.is_ok());
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.get_code_cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("hello world".into()))
        );
        assert_eq!(summary.ok().unwrap().cell_sheets_modified.len(), 1);
    }

    #[test]
    fn test_python_addition_with_cell_reference() {
        let mut gc = GridController::test();
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
            cells,
            Ok(GetCellsResponse {
                response: vec![GetCellResponse {
                    x: 0,
                    y: 0,
                    value: "9".into()
                }]
            })
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
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(10)))
        );
    }

    #[test]
    fn test_python_cell_reference_change() {
        let mut gc = GridController::test();
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

        // mock the get_cells to populate dependencies
        let _ = gc.calculation_get_cells(JsComputeGetCells::new(
            transaction_id.to_string(),
            Rect::from_numbers(0, 0, 1, 1),
            None,
            None,
        ));
        // mock the calculation_complete
        let _ = gc.calculation_complete(JsCodeResult::new_from_rust(
            transaction_id.to_string(),
            true,
            None,
            None,
            None,
            Some("10".to_string()),
            None,
            None,
            None,
        ));

        // replace the value in (0, 0) to trigger the python calculation
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "10".into(),
            None,
        );
        assert_eq!(gc.async_transactions().len(), 1);

        let transaction_id = gc.async_transactions()[0].id;

        let cells = gc.calculation_get_cells(JsComputeGetCells::new(
            transaction_id.to_string(),
            Rect::from_numbers(0, 0, 1, 1),
            None,
            None,
        ));
        assert_eq!(
            cells,
            Ok(GetCellsResponse {
                response: vec![GetCellResponse {
                    x: 0,
                    y: 0,
                    value: "10".into()
                }]
            })
        );
        assert!(gc
            .calculation_complete(JsCodeResult::new_from_rust(
                transaction_id.to_string(),
                true,
                None,
                None,
                None,
                Some("11".to_string()),
                None,
                None,
                None,
            ))
            .is_ok());

        // check that the value at (0, 1) contains the expected output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(11)))
        );
    }

    fn python_array(input: Vec<isize>) -> Vec<Vec<String>> {
        input.iter().map(|i| vec![i.to_string()]).collect()
    }

    #[test]
    fn test_python_array_output_variable_length() {
        let mut gc = GridController::test();
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

        let sheet = gc.try_sheet(sheet_id).unwrap();
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
        let mut gc = GridController::test();
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
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert!(sheet
            .display_value(Pos { x: 0, y: 0 })
            .unwrap()
            .is_blank_or_empty_string());
    }

    #[test]
    fn test_python_does_not_replace_output_until_complete() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // creates a python program that outputs a string
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "print('original output')".into(),
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
                Some("original output".to_string()),
                None,
                None,
                None,
            ))
            .is_ok());

        // check that the value at (0, 0) contains the expected output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("original output".into()))
        );
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "print('new output')".into(),
            None,
        );

        // check that the value at (0, 0) contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("original output".into()))
        );

        let transaction_id = gc.async_transactions()[0].id;

        // mock the python calculation returning the result
        assert!(gc
            .calculation_complete(JsCodeResult::new_from_rust(
                transaction_id.to_string(),
                true,
                None,
                None,
                None,
                Some("new output".to_string()),
                None,
                None,
                None,
            ))
            .is_ok());

        // repeat the same action to find a bug that occurs on second change
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("new output".into()))
        );
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "print('new output second time')".into(),
            None,
        );

        // check that the value at (0, 0) contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("new output".into()))
        );

        let transaction_id = gc.async_transactions()[0].id;

        // mock the python calculation returning the result
        assert!(gc
            .calculation_complete(JsCodeResult::new_from_rust(
                transaction_id.to_string(),
                true,
                None,
                None,
                None,
                Some("new output second time".to_string()),
                None,
                None,
                None,
            ))
            .is_ok());

        // check that the value at (0, 0) contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("new output second time".into()))
        );
    }

    #[test]
    fn test_python_multiple_calculations() {
        // Tests in column 0, and y: 0 = "1", y: 1 = "c(0,0) + 1", y: 2 = "c(0, 1) + 1"
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "1".to_string(),
            None,
        );
        let summary = gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "c(0, 0) + 1".into(),
            None,
        );
        let result = gc
            .calculation_get_cells(JsComputeGetCells::new(
                summary.transaction_id.clone().unwrap(),
                Rect::from_numbers(0, 0, 1, 1),
                None,
                None,
            ))
            .ok()
            .unwrap();
        assert_eq!(result.response.len(), 1);
        assert_eq!(
            result.response[0],
            GetCellResponse {
                x: 0,
                y: 0,
                value: "1".into()
            }
        );
        let result = gc.calculation_complete(JsCodeResult::new_from_rust(
            summary.transaction_id.unwrap(),
            true,
            None,
            None,
            None,
            Some("2".to_string()),
            None,
            None,
            None,
        ));
        assert!(result.is_ok());
        assert_eq!(result.clone().ok().unwrap().cell_sheets_modified.len(), 1);
        assert!(result.ok().unwrap().generate_thumbnail);

        let summary = gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "c(0, 1) + 1".into(),
            None,
        );
        let result = gc
            .calculation_get_cells(JsComputeGetCells::new(
                summary.transaction_id.clone().unwrap(),
                Rect::from_numbers(0, 1, 1, 1),
                None,
                None,
            ))
            .ok()
            .unwrap();
        assert_eq!(result.response.len(), 1);
        assert_eq!(
            result.response[0],
            GetCellResponse {
                x: 0,
                y: 1,
                value: "2".into()
            }
        );
        let result = gc.calculation_complete(JsCodeResult::new_from_rust(
            summary.transaction_id.unwrap(),
            true,
            None,
            None,
            None,
            Some("3".to_string()),
            None,
            None,
            None,
        ));
        assert!(result.is_ok());
        assert_eq!(result.clone().ok().unwrap().cell_sheets_modified.len(), 1);
        assert!(result.ok().unwrap().generate_thumbnail);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
    }
}
