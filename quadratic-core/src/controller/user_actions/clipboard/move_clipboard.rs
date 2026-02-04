use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::clipboard::PasteSpecial;
use crate::grid::{GridBounds, SheetId};
use crate::{Pos, Rect, SheetPos, SheetRect, a1::A1Selection};

impl GridController {
    /// move entire columns or rows from source to dest
    pub fn move_cols_rows(
        &mut self,
        source: SheetRect,
        dest: SheetPos,
        columns: bool,
        rows: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.move_cells_operations(source, dest, columns, rows);
        self.start_user_ai_transaction(ops, cursor, TransactionName::MoveCells, is_ai);
    }

    /// move multiple cell regions in a single transaction
    /// each move is a (source, dest) pair
    ///
    /// This function ensures order-independence by snapshotting all sources
    /// before applying any changes. This handles cases where one move's
    /// destination overlaps another move's source (e.g., swapping positions).
    pub fn move_cells_batch(
        &mut self,
        moves: Vec<(SheetRect, SheetPos)>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        if moves.is_empty() {
            return;
        }

        // Phase 1: Snapshot all sources first (before any modifications)
        // This ensures order-independence even when destinations overlap sources
        let mut clipboards_and_cut_ops = Vec::new();
        for (source, dest) in &moves {
            let selection = A1Selection::from_rect(*source);
            if let Ok((clipboard, cut_ops)) = self.cut_to_clipboard_operations(&selection, false) {
                clipboards_and_cut_ops.push((clipboard, cut_ops, *dest));
            }
        }

        // Create a combined selection of all source areas. This is needed so that
        // paste_html_operations knows that tables at other source positions are
        // also being moved (not static tables that would block the paste).
        let all_source_rects: Vec<Rect> = clipboards_and_cut_ops
            .iter()
            .map(|(clipboard, _, _)| {
                let origin_pos = Pos::new(clipboard.origin.x, clipboard.origin.y);
                clipboard.to_rect(origin_pos)
            })
            .collect();
        let combined_selection = if let Some(first_clipboard) = clipboards_and_cut_ops.first() {
            A1Selection::from_rects(
                all_source_rects,
                first_clipboard.0.origin.sheet_id,
                self.a1_context(),
            )
        } else {
            None
        };

        // Phase 2: Generate all operations - cuts first, then pastes
        let mut all_ops = Vec::new();

        // Add all cut (delete) operations
        for (_, cut_ops, _) in &clipboards_and_cut_ops {
            all_ops.extend(cut_ops.clone());
        }

        // Add all paste operations
        for (mut clipboard, _, dest) in clipboards_and_cut_ops {
            // Update the clipboard's selection to include all source areas being moved.
            // This allows paste_html_operations to correctly identify that tables at
            // other source positions are also being moved in this batch.
            if let Some(ref combined) = combined_selection {
                clipboard.selection = combined.clone();
            }

            let selection = A1Selection::from_single_cell(dest);
            if let Ok((paste_ops, data_table_ops)) = self.paste_html_operations(
                dest.into(),
                dest.into(),
                &selection,
                clipboard,
                PasteSpecial::None,
            ) {
                all_ops.extend(paste_ops);
                all_ops.extend(data_table_ops);
            }
        }

        self.start_user_ai_transaction(all_ops, cursor, TransactionName::MoveCells, is_ai);
    }

