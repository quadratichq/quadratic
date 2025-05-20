use crate::{
    SheetPos,
    controller::{GridController, active_transactions::pending_transaction::PendingTransaction},
    grid::{CodeCellLanguage, CodeCellValue},
};

impl GridController {
    pub(crate) fn run_python(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
    ) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            crate::wasm_bindings::js::jsRunPython(
                transaction.id.to_string(),
                sheet_pos.x as i32,
                sheet_pos.y as i32,
                sheet_pos.sheet_id.to_string(),
                code.clone(),
            );
        }
        // stop the computation cycle until async returns
        transaction.current_sheet_pos = Some(sheet_pos);
        let code_cell = CodeCellValue {
            language: CodeCellLanguage::Python,
            code,
        };
        transaction.waiting_for_async = Some(code_cell);
        self.transactions.add_async_transaction(transaction);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ArraySize, CellValue, Rect,
        controller::{
            execution::run_code::get_cells::{JsCellsA1Response, JsCellsA1Value, JsCellsA1Values},
            transaction_types::{JsCellValueResult, JsCodeResult},
        },
        grid::js_types::JsRenderCell,
    };
    use bigdecimal::BigDecimal;

    #[test]
    fn test_run_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet_pos = pos![A1].to_sheet_pos(sheet_id);
        let code = "print('test')".to_string();
        gc.set_code_cell(sheet_pos, CodeCellLanguage::Python, code.clone(), None);

        let transaction = gc.async_transactions().first().unwrap();
        let transaction_id = transaction.id;
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction.id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("test".into(), 1)),
            ..Default::default()
        })
        .ok();

        let sheet = gc.grid.try_sheet_mut(sheet_id).unwrap();
        let pos = sheet_pos.into();
        let code_cell = sheet.cell_value(pos).unwrap();
        match code_cell {
            CellValue::Code(code_cell) => {
                assert_eq!(code_cell.language, CodeCellLanguage::Python);
                assert_eq!(code_cell.code, code);
            }
            _ => panic!("expected code cell"),
        }
        let data_table = sheet.data_tables.get_mut(&pos).unwrap();
        data_table.show_name = Some(false);
        data_table.show_columns = Some(false);
        assert_eq!(data_table.output_size(), ArraySize::_1X1);
        assert_eq!(
            data_table.cell_value_at(0, 1),
            Some(CellValue::Text("test".to_string()))
        );
        assert!(!data_table.spill_error);

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_python_hello_world() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('hello world')".into(),
            None,
        );

        // transaction for its id
        let transaction_id = gc.async_transactions()[0].id;

        let summary = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("hello world".into(), 1)),
            ..Default::default()
        });
        assert!(summary.is_ok());
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("hello world".into()))
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_python_addition_with_cell_reference() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // set A1 = 9
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "9".into(), None);

        // create a python program at A2 that adds A1 + 1
        gc.set_code_cell(
            pos![A2].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "q.cells('A1') + 1".into(),
            None,
        );

        // get the transaction id for the awaiting python async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the get_cells request from python
        let cells = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        assert_eq!(
            cells,
            JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 1,
                        y: 1,
                        v: "9".into(),
                        t: 2,
                    }],
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 1,
                    one_dimensional: false,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            }
        );

        // mock the python calculation returning the result
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("10".into(), 2)),
                ..Default::default()
            })
            .is_ok()
        );

        // check that the value at A3 contains the expected output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(BigDecimal::from(10)))
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_python_cell_reference_change() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // set A1 = 9
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "9".into(), None);

        // create a javascript program at A2 that adds A1 + 1
        gc.set_code_cell(
            pos![A2].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "q.cells('A1') + 1".into(),
            None,
        );

        // get the transaction id for the awaiting python async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the get_cells to populate dependencies
        gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        // mock the calculation_complete
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("10".into(), 2)),
            ..Default::default()
        })
        .unwrap();

        // replace the value in A1 to trigger the python calculation
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "10".into(), None);
        assert_eq!(gc.async_transactions().len(), 1);

        let transaction_id = gc.async_transactions()[0].id;

        let cells = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        assert_eq!(
            cells,
            JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 1,
                        y: 1,
                        v: "10".into(),
                        t: 2,
                    }],
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 1,
                    one_dimensional: false,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            }
        );
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("11".into(), 2)),
                ..Default::default()
            })
            .is_ok()
        );

        // check that the value at A2 contains the expected output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(BigDecimal::from(11)))
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    fn python_array(input: Vec<isize>) -> Vec<Vec<JsCellValueResult>> {
        input
            .iter()
            .map(|i| vec![JsCellValueResult(i.to_string(), 2)])
            .collect()
    }

    #[test]
    fn test_python_array_output_variable_length() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // creates a python program that outputs an array of length 10 from A1 -> C1
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "create an array output".into(),
            None,
        );

        // get the transaction id for the awaiting python async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the python calculation returning the result
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: None,
                output_array: Some(python_array(vec![1, 2, 3])),
                output_display_type: Some("list".into()),
                ..Default::default()
            })
            .is_ok()
        );

        let sheet = gc.try_sheet(sheet_id).unwrap();
        let cells = sheet.get_render_cells(Rect::from_numbers(1, 2, 1, 3), gc.a1_context());
        assert_eq!(cells.len(), 3);
        assert_eq!(
            cells[0],
            JsRenderCell::new_number(1, 2, 1, None, None, true)
        );
        assert_eq!(
            cells[1],
            JsRenderCell::new_number(1, 3, 2, None, None, true)
        );
        assert_eq!(
            cells[2],
            JsRenderCell::new_number(1, 4, 3, None, None, true)
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_python_cancellation() {
        // creates a dummy python program
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "dummy calculation".into(),
            None,
        );
        let transaction_id = gc.async_transactions()[0].id;
        // mock the python result
        let result = JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("".into(), 0)),
            cancel_compute: Some(true),
            ..Default::default()
        };
        gc.calculation_complete(result).unwrap();
        assert!(gc.async_transactions().is_empty());
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert!(
            sheet
                .display_value(pos![A1])
                .unwrap()
                .is_blank_or_empty_string()
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_python_does_not_replace_output_until_complete() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // creates a python program that outputs a string
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('original output')".into(),
            None,
        );

        // get the transaction id for the awaiting python async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the python calculation returning the result
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("original output".into(), 1,)),
                ..Default::default()
            })
            .is_ok()
        );

        // check that the value at A1 contains the expected output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("original output".into()))
        );
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('new output')".into(),
            None,
        );

        // check that the value at A1 contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("original output".into()))
        );

        let transaction_id = gc.async_transactions()[0].id;

        // mock the python calculation returning the result
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("new output".into(), 1)),
                ..Default::default()
            })
            .is_ok()
        );

        // repeat the same action to find a bug that occurs on second change
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("new output".into()))
        );
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('new output second time')".into(),
            None,
        );

        // check that the value at A1 contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("new output".into()))
        );

        let transaction_id = gc.async_transactions()[0].id;

        // mock the python calculation returning the result
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("new output second time".into(), 1,)),
                ..Default::default()
            })
            .is_ok()
        );

        // check that the value at A1 contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("new output second time".into()))
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_python_multiple_calculations() {
        // Tests in column A, and y: 1 = "1", y: 2 = "q.cells('A1') + 1", y: 3 = "q.cells('A2') + 1"
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "1".to_string(), None);
        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "q.cells('A1') + 1".into(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        assert_eq!(result.values.as_ref().unwrap().cells.len(), 1);
        assert_eq!(
            result.values.unwrap().cells[0],
            JsCellsA1Value {
                x: 1,
                y: 1,
                v: "1".into(),
                t: 2,
            }
        );
        let result = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("2".into(), 2)),
            ..Default::default()
        });
        assert!(result.is_ok());

        // todo...
        // assert!(result.ok().unwrap().generate_thumbnail);

        gc.set_code_cell(
            pos![C1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "q.cells('B2') + 1".into(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "B1".to_string());
        assert_eq!(result.values.as_ref().unwrap().cells.len(), 1);
        assert_eq!(
            result.values.unwrap().cells[0],
            JsCellsA1Value {
                x: 2,
                y: 1,
                v: "2".into(),
                t: 2,
            }
        );
        let result = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("3".into(), 2)),
            ..Default::default()
        });
        assert!(result.is_ok());

        // todo...
        // assert!(result.ok().unwrap().generate_thumbnail);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(pos![B1]),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(pos![C1]),
            Some(CellValue::Number(BigDecimal::from(3)))
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }
}
