use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::clipboard::{Clipboard, PasteSpecial};
use crate::grid::js_types::JsClipboard;
use crate::grid::{GridBounds, SheetId};
use crate::{Pos, Rect, SheetPos, SheetRect, a1::A1Selection};

// To view you clipboard contents, go to https://evercoder.github.io/clipboard-inspector/
// To decode the html, use https://codebeautify.org/html-decode-string

impl GridController {
    /// using a selection, cut the contents on the grid to the clipboard
    pub fn cut_to_clipboard(
        &mut self,
        selection: &A1Selection,
        include_display_values: bool,
        cursor: Option<String>,
    ) -> Result<JsClipboard, String> {
        match self.cut_to_clipboard_operations(selection, include_display_values) {
            Ok((clipboard, ops)) => {
                self.start_user_transaction(ops, cursor, TransactionName::CutClipboard);
                Ok(clipboard.into())
            }
            _ => Err("Failed to cut to clipboard".into()),
        }
    }

    /// using a selection, paste the contents from the clipboard on the grid
    pub fn paste_from_clipboard(
        &mut self,
        selection: &A1Selection,
        js_clipboard: JsClipboard,
        special: PasteSpecial,
        cursor: Option<String>,
    ) {
        let rect = selection.largest_rect_finite(self.a1_context());
        let insert_at = rect.min;
        let end_pos = rect.max;

        // first try html
        if let Ok(clipboard) = Clipboard::decode(&js_clipboard.html)
            && let Ok((ops, data_table_ops)) =
                self.paste_html_operations(insert_at, end_pos, selection, clipboard, special)
        {
            self.start_user_transaction(ops, cursor.clone(), TransactionName::PasteClipboard);

            if !data_table_ops.is_empty() {
                self.start_user_transaction(
                    data_table_ops,
                    cursor,
                    TransactionName::PasteClipboard,
                );
            }

            return;
        }

        // if not quadratic html, then use the plain text
        if let Ok(ops) = self.paste_plain_text_operations(
            insert_at.to_sheet_pos(selection.sheet_id),
            end_pos,
            selection,
            js_clipboard.plain_text,
            special,
        ) {
            self.start_user_transaction(ops, cursor, TransactionName::PasteClipboard);
        }
    }

    /// move cells from source to dest
    /// columns and rows are optional, if true, then the cells will be moved horizontally or vertically
    pub fn move_cells(
        &mut self,
        source: SheetRect,
        dest: SheetPos,
        columns: bool,
        rows: bool,
        cursor: Option<String>,
    ) {
        let ops = self.move_cells_operations(source, dest, columns, rows);
        self.start_user_transaction(ops, cursor, TransactionName::MoveCells);
    }

    /// move a code cell vertically
    /// sheet_end is true if the code cell is at the end of the sheet
    /// reverse is true if the code cell should be moved up
    pub fn move_code_cell_vertically(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        sheet_end: bool,
        reverse: bool,
        cursor: Option<String>,
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
        self.start_user_transaction(ops, cursor, TransactionName::MoveCells);
        Some(dest.into())
    }

