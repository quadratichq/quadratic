use std::collections::HashSet;

use crate::{
    grid::{
        Bold, CellAlign, CellFmtAttr, CellWrap, FillColor, Italic, NumericCommas, NumericDecimals,
        NumericFormat, NumericFormatKind, RegionRef, SheetId, TextColor,
    },
    Pos, Rect, RunLengthEncoding,
};
use serde::{Deserialize, Serialize};

use super::{
    operation::Operation,
    transaction_summary::{CellSheetsModified, TransactionSummary},
    transactions::TransactionType,
    GridController,
};

impl GridController {
    pub fn set_cell_formats_for_type<A: CellFmtAttr>(
        &mut self,
        region: &RegionRef,
        values: RunLengthEncoding<Option<A::Value>>,
        cell_sheets_modified: Option<&mut HashSet<CellSheetsModified>>,
    ) -> RunLengthEncoding<Option<A::Value>> {
        let sheet = self.grid.sheet_mut_from_id(region.sheet);
        // TODO: optimize this for contiguous runs of the same value
        let mut old_values = RunLengthEncoding::new();
        for (cell_ref, value) in region.iter().zip(values.iter_values()) {
            let old_value = sheet
                .cell_ref_to_pos(cell_ref)
                .and_then(|pos| sheet.set_formatting_value::<A>(pos, value.clone()));
            old_values.push(old_value);
        }
        if let Some(cell_sheets_modified) = cell_sheets_modified {
            CellSheetsModified::add_region(cell_sheets_modified, sheet, region);
        }
        old_values
    }

