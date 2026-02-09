use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::grid::js_types::JsClipboard;

impl GridController {
    /// using a selection, cut the contents on the grid to the clipboard
    pub fn cut_to_clipboard(
        &mut self,
        selection: &A1Selection,
        include_display_values: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<JsClipboard, String> {
        match self.cut_to_clipboard_operations(selection, include_display_values) {
            Ok((clipboard, ops)) => {
                self.start_user_ai_transaction(ops, cursor, TransactionName::CutClipboard, is_ai);
                Ok(clipboard.into())
            }
            _ => Err("Failed to cut to clipboard".into()),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::controller::operations::clipboard::ClipboardOperation;
    use crate::grid::{CodeCellLanguage, SheetId};
    use crate::test_util::assert_code_cell_value;
    use crate::{CellValue, Pos, SheetPos, SheetRect};

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

        use crate::controller::operations::clipboard::PasteSpecial;
        // paste_from_clipboard is re-exported from mod.rs, so it's accessible
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
}
