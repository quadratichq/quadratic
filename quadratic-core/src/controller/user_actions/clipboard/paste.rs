use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::clipboard::{Clipboard, PasteSpecial};
use crate::grid::js_types::JsClipboard;

impl GridController {
    /// using a selection, paste the contents from the clipboard on the grid
    #[function_timer::function_timer]
    pub fn paste_from_clipboard(
        &mut self,
        selection: &A1Selection,
        js_clipboard: JsClipboard,
        special: PasteSpecial,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let rect = selection.largest_rect_finite(self.a1_context());
        let insert_at = rect.min;
        let end_pos = rect.max;

        // first try html
        if let Ok(clipboard) = Clipboard::decode(&js_clipboard.html)
            && let Ok((ops, data_table_ops)) =
                self.paste_html_operations(insert_at, end_pos, selection, clipboard, special)
        {
            self.start_user_ai_transaction(
                ops,
                cursor.clone(),
                TransactionName::PasteClipboard,
                is_ai,
            );

            if !data_table_ops.is_empty() {
                self.start_user_ai_transaction(
                    data_table_ops,
                    cursor,
                    TransactionName::PasteClipboard,
                    is_ai,
                );
            }
        } else if let Ok(ops) = self.paste_plain_text_operations(
            insert_at.to_sheet_pos(selection.sheet_id),
            end_pos,
            selection,
            js_clipboard.plain_text,
            special,
        ) {
            self.start_user_ai_transaction(ops, cursor, TransactionName::PasteClipboard, is_ai);
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::controller::operations::clipboard::ClipboardOperation;
    use crate::controller::transaction_types::{JsCellValueResult, JsCodeResult};
    use crate::controller::user_actions::import::tests::simple_csv_at;
    use crate::grid::js_types::JsClipboard;
    use crate::grid::sheet::borders::{BorderSelection, BorderSide, BorderStyle, CellBorderLine};
    use crate::grid::sort::SortDirection;
    use crate::test_util::{assert_code_cell_value, assert_display_cell_value};
    use crate::{Array, assert_cell_value, print_table_in_rect};
    use crate::{
        CellValue, Pos, SheetPos, SheetRect,
        controller::GridController,
        grid::{CodeCellLanguage, SheetId, js_types::CellFormatSummary},
    };
    use crate::{Rect, test_util::*};

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

    #[test]
    fn test_copy_to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        set_cell_value(&mut gc, sheet_id, "2, 2", 2, 2);
        gc.set_bold(&A1Selection::test_a1("B2"), Some(true), None, false)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "12", 4, 3);
        gc.set_italic(&A1Selection::test_a1("D3"), Some(true), None, false)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "underline", 6, 4);
        gc.set_underline(&A1Selection::test_a1("F4"), Some(true), None, false)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "strike through", 8, 5);
        gc.set_strike_through(&A1Selection::test_a1("H5"), Some(true), None, false)
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
            false,
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
            false,
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
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        set_formula_code_cell(&mut gc, sheet_id, "1 + 1", 1, 1);
        assert_display(&gc, pos![sheet_id!A1], "2");

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::test_a1("A1");
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        // paste using html on a new grid controller
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            &A1Selection::test_a1("A1"),
            js_clipboard.clone(),
            PasteSpecial::None,
            None,
            false,
        );
        assert_display(&gc, pos![sheet_id!A1], "2");

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(pos![A1]), None);

        // prepare a cell to be overwritten
        set_formula_code_cell(&mut gc, sheet_id, "2 + 2", 1, 1);
        assert_eq!(gc.undo_stack.len(), 1);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(4.into()))
        );

        gc.paste_from_clipboard(
            &A1Selection::test_a1("A1"),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        assert_display(&gc, pos![sheet_id!A1], "2");

        assert_eq!(gc.undo_stack.len(), 2);

        // undo to original code cell value
        gc.undo(1, None, false);

        assert_display(&gc, pos![sheet_id!A1], "4");

        assert_eq!(gc.undo_stack.len(), 1);

        // empty code cell
        gc.undo(1, None, false);
        assert_display(&gc, pos![sheet_id!A1], "");

        assert!(gc.sheet(sheet_id).data_tables.is_empty());
        assert_eq!(gc.undo_stack.len(), 0);
    }

    #[test]
    fn test_array_output_copy_code_to_clipboard() {
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
            false,
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

        gc.undo(1, None, false);
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
            false,
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
            false,
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

        gc.add_sheet(None, None, None, false);
        let sheet_id_2 = gc.sheet_ids()[1];

        gc.set_borders(
            A1Selection::from_rect(SheetRect::new(1, 1, 5, 5, sheet_id_1)),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
            false,
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
            false,
        );

        let sheet = gc.sheet(sheet_id_2);
        let borders = sheet.borders_in_sheet();
        dbg!(&borders);
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
        gc.set_bold(&A1Selection::test_a1("A1"), Some(true), None, false)
            .unwrap();
        set_cell_value(&mut gc, sheet_id, "12", 3, 2);
        gc.set_italic(&A1Selection::test_a1("C2"), Some(true), None, false)
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
            false,
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
                    false,
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
            false,
        );
        assert_range_paste(&gc);

        // undo the paste and paste again as plain text
        gc.undo(1, None, false);
        gc.paste_from_clipboard(
            &paste_selection,
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );
        assert_range_paste(&gc);
    }

    #[test]
    fn test_paste_formula_with_range_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!A1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "2".into(), None, false);
        gc.set_cell_value(pos![sheet_id!A3], "3".into(), None, false);
        gc.set_code_cell(
            pos![sheet_id!B1],
            CodeCellLanguage::Formula,
            "A1 + 1".to_string(),
            None,
            None,
            false,
        );

        let selection = A1Selection::test_a1("B1");
        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        // paste as html
        let paste_selection = A1Selection::test_a1("B2:C3");
        gc.paste_from_clipboard(
            &paste_selection,
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        assert_code(&gc, pos![sheet_id!B2], "A2 + 1");
        assert_code(&gc, pos![sheet_id!B3], "A3 + 1");
        assert_code(&gc, pos![sheet_id!C2], "B2 + 1");
        assert_code(&gc, pos![sheet_id!C3], "B3 + 1");
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
            false,
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
        gc.set_bold(&A1Selection::test_a1("B2"), Some(true), None, false)
            .unwrap();

        set_cell_value(&mut gc, sheet_id, "12", 3, 3);
        gc.set_italic(&A1Selection::test_a1("C3"), Some(true), None, false)
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
            false,
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
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

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
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // ensure the grid controller is empty
        assert_eq!(gc.undo_stack.len(), 0);

        gc.paste_from_clipboard(
            &A1Selection::test_a1("A1"),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![A1]),
            Some(CellValue::Number(2.into()))
        );

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(pos![A1]), None);
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
}
