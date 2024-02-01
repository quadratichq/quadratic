use crate::controller::{
    operations::operation::Operation, transaction_summary::TransactionSummary, GridController,
};
use crate::{
    grid::{
        formatting::CellFmtArray, Bold, CellAlign, CellFmtAttr, CellWrap, FillColor, Italic,
        NumericCommas, NumericDecimals, NumericFormat, RenderSize, TextColor,
    },
    Pos, RunLengthEncoding, SheetPos, SheetRect,
};

impl GridController {
    pub fn set_cell_formats_for_type<A: CellFmtAttr>(
        &mut self,
        sheet_rect: &SheetRect,
        values: RunLengthEncoding<Option<A::Value>>,
    ) -> RunLengthEncoding<Option<A::Value>> {
        // todo: add better error handling for sheet removal
        if let Some(sheet) = self.try_sheet_mut(sheet_rect.sheet_id) {
            sheet.set_cell_formats_for_type::<A>(sheet_rect, values)
        } else {
            RunLengthEncoding::new()
        }
    }

    /// set currency type for a region
    /// this also resets NumericDecimals to 2
    pub fn set_currency(
        &mut self,
        sheet_rect: &SheetRect,
        symbol: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_currency_operations(sheet_rect, symbol);
        self.start_user_transaction(ops, cursor)
    }

    /// Sets NumericFormat and NumericDecimals to None
    pub fn remove_number_formatting(
        &mut self,
        sheet_rect: &SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.remove_number_formatting_operations(sheet_rect);
        self.start_user_transaction(ops, cursor)
    }

    pub fn change_decimal_places(
        &mut self,
        source: SheetPos,
        sheet_rect: SheetRect,
        delta: isize,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.change_decimal_places_operations(source, sheet_rect, delta);
        self.start_user_transaction(ops, cursor)
    }

    pub fn toggle_commas(
        &mut self,
        source: SheetPos,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.toggle_commas_operations(source, sheet_rect);
        self.start_user_transaction(ops, cursor)
    }

    pub fn get_all_cell_formats(&self, sheet_rect: SheetRect) -> Vec<CellFmtArray> {
        let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) else {
            return vec![];
        };
        let mut cell_formats = vec![
            CellFmtArray::Align(RunLengthEncoding::new()),
            CellFmtArray::Wrap(RunLengthEncoding::new()),
            CellFmtArray::NumericFormat(RunLengthEncoding::new()),
            CellFmtArray::NumericDecimals(RunLengthEncoding::new()),
            CellFmtArray::NumericCommas(RunLengthEncoding::new()),
            CellFmtArray::Bold(RunLengthEncoding::new()),
            CellFmtArray::Italic(RunLengthEncoding::new()),
            CellFmtArray::TextColor(RunLengthEncoding::new()),
            CellFmtArray::FillColor(RunLengthEncoding::new()),
        ];
        for y in sheet_rect.y_range() {
            for x in sheet_rect.x_range() {
                let pos = Pos { x, y };
                cell_formats.iter_mut().for_each(|array| match array {
                    CellFmtArray::Align(array) => {
                        array.push(sheet.get_formatting_value::<CellAlign>(pos));
                    }
                    CellFmtArray::Wrap(array) => {
                        array.push(sheet.get_formatting_value::<CellWrap>(pos));
                    }
                    CellFmtArray::NumericFormat(array) => {
                        array.push(sheet.get_formatting_value::<NumericFormat>(pos));
                    }
                    CellFmtArray::NumericDecimals(array) => {
                        array.push(sheet.get_formatting_value::<NumericDecimals>(pos));
                    }
                    CellFmtArray::NumericCommas(array) => {
                        array.push(sheet.get_formatting_value::<NumericCommas>(pos));
                    }
                    CellFmtArray::Bold(array) => {
                        array.push(sheet.get_formatting_value::<Bold>(pos));
                    }
                    CellFmtArray::Italic(array) => {
                        array.push(sheet.get_formatting_value::<Italic>(pos));
                    }
                    CellFmtArray::TextColor(array) => {
                        array.push(sheet.get_formatting_value::<TextColor>(pos));
                    }
                    CellFmtArray::FillColor(array) => {
                        array.push(sheet.get_formatting_value::<FillColor>(pos));
                    }
                    CellFmtArray::RenderSize(array) => {
                        array.push(sheet.get_formatting_value::<RenderSize>(pos));
                    }
                });
            }
        }
        cell_formats
    }
}