    /// move a code cell vertically
    /// sheet_end is true if the code cell is at the end of the sheet
    /// reverse is true if the code cell should be moved up
    #[allow(clippy::too_many_arguments)]
    pub fn move_code_cell_vertically(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        sheet_end: bool,
        reverse: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Option<Pos> {
        let sheet = self.try_sheet(sheet_id)?;
        let source = SheetRect::from_numbers(x, y, 1, 1, sheet_id);
        let mut dest = SheetPos::new(sheet_id, x, y);
        let code_cell = sheet.get_render_code_cell((x, y).into())?;
        if sheet_end {
            if let GridBounds::NonEmpty(rect) = sheet.bounds(true) {
                dest = if reverse {
                    SheetPos::new(
                        sheet_id,
                        x,
                        rect.min.y.saturating_sub(code_cell.h as i64).max(1),
                    )
                } else {
                    SheetPos::new(sheet_id, x, rect.max.y + 1)
                };
            }
        } else {
            let rect = Rect::from_numbers(
                code_cell.x as i64,
                code_cell.y as i64,
                code_cell.w as i64,
                code_cell.h as i64,
            );
            let row = sheet
                .find_next_row_for_rect(y + if reverse { -1 } else { 1 }, x, reverse, rect)
                .max(1);
            dest = SheetPos::new(sheet_id, x, row);
        }
        let ops = self.move_cells_operations(source, dest, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::MoveCells, is_ai);
        Some(dest.into())
    }

    /// move a code cell horizontally
    /// sheet_end is true if the code cell is at the end of the sheet
    /// reverse is true if the code cell should be moved left
    #[allow(clippy::too_many_arguments)]
    pub fn move_code_cell_horizontally(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        sheet_end: bool,
        reverse: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Option<Pos> {
        let sheet = self.try_sheet(sheet_id)?;
        let source = SheetRect::from_numbers(x, y, 1, 1, sheet_id);
        let mut dest = SheetPos::new(sheet_id, x, y);
        let code_cell = sheet.get_render_code_cell((x, y).into())?;
        if sheet_end {
            if let GridBounds::NonEmpty(rect) = sheet.bounds(true) {
                dest = if reverse {
                    SheetPos::new(
                        sheet_id,
                        rect.min.x.saturating_sub(code_cell.w as i64).max(1),
                        y,
                    )
                } else {
                    SheetPos::new(sheet_id, rect.max.x + 1, y)
                }
            }
        } else {
            let rect = Rect::from_numbers(
                code_cell.x as i64,
                code_cell.y as i64,
                code_cell.w as i64,
                code_cell.h as i64,
            );
            let col = sheet
                .find_next_column_for_rect(x + if reverse { -1 } else { 1 }, y, reverse, rect)
                .max(1);
            dest = SheetPos::new(sheet_id, col, y);
        }
        let ops = self.move_cells_operations(source, dest, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::MoveCells, is_ai);
        Some(dest.into())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::controller::operations::clipboard::{ClipboardOperation, PasteSpecial};
    use crate::controller::transaction_types::{JsCellValueResult, JsCodeResult};
    use crate::controller::user_actions::import::tests::simple_csv_at;
    use crate::grid::js_types::{CellFormatSummary, JsClipboard};
    use crate::grid::sort::SortDirection;
    use crate::grid::{CodeCellLanguage, SheetId};
    use crate::{Array, test_util::*};
    use crate::{CellValue, Pos, SheetPos, SheetRect, controller::GridController};

    #[track_caller]
    fn set_cell_value(gc: &mut GridController, sheet_id: SheetId, value: &str, x: i64, y: i64) {
        gc.set_cell_value(SheetPos { x, y, sheet_id }, value.into(), None, false);
    }

    #[track_caller]
    fn set_code_cell(
        gc: &mut GridController,
        sheet_id: SheetId,
        language: CodeCellLanguage,
        code: &str,
        x: i64,
        y: i64,
    ) {
        gc.set_code_cell(
            SheetPos { x, y, sheet_id },
            language,
            code.into(),
            None,
            None,
            false,
        );
    }

    #[track_caller]
    fn set_formula_code_cell(
        gc: &mut GridController,
        sheet_id: SheetId,
        code: &str,
        x: i64,
        y: i64,
    ) {
        set_code_cell(gc, sheet_id, CodeCellLanguage::Formula, code, x, y);
    }

    #[track_caller]
    fn assert_cell_values(gc: &GridController, sheet_id: SheetId, values: &[(i64, i64, i64)]) {
        let sheet = gc.sheet(sheet_id);
        for &(x, y, expected) in values {
            assert_eq!(
                sheet.display_value(Pos { x, y }),
                Some(CellValue::Number(expected.into())),
                "wrong cell value at ({x}, {y})"
            );
        }
    }

    #[track_caller]
    fn assert_empty_cells(gc: &GridController, sheet_id: SheetId, cells: &[(i64, i64)]) {
        let sheet = gc.sheet(sheet_id);
        for &(x, y) in cells {
            assert_eq!(sheet.display_value(Pos { x, y }), None);
        }
    }

    #[test]
    fn test_move_cells() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3; 4, 5, 6}", 1, 1);
        set_cell_value(&mut gc, sheet_id, "100", 1, 3);

        gc.move_cols_rows(
            SheetRect::new_pos_span(Pos { x: 1, y: 1 }, Pos { x: 3, y: 3 }, sheet_id),
            (11, 11, sheet_id).into(),
            false,
            false,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value((11, 11).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value((11, 13).into()),
            Some(CellValue::Number(100.into()))
        );
        assert_eq!(sheet.display_value((1, 1).into()), None);
        assert_eq!(sheet.display_value((1, 3).into()), None);

        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value((11, 11).into()), None);
        assert_eq!(sheet.display_value((11, 13).into()), None);
        assert_eq!(
            sheet.display_value((1, 1).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value((1, 3).into()),
            Some(CellValue::Number(100.into()))
        );
    }

    #[test]
    fn copy_cell_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.formats.bold.set(Pos { x: 2, y: 3 }, Some(true));
        sheet
            .formats
            .fill_color
            .set(Pos { x: 4, y: 5 }, Some("red".to_string()));
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 5, 6, sheet_id));
        let sheet = gc.sheet(sheet_id);
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 2, y: 3 }),
            CellFormatSummary {
                bold: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 4, y: 5 }),
            CellFormatSummary {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_move_code_cell_vertically() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // Set up a code cell
        set_formula_code_cell(&mut gc, sheet_id, "{1; 2; 3}", 1, 1);
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (1, 2, 2), (1, 3, 3)]);

        // Move down
        let result = gc.move_code_cell_vertically(sheet_id, 1, 1, false, false, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 4 }));
        assert_cell_values(&gc, sheet_id, &[(1, 4, 1), (1, 5, 2), (1, 6, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (1, 2), (1, 3)]);

        // Move up
        let result = gc.move_code_cell_vertically(sheet_id, 1, 4, false, true, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (1, 2, 2), (1, 3, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 4), (1, 5), (1, 6)]);

        // Move to sheet end (down)
        set_cell_value(&mut gc, sheet_id, "obstacle", 1, 10);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 1, true, false, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 11 }));
        assert_cell_values(&gc, sheet_id, &[(1, 11, 1), (1, 12, 2), (1, 13, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (1, 2), (1, 3)]);

        // Move to sheet start (up)
        set_cell_value(&mut gc, sheet_id, "obstacle1", 1, 3);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 11, true, true, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (1, 2, 3)]);
        // assert_empty_cells(&gc, sheet_id, &[(1, 11), (1, 12), (1, 13)]);

        // Move when there's no code cell
        let result = gc.move_code_cell_vertically(sheet_id, 20, 20, false, false, None, false);
        assert_eq!(result, None);

        // Move down with obstacles
        set_cell_value(&mut gc, sheet_id, "obstacle2", 1, 4);
        set_cell_value(&mut gc, sheet_id, "obstacle3", 1, 5);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 1, false, false, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 6 }));
        assert_cell_values(&gc, sheet_id, &[(1, 6, 1), (1, 7, 2), (1, 8, 3)]);

        // Move up with obstacles
        let result = gc.move_code_cell_vertically(sheet_id, 1, 6, false, true, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (1, 2, 2), (1, 3, 3)]);

        // Move a single-cell code output
        set_formula_code_cell(&mut gc, sheet_id, "42", 1, 15);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 15, false, false, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 16 }));
        assert_cell_values(&gc, sheet_id, &[(1, 16, 42)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 15)]);

        // Undo and redo
        gc.undo(1, None, false);
        assert_cell_values(&gc, sheet_id, &[(1, 15, 42)]);
        gc.redo(1, None, false);
        assert_cell_values(&gc, sheet_id, &[(1, result.unwrap().y, 42)]);
    }

    #[test]
    fn test_move_code_cell_horizontally() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // Set up a code cell
        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3}", 1, 1);
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (2, 1, 2), (3, 1, 3)]);

        // Move right
        let result = gc.move_code_cell_horizontally(sheet_id, 1, 1, false, false, None, false);
        assert_eq!(result, Some(Pos { x: 4, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(4, 1, 1), (5, 1, 2), (6, 1, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (2, 1), (3, 1)]);

        // Move left
        let result = gc.move_code_cell_horizontally(sheet_id, 4, 1, false, true, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (2, 1, 2), (3, 1, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(4, 1), (5, 1), (6, 1)]);

        // Move to sheet end (right)
        set_cell_value(&mut gc, sheet_id, "obstacle", 10, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 1, 1, true, false, None, false);
        assert_eq!(result, Some(Pos { x: 11, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(11, 1, 1), (12, 1, 2), (13, 1, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (2, 1), (3, 1)]);

        // Move to sheet start (left)
        set_cell_value(&mut gc, sheet_id, "obstacle1", 3, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 11, 1, true, true, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (2, 1, 2), (3, 1, 3)]);
        // assert_empty_cells(&gc, sheet_id, &[(11, 1), (12, 1), (13, 1)]);

        // Move when there's no code cell
        let result = gc.move_code_cell_horizontally(sheet_id, 20, 20, false, false, None, false);
        assert_eq!(result, None);

        // Move right with obstacles
        set_cell_value(&mut gc, sheet_id, "obstacle2", 4, 1);
        set_cell_value(&mut gc, sheet_id, "obstacle3", 5, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 1, 1, false, false, None, false);
        assert_eq!(result, Some(Pos { x: 6, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(6, 1, 1), (7, 1, 2), (8, 1, 3)]);

        // Move left with obstacles
        let result = gc.move_code_cell_horizontally(sheet_id, 6, 1, false, true, None, false);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (2, 1, 2), (3, 1, 3)]);

        // Move a single-cell code output
        set_formula_code_cell(&mut gc, sheet_id, "42", 15, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 15, 1, false, false, None, false);
        assert_eq!(result, Some(Pos { x: 16, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(16, 1, 42)]);
        assert_empty_cells(&gc, sheet_id, &[(15, 1)]);

        // Undo and redo
        gc.undo(1, None, false);
        assert_cell_values(&gc, sheet_id, &[(15, 1, 42)]);
        gc.redo(1, None, false);
        assert_cell_values(&gc, sheet_id, &[(result.unwrap().x, 1, 42)]);
    }

    #[test]
    fn test_translate_code_cell_references_on_cut() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "1", 1, 1);
        set_formula_code_cell(&mut gc, sheet_id, "A1", 2, 1);
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1)]);
        assert_cell_values(&gc, sheet_id, &[(2, 1, 1)]);

        gc.set_code_cell(
            pos![C1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            r#"q.cells("A1")"#.to_string(),
            None,
            None,
            false,
        );

        gc.set_code_cell(
            pos![D1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1");"#.to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_rect(SheetRect::new(2, 1, 4, 1, sheet_id));
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Cut, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(2, 2, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        assert_cell_values(&gc, sheet_id, &[(2, 2, 1)]);
        assert_code_cell_value(&gc, sheet_id, 2, 2, "A1");
        assert_code_cell_value(&gc, sheet_id, 3, 2, r#"q.cells("A1")"#);
        assert_code_cell_value(&gc, sheet_id, 4, 2, r#"return q.cells("A1");"#);
    }

    #[test]
    fn test_translate_code_cell_references_on_copy() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let mock_calculation_complete = |gc: &mut GridController| {
            let result = JsCodeResult {
                transaction_id: gc.last_transaction().unwrap().id.to_string(),
                success: true,
                std_out: None,
                std_err: None,
                line_number: None,
                output_value: Some(JsCellValueResult("".to_string(), 1)),
                output_array: None,
                output_display_type: None,
                chart_pixel_output: None,
                has_headers: false,
            };
            gc.calculation_complete(result).unwrap();
        };

        set_cell_value(&mut gc, sheet_id, "1", 1, 1);
        set_formula_code_cell(&mut gc, sheet_id, "A1", 2, 1);
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1)]);
        assert_cell_values(&gc, sheet_id, &[(2, 1, 1)]);

        gc.set_code_cell(
            pos![C1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            r#"q.cells("A1")"#.to_string(),
            None,
            None,
            false,
        );
        mock_calculation_complete(&mut gc);

        gc.set_code_cell(
            pos![D1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1");"#.to_string(),
            None,
            None,
            false,
        );
        mock_calculation_complete(&mut gc);

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::test_a1("B1:D1");
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("B2"),
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
            false,
        );
        // complete JS & Python code runs in the paste
        mock_calculation_complete(&mut gc);
        mock_calculation_complete(&mut gc);

        assert_display_cell_value(&gc, sheet_id, 2, 2, "");
        assert_code_cell_value(&gc, sheet_id, 2, 2, "A2");
        assert_code_cell_value(&gc, sheet_id, 3, 2, r#"q.cells("A2")"#);
        assert_code_cell_value(&gc, sheet_id, 4, 2, r#"return q.cells("A2");"#);

        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );
        // complete JS & Python code runs in the paste
        mock_calculation_complete(&mut gc);
        mock_calculation_complete(&mut gc);

        assert_display_cell_value(&gc, sheet_id, 1, 1, "Bad cell reference");
        assert_code_cell_value(&gc, sheet_id, 1, 1, "#REF!");
        assert_code_cell_value(&gc, sheet_id, 2, 1, r##"q.cells("#REF!")"##);
        assert_code_cell_value(&gc, sheet_id, 3, 1, r##"return q.cells("#REF!");"##);
    }

    #[test]
    fn test_paste_in_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        let sheet = gc.sheet_mut(sheet_id);
        let values = vec![vec!["value".to_string(); 2]; 2];
        sheet.set_cell_values(Rect::from_numbers(1, 1, 2, 2), Array::from(values));

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 2, 2, sheet_id));
        let sheet = gc.sheet(sheet_id);
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("F5", sheet_id),
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();
        assert_eq!(
            sheet.display_value(pos![F5]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![G6]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(1, 2).unwrap(),
            &CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(2, 3).unwrap(),
            &CellValue::Text("value".to_string())
        );

        // first row is not header
        gc.sheet_mut(sheet_id)
            .modify_data_table_at(&pos, |dt| {
                dt.header_is_first_row = false;
                Ok(())
            })
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("G10", sheet_id),
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();
        assert_eq!(
            sheet.display_value(pos![G10]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![H11]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(2, 6).unwrap(),
            &CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(3, 7).unwrap(),
            &CellValue::Text("value".to_string())
        );

        // first row is not header
        gc.sheet_mut(sheet_id)
            .modify_data_table_at(&pos, |dt| {
                dt.show_name = Some(false);
                dt.show_columns = Some(false);
                Ok(())
            })
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E11", sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();
        assert_eq!(
            sheet.display_value(pos![E11]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![F12]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(0, 9).unwrap(),
            &CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(1, 10).unwrap(),
            &CellValue::Text("value".to_string())
        );
    }

    #[test]
    fn test_paste_in_data_table_with_sort() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        // sort column 3 descending
        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&pos, |dt| {
                dt.sort_column(3, SortDirection::Descending).unwrap();
                Ok(())
            })
            .unwrap();

        let sheet = gc.sheet_mut(sheet_id);
        let values = vec![vec!["value".to_string(); 2]; 2];
        sheet.set_cell_values(Rect::from_numbers(1, 1, 2, 2), Array::from(values));

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 2, 2, sheet_id));
        let sheet = gc.sheet(sheet_id);
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("F5", sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(
            sheet.display_value(pos![F5]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![G6]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(1, 6).unwrap(),
            &CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(2, 8).unwrap(),
            &CellValue::Text("value".to_string())
        );
    }

    #[test]
    fn test_paste_in_data_table_with_hidden_column() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        // hide first column
        gc.sheet_mut(sheet_id)
            .modify_data_table_at(&pos, |dt| {
                let column_headers = dt.column_headers.as_mut().unwrap();
                column_headers[2].display = false;
                Ok(())
            })
            .unwrap();

        let sheet = gc.sheet_mut(sheet_id);
        let values = vec![vec!["value".to_string(); 2]; 2];
        sheet.set_cell_values(Rect::from_numbers(1, 1, 2, 2), Array::from(values));

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 2, 2, sheet_id));
        let sheet = gc.sheet(sheet_id);
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("F5", sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(
            sheet.display_value(pos![F5]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![G6]).unwrap(),
            CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(1, 2).unwrap(),
            &CellValue::Text("value".to_string())
        );
        assert_eq!(
            data_table.value.get(3, 3).unwrap(),
            &CellValue::Text("value".to_string())
        );
    }

    #[test]
    fn test_move_cells_batch_order_independence() {
        // Test that the order of moves in a batch doesn't affect the final result
        // when moving non-overlapping regions to non-overlapping destinations

        // Helper to set up a grid and run batch moves
        // Takes a function that transforms the moves vector to allow testing different orders
        fn run_batch_move<F>(transform_moves: F) -> GridController
        where
            F: FnOnce(SheetId) -> Vec<(SheetRect, SheetPos)>,
        {
            let mut gc = GridController::default();
            let sheet_id = gc.sheet_ids()[0];

            // Set up region A at (1,1) - (2,2) with values 1-4
            set_cell_value(&mut gc, sheet_id, "1", 1, 1);
            set_cell_value(&mut gc, sheet_id, "2", 2, 1);
            set_cell_value(&mut gc, sheet_id, "3", 1, 2);
            set_cell_value(&mut gc, sheet_id, "4", 2, 2);

            // Set up region B at (5,1) - (6,2) with values 5-8
            set_cell_value(&mut gc, sheet_id, "5", 5, 1);
            set_cell_value(&mut gc, sheet_id, "6", 6, 1);
            set_cell_value(&mut gc, sheet_id, "7", 5, 2);
            set_cell_value(&mut gc, sheet_id, "8", 6, 2);

            let moves = transform_moves(sheet_id);
            gc.move_cells_batch(moves, None, false);
            gc
        }

        // Test order 1: A then B
        let gc1 = run_batch_move(|sheet_id| {
            let source_a = SheetRect::new(1, 1, 2, 2, sheet_id);
            let dest_a = SheetPos::new(sheet_id, 10, 10);
            let source_b = SheetRect::new(5, 1, 6, 2, sheet_id);
            let dest_b = SheetPos::new(sheet_id, 20, 10);
            vec![(source_a, dest_a), (source_b, dest_b)]
        });

        // Test order 2: B then A
        let gc2 = run_batch_move(|sheet_id| {
            let source_a = SheetRect::new(1, 1, 2, 2, sheet_id);
            let dest_a = SheetPos::new(sheet_id, 10, 10);
            let source_b = SheetRect::new(5, 1, 6, 2, sheet_id);
            let dest_b = SheetPos::new(sheet_id, 20, 10);
            vec![(source_b, dest_b), (source_a, dest_a)]
        });

        // Both should have the same result
        let sheet1 = gc1.sheet(gc1.sheet_ids()[0]);
        let sheet2 = gc2.sheet(gc2.sheet_ids()[0]);

        // Check region A moved to (10,10)
        assert_eq!(
            sheet1.display_value((10, 10).into()),
            sheet2.display_value((10, 10).into()),
            "Value at (10,10) differs"
        );
        assert_eq!(
            sheet1.display_value((11, 10).into()),
            sheet2.display_value((11, 10).into()),
            "Value at (11,10) differs"
        );
        assert_eq!(
            sheet1.display_value((10, 11).into()),
            sheet2.display_value((10, 11).into()),
            "Value at (10,11) differs"
        );
        assert_eq!(
            sheet1.display_value((11, 11).into()),
            sheet2.display_value((11, 11).into()),
            "Value at (11,11) differs"
        );

        // Check region B moved to (20,10)
        assert_eq!(
            sheet1.display_value((20, 10).into()),
            sheet2.display_value((20, 10).into()),
            "Value at (20,10) differs"
        );
        assert_eq!(
            sheet1.display_value((21, 10).into()),
            sheet2.display_value((21, 10).into()),
            "Value at (21,10) differs"
        );
        assert_eq!(
            sheet1.display_value((20, 11).into()),
            sheet2.display_value((20, 11).into()),
            "Value at (20,11) differs"
        );
        assert_eq!(
            sheet1.display_value((21, 11).into()),
            sheet2.display_value((21, 11).into()),
            "Value at (21,11) differs"
        );

        // Verify original locations are empty in both
        assert_eq!(sheet1.display_value((1, 1).into()), None);
        assert_eq!(sheet2.display_value((1, 1).into()), None);
        assert_eq!(sheet1.display_value((5, 1).into()), None);
        assert_eq!(sheet2.display_value((5, 1).into()), None);

        // Verify the actual values are correct
        assert_eq!(
            sheet1.display_value((10, 10).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet1.display_value((20, 10).into()),
            Some(CellValue::Number(5.into()))
        );
    }

    #[test]
    fn test_move_cells_batch_single_transaction() {
        // Verify that batch move creates a single undoable transaction
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // Set up two regions
        set_cell_value(&mut gc, sheet_id, "1", 1, 1);
        set_cell_value(&mut gc, sheet_id, "2", 5, 1);

        let initial_undo_count = gc.undo_stack.len();

        let source_a = SheetRect::new(1, 1, 1, 1, sheet_id);
        let dest_a = SheetPos::new(sheet_id, 10, 10);
        let source_b = SheetRect::new(5, 1, 5, 1, sheet_id);
        let dest_b = SheetPos::new(sheet_id, 20, 10);

        gc.move_cells_batch(vec![(source_a, dest_a), (source_b, dest_b)], None, false);

        // Should have added exactly one transaction
        assert_eq!(gc.undo_stack.len(), initial_undo_count + 1);

        // Verify moves happened
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value((10, 10).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value((20, 10).into()),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(sheet.display_value((1, 1).into()), None);
        assert_eq!(sheet.display_value((5, 1).into()), None);

        // Single undo should revert both moves
        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value((1, 1).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value((5, 1).into()),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(sheet.display_value((10, 10).into()), None);
        assert_eq!(sheet.display_value((20, 10).into()), None);
    }

    #[test]
    fn test_move_cells_batch_with_code_cells() {
        // Test batch move with formula code cells
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // Set up two formula cells
        set_formula_code_cell(&mut gc, sheet_id, "{1, 2}", 1, 1);
        set_formula_code_cell(&mut gc, sheet_id, "{3, 4}", 1, 5);

        let source_a = SheetRect::new(1, 1, 2, 1, sheet_id);
        let dest_a = SheetPos::new(sheet_id, 10, 10);
        let source_b = SheetRect::new(1, 5, 2, 5, sheet_id);
        let dest_b = SheetPos::new(sheet_id, 10, 20);

        gc.move_cells_batch(vec![(source_a, dest_a), (source_b, dest_b)], None, false);

        let sheet = gc.sheet(sheet_id);

        // Check first code cell moved
        assert_eq!(
            sheet.display_value((10, 10).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value((11, 10).into()),
            Some(CellValue::Number(2.into()))
        );

        // Check second code cell moved
        assert_eq!(
            sheet.display_value((10, 20).into()),
            Some(CellValue::Number(3.into()))
        );
        assert_eq!(
            sheet.display_value((11, 20).into()),
            Some(CellValue::Number(4.into()))
        );

        // Original locations should be empty
        assert_eq!(sheet.display_value((1, 1).into()), None);
        assert_eq!(sheet.display_value((1, 5).into()), None);
    }

    #[test]
    fn test_move_cells_batch_empty_moves() {
        // Test that an empty batch doesn't cause issues
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "1", 1, 1);
        let initial_undo_count = gc.undo_stack.len();

        gc.move_cells_batch(vec![], None, false);

        // Empty batch should still create a transaction (but with no ops)
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value((1, 1).into()),
            Some(CellValue::Number(1.into()))
        );

        assert_eq!(gc.undo_stack.len(), initial_undo_count);
    }

    #[test]
    fn test_move_cells_batch_three_regions_order_independence() {
        // Test with three regions to ensure order independence scales
        fn run_three_region_batch<F>(create_moves: F) -> GridController
        where
            F: FnOnce(SheetId) -> Vec<(SheetRect, SheetPos)>,
        {
            let mut gc = GridController::default();
            let sheet_id = gc.sheet_ids()[0];

            // Region A at (1,1)
            set_cell_value(&mut gc, sheet_id, "A", 1, 1);
            // Region B at (1,5)
            set_cell_value(&mut gc, sheet_id, "B", 1, 5);
            // Region C at (1,9)
            set_cell_value(&mut gc, sheet_id, "C", 1, 9);

            let moves = create_moves(sheet_id);
            gc.move_cells_batch(moves, None, false);
            gc
        }

        // Helper to create moves in different orders
        fn create_moves_order(sheet_id: SheetId, order: &[usize]) -> Vec<(SheetRect, SheetPos)> {
            let source_a = SheetRect::new(1, 1, 1, 1, sheet_id);
            let dest_a = SheetPos::new(sheet_id, 10, 1);
            let source_b = SheetRect::new(1, 5, 1, 5, sheet_id);
            let dest_b = SheetPos::new(sheet_id, 10, 5);
            let source_c = SheetRect::new(1, 9, 1, 9, sheet_id);
            let dest_c = SheetPos::new(sheet_id, 10, 9);

            let all_moves = vec![(source_a, dest_a), (source_b, dest_b), (source_c, dest_c)];

            order.iter().map(|&i| all_moves[i]).collect()
        }

        // Test all 6 permutations: ABC, ACB, BAC, BCA, CAB, CBA
        let orders: Vec<Vec<usize>> = vec![
            vec![0, 1, 2], // ABC
            vec![0, 2, 1], // ACB
            vec![1, 0, 2], // BAC
            vec![1, 2, 0], // BCA
            vec![2, 0, 1], // CAB
            vec![2, 1, 0], // CBA
        ];

        let results: Vec<_> = orders
            .iter()
            .map(|order| run_three_region_batch(|sheet_id| create_moves_order(sheet_id, order)))
            .collect();

        // All results should be identical
        let first_sheet = results[0].sheet(results[0].sheet_ids()[0]);
        for (i, gc) in results.iter().enumerate().skip(1) {
            let sheet = gc.sheet(gc.sheet_ids()[0]);
            assert_eq!(
                sheet.display_value((10, 1).into()),
                first_sheet.display_value((10, 1).into()),
                "Order {} differs at (10,1)",
                i
            );
            assert_eq!(
                sheet.display_value((10, 5).into()),
                first_sheet.display_value((10, 5).into()),
                "Order {} differs at (10,5)",
                i
            );
            assert_eq!(
                sheet.display_value((10, 9).into()),
                first_sheet.display_value((10, 9).into()),
                "Order {} differs at (10,9)",
                i
            );
        }

        // Verify actual values
        assert_eq!(
            first_sheet.display_value((10, 1).into()),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            first_sheet.display_value((10, 5).into()),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            first_sheet.display_value((10, 9).into()),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    fn test_move_cells_batch_swap_positions() {
        // Test swapping: A moves to B's position, B moves to A's position
        // This tests when destination overlaps with another move's source

        fn run_swap_batch<F>(create_moves: F) -> GridController
        where
            F: FnOnce(SheetId) -> Vec<(SheetRect, SheetPos)>,
        {
            let mut gc = GridController::default();
            let sheet_id = gc.sheet_ids()[0];

            // Region A at (1,1) with value "A"
            set_cell_value(&mut gc, sheet_id, "A", 1, 1);
            // Region B at (5,1) with value "B"
            set_cell_value(&mut gc, sheet_id, "B", 5, 1);

            let moves = create_moves(sheet_id);
            gc.move_cells_batch(moves, None, false);
            gc
        }

        // Test order 1: A->B's pos, then B->A's pos
        let gc1 = run_swap_batch(|sheet_id| {
            let source_a = SheetRect::new(1, 1, 1, 1, sheet_id);
            let dest_a = SheetPos::new(sheet_id, 5, 1); // A moves to where B was
            let source_b = SheetRect::new(5, 1, 5, 1, sheet_id);
            let dest_b = SheetPos::new(sheet_id, 1, 1); // B moves to where A was
            vec![(source_a, dest_a), (source_b, dest_b)]
        });

        // Test order 2: B->A's pos, then A->B's pos
        let gc2 = run_swap_batch(|sheet_id| {
            let source_a = SheetRect::new(1, 1, 1, 1, sheet_id);
            let dest_a = SheetPos::new(sheet_id, 5, 1);
            let source_b = SheetRect::new(5, 1, 5, 1, sheet_id);
            let dest_b = SheetPos::new(sheet_id, 1, 1);
            vec![(source_b, dest_b), (source_a, dest_a)]
        });

        let sheet1 = gc1.sheet(gc1.sheet_ids()[0]);
        let sheet2 = gc2.sheet(gc2.sheet_ids()[0]);

        // Check if both orders produce the same result
        let val1_at_1_1 = sheet1.display_value((1, 1).into());
        let val1_at_5_1 = sheet1.display_value((5, 1).into());
        let val2_at_1_1 = sheet2.display_value((1, 1).into());
        let val2_at_5_1 = sheet2.display_value((5, 1).into());

        // For a proper swap, we'd expect:
        // - Position (1,1) to have "B"
        // - Position (5,1) to have "A"
        // But this depends on whether the implementation handles this correctly

        // Assert that order produces same result (this may fail if order matters!)
        assert_eq!(
            val1_at_1_1, val2_at_1_1,
            "Swap order matters! Value at (1,1) differs: order1={:?}, order2={:?}",
            val1_at_1_1, val2_at_1_1
        );
        assert_eq!(
            val1_at_5_1, val2_at_5_1,
            "Swap order matters! Value at (5,1) differs: order1={:?}, order2={:?}",
            val1_at_5_1, val2_at_5_1
        );

        // If we get here, order doesn't matter - verify the swap happened correctly
        // After a swap: (1,1) should have "B", (5,1) should have "A"
        assert_eq!(
            val1_at_1_1,
            Some(CellValue::Text("B".to_string())),
            "Expected 'B' at (1,1) after swap"
        );
        assert_eq!(
            val1_at_5_1,
            Some(CellValue::Text("A".to_string())),
            "Expected 'A' at (5,1) after swap"
        );
    }

    #[test]
    fn test_move_cells_batch_chain_move() {
        // Test chain move: A moves to B's position, B moves to C's position
        // This is another case where destination overlaps source

        fn run_chain_batch<F>(create_moves: F) -> GridController
        where
            F: FnOnce(SheetId) -> Vec<(SheetRect, SheetPos)>,
        {
            let mut gc = GridController::default();
            let sheet_id = gc.sheet_ids()[0];

            // Region A at (1,1)
            set_cell_value(&mut gc, sheet_id, "A", 1, 1);
            // Region B at (5,1)
            set_cell_value(&mut gc, sheet_id, "B", 5, 1);
            // Region C at (9,1)
            set_cell_value(&mut gc, sheet_id, "C", 9, 1);

            let moves = create_moves(sheet_id);
            gc.move_cells_batch(moves, None, false);
            gc
        }

        // Order 1: A->B, B->C (A moves to where B is, B moves to where C is)
        let gc1 = run_chain_batch(|sheet_id| {
            let source_a = SheetRect::new(1, 1, 1, 1, sheet_id);
            let dest_a = SheetPos::new(sheet_id, 5, 1); // A -> B's position
            let source_b = SheetRect::new(5, 1, 5, 1, sheet_id);
            let dest_b = SheetPos::new(sheet_id, 9, 1); // B -> C's position
            vec![(source_a, dest_a), (source_b, dest_b)]
        });

        // Order 2: B->C, A->B (reverse order)
        let gc2 = run_chain_batch(|sheet_id| {
            let source_a = SheetRect::new(1, 1, 1, 1, sheet_id);
            let dest_a = SheetPos::new(sheet_id, 5, 1);
            let source_b = SheetRect::new(5, 1, 5, 1, sheet_id);
            let dest_b = SheetPos::new(sheet_id, 9, 1);
            vec![(source_b, dest_b), (source_a, dest_a)]
        });

        let sheet1 = gc1.sheet(gc1.sheet_ids()[0]);
        let sheet2 = gc2.sheet(gc2.sheet_ids()[0]);

        let val1_at_1_1 = sheet1.display_value((1, 1).into());
        let val1_at_5_1 = sheet1.display_value((5, 1).into());
        let val1_at_9_1 = sheet1.display_value((9, 1).into());
        let val2_at_1_1 = sheet2.display_value((1, 1).into());
        let val2_at_5_1 = sheet2.display_value((5, 1).into());
        let val2_at_9_1 = sheet2.display_value((9, 1).into());

        // Check if order produces same results
        assert_eq!(
            val1_at_1_1, val2_at_1_1,
            "Chain move order matters! Value at (1,1) differs: order1={:?}, order2={:?}",
            val1_at_1_1, val2_at_1_1
        );
        assert_eq!(
            val1_at_5_1, val2_at_5_1,
            "Chain move order matters! Value at (5,1) differs: order1={:?}, order2={:?}",
            val1_at_5_1, val2_at_5_1
        );
        assert_eq!(
            val1_at_9_1, val2_at_9_1,
            "Chain move order matters! Value at (9,1) differs: order1={:?}, order2={:?}",
            val1_at_9_1, val2_at_9_1
        );

        // If order doesn't matter, verify correct chain behavior:
        // - (1,1) should be empty (A moved away)
        // - (5,1) should have "A" (A moved here)
        // - (9,1) should have "B" (B moved here, overwriting C)
        // Note: C gets overwritten because B moves to its position
        assert_eq!(
            val1_at_1_1, None,
            "Expected (1,1) to be empty after chain move"
        );
        assert_eq!(
            val1_at_5_1,
            Some(CellValue::Text("A".to_string())),
            "Expected 'A' at (5,1) after chain move"
        );
        assert_eq!(
            val1_at_9_1,
            Some(CellValue::Text("B".to_string())),
            "Expected 'B' at (9,1) after chain move"
        );
    }

    #[test]
    fn test_move_cells_batch_multiple_tables_to_previous_positions() {
        // Test the specific bug where a later table is moved to an earlier table's
        // original position. Without the fix, the later table would be deleted
        // instead of moved because paste_html_operations would see the earlier
        // table (which hasn't been moved yet in the sheet state) and fail.
        use crate::controller::user_actions::import::tests::simple_csv_at;

        // Create two CSV tables: Table A at (1,1) and Table B at (20,1)
        let (mut gc, sheet_id, _, _) = simple_csv_at(pos!(A1));

        // Import a second CSV at a different position
        let csv_file = std::fs::read("../quadratic-rust-shared/data/csv/simple.csv").unwrap();
        gc.import_csv(
            sheet_id,
            csv_file.as_slice(),
            "test2.csv",
            pos!(T1), // Position (20, 1)
            None,
            Some(b','),
            Some(true),
            false,
            false,
        )
        .unwrap();

        // Verify both tables exist
        let sheet = gc.sheet(sheet_id);
        assert!(
            sheet.data_table_at(&pos!(A1)).is_some(),
            "Table A should exist at (1,1)"
        );
        assert!(
            sheet.data_table_at(&pos!(T1)).is_some(),
            "Table B should exist at (20,1)"
        );

        // Get the table dimensions
        let table_a = sheet.data_table_at(&pos!(A1)).unwrap();
        let table_b = sheet.data_table_at(&pos!(T1)).unwrap();
        let table_a_rect = table_a.output_rect(pos!(A1), false);
        let table_b_rect = table_b.output_rect(pos!(T1), false);

        // Move Table A to (40,1), and Table B to (1,1) (where Table A was)
        // This is the scenario that was buggy: Table B moving to Table A's original position
        let moves = vec![
            (
                SheetRect::from_numbers(
                    table_a_rect.min.x,
                    table_a_rect.min.y,
                    table_a_rect.width() as i64,
                    table_a_rect.height() as i64,
                    sheet_id,
                ),
                SheetPos::new(sheet_id, 40, 1),
            ),
            (
                SheetRect::from_numbers(
                    table_b_rect.min.x,
                    table_b_rect.min.y,
                    table_b_rect.width() as i64,
                    table_b_rect.height() as i64,
                    sheet_id,
                ),
                SheetPos::new(sheet_id, 1, 1), // Move to where Table A was
            ),
        ];

        gc.move_cells_batch(moves, None, false);

        // Verify both tables were moved correctly
        let sheet = gc.sheet(sheet_id);

        // Table A should now be at (40,1)
        assert!(
            sheet.data_table_at(&Pos::new(40, 1)).is_some(),
            "Table A should have moved to (40,1)"
        );

        // Table B should now be at (1,1) - this was the bug: Table B was being deleted
        assert!(
            sheet.data_table_at(&pos!(A1)).is_some(),
            "Table B should have moved to (1,1), but it was deleted instead"
        );

        // Original positions should be empty
        assert!(
            sheet.data_table_at(&pos!(T1)).is_none(),
            "Original position of Table B (20,1) should be empty"
        );

        // Verify undo works correctly
        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);
        assert!(
            sheet.data_table_at(&pos!(A1)).is_some(),
            "After undo, Table A should be back at (1,1)"
        );
        assert!(
            sheet.data_table_at(&pos!(T1)).is_some(),
            "After undo, Table B should be back at (20,1)"
        );
        assert!(
            sheet.data_table_at(&Pos::new(40, 1)).is_none(),
            "After undo, position (40,1) should be empty"
        );
    }
}
