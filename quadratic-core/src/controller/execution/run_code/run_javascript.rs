use crate::{
    SheetPos,
    controller::{GridController, active_transactions::pending_transaction::PendingTransaction},
    grid::{CodeCellLanguage, CodeCellValue},
};

impl GridController {
    pub(crate) fn run_javascript(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
    ) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            crate::wasm_bindings::js::jsRunJavascript(
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
            language: CodeCellLanguage::Javascript,
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
    fn test_run_javascript() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet_pos = pos![A1].to_sheet_pos(sheet_id);
        let code = "return 'test';".to_string();
        gc.set_code_cell(sheet_pos, CodeCellLanguage::Javascript, code.clone(), None);

        let transaction = gc.async_transactions().first().unwrap();
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
                assert_eq!(code_cell.language, CodeCellLanguage::Javascript);
                assert_eq!(code_cell.code, code);
            }
            _ => panic!("expected code cell"),
        }
        let data_table = sheet.data_tables.get_mut(&pos).unwrap();
        data_table.show_name = Some(false);
        data_table.show_columns = Some(false);
        assert_eq!(data_table.output_size(), ArraySize::_1X1);
        assert_eq!(
            data_table.cell_value_at(0, 0),
            Some(CellValue::Text("test".to_string()))
        );
        assert!(!data_table.spill_error);
    }

    #[test]
    fn test_javascript_hello_world() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "return 'hello world';".into(),
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
    }

    #[test]
    fn test_javascript_addition_with_cell_reference() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // set A1 = 9
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "9".into(), None);

        // create a javascript program at A2 that adds A1 + 1
        gc.set_code_cell(
            pos![A2].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "return q.cells(\"A1\") + 1;".into(),
            None,
        );

        // get the transaction id for the awaiting javascript async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the get_cells request from javascript
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

        // mock the javascript calculation returning the result
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
    }

    #[test]
    fn test_javascript_cell_reference_change() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // set A1 = 9
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "9".into(), None);

        // create a javascript program at A2 that adds A1 + 1
        gc.set_code_cell(
            pos![A2].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "return q.cells(\"A1\") + 1;".into(),
            None,
        );

        // get the transaction id for the awaiting javascript async calculation
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

        assert_eq!(gc.async_transactions().len(), 0);

        // replace the value in A1 to trigger the javascript calculation
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
    }

    fn javascript_array(input: Vec<isize>) -> Vec<Vec<JsCellValueResult>> {
        input
            .iter()
            .map(|i| vec![JsCellValueResult(i.to_string(), 2)])
            .collect()
    }

    #[test]
    fn test_javascript_array_output_variable_length() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // creates a javascript program that outputs an array of length 10 from A1 -> C1
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "create an array output".into(),
            None,
        );

        // get the transaction id for the awaiting javascript async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the javascript calculation returning the result
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_array: Some(javascript_array(vec![1, 2, 3])),
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
    }

    #[test]
    fn test_javascript_cancellation() {
        // creates a dummy javascript program
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
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
    }

    #[test]
    fn test_javascript_does_not_replace_output_until_complete() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // creates a javascript program that outputs a string
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "return 'original output';".into(),
            None,
        );

        // get the transaction id for the awaiting javascript async calculation
        let transaction_id = gc.async_transactions()[0].id;

        // mock the javascript calculation returning the result
        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("original output".into(), 1)),
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
            CodeCellLanguage::Javascript,
            "return 'new output';".into(),
            None,
        );

        // check that the value at A1 contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("original output".into()))
        );

        let transaction_id = gc.async_transactions()[0].id;

        // mock the javascript calculation returning the result
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
            CodeCellLanguage::Javascript,
            "return 'new output second time';".into(),
            None,
        );

        // check that the value at A1 contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("new output".into()))
        );

        let transaction_id = gc.async_transactions()[0].id;

        // mock the javascript calculation returning the result
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
    }

    #[test]
    fn test_javascript_multiple_calculations() {
        // Tests in column A, and y: 1 = "1", y: 2 = "q.cells(\"A1\") + 1", y: 3 = "q.cells(\"A2\") + 1"
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "1".to_string(), None);
        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "q.cells(\"A1\") + 1".into(),
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
            CodeCellLanguage::Javascript,
            "q.cells(\"B2\") + 1".into(),
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
    }

    #[test]
    fn test_javascript_with_headers() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "return ['header', 1, 2, 3];".into(),
            None,
        );

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
    }
}
