use indexmap::IndexMap;

use crate::a1::{A1Context, A1Selection, CellRefRange};
use crate::cell_values::CellValues;
use crate::controller::operations::clipboard::{Clipboard, ClipboardOperation, ClipboardOrigin};
use crate::grid::Sheet;
use crate::{CellValue, Pos};

impl Sheet {
    /// Copies the selection to the clipboard.
    ///
    /// Returns the copied SheetRect, plain text, and html.
    #[function_timer::function_timer]
    pub fn copy_to_clipboard(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
        clipboard_operation: ClipboardOperation,
        include_display_values: bool,
    ) -> Clipboard {
        let mut origin = ClipboardOrigin::default(selection.sheet_id);
        let mut w = 0;
        let mut h = 0;

        let sheet_bounds = self.selection_bounds(selection, true, true, false, a1_context);
        if let Some(bounds) = sheet_bounds {
            origin.x = bounds.min.x;
            origin.y = bounds.min.y;
            w = bounds.width();
            h = bounds.height();
        }

        // Cell values
        let mut cells = Some(CellValues::default());

        // Display values
        let mut values = if include_display_values {
            Some(CellValues::default())
        } else {
            None
        };

        if cells.is_some() || values.is_some() {
            for range in selection.ranges.iter() {
                match range {
                    CellRefRange::Sheet { range } => {
                        let rect = self.ref_range_bounds_to_rect(range, true);
                        for y in rect.y_range() {
                            for x in rect.x_range() {
                                let pos = Pos { x, y };

                                let new_x = (pos.x - origin.x) as u32;
                                let new_y = (pos.y - origin.y) as u32;

                                // create quadratic clipboard values
                                if let Some(cells) = cells.as_mut() {
                                    let cell_value =
                                        self.cell_value(pos).unwrap_or(CellValue::Blank);
                                    cells.set(new_x, new_y, cell_value);
                                }

                                // create quadratic clipboard value-only for PasteSpecial::Values
                                if let Some(values) = values.as_mut() {
                                    let display_value =
                                        self.display_value(pos).unwrap_or(CellValue::Blank);
                                    values.set(new_x, new_y, display_value);
                                }
                            }
                        }
                    }
                    CellRefRange::Table { .. } => (),
                }
            }
        }

        let mut data_tables = IndexMap::new();
        if let Some(bounds) = sheet_bounds {
            let include_code_table_values = matches!(clipboard_operation, ClipboardOperation::Cut);
            let data_tables_in_rect = self.data_tables_and_cell_values_in_rect(
                &bounds,
                include_code_table_values,
                a1_context,
                Some(selection),
                &mut cells,
                &mut values,
            );
            data_tables.extend(data_tables_in_rect);
        }

        Clipboard {
            origin,
            selection: selection.clone(),
            w,
            h,
            cells: cells.unwrap_or_default(),
            values: values.unwrap_or_default(),
            formats: self.formats.to_clipboard(selection, self, a1_context).ok(),
            borders: self.borders.to_clipboard(selection),
            validations: self
                .validations
                .to_clipboard(selection, &origin, a1_context),
            data_tables,
            operation: clipboard_operation,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Pos;
    use crate::controller::GridController;
    use crate::controller::operations::clipboard::PasteSpecial;
    use crate::controller::user_actions::import::tests::simple_csv;
    use crate::grid::js_types::JsClipboard;
    use crate::grid::sheet::borders::{BorderSelection, BorderStyle, CellBorderLine};

    #[test]
    fn copy_to_clipboard_exclude() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(0, 0, 4, 1, vec!["1", "2", "3", "4"]);

        let selection = A1Selection::test_a1("A1,C1:C2");
        let sheet = gc.sheet(sheet_id);
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(0, 5, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.cell_value(Pos { x: 1, y: 5 }).is_none());
    }

    #[test]
    fn clipboard_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let js_clipboard = sheet
            .copy_to_clipboard(
                &A1Selection::test_a1("A1"),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("B2"),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let border = sheet.borders.get_style_cell(pos![B2]);
        assert_eq!(border.top.unwrap().line, CellBorderLine::default());
        assert_eq!(border.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(border.left.unwrap().line, CellBorderLine::default());
        assert_eq!(border.right.unwrap().line, CellBorderLine::default());
    }

    #[test]
    fn clipboard_formats() {
        let (mut gc, sheet_id, _, _) = simple_csv();
        let get_format = |pos: Pos, clipboard: &Clipboard| {
            clipboard
                .formats
                .clone()
                .unwrap()
                .bold
                .unwrap()
                .get(pos)
                .unwrap()
        };
        let set_bold = |gc: &mut GridController, pos: &str| {
            gc.set_bold(
                &A1Selection::test_a1_sheet_id(pos, sheet_id),
                Some(true),
                None,
                false,
            )
            .unwrap();
        };
        let set_clipboard = |gc: &mut GridController, pos: &str| {
            let context = gc.a1_context().to_owned();
            let JsClipboard { html, .. } = gc
                .sheet_mut(sheet_id)
                .copy_to_clipboard(
                    &A1Selection::test_a1(pos),
                    &context,
                    ClipboardOperation::Copy,
                    true,
                )
                .into();

            Clipboard::decode(&html).unwrap()
        };

        // format on the sheet at k1
        set_bold(&mut gc, "K1");
        let clipboard = set_clipboard(&mut gc, "K1");
        assert!(get_format(pos![K1], &clipboard).unwrap());

        // format on a data table at A3
        set_bold(&mut gc, "A3");
        let clipboard = set_clipboard(&mut gc, "A3");
        assert!(get_format(pos![A3], &clipboard).unwrap());
    }
}