    /// set currency type for a region
    /// this also resets NumericDecimals to 2
    pub fn set_currency(
        &mut self,
        sheet_id: SheetId,
        rect: &Rect,
        symbol: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let region = self.grid_mut().sheet_mut_from_id(sheet_id).region(*rect);
        let ops = vec![
            Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol,
                    }),
                    region.len(),
                )),
            },
            Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(
                    Some(2),
                    region.len(),
                )),
            },
        ];
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }

    /// Sets NumericFormat and NumericDecimals to None
    pub fn remove_number_formatting(
        &mut self,
        sheet_id: SheetId,
        rect: &Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let region = self.grid_mut().sheet_mut_from_id(sheet_id).region(*rect);
        let ops = vec![
            Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(None, region.len())),
            },
            Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(None, region.len())),
            },
            Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericCommas(RunLengthEncoding::repeat(None, region.len())),
            },
        ];
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }

    // todo: should also check the results of spills
    pub fn change_decimal_places(
        &mut self,
        sheet_id: SheetId,
        source: Pos,
        rect: Rect,
        delta: isize,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.sheet(sheet_id);
        let is_percentage =
            sheet.cell_numeric_format_kind(source) == Some(NumericFormatKind::Percentage);
        let decimals = sheet.decimal_places(source, is_percentage).unwrap_or(0);
        if decimals + (delta as i16) < 0 {
            return TransactionSummary::default();
        }
        let region = self.region(sheet_id, rect);
        let numeric_decimals = Some(decimals + delta as i16);
        let ops = vec![Operation::SetCellFormats {
            region: region.clone(),
            attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(
                numeric_decimals,
                region.len(),
            )),
        }];
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }

    pub fn toggle_commas(
        &mut self,
        sheet_id: SheetId,
        source: Pos,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.sheet(sheet_id);
        let commas = if let Some(commas) = sheet.get_formatting_value::<NumericCommas>(source) {
            !commas
        } else {
            true
        };
        let region = self.region(sheet_id, rect);
        let ops = vec![Operation::SetCellFormats {
            region: region.clone(),
            attr: CellFmtArray::NumericCommas(RunLengthEncoding::repeat(
                Some(commas),
                region.len(),
            )),
        }];
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }

    pub fn get_all_cell_formats(&self, sheet_id: SheetId, rect: Rect) -> Vec<CellFmtArray> {
        let sheet = self.sheet(sheet_id);
        let mut cell_formats = vec![
            CellFmtArray::Align(RunLengthEncoding::new()),
            CellFmtArray::Wrap(RunLengthEncoding::new()),
            CellFmtArray::NumericFormat(RunLengthEncoding::new()),
            CellFmtArray::NumericDecimals(RunLengthEncoding::new()),
            CellFmtArray::Bold(RunLengthEncoding::new()),
            CellFmtArray::Italic(RunLengthEncoding::new()),
            CellFmtArray::TextColor(RunLengthEncoding::new()),
            CellFmtArray::FillColor(RunLengthEncoding::new()),
        ];
        for y in rect.y_range() {
            for x in rect.x_range() {
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
                sheet_id: SheetId,
                rect: Rect,
                value: Option<<$cell_fmt_attr_type as CellFmtAttr>::Value>,
                cursor: Option<String>,
            ) -> TransactionSummary {
                let region = self.region(sheet_id, rect);
                let attr =
                    $cell_fmt_array_constructor(RunLengthEncoding::repeat(value, region.len()));
                let ops = vec![Operation::SetCellFormats { region, attr }];
                self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
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

/// Array of a single cell formatting attribute.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum CellFmtArray {
    Align(RunLengthEncoding<Option<CellAlign>>),
    Wrap(RunLengthEncoding<Option<CellWrap>>),
    NumericFormat(RunLengthEncoding<Option<NumericFormat>>),
    NumericDecimals(RunLengthEncoding<Option<i16>>),
    NumericCommas(RunLengthEncoding<Option<bool>>),
    Bold(RunLengthEncoding<Option<bool>>),
    Italic(RunLengthEncoding<Option<bool>>),
    TextColor(RunLengthEncoding<Option<String>>),
    FillColor(RunLengthEncoding<Option<String>>),
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, grid::TextColor, Pos, Rect};

    #[test]
    fn test_set_cell_text_color_undo_redo() {
        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos1 = Pos { x: 3, y: 6 };
        let pos2 = Pos { x: 5, y: 8 };
        let pos3 = Pos { x: 9, y: 6 };
        let rect1 = Rect::new_span(pos1, pos2);
        let rect2 = Rect::new_span(pos2, pos3);

        let get = |g: &GridController, pos: crate::Pos| {
            g.sheet(sheet_id)
                .get_formatting_value::<TextColor>(pos)
                .unwrap_or_default()
        };

        assert_eq!(get(&gc, pos1), "");
        assert_eq!(get(&gc, pos2), "");
        assert_eq!(get(&gc, pos3), "");

        gc.set_cell_text_color(sheet_id, rect1, Some("blue".to_string()), None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "blue");
        assert_eq!(get(&gc, pos3), "");

        gc.set_cell_text_color(sheet_id, rect2, Some("red".to_string()), None);
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
        gc.delete_cell_values(sheet_id, rect1, None);
        assert_eq!(get(&gc, pos1), "blue");
        assert_eq!(get(&gc, pos2), "red");
        assert_eq!(get(&gc, pos3), "red");

        gc.clear_formatting(sheet_id, rect1, None);
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
    }

    #[test]
    fn test_render_fill() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_fill_color(
            sheet_id,
            Rect {
                min: crate::Pos { x: 1, y: 1 },
                max: crate::Pos { x: 10, y: 10 },
            },
            Some("blue".to_string()),
            None,
        );
        gc.set_cell_fill_color(
            sheet_id,
            Rect {
                min: crate::Pos { x: 1, y: 15 },
                max: crate::Pos { x: 10, y: 20 },
            },
            Some("blue".to_string()),
            None,
        );
        gc.set_cell_fill_color(
            sheet_id,
            Rect {
                min: crate::Pos { x: 1, y: 10 },
                max: crate::Pos { x: 10, y: 15 },
            },
            Some("blue".to_string()),
            None,
        );
        let render_fills = gc.sheet(sheet_id).get_render_fills(Rect {
            min: crate::Pos { x: -100, y: -100 },
            max: crate::Pos { x: 100, y: 100 },
        });
        assert_eq!(10, render_fills.len());
    }

    #[test]
    fn test_change_decimal_places() {
        // setup
        let mut gc: GridController = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            sheet_id,
            Pos { x: 0, y: 0 },
            String::from("1.12345678"),
            None,
        );
        gc.set_cell_value(
            sheet_id,
            Pos { x: 1, y: 0 },
            String::from("0.12345678"),
            None,
        );
        gc.set_cell_value(sheet_id, Pos { x: 0, y: 1 }, String::from("abcd"), None);
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }));
        assert_eq!(cells.len(), 3);
        assert_eq!(cells[0].value, "1.12345678");
        assert_eq!(cells[1].value, "abcd");
        assert_eq!(cells[2].value, "0.12345678");

        // delta: -1 for two cells
        gc.change_decimal_places(
            sheet_id,
            Pos { x: 0, y: 0 },
            Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }),
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
            sheet_id,
            Pos { x: 0, y: 0 },
            Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 1, y: 1 }),
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
    }

    #[test]
    fn test_set_currency() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            sheet_id,
            Pos { x: 0, y: 0 },
            String::from("1.12345678"),
            None,
        );
        gc.set_currency(
            sheet_id,
            &Rect::single_pos(Pos { x: 0, y: 0 }),
            Some("$".to_string()),
            None,
        );
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }));
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].value, "$1.12");
    }

    #[test]
    fn test_remove_formatting() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            sheet_id,
            Pos { x: 0, y: 0 },
            String::from("1.12345678"),
            None,
        );
        gc.set_currency(
            sheet_id,
            &Rect::single_pos(Pos { x: 0, y: 0 }),
            Some("$".to_string()),
            None,
        );
        gc.clear_formatting(sheet_id, Rect::single_pos(Pos { x: 0, y: 0 }), None);
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }));
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].value, "1.12345678");
    }
}
