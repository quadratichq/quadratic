use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;
use crate::grid::formatting::CellFmtArray;
use crate::grid::{
    Bold, CellAlign, CellFmtAttr, CellVerticalAlign, CellWrap, FillColor, Italic, NumericDecimals,
    NumericFormat, StrikeThrough, TextColor, Underline,
};
use crate::{RunLengthEncoding, SheetPos, SheetRect};

impl GridController {
    pub fn set_cell_formats_for_type<A: CellFmtAttr>(
        &mut self,
        sheet_rect: &SheetRect,
        values: RunLengthEncoding<Option<A::Value>>,
    ) -> RunLengthEncoding<Option<A::Value>> {
        // todo: add better error handling for sheet removal
        let result = if let Some(sheet) = self.try_sheet_mut(sheet_rect.sheet_id) {
            sheet.set_cell_formats_for_type::<A>(sheet_rect, values)
        } else {
            RunLengthEncoding::new()
        };
        result
    }

    /// set currency type for a region
    /// this also resets NumericDecimals to 2
    pub fn set_currency(
        &mut self,
        sheet_rect: &SheetRect,
        symbol: Option<String>,
        cursor: Option<String>,
    ) {
        let ops = self.set_currency_operations(sheet_rect, symbol);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
    }

    /// Sets NumericFormat and NumericDecimals to None
    pub fn remove_number_formatting(&mut self, sheet_rect: &SheetRect, cursor: Option<String>) {
        let ops = self.remove_number_formatting_operations(sheet_rect);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
    }

    pub fn change_decimal_places(
        &mut self,
        source: SheetPos,
        sheet_rect: SheetRect,
        delta: isize,
        cursor: Option<String>,
    ) {
        let ops = self.change_decimal_places_operations(source, sheet_rect, delta);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
    }

    pub fn toggle_commas(
        &mut self,
        source: SheetPos,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) {
        let ops = self.toggle_commas_operations(source, sheet_rect);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
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
            ) {
                let attr =
                    $cell_fmt_array_constructor(RunLengthEncoding::repeat(value, sheet_rect.len()));
                let ops = vec![Operation::SetCellFormats { sheet_rect, attr }];
                self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
            }
        }
    };
}

