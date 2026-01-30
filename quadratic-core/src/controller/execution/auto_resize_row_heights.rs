use uuid::Uuid;

use super::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::error_core::Result;
use crate::grid::SheetId;
use crate::grid::js_types::JsRowHeight;

impl GridController {
    pub fn start_auto_resize_row_heights(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        rows: Vec<i64>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test))
            || !transaction.is_user_ai()
            || rows.is_empty()
        {
            return;
        }

        // send sheet info and offsets modified to get the correct row heights
        self.send_sheet_info(transaction);
        self.send_offsets_modified(transaction);

        // process visible dirty hashes to so that we can get the correct row heights
        self.process_visible_dirty_hashes(transaction);

        if let Some(sheet) = self.try_sheet(sheet_id) {
            let mut auto_resize_rows = sheet.get_auto_resize_rows(rows);
            if auto_resize_rows.is_empty() {
                return;
            }

            auto_resize_rows.sort();
            if let Ok(rows_string) = serde_json::to_string(&auto_resize_rows) {
                crate::wasm_bindings::js::jsRequestRowHeights(
                    transaction.id.to_string(),
                    sheet_id.to_string(),
                    rows_string,
                );
                // don't add_async_transaction in test mode,
                // as we will not receive renderer callback during tests and the transaction will never complete
                if !cfg!(test) {
                    self.transactions.add_async_transaction(transaction);
                }
            } else {
                dbgjs!(
                    "[control_transactions] start_auto_resize_row_heights: Failed to serialize auto resize rows"
                );
            }
        } else {
            dbgjs!("[control_transactions] start_auto_resize_row_heights: Sheet not found");
        }
    }

    pub fn complete_auto_resize_row_heights(
        &mut self,
        transaction_id: Uuid,
        sheet_id: SheetId,
        row_heights: Vec<JsRowHeight>,
    ) -> Result<()> {
        let mut transaction = self.transactions.remove_awaiting_async(transaction_id)?;
        if !row_heights.is_empty() {
            transaction.operations.push_back(Operation::ResizeRows {
                sheet_id,
                row_heights,
                client_resized: false, // Auto-resize mode
            });
        }
        self.start_transaction(&mut transaction);
        self.finalize_transaction(transaction);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::controller::GridController;
    use crate::controller::active_transactions::pending_transaction::PendingTransaction;
    use crate::controller::execution::run_code::get_cells::JsCellsA1Response;
    use crate::controller::execution::run_code::get_cells::JsCellsA1Value;
    use crate::controller::execution::run_code::get_cells::JsCellsA1Values;
    use crate::controller::operations::operation::Operation;
    use crate::controller::transaction_types::JsCellValueResult;
    use crate::controller::transaction_types::JsCodeResult;
    use crate::controller::user_actions::import::tests::simple_csv_at;
    use crate::grid::formats::FormatUpdate;
    use crate::grid::formats::SheetFormatUpdates;
    use crate::grid::formatting::RenderSize;
    use crate::grid::js_types::JsRowHeight;
    use crate::grid::{
        CellAlign, CellVerticalAlign, CellWrap, CodeCellLanguage, NumericFormat, NumericFormatKind,
        SheetId,
    };
    use crate::sheet_offsets::resize_transient::TransientResize;
    use crate::wasm_bindings::js::{
        clear_js_calls, expect_js_call, expect_js_call_count, expect_js_offsets,
    };
    use crate::{CellValue, Pos, SheetPos, a1::A1Selection};

    fn mock_auto_resize_row_heights(
        gc: &mut GridController,
        sheet_id: SheetId,
        ops: Vec<Operation>,
        row_heights: Vec<JsRowHeight>, // mock response from renderer
    ) {
        let mut transaction = PendingTransaction {
            operations: ops.into(),
            ..Default::default()
        };
        let has_async = transaction.has_async;
        // manually add async transaction, as this is disabled in test mode by default
        gc.transactions.add_async_transaction(&mut transaction);
        assert_eq!(transaction.has_async, has_async + 1);

        gc.start_transaction(&mut transaction);

        // mock callback from renderer
        let _ = gc.complete_auto_resize_row_heights(transaction.id, sheet_id, row_heights);
    }

    fn expect_js_request_row_heights(sheet_id: SheetId, row_heights: Vec<JsRowHeight>) {
        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((None, Some(row_heights[0].row)), row_heights[0].height);
        expect_js_offsets(sheet_id, offsets, true);
    }

    #[test]
    fn test_auto_resize_row_heights_on_set_cell_value() {
        clear_js_calls();
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_cell_wrap(
            &A1Selection::from_single_cell(sheet_pos),
            CellWrap::Wrap,
            None,
            false,
        )
        .unwrap();
        let ops = gc
            .set_cell_values_operations(
                sheet_pos,
                vec![vec![
                    "test_auto_resize_row_heights_on_set_cell_value_1".to_string(),
                ]],
                false,
            )
            .unwrap();
        // mock response from renderer
        let row_heights = vec![JsRowHeight {
            row: 1,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops.0.clone(), row_heights.clone());

        assert_eq!(
            gc.sheet(sheet_id).display_value(sheet_pos.into()),
            Some(CellValue::Text(
                "test_auto_resize_row_heights_on_set_cell_value_1".to_string()
            ))
        );
        // should trigger auto resize row heights and request row heights from renderer
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[1]"),
            false,
        );

        // should resize row 1 to 40, as per mock response from renderer
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(1), 40f64);

        // should send resized row heights to renderer and client
        expect_js_request_row_heights(sheet_id, row_heights);

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());

        let ops = gc
            .set_cell_values_operations(
                sheet_pos,
                vec![vec![
                    "test_auto_resize_row_heights_on_set_cell_value_2".to_string(),
                ]],
                false,
            )
            .unwrap();
        let row_heights = vec![JsRowHeight {
            row: 1,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops.0, row_heights);
        // should trigger auto resize row heights and request row heights from renderer
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[1]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(1), 40f64);
        // new row height same as previous, should not trigger jsResizeRowHeights
        expect_js_call_count("jsOffsetsModified", 0, true);

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_auto_resize_row_heights_on_set_cell_format() {
        clear_js_calls();
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![
                vec!["1".into()],
                vec!["2".into()],
                vec!["3".into()],
                vec!["4".into()],
                vec!["5".into()],
                vec!["6".into()],
                vec!["7".into()],
                vec!["8".into()],
            ],
            None,
            false,
        );
        gc.set_cell_wrap(&A1Selection::test_a1("A1:J10"), CellWrap::Wrap, None, false)
            .unwrap();

        // should trigger auto resize row heights for wrap
        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A1"),
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Overflow)),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 1,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[1]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(1), 40f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should trigger auto resize row heights for numeric format
        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A2"),
                FormatUpdate {
                    numeric_format: Some(Some(NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol: None,
                    })),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 2,
            height: 41f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[2]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(2), 41f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should trigger auto resize row heights for numeric decimals

        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A3"),
                FormatUpdate {
                    numeric_decimals: Some(Some(2)),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 3,
            height: 42f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[3]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(3), 42f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should trigger auto resize row heights for numeric commas
        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A4"),
                FormatUpdate {
                    numeric_commas: Some(Some(true)),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 4,
            height: 43f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[4]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(4), 43f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should trigger auto resize row heights for bold
        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A5"),
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 5,
            height: 44f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[5]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(5), 44f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should trigger auto resize row heights for italic
        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A6"),
                FormatUpdate {
                    italic: Some(Some(true)),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 6,
            height: 45f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[6]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(6), 45f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should trigger auto resize row heights for font size
        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A7"),
                FormatUpdate {
                    font_size: Some(Some(24)),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 7,
            height: 46f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[7]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(7), 46f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should not trigger auto resize row heights for other formats
        let ops = vec![Operation::SetCellFormatsA1 {
            sheet_id,
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1("A1"),
                FormatUpdate {
                    align: Some(Some(CellAlign::Center)),
                    vertical_align: Some(Some(CellVerticalAlign::Middle)),
                    text_color: Some(Some("red".to_string())),
                    fill_color: Some(Some("blue".to_string())),
                    render_size: Some(Some(RenderSize {
                        w: "1".to_string(),
                        h: "2".to_string(),
                    })),
                    ..FormatUpdate::default()
                },
            ),
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, vec![]);
        expect_js_call_count("jsRequestRowHeights", 0, false);
        expect_js_call_count("jsOffsetsModified", 0, false);

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_auto_resize_row_heights_on_compute_code_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_cell_wrap(
            &A1Selection::from_single_cell(sheet_pos),
            CellWrap::Wrap,
            None,
            false,
        )
        .unwrap();
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "1+1".to_string(),
            None,
            None,
            false,
        );
        clear_js_calls();

        let ops = vec![Operation::ComputeCode { sheet_pos }];
        let row_heights = vec![JsRowHeight {
            row: 1,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;

        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[1]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(1), 40f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_auto_resize_row_heights_on_compute_code_python() {
        clear_js_calls();

        // run 2 async operations in a transaction
        // run_python & resize_row_heights

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };

        gc.set_cell_wrap(&A1Selection::test_a1("A2"), CellWrap::Wrap, None, false)
            .unwrap();

        // python code cell
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "9".into(),
            None,
            false,
        );
        let code = "c(1, 1) + 1".to_string();
        let ops =
            gc.set_code_cell_operations(sheet_pos, CodeCellLanguage::Python, code.clone(), None);

        // resize rows
        let row_heights = vec![JsRowHeight {
            row: 2,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(1), 21f64);

        let transaction = gc.async_transactions().first().unwrap();
        assert_eq!(transaction.has_async, 1);
        let transaction_id = transaction.id;

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
        // pending cal
        let transaction = gc.async_transactions().first().unwrap();
        assert_eq!(transaction.has_async, 1);

        assert!(
            gc.calculation_complete(JsCodeResult {
                transaction_id: transaction_id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("10".into(), 2)),
                ..Default::default()
            })
            .is_ok()
        );
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(10.into()))
        );

        expect_js_call(
            "jsRunPython",
            format!(
                "{},{},{},{},{},{},{}",
                transaction_id, 1, 2, sheet_id, code, 600, 460
            ),
            false,
        );
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[2]"),
            false,
        );
        expect_js_request_row_heights(sheet_id, row_heights);

        // row resized to 40
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(2), 40f64);

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_auto_resize_row_heights_on_offset_resize() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_cell_values(
            sheet_pos,
            vec![
                vec!["one".into()],
                vec!["two".into()],
                vec!["three".into()],
                vec!["four".into()],
            ],
            None,
            false,
        );
        gc.set_cell_wrap(&A1Selection::test_a1("A1:J10"), CellWrap::Wrap, None, false)
            .unwrap();

        // set row 1 to Manually resized
        gc.commit_offsets_resize(
            sheet_id,
            TransientResize {
                row: Some(2),
                column: None,
                old_size: gc.sheet(sheet_id).offsets.row_height(1),
                new_size: 40.0,
            },
            None,
            false,
        );

        clear_js_calls();

        // resize column 1 should trigger auto resize row heights for rows 1, 3, 4
        let ops = vec![Operation::ResizeColumn {
            sheet_id,
            column: 1,
            new_size: 120.0,
            client_resized: (true),
        }];
        let row_heights = vec![JsRowHeight {
            row: 1,
            height: 41f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops.clone(), row_heights.clone());

        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[1,3,4]"),
            true,
        );

        // set row 2 to Auto resized
        gc.commit_single_resize(sheet_id, None, Some(2), 25f64, None, false);

        // resize column 1 should trigger auto resize row heights for rows 1, 2, 3, 4
        let ops = vec![Operation::ResizeColumn {
            sheet_id,
            column: 1,
            new_size: 100.0,
            client_resized: (true),
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights);
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[1,2,3,4]"),
            true,
        );

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_auto_resize_row_heights_on_user_transaction_only() {
        clear_js_calls();
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_cell_wrap(
            &A1Selection::from_single_cell(sheet_pos),
            CellWrap::Wrap,
            None,
            false,
        )
        .unwrap();
        let ops = gc
            .set_cell_values_operations(
                sheet_pos,
                vec![vec![
                    "test_auto_resize_row_heights_on_user_transaction_only".to_string(),
                ]],
                false,
            )
            .unwrap();
        // mock response from renderer
        let row_heights = vec![JsRowHeight {
            row: 1,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops.0.clone(), row_heights.clone());
        assert_eq!(
            gc.sheet(sheet_id).display_value(sheet_pos.into()),
            Some(CellValue::Text(
                "test_auto_resize_row_heights_on_user_transaction_only".to_string()
            ))
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[1]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(1), 40f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should not trigger auto resize row heights for undo / redo transaction
        gc.undo(1, None, false);
        gc.redo(1, None, false);
        expect_js_call_count("jsRequestRowHeights", 0, false);

        // should not trigger auto resize row heights for multiplayer transactions
        let mut other_gc = GridController::test();
        other_gc.set_first_sheet_id(sheet_id);
        other_gc.received_transaction(transaction_id, 1, ops.0);
        let sheet = other_gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text(
                "test_auto_resize_row_heights_on_user_transaction_only".to_string()
            ))
        );
        expect_js_call_count("jsRequestRowHeights", 0, true);

        // transaction should be completed
        let async_transaction = gc.transactions.get_async_transaction(transaction_id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_transaction_save_when_auto_resize_row_heights_when_not_executed() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        // set wrap
        gc.set_cell_wrap(
            &A1Selection::from_single_cell(sheet_pos),
            CellWrap::Wrap,
            None,
            false,
        )
        .unwrap();

        // manually resize row 0
        gc.commit_offsets_resize(
            sheet_id,
            TransientResize {
                row: Some(1),
                column: None,
                old_size: gc.sheet(sheet_id).offsets.row_height(0),
                new_size: 40.0,
            },
            None,
            false,
        );

        let prev_transaction_id = gc.last_transaction().unwrap().id;

        clear_js_calls();
        // set cell value, should not trigger auto resize row heights because manually resized
        gc.set_cell_value(
            sheet_pos,
            "test_auto_resize_row_heights_on_user_transaction_only".to_string(),
            None,
            false,
        );
        // confirm no auto resize row heights call
        expect_js_call_count("jsRequestRowHeights", 0, true);

        let next_transaction = gc.last_transaction().unwrap();

        // confirm new transaction save
        assert_ne!(prev_transaction_id, next_transaction.id);

        // confirm new transaction has set cell value operation
        assert!(matches!(
            next_transaction.operations[0],
            Operation::SetCellValues { .. }
        ));

        // confirm no pending async transaction
        let async_transaction = gc.transactions.get_async_transaction(next_transaction.id);
        assert!(async_transaction.is_err());
    }

    #[test]
    fn test_table_rows_resize_on_cell_wrap() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![M20]);

        clear_js_calls();

        // should trigger auto resize row heights for wrap
        let ops = vec![Operation::DataTableFormats {
            sheet_pos: pos.to_sheet_pos(sheet_id),
            formats: SheetFormatUpdates::from_selection(
                &A1Selection::test_a1_sheet_id("A2", sheet_id),
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Wrap)),
                    ..FormatUpdate::default()
                },
            ),
        }];
        let row_heights = vec![JsRowHeight {
            row: 22,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[22]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(22), 40f64);
        expect_js_request_row_heights(sheet_id, row_heights);
    }

    #[test]
    fn test_table_rows_resize_on_set_value() {
        let (mut gc, sheet_id, _, _) = simple_csv_at(pos![M20]);

        // pre set cell wrap at M22 and clear js calls
        gc.set_cell_wrap(
            &A1Selection::test_a1_sheet_id("M22", sheet_id),
            CellWrap::Wrap,
            None,
            false,
        )
        .unwrap();
        clear_js_calls();

        // should trigger auto resize row heights for setting value at cell having wrap
        let ops = vec![Operation::SetDataTableAt {
            sheet_pos: pos![M22].to_sheet_pos(sheet_id),
            values: vec![vec!["value"]].into(),
        }];
        let row_heights = vec![JsRowHeight {
            row: 22,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[22]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(22), 40f64);
        expect_js_request_row_heights(sheet_id, row_heights);
    }

    #[test]
    fn test_table_rows_resize_on_delete_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![M20]);

        // pre set cell wrap at M22 and clear js calls
        gc.set_cell_wrap(
            &A1Selection::test_a1_sheet_id("M22", sheet_id),
            CellWrap::Wrap,
            None,
            false,
        )
        .unwrap();
        clear_js_calls();

        // should trigger auto resize row heights for setting value at cell having wrap
        let ops = vec![Operation::SetDataTableAt {
            sheet_pos: pos![M22].to_sheet_pos(sheet_id),
            values: vec![vec!["value"]].into(),
        }];
        let row_heights = vec![JsRowHeight {
            row: 22,
            height: 40f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[22]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(22), 40f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        // should trigger auto resize row heights for deleting table having wrap
        let ops = vec![Operation::DeleteDataTable {
            sheet_pos: pos.to_sheet_pos(sheet_id),
        }];
        let row_heights = vec![JsRowHeight {
            row: 22,
            height: 21f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[22]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(22), 21f64);
        expect_js_request_row_heights(sheet_id, row_heights);

        gc.undo(1, None, false);
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(22), 40f64);
    }

    #[test]
    fn test_table_rows_resize_on_multiline_text() {
        let (mut gc, sheet_id, _, _) = simple_csv_at(pos![M20]);

        clear_js_calls();

        // should trigger auto resize row heights for setting multiline value
        // (even without wrap formatting)
        let ops = vec![Operation::SetDataTableAt {
            sheet_pos: pos![M22].to_sheet_pos(sheet_id),
            values: vec![vec!["line1\nline2\nline3"]].into(),
        }];
        let row_heights = vec![JsRowHeight {
            row: 22,
            height: 48f64,
        }];
        mock_auto_resize_row_heights(&mut gc, sheet_id, ops, row_heights.clone());
        let transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestRowHeights",
            format!("{},{},{}", transaction_id, sheet_id, "[22]"),
            false,
        );
        assert_eq!(gc.sheet(sheet_id).offsets.row_height(22), 48f64);
        expect_js_request_row_heights(sheet_id, row_heights);
    }
}