    /// move a code cell horizontally
    /// sheet_end is true if the code cell is at the end of the sheet
    /// reverse is true if the code cell should be moved left
    pub fn move_code_cell_horizontally(
        &mut self,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        sheet_end: bool,
        reverse: bool,
        cursor: Option<String>,
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
        self.start_user_transaction(ops, cursor, TransactionName::MoveCells);
        Some(dest.into())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::controller::operations::clipboard::ClipboardOperation;
    use crate::controller::user_actions::import::tests::simple_csv_at;
    use crate::grid::js_types::JsClipboard;
    use crate::grid::sheet::borders::{BorderSelection, BorderSide, BorderStyle, CellBorderLine};
    use crate::grid::sort::SortDirection;
    use crate::test_util::*;
    use crate::test_util::{assert_code_cell_value, assert_display_cell_value};
    use crate::{Array, assert_cell_value, print_table_in_rect};
    use crate::{
        CellValue, Pos, SheetPos, SheetRect,
        controller::GridController,
        grid::{CodeCellLanguage, SheetId, js_types::CellFormatSummary},
    };

    #[track_caller]
    fn set_cell_value(gc: &mut GridController, sheet_id: SheetId, value: &str, x: i64, y: i64) {
        gc.set_cell_value(SheetPos { x, y, sheet_id }, value.into(), None);
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
    fn test_copy_to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "2, 2", 2, 2);
        gc.set_bold(&A1Selection::test_a1("B2"), Some(true), None)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "12", 4, 3);
        gc.set_italic(&A1Selection::test_a1("D3"), Some(true), None)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "underline", 6, 4);
        gc.set_underline(&A1Selection::test_a1("F4"), Some(true), None)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "strike through", 8, 5);
        gc.set_strike_through(&A1Selection::test_a1("H5"), Some(true), None)
            .unwrap();

        let selection = A1Selection::from_rect(SheetRect::new(2, 2, 8, 5, sheet_id));
        let sheet = gc.sheet(sheet_id);
        let JsClipboard { plain_text, .. } = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        assert_eq!(
            plain_text,
            String::from(
                "2, 2\t\t\t\t\t\t\n\t\t12\t\t\t\t\n\t\t\t\tunderline\t\t\n\t\t\t\t\t\tstrike through"
            )
        );

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 8, 6, sheet_id));
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));

        // paste using plain_text
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
        );

        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Text(String::from("2, 2")))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 4, y: 3 }),
            Some(CellValue::Number(12.into()))
        );

        // paste using html
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Text(String::from("2, 2")))
        );
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 2, y: 2 }),
            CellFormatSummary {
                bold: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.display_value(Pos { x: 4, y: 3 }),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 4, y: 3 }),
            CellFormatSummary {
                italic: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.display_value(Pos { x: 6, y: 4 }),
            Some(CellValue::Text(String::from("underline")))
        );
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 6, y: 4 }),
            CellFormatSummary {
                underline: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.display_value(Pos { x: 8, y: 5 }),
            Some(CellValue::Text(String::from("strike through")))
        );
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 8, y: 5 }),
            CellFormatSummary {
                strike_through: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_copy_code_to_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "1 + 1", 1, 1);

        assert_eq!(gc.undo_stack.len(), 1);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(2.into()))
        );

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 1, 1, sheet_id));
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        // paste using html on a new grid controller
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 1, y: 1 }), None);

        // prepare a cell to be overwritten
        set_formula_code_cell(&mut gc, sheet_id, "2 + 2", 1, 1);

        assert_eq!(gc.undo_stack.len(), 1);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(4.into()))
        );

        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(2.into()))
        );

        assert_eq!(gc.undo_stack.len(), 2);

        // undo to original code cell value
        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(4.into()))
        );

        assert_eq!(gc.undo_stack.len(), 1);

        // empty code cell
        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 1, y: 1 }), None);

        assert_eq!(gc.undo_stack.len(), 0);
    }

    #[test]
    fn test_copy_code_to_clipboard_with_array_output() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3}", 1, 1);

        assert_eq!(gc.undo_stack.len(), 1);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Number(3.into()))
        );
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 3, 1, sheet_id));
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        // paste using html on a new grid controller
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Number(3.into()))
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 1, y: 1 }), None);
        assert_eq!(sheet.display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(sheet.display_value(Pos { x: 3, y: 1 }), None);
    }

    #[test]
    fn test_copy_borders_to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 1, 1, sheet_id));

        gc.set_borders(
            selection.clone(),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(3, 3, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .borders
                .get(BorderSide::Top, Pos { x: 3, y: 3 })
                .unwrap()
                .line,
            CellBorderLine::default()
        );
    }

    #[test]
    fn test_copy_borders_inside() {
        let mut gc = GridController::test();
        let sheet_id_1 = gc.sheet_ids()[0];

        gc.add_sheet(None, None, None);
        let sheet_id_2 = gc.sheet_ids()[1];

        gc.set_borders(
            A1Selection::from_rect(SheetRect::new(1, 1, 5, 5, sheet_id_1)),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id_1);
        let borders = sheet.borders_in_sheet();
        let mut horizontal_borders = borders.horizontal.as_ref().unwrap().iter();
        let mut vertical_borders = borders.vertical.as_ref().unwrap().iter();

        let border = horizontal_borders.next().unwrap();
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 1);
        assert_eq!(border.width, Some(5));
        assert_eq!(border.line, CellBorderLine::default());

        let border = horizontal_borders.next().unwrap();
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 6);
        assert_eq!(border.width, Some(5));
        assert_eq!(border.line, CellBorderLine::default());

        let border = vertical_borders.next().unwrap();
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 1);
        assert_eq!(border.height, Some(5));
        assert_eq!(border.line, CellBorderLine::default());

        let border = vertical_borders.next().unwrap();
        assert_eq!(border.x, 6);
        assert_eq!(border.y, 1);
        assert_eq!(border.height, Some(5));
        assert_eq!(border.line, CellBorderLine::default());

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 5, 5, sheet_id_1));
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 11, sheet_id_2),
            js_clipboard,
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id_2);
        let borders = sheet.borders_in_sheet();
        let mut horizontal_borders = borders.horizontal.as_ref().unwrap().iter();
        let mut vertical_borders = borders.vertical.as_ref().unwrap().iter();

        let border = horizontal_borders.next().unwrap();
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 11);
        assert_eq!(border.width, Some(5));
        assert_eq!(border.line, CellBorderLine::default());

        let border = horizontal_borders.next().unwrap();
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 16);
        assert_eq!(border.width, Some(5));
        assert_eq!(border.line, CellBorderLine::default());

        let border = vertical_borders.next().unwrap();
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 11);
        assert_eq!(border.height, Some(5));
        assert_eq!(border.line, CellBorderLine::default());

        let border = vertical_borders.next().unwrap();
        assert_eq!(border.x, 6);
        assert_eq!(border.y, 11);
        assert_eq!(border.height, Some(5));
        assert_eq!(border.line, CellBorderLine::default());
    }

    #[test]
    fn test_paste_from_quadratic_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "1, 1", 1, 1);
        gc.set_bold(&A1Selection::test_a1("A1"), Some(true), None)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "12", 3, 2);
        gc.set_italic(&A1Selection::test_a1("C2"), Some(true), None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 3, 2, sheet_id));
        let JsClipboard { plain_text, .. } = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        assert_eq!(plain_text, String::from("1, 1\t\t\n\t\t12"));

        let selection = A1Selection::from_rect(SheetRect::new(0, 0, 3, 2, sheet_id));
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 2, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let cell11 = sheet.display_value(Pos { x: 2, y: 3 });
        assert_eq!(cell11.unwrap(), CellValue::Text(String::from("1, 1")));
        let cell21 = sheet.display_value(Pos { x: 4, y: 4 });
        assert_eq!(cell21.unwrap(), CellValue::Number(12.into()));
    }

    // | 1 | A1           |
    // | 2 | [paste here] |
    //
    // paste the code cell (2,1) => A1 from the clipboard to (2,2),
    // expect value to change to 2
    #[test]
    fn test_paste_relative_code_from_quadratic_clipboard() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let src_pos: Pos = (2, 1).into();

        set_formula_code_cell(&mut gc, sheet_id, "SUM(A1)", src_pos.x, src_pos.y);
        set_cell_value(&mut gc, sheet_id, "1", 1, 1);
        set_cell_value(&mut gc, sheet_id, "2", 1, 2);
        set_cell_value(&mut gc, sheet_id, "3", 1, 3);

        // generate the html from the values above
        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_rect(SheetRect::single_pos(src_pos, sheet_id));
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        let assert_code_cell =
            |gc: &mut GridController, dest_pos: SheetPos, code: &str, value: i32| {
                gc.paste_from_clipboard(
                    &A1Selection::from_xy(dest_pos.x, dest_pos.y, sheet_id),
                    js_clipboard.clone(),
                    PasteSpecial::None,
                    None,
                );

                assert_code_language(gc, dest_pos, CodeCellLanguage::Formula, code.into());
                assert_display(gc, dest_pos, &value.to_string());
            };

        // paste code cell (2,1) from the clipboard to (2,2)
        let dest_pos: SheetPos = (2, 2, sheet_id).into();
        assert_code_cell(&mut gc, dest_pos, "SUM(A2)", 2);

        // paste code cell (2,1) from the clipboard to (2,3)
        let dest_pos: SheetPos = (2, 3, sheet_id).into();
        assert_code_cell(&mut gc, dest_pos, "SUM(A3)", 3);
    }

    #[test]
    fn test_paste_with_range_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos = Pos::new(1, 1);

        set_cell_value(&mut gc, sheet_id, "1", pos.x, pos.y);
        set_cell_value(&mut gc, sheet_id, "2", pos.x, pos.y + 1);

        let selection = A1Selection::from_rect(SheetRect::from_numbers(
            pos.x,
            pos.y,
            pos.x,
            pos.y + 1,
            sheet_id,
        ));
        let js_clipboard: JsClipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        let paste_rect = SheetRect::new(pos.x + 1, pos.y, pos.x + 2, pos.y + 4, sheet_id);

        let assert_range_paste = |gc: &GridController| {
            print_table_in_rect(gc, sheet_id, Rect::new_span(pos, paste_rect.max));

            assert_cell_value(gc, sheet_id, 2, 1, 1.into());
            assert_cell_value(gc, sheet_id, 2, 2, 2.into());
            assert_cell_value(gc, sheet_id, 2, 3, 1.into());
            assert_cell_value(gc, sheet_id, 2, 4, 2.into());
            assert_cell_value(gc, sheet_id, 3, 1, 1.into());
            assert_cell_value(gc, sheet_id, 3, 2, 2.into());
            assert_cell_value(gc, sheet_id, 3, 3, 1.into());
            assert_cell_value(gc, sheet_id, 3, 4, 2.into());
        };

        // paste as html
        let paste_selection = A1Selection::from_rect(paste_rect);
        gc.paste_from_clipboard(
            &paste_selection,
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
        );
        assert_range_paste(&gc);

        // undo the paste and paste again as plain text
        gc.undo(None);
        gc.paste_from_clipboard(&paste_selection, js_clipboard, PasteSpecial::None, None);
        assert_range_paste(&gc);
    }

    #[test]
    fn test_paste_formula_with_range_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos = Pos::new(1, 1);

        set_cell_value(&mut gc, sheet_id, "1", 1, 1);
        set_cell_value(&mut gc, sheet_id, "2", 1, 2);
        set_cell_value(&mut gc, sheet_id, "3", 1, 3);
        set_formula_code_cell(&mut gc, sheet_id, "A1 + 1", 2, 1);

        let selection = A1Selection::from_xy(2, 1, sheet_id);
        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        let paste_rect = SheetRect::new(2, 2, 3, 3, sheet_id);

        // paste as html
        let paste_selection = A1Selection::from_rect(paste_rect);
        gc.paste_from_clipboard(&paste_selection, js_clipboard, PasteSpecial::None, None);

        print_table_in_rect(&gc, sheet_id, Rect::new_span(pos, paste_rect.max));
        assert_code_cell_value(&gc, sheet_id, 2, 2, "A2 + 1");
        assert_code_cell_value(&gc, sheet_id, 2, 3, "A3 + 1");
        assert_code_cell_value(&gc, sheet_id, 3, 2, "B2 + 1");
        assert_code_cell_value(&gc, sheet_id, 3, 3, "B3 + 1");
    }

    #[test]
    fn paste_special_values() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3}", 1, 1);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Number(3.into()))
        );

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 3, 1, sheet_id));
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(0, 2, sheet_id),
            js_clipboard,
            PasteSpecial::Values,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: 2 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(3.into()))
        );
    }

    #[test]
    fn paste_special_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "1", 2, 2);
        gc.set_bold(&A1Selection::test_a1("B2"), Some(true), None)
            .unwrap();

        set_cell_value(&mut gc, sheet_id, "12", 3, 3);
        gc.set_italic(&A1Selection::test_a1("C3"), Some(true), None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 3, 3, sheet_id));
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        assert_eq!(&js_clipboard.plain_text, "\t\t\n\t1\t\n\t\t12");

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard,
            PasteSpecial::Formats,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 2, y: 2 }), None);
        assert_eq!(sheet.display_value(Pos { x: 3, y: 3 }), None);
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 2, y: 2 }),
            CellFormatSummary {
                bold: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.cell_format_summary(Pos { x: 3, y: 3 }),
            CellFormatSummary {
                italic: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    fn copy_part_of_code_run() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3; 4, 5, 6}", 1, 1);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );

        // don't copy the origin point
        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_rect(SheetRect::new(2, 1, 3, 2, sheet_id));
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        // paste using html on a new grid controller
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            &A1Selection::from_xy(0, 0, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(2.into()))
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(Pos { x: 0, y: 0 }), None);
    }

    #[test]
    fn test_move_cells() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        set_formula_code_cell(&mut gc, sheet_id, "{1, 2, 3; 4, 5, 6}", 1, 1);
        set_cell_value(&mut gc, sheet_id, "100", 1, 3);

        gc.move_cells(
            SheetRect::new_pos_span(Pos { x: 1, y: 1 }, Pos { x: 3, y: 3 }, sheet_id),
            (11, 11, sheet_id).into(),
            false,
            false,
            None,
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

        gc.undo(None);

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
        let result = gc.move_code_cell_vertically(sheet_id, 1, 1, false, false, None);
        assert_eq!(result, Some(Pos { x: 1, y: 4 }));
        assert_cell_values(&gc, sheet_id, &[(1, 4, 1), (1, 5, 2), (1, 6, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (1, 2), (1, 3)]);

        // Move up
        let result = gc.move_code_cell_vertically(sheet_id, 1, 4, false, true, None);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (1, 2, 2), (1, 3, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 4), (1, 5), (1, 6)]);

        // Move to sheet end (down)
        set_cell_value(&mut gc, sheet_id, "obstacle", 1, 10);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 1, true, false, None);
        assert_eq!(result, Some(Pos { x: 1, y: 11 }));
        assert_cell_values(&gc, sheet_id, &[(1, 11, 1), (1, 12, 2), (1, 13, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (1, 2), (1, 3)]);

        // Move to sheet start (up)
        set_cell_value(&mut gc, sheet_id, "obstacle1", 1, 3);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 11, true, true, None);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (1, 2, 3)]);
        // assert_empty_cells(&gc, sheet_id, &[(1, 11), (1, 12), (1, 13)]);

        // Move when there's no code cell
        let result = gc.move_code_cell_vertically(sheet_id, 20, 20, false, false, None);
        assert_eq!(result, None);

        // Move down with obstacles
        set_cell_value(&mut gc, sheet_id, "obstacle2", 1, 4);
        set_cell_value(&mut gc, sheet_id, "obstacle3", 1, 5);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 1, false, false, None);
        assert_eq!(result, Some(Pos { x: 1, y: 6 }));
        assert_cell_values(&gc, sheet_id, &[(1, 6, 1), (1, 7, 2), (1, 8, 3)]);

        // Move up with obstacles
        let result = gc.move_code_cell_vertically(sheet_id, 1, 6, false, true, None);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (1, 2, 2), (1, 3, 3)]);

        // Move a single-cell code output
        set_formula_code_cell(&mut gc, sheet_id, "42", 1, 15);
        let result = gc.move_code_cell_vertically(sheet_id, 1, 15, false, false, None);
        assert_eq!(result, Some(Pos { x: 1, y: 16 }));
        assert_cell_values(&gc, sheet_id, &[(1, 16, 42)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 15)]);

        // Undo and redo
        gc.undo(None);
        assert_cell_values(&gc, sheet_id, &[(1, 15, 42)]);
        gc.redo(None);
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
        let result = gc.move_code_cell_horizontally(sheet_id, 1, 1, false, false, None);
        assert_eq!(result, Some(Pos { x: 4, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(4, 1, 1), (5, 1, 2), (6, 1, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (2, 1), (3, 1)]);

        // Move left
        let result = gc.move_code_cell_horizontally(sheet_id, 4, 1, false, true, None);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (2, 1, 2), (3, 1, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(4, 1), (5, 1), (6, 1)]);

        // Move to sheet end (right)
        set_cell_value(&mut gc, sheet_id, "obstacle", 10, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 1, 1, true, false, None);
        assert_eq!(result, Some(Pos { x: 11, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(11, 1, 1), (12, 1, 2), (13, 1, 3)]);
        assert_empty_cells(&gc, sheet_id, &[(1, 1), (2, 1), (3, 1)]);

        // Move to sheet start (left)
        set_cell_value(&mut gc, sheet_id, "obstacle1", 3, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 11, 1, true, true, None);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (2, 1, 2), (3, 1, 3)]);
        // assert_empty_cells(&gc, sheet_id, &[(11, 1), (12, 1), (13, 1)]);

        // Move when there's no code cell
        let result = gc.move_code_cell_horizontally(sheet_id, 20, 20, false, false, None);
        assert_eq!(result, None);

        // Move right with obstacles
        set_cell_value(&mut gc, sheet_id, "obstacle2", 4, 1);
        set_cell_value(&mut gc, sheet_id, "obstacle3", 5, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 1, 1, false, false, None);
        assert_eq!(result, Some(Pos { x: 6, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(6, 1, 1), (7, 1, 2), (8, 1, 3)]);

        // Move left with obstacles
        let result = gc.move_code_cell_horizontally(sheet_id, 6, 1, false, true, None);
        assert_eq!(result, Some(Pos { x: 1, y: 1 }));
        // Spill error!
        // assert_cell_values(&gc, sheet_id, &[(1, 1, 1), (2, 1, 2), (3, 1, 3)]);

        // Move a single-cell code output
        set_formula_code_cell(&mut gc, sheet_id, "42", 15, 1);
        let result = gc.move_code_cell_horizontally(sheet_id, 15, 1, false, false, None);
        assert_eq!(result, Some(Pos { x: 16, y: 1 }));
        assert_cell_values(&gc, sheet_id, &[(16, 1, 42)]);
        assert_empty_cells(&gc, sheet_id, &[(15, 1)]);

        // Undo and redo
        gc.undo(None);
        assert_cell_values(&gc, sheet_id, &[(15, 1, 42)]);
        gc.redo(None);
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
        );

        gc.set_code_cell(
            pos![D1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1");"#.to_string(),
            None,
            None,
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
        );

        assert_cell_values(&gc, sheet_id, &[(2, 2, 1)]);
        assert_code_cell_value(&gc, sheet_id, 2, 2, "A1");
        assert_code_cell_value(&gc, sheet_id, 3, 2, r#"q.cells("A1")"#);
        assert_code_cell_value(&gc, sheet_id, 4, 2, r#"return q.cells("A1");"#);
    }

    #[test]
    fn test_translate_code_cell_references_on_copy() {
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
        );

        gc.set_code_cell(
            pos![D1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1");"#.to_string(),
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::from_rect(SheetRect::new(2, 1, 4, 1, sheet_id));
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(2, 2, sheet_id),
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
        );

        assert_display_cell_value(&gc, sheet_id, 2, 2, "");
        assert_code_cell_value(&gc, sheet_id, 2, 2, "A2");
        assert_code_cell_value(&gc, sheet_id, 3, 2, r#"q.cells("A2")"#);
        assert_code_cell_value(&gc, sheet_id, 4, 2, r#"return q.cells("A2");"#);

        gc.paste_from_clipboard(
            &A1Selection::from_xy(1, 1, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
        );

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
}