impl_set_cell_fmt_method!(set_cell_align<CellAlign>(CellFmtArray::Align));
impl_set_cell_fmt_method!(set_cell_vertical_align<CellVerticalAlign>(CellFmtArray::VerticalAlign));
impl_set_cell_fmt_method!(set_cell_wrap<CellWrap>(CellFmtArray::Wrap));
impl_set_cell_fmt_method!(set_cell_numeric_format<NumericFormat>(CellFmtArray::NumericFormat));
impl_set_cell_fmt_method!(set_cell_numeric_decimals<NumericDecimals>(CellFmtArray::NumericDecimals));
impl_set_cell_fmt_method!(set_cell_bold<Bold>(CellFmtArray::Bold));
impl_set_cell_fmt_method!(set_cell_italic<Italic>(CellFmtArray::Italic));
impl_set_cell_fmt_method!(set_cell_text_color<TextColor>(CellFmtArray::TextColor));
impl_set_cell_fmt_method!(set_cell_fill_color<FillColor>(CellFmtArray::FillColor));
impl_set_cell_fmt_method!(set_cell_underline<Underline>(CellFmtArray::Underline));
impl_set_cell_fmt_method!(set_cell_strike_through<StrikeThrough>(CellFmtArray::StrikeThrough));

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use crate::controller::GridController;
    use crate::grid::formats::format::Format;
    use crate::grid::formats::format_update::FormatUpdate;
    use crate::grid::js_types::{JsNumber, JsRenderCell};
    use crate::grid::{CellAlign, SheetId, TextColor};
    use crate::{Pos, Rect, SheetPos, SheetRect};

    #[test]
    #[parallel]
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
    #[parallel]
    fn test_number_formatting() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "1234567.89".to_string(),
            None,
        );
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_format_cell(
            Pos { x: 0, y: 0 },
            &FormatUpdate {
                numeric_decimals: Some(Some(2)),
                ..Default::default()
            },
            false,
        );
        assert_eq!(
            sheet.format_cell(0, 0, false),
            Format {
                numeric_decimals: Some(2),
                ..Default::default()
            }
        );
        let cells = sheet.get_render_cells(Rect::new(0, 0, 0, 0));
        assert_eq!(
            &cells[0],
            &JsRenderCell {
                value: "1234567.89".into(),
                number: Some(JsNumber {
                    decimals: Some(2),
                    ..Default::default()
                }),
                align: Some(CellAlign::Right),
                ..Default::default()
            }
        );
    }

    #[test]
    #[parallel]
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
        assert_eq!(cells[0].value, "1.12345678");
        assert_eq!(cells[0].x, 0);
        assert_eq!(cells[0].y, 0);
        assert_eq!(
            cells[0].number,
            Some(JsNumber {
                decimals: Some(7),
                ..Default::default()
            })
        );
        assert_eq!(cells[1].value, "abcd");
        assert_eq!(cells[2].value, "0.12345678");

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

    // #[test]
    // #[parallel]
    // fn test_change_decimal_places_different_precision() {
    //     // The previous test checks that the decimal places are changed when all cells have the same precision.
    //     // However, the test does not cover the case where the cells have different precision.
    //     // This test checks that the decimal places are changed correctly when the cells have different precision.

    //     // setup
    //     let mut gc: GridController = GridController::test();
    //     let sheet_id = gc.sheet_ids()[0];

    //     let start_pos = Pos { x: 0, y: 0 };
    //     let end_pos = Pos { x: 0, y: 4 };

    //     let test_values = ["1", "1.2", "1.23", "1.234", "1.2345"];
    //     for (i, value) in test_values.iter().enumerate() {
    //         gc.set_cell_value(
    //             SheetPos {
    //                 x: start_pos.x,
    //                 y: start_pos.y + i as i64,
    //                 sheet_id,
    //             },
    //             value.to_string(),
    //             None,
    //         );
    //     }

    //     let expected_values_on_decrement = ["1", "1", "1", "1", "1"];
    //     gc.change_decimal_places(
    //         SheetPos::new(sheet_id, start_pos.x, start_pos.y),
    //         SheetRect::new_pos_span(start_pos, end_pos, sheet_id),
    //         -1,
    //         None,
    //     );
    //     let cells = gc
    //         .sheet(sheet_id)
    //         .get_render_cells(Rect::new_span(start_pos, end_pos));
    //     for (i, cell) in cells.iter().enumerate() {
    //         assert_eq!(cell.value, expected_values_on_decrement[i]);
    //     }

    //     let expected_values_on_increment = ["1.0", "1.2", "1.2", "1.2", "1.2"];
    //     gc.change_decimal_places(
    //         SheetPos::new(sheet_id, start_pos.x, start_pos.y),
    //         SheetRect::new_pos_span(start_pos, end_pos, sheet_id),
    //         1,
    //         None,
    //     );
    //     let cells = gc
    //         .sheet(sheet_id)
    //         .get_render_cells(Rect::new_span(start_pos, end_pos));
    //     for (i, cell) in cells.iter().enumerate() {
    //         assert_eq!(cell.value, expected_values_on_increment[i]);
    //     }

    //     let expected_values_on_5_increments =
    //         ["1.000000", "1.200000", "1.230000", "1.234000", "1.234500"];
    //     gc.change_decimal_places(
    //         SheetPos::new(sheet_id, start_pos.x, start_pos.y),
    //         SheetRect::new_pos_span(start_pos, end_pos, sheet_id),
    //         5,
    //         None,
    //     );
    //     let cells = gc
    //         .sheet(sheet_id)
    //         .get_render_cells(Rect::new_span(start_pos, end_pos));
    //     for (i, cell) in cells.iter().enumerate() {
    //         assert_eq!(cell.value, expected_values_on_5_increments[i]);
    //     }
    // }

    #[test]
    #[parallel]
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
        assert_eq!(cells[0].value, "1.12345678");
        assert_eq!(cells[0].number, Some(JsNumber::dollars()));

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
}
