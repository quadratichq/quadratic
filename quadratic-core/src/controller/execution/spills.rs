// Handles all spill checking for the sheet

use crate::SheetRect;
use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;

impl GridController {
    /// Checks data tables for spill changes in sheet_rect.
    pub fn update_spills_in_sheet_rect(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
    ) {
        let sheet_id = sheet_rect.sheet_id;
        let rect = sheet_rect.to_owned().into();
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            let dirty_rects = sheet.data_tables_update_spill(rect);
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
        }
    }
}

#[cfg(test)]
mod tests {

    use crate::a1::A1Selection;
    use crate::controller::GridController;
    use crate::controller::operations::clipboard::{ClipboardOperation, PasteSpecial};
    use crate::controller::transaction_types::{JsCellValueResult, JsCodeResult};
    use crate::grid::js_types::{JsNumber, JsRenderCell, JsRenderCellSpecial};
    use crate::grid::{CellAlign, CellWrap, CodeCellLanguage, CodeRun, DataTable, DataTableKind};
    use crate::test_util::*;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call_count};
    use crate::{Array, Pos, Rect, SheetPos, Value};

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
    fn test_check_spill_single_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "1".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "2".to_string(), None, false);
        gc.set_code_cell(
            pos![sheet_id!B1],
            crate::grid::CodeCellLanguage::Formula,
            "A1:A2".to_string(),
            None,
            None,
            false,
        );

        // manually set a cell value and see if spill is changed
        gc.set_cell_value(pos![sheet_id!B2], "3".into(), None, false);

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        assert!(sheet.data_table_at(&pos![B1]).unwrap().has_spill());
    }

    #[test]
    fn test_check_all_spills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // sets 1,1=1 and 1,2=2
        gc.set_cell_value(pos![sheet_id!A1], "1".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "2".to_string(), None, false);

        // sets code cell that outputs 1,0=1 and 1,1=2
        gc.set_code_cell(
            pos![sheet_id!B1],
            crate::grid::CodeCellLanguage::Formula,
            "A1:A2".to_string(),
            None,
            None,
            false,
        );

        clear_js_calls();

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.data_tables.get_at_index(0).unwrap().1.has_spill());

        // manually set a cell value and see if the spill error changed
        gc.set_cell_value(pos![sheet_id!B2], "3".into(), None, false);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.data_tables.get_at_index(0).unwrap().1.has_spill());

        // remove the cell causing the spill error
        gc.set_cell_value(pos![sheet_id!B2], "".into(), None, false);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.cell_value(Pos { x: 2, y: 2 }), None);

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.data_tables.get_at_index(0).unwrap().1.has_spill());
        expect_js_call_count("jsUpdateCodeCells", 2, true);
    }

    #[test]
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
            vec![vec!["1".into()], vec!["2".into()], vec!["3".into()]],
            None,
            false,
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
            None,
            false,
        );

        // cause a spill error
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".into(),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let code_run = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(code_run.has_spill());

        // should be a spill caused by 1,2
        let render_cells =
            sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }), gc.a1_context());
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
            false,
        );

        let sheet = gc.try_sheet(sheet_id).unwrap();
        let code_run = sheet.data_table_at(&Pos { x: 1, y: 1 });
        assert!(code_run.is_some());
        assert!(!code_run.unwrap().has_spill());

        let render_cells =
            sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }), gc.a1_context());

        // should be B0: "1" since spill was removed
        assert_eq!(
            render_cells,
            output_number(1, 1, "1", Some(CodeCellLanguage::Formula), None),
        );
    }

    #[test]
    fn test_check_spills_over_code() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_values(
            pos![sheet_id!B1],
            vec![vec!["1".into()], vec!["2".into()], vec!["3".into()]],
            None,
            false,
        );

        // copied values
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "B1:B4".into(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(rect![A1:A1], gc.a1_context());
        assert_eq!(
            render_cells,
            output_number(1, 1, "1", Some(CodeCellLanguage::Formula), None)
        );
        let render_cells = sheet.get_render_cells(rect![A2:A2], gc.a1_context());
        assert_eq!(render_cells, output_number(1, 2, "2", None, None));

        clear_js_calls();
        // this is no longer possible after the removal of CellValue::Code
        // instead, this code fails
        gc.set_code_cell(
            pos![sheet_id!A2],
            CodeCellLanguage::Formula,
            "1 + 2".into(),
            None,
            None,
            false,
        );
        expect_js_call_count("jsClientMessage", 1, true);

        assert!(gc.sheet(sheet_id).data_table_at(&pos![A2]).is_none());
    }

    #[test]
    fn test_check_spills_code_array() {
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
                vec!["1".into(), "2".into(), "3".into()],
                vec!["4".into(), "5".into(), "6".into()],
                vec!["7".into(), "8".into(), "9".into()],
            ],
            None,
            false,
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
            None,
            false,
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
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells =
            sheet.get_render_cells(Rect::single_pos(Pos { x: 12, y: 10 }), gc.a1_context());
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
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells =
            sheet.get_render_cells(Rect::single_pos(Pos { x: 12, y: 10 }), gc.a1_context());
        assert_eq!(
            render_cells,
            output_number(12, 10, "1", Some(CodeCellLanguage::Formula), None)
        );
    }

    #[test]
    fn test_check_deleted_data_tables() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "".to_string(),
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed: Default::default(),
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1"]])),
            false,
            Some(true),
            Some(true),
            None,
        );
        let pos = Pos { x: 0, y: 0 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_data_table(pos, Some(data_table.clone()));
    }

    #[test]
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
            false,
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
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            chart_pixel_output: Some((100.0, 100.0)),
            output_value: Some(JsCellValueResult("<html>".to_string(), 1)),
            ..Default::default()
        };
        gc.calculation_complete(result).unwrap();

        let sheet = gc.sheet(sheet_id);

        let render_cells =
            sheet.get_render_cells(Rect::single_pos(Pos { x: 1, y: 1 }), gc.a1_context());
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

    /// Test: deleting cells that include the full range of an import table
    /// should delete the table.
    #[test]
    fn test_delete_full_import_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create import table at C3 (outputs C3:E7)
        test_create_data_table(&mut gc, sheet_id, pos![C3], 3, 3);

        // Verify table exists
        assert!(
            gc.sheet(sheet_id).data_table_at(&pos![C3]).is_some(),
            "Table at C3 should exist before delete"
        );

        // Delete the full table range
        gc.delete_cells(
            &A1Selection::test_a1_sheet_id("C3:E7", sheet_id),
            None,
            false,
        );

        // Table should be deleted
        assert!(
            gc.sheet(sheet_id).data_table_at(&pos![C3]).is_none(),
            "Table at C3 should be deleted after deleting full range"
        );

        // Undo should restore the table
        gc.undo(1, None, false);
        assert!(
            gc.sheet(sheet_id).data_table_at(&pos![C3]).is_some(),
            "Table at C3 should be restored after undo"
        );
    }

    /// Test: copying and pasting a data table to a location whose output overlaps
    /// with an existing table should cause the pasted table to spill, NOT delete
    /// the original table.
    #[test]
    fn test_spill_copied_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create original table at C3 (outputs C3:E7)
        test_create_data_table(&mut gc, sheet_id, pos![C3], 3, 3);

        let a1_context = gc.a1_context();

        // Copy the table and paste at A1
        // The pasted table would output A1:C5, which overlaps with the original at C3:C5
        let clipboard = gc.sheet(sheet_id).copy_to_clipboard(
            &A1Selection::test_a1("C3:E10"),
            &a1_context,
            ClipboardOperation::Copy,
            true,
        );

        gc.paste_from_clipboard(
            &A1Selection::test_a1("A1"),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        // Check that BOTH tables exist
        let table_at_a1 = gc.sheet(sheet_id).data_table_at(&pos![A1]);
        let table_at_c3 = gc.sheet(sheet_id).data_table_at(&pos![C3]);

        assert!(
            table_at_c3.is_some(),
            "Original table at C3 should still exist after paste"
        );
        assert!(table_at_a1.is_some(), "Pasted table at A1 should exist");

        // The original table should NOT have a spill (it was created first)
        assert!(
            !table_at_c3.unwrap().has_spill(),
            "Original table at C3 should NOT have spill"
        );

        // The pasted table should have a spill error (its output overlaps with C3)
        assert!(
            table_at_a1.unwrap().has_spill(),
            "Pasted table at A1 should have spill because its output overlaps with C3"
        );

        // Now delete the original table at C3 by deleting its selection
        gc.delete_cells(
            &A1Selection::test_a1_sheet_id("C3:E7", sheet_id),
            None,
            false,
        );

        // The pasted table should now unspill
        let table_at_a1 = gc.sheet(sheet_id).data_table_at(&pos![A1]);
        let table_at_c3 = gc.sheet(sheet_id).data_table_at(&pos![C3]);

        assert!(
            table_at_c3.is_none(),
            "Original table at C3 should be deleted"
        );
        assert!(
            table_at_a1.is_some(),
            "Pasted table at A1 should still exist after deleting C3"
        );
        assert!(
            !table_at_a1.unwrap().has_spill(),
            "Pasted table at A1 should no longer have spill after C3 is deleted"
        );
    }
}
