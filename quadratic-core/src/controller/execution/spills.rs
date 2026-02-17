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
    use crate::{Array, CellValue, Pos, Rect, SheetPos, Value};

    fn output_spill_error(x: i64, y: i64) -> Vec<JsRenderCell> {
        // Note: DataTable cells don't have language set (border drawn from table struct)
        vec![JsRenderCell {
            x,
            y,
            language: None,
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
        // Note: DataTable cells don't have language set (border drawn from table struct)
        assert_eq!(render_cells, output_number(1, 1, "1", None, None),);
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
        // Note: DataTable cells don't have language set (border drawn from table struct)
        assert_eq!(render_cells, output_number(1, 1, "1", None, None));
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
        // Note: DataTable cells don't have language set (border drawn from table struct)
        assert_eq!(render_cells, output_number(12, 10, "1", None, None));
    }

    #[test]
    fn test_check_deleted_data_tables() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "".to_string(),
            formula_ast: None,
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
        // Note: DataTable cells don't have language set (border drawn from table struct)
        assert_eq!(
            render_cells,
            vec![JsRenderCell {
                x: 1,
                y: 1,
                language: None,
                special: Some(JsRenderCellSpecial::SpillError),
                ..Default::default()
            }]
        );
    }

    #[test]
    fn test_spill_from_merged_cell() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // Create a merged cell at B1:C1 (same row as code cell output)
        let merge_selection = crate::a1::A1Selection::test_a1_sheet_id("B1:C1", sheet_id);
        gc.merge_cells(merge_selection, None, false);

        // Create a code cell that would spill over the merged cell
        // The formula outputs horizontally: A1=1, B1=2, C1=3
        // But B1:C1 is a merged cell, causing a spill
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3}".into(),
            None,
            None,
            false,
        );

        // Should have a spill error due to merged cell
        let sheet = gc.sheet(sheet_id);
        let code_cell = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(code_cell.has_spill());
        assert!(code_cell.spill_merged_cell);
    }

    #[test]
    fn test_spill_removed_when_merged_cell_unmerged() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // Create a merged cell at B1:C1
        let merge_selection = crate::a1::A1Selection::test_a1_sheet_id("B1:C1", sheet_id);
        gc.merge_cells(merge_selection, None, false);

        // Create a code cell that would spill over the merged cell
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3}".into(),
            None,
            None,
            false,
        );

        // Verify spill error exists
        let sheet = gc.sheet(sheet_id);
        let code_cell = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(code_cell.has_spill());

        // Unmerge the cell
        let unmerge_selection = crate::a1::A1Selection::test_a1_sheet_id("B1:C1", sheet_id);
        gc.unmerge_cells(unmerge_selection, None, false);

        // Spill error should be gone
        let sheet = gc.sheet(sheet_id);
        let code_cell = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(!code_cell.has_spill());
        assert!(!code_cell.spill_merged_cell);
    }

    #[test]
    fn test_merged_cell_created_after_code_causes_spill() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // Now create a merged cell first
        let merge_selection = crate::a1::A1Selection::test_a1_sheet_id("B1:C1", sheet_id);
        gc.merge_cells(merge_selection, None, false);

        // Then create a code cell that would spill over the merged cell
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3}".into(),
            None,
            None,
            false,
        );

        // Should have a spill error due to merged cell
        let sheet = gc.sheet(sheet_id);
        let code_cell = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(
            code_cell.has_spill(),
            "Code cell should have a spill error when created over merged cell"
        );
        assert!(
            code_cell.spill_merged_cell,
            "spill_merged_cell should be true"
        );
    }

    #[test]
    fn test_multiple_merged_cells_causing_spills() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // Create multiple merged cells on same row as output
        let merge1 = crate::a1::A1Selection::test_a1_sheet_id("B1:C1", sheet_id);
        gc.merge_cells(merge1, None, false);

        let merge2 = crate::a1::A1Selection::test_a1_sheet_id("D1:E1", sheet_id);
        gc.merge_cells(merge2, None, false);

        // Create a code cell that would spill over both merged cells
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3, 4, 5}".into(),
            None,
            None,
            false,
        );

        // Should have a spill error
        let sheet = gc.sheet(sheet_id);
        let code_cell = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(code_cell.has_spill());
        assert!(code_cell.spill_merged_cell);

        // Check that the spill error reasons include anchors from both merged cells
        let reasons = sheet.find_spill_error_reasons(
            &code_cell.output_rect(Pos { x: 1, y: 1 }, true),
            Pos { x: 1, y: 1 },
        );
        // Should include anchor positions from both merged cells (B1 and D1)
        assert!(reasons.contains(&Pos { x: 2, y: 1 })); // B1 anchor
        assert!(reasons.contains(&Pos { x: 4, y: 1 })); // D1 anchor
    }

    #[test]
    fn test_spill_with_mixed_causes() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // Create a merged cell at B1:C1
        let merge_selection = crate::a1::A1Selection::test_a1_sheet_id("B1:C1", sheet_id);
        gc.merge_cells(merge_selection, None, false);

        // Add a regular cell value at D1
        gc.set_cell_value(
            SheetPos {
                x: 4,
                y: 1,
                sheet_id,
            },
            "blocks".into(),
            None,
            false,
        );

        // Create a code cell that would spill over both
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3, 4}".into(),
            None,
            None,
            false,
        );

        // Should have spill errors from both merged cell and regular value
        let sheet = gc.sheet(sheet_id);
        let code_cell = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(code_cell.has_spill());
        assert!(code_cell.spill_merged_cell);
        assert!(code_cell.spill_value);

        // Check that the spill error reasons include positions from both causes
        let reasons = sheet.find_spill_error_reasons(
            &code_cell.output_rect(Pos { x: 1, y: 1 }, true),
            Pos { x: 1, y: 1 },
        );
        // Should include B1 (anchor of merged cell) and D1 (value)
        assert!(reasons.contains(&Pos { x: 2, y: 1 })); // B1 anchor of B1:C1 merged cell
        assert!(reasons.contains(&Pos { x: 4, y: 1 })); // D1 regular value
    }

    #[test]
    fn test_spill_vertical_merged_cell() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // First set up some values to reference
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

        // Create a vertical merged cell at A2:A3
        let merge_selection = crate::a1::A1Selection::test_a1_sheet_id("A2:A3", sheet_id);
        gc.merge_cells(merge_selection, None, false);

        // Create a formula that references B1:B3 which will output vertically at A1, A2, A3
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "B1:B3".into(),
            None,
            None,
            false,
        );

        // Should have a spill error due to vertical merged cell at A2:A3
        let sheet = gc.sheet(sheet_id);
        let code_cell = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(code_cell.has_spill());
        assert!(code_cell.spill_merged_cell);

        // Check that spill error includes the anchor of the merged cell
        let reasons = sheet.find_spill_error_reasons(
            &code_cell.output_rect(Pos { x: 1, y: 1 }, true),
            Pos { x: 1, y: 1 },
        );
        // Should contain A2 (anchor of the A2:A3 merged cell)
        assert!(reasons.contains(&Pos { x: 1, y: 2 })); // A2 anchor
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

    /// Test: deleting cells that include the full range of a code table with
    /// multi-cell output should delete the table.
    #[test]
    fn test_delete_full_code_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create code table at C3 with 3x3 output (outputs C3:E5)
        test_create_code_table(&mut gc, sheet_id, pos![C3], 3, 3);

        // Verify table exists
        assert!(
            gc.sheet(sheet_id).data_table_at(&pos![C3]).is_some(),
            "Code table at C3 should exist before delete"
        );

        // Delete the full table range
        gc.delete_cells(
            &A1Selection::test_a1_sheet_id("C3:E5", sheet_id),
            None,
            false,
        );

        // Table should be deleted
        assert!(
            gc.sheet(sheet_id).data_table_at(&pos![C3]).is_none(),
            "Code table at C3 should be deleted after deleting full range"
        );

        // Undo should restore the table
        gc.undo(1, None, false);
        assert!(
            gc.sheet(sheet_id).data_table_at(&pos![C3]).is_some(),
            "Code table at C3 should be restored after undo"
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
            a1_context,
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

    /// Test: copying and pasting a code table where the paste output covers the
    /// anchor of an existing code table should delete the original table.
    #[test]
    fn test_spill_copied_code_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create original code table at C3 with 3x3 output (outputs C3:E5)
        test_create_code_table(&mut gc, sheet_id, pos![C3], 3, 3);

        let a1_context = gc.a1_context();

        // Copy the table and paste at A1
        // The pasted table would output A1:C3, which covers C3 (the anchor of the original)
        let clipboard = gc.sheet(sheet_id).copy_to_clipboard(
            &A1Selection::test_a1("C3:E5"),
            a1_context,
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

        // The original table at C3 should be deleted because the paste output covers its anchor
        let table_at_a1 = gc.sheet(sheet_id).data_table_at(&pos![A1]);
        let table_at_c3 = gc.sheet(sheet_id).data_table_at(&pos![C3]);

        assert!(
            table_at_c3.is_none(),
            "Original code table at C3 should be deleted because paste covers its anchor"
        );
        assert!(
            table_at_a1.is_some(),
            "Pasted code table at A1 should exist"
        );

        // The pasted table should NOT have a spill (the blocking table was deleted)
        assert!(
            !table_at_a1.unwrap().has_spill(),
            "Pasted code table at A1 should NOT have spill since C3 was deleted"
        );
    }

    /// Test: deleting a code table that has a spill error should still delete the table.
    #[test]
    fn test_delete_spilled_code_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create first table at C3 with 3x3 output (C3:E5)
        test_create_code_table(&mut gc, sheet_id, pos![C3], 3, 3);

        // Create second code table at A1 that would output A1:C3
        // This will cause a spill error because C3 is occupied by the first table
        test_create_code_table(&mut gc, sheet_id, pos![A1], 3, 3);

        // Verify both tables exist
        let table_at_a1 = gc.sheet(sheet_id).data_table_at(&pos![A1]);
        let table_at_c3 = gc.sheet(sheet_id).data_table_at(&pos![C3]);
        assert!(table_at_a1.is_some(), "Table at A1 should exist");
        assert!(table_at_c3.is_some(), "Table at C3 should exist");

        // Verify A1 has a spill error
        assert!(
            table_at_a1.unwrap().has_spill(),
            "Table at A1 should have a spill error"
        );

        // Delete the spilled code table at A1
        gc.delete_cells(&A1Selection::test_a1_sheet_id("A1", sheet_id), None, false);

        // The spilled table at A1 should be deleted
        let table_at_a1 = gc.sheet(sheet_id).data_table_at(&pos![A1]);
        let table_at_c3 = gc.sheet(sheet_id).data_table_at(&pos![C3]);

        assert!(
            table_at_a1.is_none(),
            "Table at A1 should be deleted after delete_cells"
        );
        assert!(
            table_at_c3.is_some(),
            "Table at C3 should still exist after deleting A1"
        );
    }

    #[test]
    fn test_spill_check_excludes_code_cell_own_position() {
        // Test that a CellValue::Code at the code cell's own position doesn't cause a false spill
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a JavaScript code cell that returns a single value
        // This should be stored as CellValue::Code (1x1 output)
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Javascript,
            "return q.cells('B1') + 10".to_string(),
            None,
            None,
            false,
        );

        // Set a value in B1 that the code cell references
        gc.set_cell_value(pos![sheet_id!B1], "5".into(), None, false);

        // Wait for code execution to complete
        // The code cell should execute and produce a result
        // Since it's 1x1, it should be stored as CellValue::Code

        // Now simulate what happens after reload: the code cell executes again
        // The key test is that when checking for spills, the CellValue::Code at A1
        // should not cause a false spill error

        // Re-execute the code cell (simulating reload)
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Javascript,
            "return q.cells('B1') + 10".to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // Check that the code cell is stored as CellValue::Code (not DataTable)
        // This means it qualified as a single code cell
        if let Some(CellValue::Code(_)) = sheet.cell_value_ref(pos![A1]) {
            // Good - it's a CellValue::Code
        } else {
            // If it's a DataTable, check that it doesn't have a spill error
            if let Some(data_table) = sheet.data_table_at(&pos![A1]) {
                assert!(
                    !data_table.has_spill(),
                    "Code cell should not have a spill error when CellValue::Code is at its own position"
                );
            }
        }

        // Verify no spill error is shown
        let render_cells = sheet.get_render_cells(Rect::single_pos(pos![A1]), gc.a1_context());
        assert!(
            !render_cells
                .iter()
                .any(|cell| matches!(cell.special, Some(JsRenderCellSpecial::SpillError))),
            "Code cell should not show spill error after reload"
        );
    }
}