macro_rules! impl_set_cell_fmt_method {
    ($method_name:ident<$cell_fmt_attr_type:ty>($cell_fmt_array_constructor:expr)) => {
        impl GridController {
            pub fn $method_name(
                &mut self,
                sheet_rect: SheetRect,
                value: Option<<$cell_fmt_attr_type as CellFmtAttr>::Value>,
                cursor: Option<String>,
            ) -> TransactionSummary {
                let attr =
                    $cell_fmt_array_constructor(RunLengthEncoding::repeat(value, sheet_rect.len()));
                let ops = vec![Operation::SetCellFormats { sheet_rect, attr }];
                self.start_user_transaction(ops, cursor)
            }
        }
    };
}

impl_set_cell_fmt_method!(set_cell_align<CellAlign>(CellFmtArray::Align));
impl_set_cell_fmt_method!(set_cell_wrap<CellWrap>(CellFmtArray::Wrap));
impl_set_cell_fmt_method!(set_cell_numeric_format<NumericFormat>(CellFmtArray::NumericFormat));
impl_set_cell_fmt_method!(set_cell_numeric_decimals<NumericDecimals>(CellFmtArray::NumericDecimals));
impl_set_cell_fmt_method!(set_cell_bold<Bold>(CellFmtArray::Bold));
impl_set_cell_fmt_method!(set_cell_italic<Italic>(CellFmtArray::Italic));
impl_set_cell_fmt_method!(set_cell_text_color<TextColor>(CellFmtArray::TextColor));
impl_set_cell_fmt_method!(set_cell_fill_color<FillColor>(CellFmtArray::FillColor));
impl_set_cell_fmt_method!(set_cell_render_size<RenderSize>(CellFmtArray::RenderSize));

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController,
        grid::{RenderSize, SheetId, TextColor},
        Pos, Rect, SheetPos, SheetRect,
    };

    #[test]
    fn test_set_cell_text_color_undo_redo() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos1 = Pos { x: 3, y: 6 };
        let pos2 = Pos { x: 5, y: 8 };
        let pos3 = Pos { x: 9, y: 6 };
        let rect1 = SheetRect::new_pos_span(pos1, pos2, sheet_id);
        let rect2 = SheetRect::new_pos_span(pos2, pos3, sheet_id);

        let get = |g: &GridController, pos: crate::Pos| {
            g.sheet(sheet_id)
                .get_formatting_value::<TextColor>(pos)
                .unwrap_or_default()
        };

        assert_eq!(get(&gc, pos1), "");
        assert_eq!(get(&gc, pos2), "");
        assert_eq!(get(&gc, pos3), "");

        gc.set_cell_text_color(rect1, Some("blue".to_string()), None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "blue");
        assert_eq!(get(&gc, pos3), "");

        gc.set_cell_text_color(rect2, Some("red".to_string()), None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "red");
        assert_eq!(get(&gc, pos3), "red");

        gc.undo(None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "blue");
        assert_eq!(get(&gc, pos3), "");

        gc.undo(None);
        assert_eq!(get(&gc, pos1), "");
        assert_eq!(get(&gc, pos2), "");
        assert_eq!(get(&gc, pos3), "");

        gc.redo(None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "blue");
        assert_eq!(get(&gc, pos3), "");

        gc.redo(None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "red");
        assert_eq!(get(&gc, pos3), "red");

        // delete and redo
        gc.delete_cells_rect(rect1, None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "red");
        assert_eq!(get(&gc, pos3), "red");

        gc.clear_formatting(rect1, None);
        assert_eq!(get(&gc, pos1), "");
        assert_eq!(get(&gc, pos2), "");
        assert_eq!(get(&gc, pos3), "red");

        gc.undo(None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "red");
        assert_eq!(get(&gc, pos3), "red");

        gc.redo(None);
        assert_eq!(get(&gc, pos1), "");
        assert_eq!(get(&gc, pos2), "");
        assert_eq!(get(&gc, pos3), "red");

        // ensure not found sheet_id fails silently
        gc.set_cell_text_color(
            SheetRect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 0, y: 0 },
                sheet_id: SheetId::new(),
            },
            Some("red".to_string()),
            None,
        );
    }

    #[test]
    fn test_render_fill() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_fill_color(
            SheetRect {
                min: crate::Pos { x: 1, y: 1 },
                max: crate::Pos { x: 10, y: 10 },
                sheet_id,
            },
            Some("blue".to_string()),
            None,
        );
        gc.set_cell_fill_color(
            SheetRect {
                min: crate::Pos { x: 1, y: 15 },
                max: crate::Pos { x: 10, y: 20 },
                sheet_id,
            },
            Some("blue".to_string()),
            None,
        );
        gc.set_cell_fill_color(
            SheetRect {
                min: crate::Pos { x: 1, y: 10 },
                max: crate::Pos { x: 10, y: 15 },
                sheet_id,
            },
            Some("blue".to_string()),
            None,
        );
        let render_fills = gc.sheet(sheet_id).get_render_fills(Rect {
            min: crate::Pos { x: -100, y: -100 },
            max: crate::Pos { x: 100, y: 100 },
        });
        assert_eq!(10, render_fills.len());

        // ensure not found sheet_id fails silently
        gc.set_cell_fill_color(
            SheetRect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 0, y: 0 },
                sheet_id: SheetId::new(),
            },
            Some("red".to_string()),
            None,
        );
    }

    #[test]
    fn test_change_decimal_places() {
        // setup
        let mut gc: GridController = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            String::from("1.12345678"),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            String::from("0.12345678"),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            String::from("abcd"),
            None,
        );
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }));
        assert_eq!(cells.len(), 3);
        assert_eq!(cells[0].value, "1.12345678");
        assert_eq!(cells[1].value, "abcd");
        assert_eq!(cells[2].value, "0.12345678");

        // delta: -1 for two cells
        gc.change_decimal_places(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            SheetRect::new_pos_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }, sheet_id),
            -1,
            None,
        );
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }));
        assert_eq!(cells.len(), 3);
        assert_eq!(cells[0].value, "1.1234568");
        assert_eq!(cells[1].value, "abcd");
        assert_eq!(cells[2].value, "0.1234568");

        // delta +1 for two cells
        gc.change_decimal_places(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            SheetRect::new_pos_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }, sheet_id),
            1,
            None,
        );
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }));
        assert_eq!(cells.len(), 3);
        assert_eq!(cells[0].value, "1.12345678");
        assert_eq!(cells[1].value, "abcd");
        assert_eq!(cells[2].value, "0.12345678");

        // ensure not found sheet_id fails silently
        let sheet_id = SheetId::new();
        gc.change_decimal_places(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id),
            2,
            None,
        );
    }

    #[test]
    fn test_set_currency() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            String::from("1.12345678"),
            None,
        );
        gc.set_currency(
            &SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id),
            Some("$".to_string()),
            None,
        );
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }));
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].value, "$1.12");

        // ensure not found sheet_id fails silently
        gc.set_currency(
            &SheetRect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 0, y: 0 },
                sheet_id: SheetId::new(),
            },
            Some("$".to_string()),
            None,
        );
    }

    #[test]
    fn test_set_output_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_render_size(
            SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id),
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            None,
        );
    }

    #[test]
    fn test_remove_formatting() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            String::from("1.12345678"),
            None,
        );
        gc.set_currency(
            &SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id),
            Some("$".to_string()),
            None,
        );
        gc.clear_formatting(SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id), None);
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }));
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].value, "1.12345678");

        // ensure not found sheet_id fails silently
        gc.clear_formatting(
            SheetRect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 0, y: 0 },
                sheet_id: SheetId::new(),
            },
            None,
        );
    }

    #[test]
    fn test_set_cell_render_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_render_size(
            SheetRect::single_pos(Pos { x: 0, y: 0 }, sheet_id),
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_formatting_value::<RenderSize>(Pos { x: 0, y: 0 }),
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string()
            })
        );

        // ensure not found sheet_id fails silently
        gc.set_cell_render_size(
            SheetRect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 0, y: 0 },
                sheet_id: SheetId::new(),
            },
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            None,
        );
    }
}
