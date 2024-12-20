// Handles all spill checking for the sheet

use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;
use crate::grid::SheetId;
use crate::{ArraySize, Pos, Rect};

impl GridController {
    /// Changes the spill error for a code_cell and adds necessary operations
    fn change_spill(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        index: usize,
        spill_error: bool,
    ) {
        // change the spill for the first code_cell and then iterate the later code_cells.
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            let mut code_pos: Option<Pos> = None;
            if let Some((pos, run)) = sheet.data_tables.get_index_mut(index) {
                let sheet_pos = pos.to_sheet_pos(sheet.id);
                transaction
                    .reverse_operations
                    .push(Operation::SetDataTable {
                        sheet_pos,
                        data_table: Some(run.clone()),
                        index,
                    });
                run.spill_error = spill_error;
                transaction
                    .forward_operations
                    .push(Operation::SetDataTable {
                        sheet_pos,
                        data_table: Some(run.to_owned()),
                        index,
                    });
                code_pos = Some(*pos);

                // need to update the cells that are affected by the spill error
                let sheet_rect = run.output_sheet_rect(sheet_pos, true);
                transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);
            }
            if let Some(code_pos) = code_pos {
                if let Some(data_table) = sheet.data_tables.get(&code_pos) {
                    transaction.add_from_code_run(
                        sheet_id,
                        code_pos,
                        data_table.is_image(),
                        data_table.is_html(),
                    );
                    // transaction
                    //     .forward_operations
                    //     .push(Operation::SetCodeRunVersion {
                    //         sheet_pos,
                    //         code_run: Some(run.to_owned()),
                    //         index,
                    //         version: 1,
                    //     });

                    // if (cfg!(target_family = "wasm") || cfg!(test))
                    //     && !transaction.is_server()
                    //     && send_client
                    // {
                    //     transaction.add_from_code_run(sheet_id, *pos, &Some(run.to_owned()));
                    //     let sheet_rect = run.output_sheet_rect(sheet_pos, false);
                    //     transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);
                }
            }
        }
    }

    /// Checks if a code_cell has a spill error by comparing its output to both CellValues in that range, and earlier data_tables output.
    fn check_spill(&self, sheet_id: SheetId, index: usize) -> Option<bool> {
        if let Some(sheet) = self.grid.try_sheet(sheet_id) {
            if let Some((pos, data_table)) = sheet.data_tables.get_index(index) {
                // output sizes of 1x1 cannot spill
                if matches!(data_table.output_size(), ArraySize::_1X1) {
                    return None;
                }

                let output: Rect = data_table
                    .output_sheet_rect(pos.to_sheet_pos(sheet_id), true)
                    .into();

                // then do the more expensive checks to see if there is a spill error
                if sheet.has_cell_value_in_rect(&output, Some(*pos))
                    || sheet.has_code_cell_in_rect(&output, *pos)
                {
                    // if spill error has not been set, then set it and start the more expensive checks for all later code_cells.
                    if data_table.readonly && !data_table.spill_error {
                        return Some(true);
                    }
                } else if data_table.spill_error {
                    // release the code_cell's spill error, then start the more expensive checks for all later code_cells.
                    return Some(false);
                }
            }
        }
        None
    }

    /// Checks all data_tables for changes in spill_errors.
    pub fn check_all_spills(&mut self, transaction: &mut PendingTransaction, sheet_id: SheetId) {
        if let Some(sheet) = self.grid.try_sheet(sheet_id) {
            for index in 0..sheet.data_tables.len() {
                if let Some(spill_error) = self.check_spill(sheet_id, index) {
                    self.change_spill(transaction, sheet_id, index, spill_error);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use serial_test::{parallel, serial};

    use crate::controller::active_transactions::pending_transaction::PendingTransaction;
    use crate::controller::transaction_types::JsCodeResult;
    use crate::controller::GridController;
    use crate::grid::js_types::{JsNumber, JsRenderCell, JsRenderCellSpecial};
    use crate::grid::{CellAlign, CellWrap, CodeCellLanguage, CodeRun, DataTable, DataTableKind};
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call_count};
    use crate::{Array, CellValue, Pos, Rect, SheetPos, Value};

    fn output_spill_error(x: i64, y: i64) -> Vec<JsRenderCell> {
        vec![JsRenderCell {
            x,
            y,
            language: Some(CodeCellLanguage::Formula),
            special: Some(JsRenderCellSpecial::SpillError),
            ..Default::default()
        }]
    }

    fn output_number(
        x: i64,
        y: i64,
        n: &str,
        language: Option<CodeCellLanguage>,
        special: Option<JsRenderCellSpecial>,
    ) -> Vec<JsRenderCell> {
        vec![JsRenderCell {
            x,
            y,
            language,
            value: n.into(),
            align: Some(CellAlign::Right),
            number: Some(JsNumber::default()),
            special,
            wrap: Some(CellWrap::Clip),
            ..Default::default()
        }]
    }

    #[test]
    #[parallel]
    fn test_check_spills() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();

        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid.try_sheet_mut(sheet_id).unwrap();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Formula,
            "A0:A1".to_string(),
            None,
        );

        let sheet = gc.grid.try_sheet_mut(sheet_id).unwrap();

        // manually set a cell value and see if spill is changed
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(3.into()));

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        assert!(!sheet.data_tables[0].spill_error);

        gc.check_all_spills(&mut transaction, sheet_id);

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        assert!(sheet.data_tables[0].spill_error);
    }

    #[test]
    #[parallel]
    fn test_check_all_spills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid.try_sheet_mut(sheet_id).unwrap();

        // sets 0,0=1 and 0,1=2
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(2.into()));

        // sets code cell that outputs 1,0=1 and 1,1=2
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Formula,
            "A0:A1".to_string(),
            None,
        );

        clear_js_calls();

        // manually set a cell value and see if the spill error changed
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "3".into(),
            None,
        );
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(3.into()));

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.data_tables[0].spill_error);

        let mut transaction = PendingTransaction::default();

        gc.check_all_spills(&mut transaction, sheet_id);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.data_tables[0].spill_error);

        // remove the cell causing the spill error
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "".into(),
            None,
        );
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.cell_value(Pos { x: 1, y: 1 }), None);
        gc.check_all_spills(&mut transaction, sheet_id);

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.data_tables[0].spill_error);
        expect_js_call_count("jsUpdateCodeCell", 1, true);
    }

    #[test]
    #[parallel]
    fn test_check_spills_by_code_run() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_values(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            vec![vec!["1"], vec!["2"], vec!["3"]],
            None,
        );

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "B1:B4".into(),
            None,
        );

        // cause a spill error
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("hello".into()));

        let transaction = &mut PendingTransaction::default();
        gc.check_all_spills(transaction, sheet_id);

        let sheet = gc.sheet(sheet_id);
        let code_run = sheet.data_table(Pos { x: 0, y: 0 }).unwrap();
        assert!(code_run.spill_error);

        // should be a spill caused by 1,2
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }));
        assert_eq!(render_cells, output_spill_error(1, 1));

        // remove 'hello' that caused spill
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "".into(),
            None,
        );

        let sheet = gc.try_sheet(sheet_id).unwrap();
        let code_run = sheet.data_table(Pos { x: 1, y: 1 });
        assert!(code_run.is_some());
        assert!(!code_run.unwrap().spill_error);

        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }));

        // should be B0: "1" since spill was removed
        assert_eq!(
            render_cells,
            output_number(1, 1, "1", Some(CodeCellLanguage::Formula), None),
        );
    }

    #[test]
    #[parallel]
    fn test_check_spills_over_code() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_values(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            vec![vec!["1"], vec!["2"], vec!["3"]],
            None,
        );

        // value to cause the spill
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "B1:B4".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }));
        assert_eq!(
            render_cells,
            output_number(1, 1, "1", Some(CodeCellLanguage::Formula), None)
        );
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 2 }));
        assert_eq!(render_cells, output_number(1, 2, "2", None, None));

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1 + 2".into(),
            None,
        );

        // should be spilled because of the code_cell
        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }));
        assert_eq!(render_cells, output_spill_error(1, 1),);
    }

    #[test]
    #[parallel]
    fn test_check_spills_over_code_array() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy: column: 0-2, rows: 0="1", 1="2", 2="3"
        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![
                vec!["1", "2", "3"],
                vec!["4", "5", "6"],
                vec!["7", "8", "9"],
            ],
            None,
        );

        // copies values to copy to 10,10: column: 10-12, rows: 10="1", 11="2", 12="3"
        gc.set_code_cell(
            SheetPos {
                x: 11,
                y: 11,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A1:C3".into(),
            None,
        );

        // output that is spilled column: 11, row: 9 creates a spill (since it's inside the other code_cell)
        gc.set_code_cell(
            SheetPos {
                x: 12,
                y: 10,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A1:A3".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 12, y: 10 }));
        assert_eq!(render_cells, output_spill_error(12, 10));

        // delete the code_cell that caused the spill
        gc.set_cell_value(
            SheetPos {
                x: 11,
                y: 11,
                sheet_id,
            },
            "".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 12, y: 10 }));
        assert_eq!(
            render_cells,
            output_number(12, 10, "1", Some(CodeCellLanguage::Formula), None)
        );
    }

    #[test]
    #[parallel]
    fn test_check_deleted_data_tables() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed: Default::default(),
            formatted_code_string: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1"]])),
            false,
            false,
            true,
            None,
        );
        let pos = Pos { x: 0, y: 0 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_data_table(pos, Some(data_table.clone()));
    }

    #[test]
    #[parallel]
    fn test_spill_from_js_chart() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".to_string(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Javascript,
            "".into(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            chart_pixel_output: Some((100.0, 100.0)),
            ..Default::default()
        };
        gc.calculation_complete(result).unwrap();

        let sheet = gc.sheet(sheet_id);

        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }));
        assert_eq!(
            render_cells,
            vec![JsRenderCell {
                x: 1,
                y: 1,
                language: Some(CodeCellLanguage::Javascript),
                special: Some(JsRenderCellSpecial::SpillError),
                ..Default::default()
            }]
        );
    }
}
