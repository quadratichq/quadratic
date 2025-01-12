use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::CodeCellLanguage,
    SheetPos,
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
                code,
            );
        }
        // stop the computation cycle until async returns
        transaction.current_sheet_pos = Some(sheet_pos);
        transaction.waiting_for_async = Some(CodeCellLanguage::Javascript);
        self.transactions.add_async_transaction(transaction);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::{
            execution::run_code::get_cells::{CellA1Response, JsGetCellResponse},
            transaction_types::JsCodeResult,
        },
        grid::js_types::JsRenderCell,
        ArraySize, CellValue, Rect,
    };
    use bigdecimal::BigDecimal;
    use serial_test::parallel;

    #[test]
    #[parallel]
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
            output_value: Some(vec!["test".into(), "text".into()]),
            ..Default::default()
        })
        .ok();

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        let pos = sheet_pos.into();
        let code_cell = sheet.cell_value(pos).unwrap();
        match code_cell {
            CellValue::Code(code_cell) => {
                assert_eq!(code_cell.language, CodeCellLanguage::Javascript);
                assert_eq!(code_cell.code, code);
            }
            _ => panic!("expected code cell"),
        }
        let code_run = sheet.data_tables.get(&pos).unwrap();
        assert_eq!(code_run.output_size(), ArraySize::_1X1);
        assert_eq!(
            code_run.cell_value_at(0, 0),
            Some(CellValue::Text("test".to_string()))
        );
        assert!(!code_run.spill_error);
    }

    #[test]
    #[parallel]
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
            output_value: Some(vec!["hello world".into(), "text".into()]),
            ..Default::default()
        });
        assert!(summary.is_ok());
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.get_code_cell_value(pos![A1]),
            Some(CellValue::Text("hello world".into()))
        );
    }

    #[test]
    #[parallel]
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
        let cells = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string(), None);
        assert!(cells.is_ok());
        assert_eq!(
            cells,
            Ok(CellA1Response {
                cells: vec![JsGetCellResponse {
                    x: 1,
                    y: 1,
                    value: "9".into(),
                    type_name: "number".into(),
                }],
                x: 1,
                y: 1,
                w: 1,
                h: 1,
                two_dimensional: false,
            })
        );

        // mock the javascript calculation returning the result
        assert!(gc
            .calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(vec!["10".into(), "number".into()]),
                ..Default::default()
            })
            .is_ok());

        // check that the value at A2 contains the expected output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(BigDecimal::from(10)))
        );
    }

    #[test]
    #[parallel]
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
        let _ = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string(), None);
        // mock the calculation_complete
        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(vec!["10".into(), "number".into()]),
            ..Default::default()
        });

        // replace the value in A1 to trigger the javascript calculation
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "10".into(), None);
        assert_eq!(gc.async_transactions().len(), 1);

        let transaction_id = gc.async_transactions()[0].id;

        let cells = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string(), None);
        assert_eq!(
            cells,
            Ok(CellA1Response {
                cells: vec![JsGetCellResponse {
                    x: 1,
                    y: 1,
                    value: "10".into(),
                    type_name: "number".into(),
                }],
                x: 1,
                y: 1,
                w: 1,
                h: 1,
                two_dimensional: false,
            })
        );
        assert!(gc
            .calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(vec!["11".into(), "number".into()]),
                ..Default::default()
            })
            .is_ok());

        // check that the value at A2 contains the expected output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(BigDecimal::from(11)))
        );
    }

    fn javascript_array(input: Vec<isize>) -> Vec<Vec<Vec<String>>> {
        input
            .iter()
            .map(|i| vec![vec![i.to_string(), "number".into()]])
            .collect()
    }

    #[test]
    #[parallel]
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
        assert!(gc
            .calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_array: Some(javascript_array(vec![1, 2, 3])),
                ..Default::default()
            })
            .is_ok());

        let sheet = gc.try_sheet(sheet_id).unwrap();
        let cells = sheet.get_render_cells(Rect::from_numbers(1, 1, 1, 3));
        assert_eq!(cells.len(), 3);
        assert_eq!(
            cells[0],
            JsRenderCell::new_number(1, 1, 1, Some(CodeCellLanguage::Javascript), None, true)
        );
        assert_eq!(
            cells[1],
            JsRenderCell::new_number(1, 2, 2, None, None, true)
        );
        assert_eq!(
            cells[2],
            JsRenderCell::new_number(1, 3, 3, None, None, true)
        );
    }

    #[test]
    #[parallel]
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
            output_value: Some(vec!["".into(), "blank".into()]),
            cancel_compute: Some(true),
            ..Default::default()
        };
        gc.calculation_complete(result).unwrap();
        assert!(gc.async_transactions().is_empty());
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert!(sheet
            .display_value(pos![A1])
            .unwrap()
            .is_blank_or_empty_string());
    }

    #[test]
    #[parallel]
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
        assert!(gc
            .calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(vec!["original output".into(), "text".into()]),
                ..Default::default()
            })
            .is_ok());

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
        assert!(gc
            .calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(vec!["new output".into(), "text".into()]),
                ..Default::default()
            })
            .is_ok());

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
        assert!(gc
            .calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(vec!["new output second time".into(), "text".into()]),
                ..Default::default()
            })
            .is_ok());

        // check that the value at A1 contains the original output
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Text("new output second time".into()))
        );
    }

    #[test]
    #[parallel]
    fn test_javascript_multiple_calculations() {
        // Tests in column A, and y: 1 = "1", y: 2 = "q.cells(\"A1\") + 1", y: 3 = "q.cells(\"A2\") + 1"
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![A1].to_sheet_pos(sheet_id), "1".to_string(), None);
        gc.set_code_cell(
            pos![A2].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "q.cells(\"A1\") + 1".into(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string(), None)
            .ok()
            .unwrap();
        assert_eq!(result.cells.len(), 1);
        assert_eq!(
            result.cells[0],
            JsGetCellResponse {
                x: 1,
                y: 1,
                value: "1".into(),
                type_name: "number".into(),
            }
        );
        let result = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(vec!["2".into(), "number".into()]),
            ..Default::default()
        });
        assert!(result.is_ok());

        // todo...
        // assert!(result.ok().unwrap().generate_thumbnail);

        gc.set_code_cell(
            pos![A3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            "q.cells(\"A2\") + 1".into(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "A2".to_string(), None)
            .ok()
            .unwrap();
        assert_eq!(result.cells.len(), 1);
        assert_eq!(
            result.cells[0],
            JsGetCellResponse {
                x: 1,
                y: 2,
                value: "2".into(),
                type_name: "number".into(),
            }
        );
        let result = gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(vec!["3".into(), "number".into()]),
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
            sheet.display_value(pos![A2]),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(pos![A3]),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
    }
}
