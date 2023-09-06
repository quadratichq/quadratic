use serde::{Deserialize, Serialize};

use crate::{array, grid::*, Array, CellValue, Pos, Rect, RunLengthEncoding};

use super::{
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};

impl GridController {
    pub fn populate_with_random_floats(&mut self, sheet_id: SheetId, region: &Rect) {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        sheet.with_random_floats(region);
    }

    pub fn grid(&self) -> &Grid {
        &self.grid
    }

    pub fn set_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: CellValue,
        cursor: Option<String>,
    ) -> TransactionSummary {
        self.set_cells(sheet_id, pos, array![value], cursor)
    }
    pub fn set_cells(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        values: Array,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let end_pos = Pos {
            x: start_pos.x + values.width() as i64 - 1,
            y: start_pos.y + values.height() as i64 - 1,
        };
        let rect = Rect {
            min: start_pos,
            max: end_pos,
        };
        let region = self.region(sheet_id, rect);
        let ops = vec![Operation::SetCellValues { region, values }];
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn delete_cell_values(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let region = self.existing_region(sheet_id, rect);
        let ops = match region.size() {
            Some(size) => {
                let values = Array::new_empty(size);
                vec![Operation::SetCellValues { region, values }]
            }
            None => vec![], // region is empty; do nothing
        };
        self.transact_forward(Transaction { ops, cursor })
    }

    pub fn set_code_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: CodeCellValue,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let cell_ref = self
            .grid
            .sheet_mut_from_id(sheet_id)
            .get_or_create_cell_ref(pos);
        let ops = vec![Operation::SetCodeCell { cell_ref, value }];
        self.transact_forward(Transaction { ops, cursor })
    }

    pub fn set_cell_formats_for_type<A: CellFmtAttr>(
        &mut self,
        region: &RegionRef,
        values: RunLengthEncoding<Option<A::Value>>,
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
        old_values
    }

    /// Returns a region of the spreadsheet, assigning IDs to columns and rows
    /// as needed.
    pub fn region(&mut self, sheet_id: SheetId, rect: Rect) -> RegionRef {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let columns = rect
            .x_range()
            .map(|x| sheet.get_or_create_column(x).0.id)
            .collect();
        let rows = rect
            .y_range()
            .map(|y| sheet.get_or_create_row(y).id)
            .collect();
        RegionRef {
            sheet: sheet_id,
            columns,
            rows,
        }
    }
    /// Returns a region of the spreadsheet, ignoring columns and rows which
    /// have no contents and no IDs.
    pub fn existing_region(&self, sheet_id: SheetId, rect: Rect) -> RegionRef {
        let sheet = self.grid.sheet_from_id(sheet_id);
        let columns = rect
            .x_range()
            .filter_map(|x| sheet.get_column(x))
            .map(|col| col.id)
            .collect();
        let rows = rect.y_range().filter_map(|y| sheet.get_row(y)).collect();
        RegionRef {
            sheet: sheet_id,
            columns,
            rows,
        }
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
                self.transact_forward(Transaction { ops, cursor })
            }
        }
    };
}

impl_set_cell_fmt_method!(set_cell_align<CellAlign>(CellFmtArray::Align));
impl_set_cell_fmt_method!(set_cell_wrap<CellWrap>(CellFmtArray::Wrap));
impl_set_cell_fmt_method!(set_cell_numeric_format<NumericFormat>(CellFmtArray::NumericFormat));
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
    Bold(RunLengthEncoding<Option<bool>>),
    Italic(RunLengthEncoding<Option<bool>>),
    TextColor(RunLengthEncoding<Option<String>>),
    FillColor(RunLengthEncoding<Option<String>>),
}

#[test]
fn test_set_cell_value_undo_redo() {
    let mut g = GridController::new();
    let sheet_id = g.grid.sheets()[0].id;
    let pos = Pos { x: 3, y: 6 };
    let get_the_cell =
        |g: &GridController| g.sheet(sheet_id).get_cell_value(pos).unwrap_or_default();
    let expected_summary = Some(TransactionSummary {
        cell_regions_modified: vec![(sheet_id, Rect::single_pos(pos))],
        ..Default::default()
    });

    assert_eq!(get_the_cell(&g), CellValue::Blank);
    g.set_cell_value(sheet_id, pos, "a".into(), None);
    assert_eq!(get_the_cell(&g), "a".into());
    g.set_cell_value(sheet_id, pos, "b".into(), None);
    assert_eq!(get_the_cell(&g), "b".into());
    assert!(g.undo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "a".into());
    assert!(g.redo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "b".into());
    assert!(g.undo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "a".into());
    assert!(g.undo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), CellValue::Blank);
    assert!(g.undo(None).is_none());
    assert_eq!(get_the_cell(&g), CellValue::Blank);
    assert!(g.redo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "a".into());
    assert!(g.redo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "b".into());
    assert!(g.redo(None).is_none());
    assert_eq!(get_the_cell(&g), "b".into());
}

#[test]
fn test_set_cell_text_color_undo_redo() {
    let mut g = GridController::new();
    let sheet_id = g.grid.sheets()[0].id;
    let pos1 = Pos { x: 3, y: 6 };
    let pos2 = Pos { x: 5, y: 8 };
    let pos3 = Pos { x: 9, y: 6 };
    let rect1 = Rect::new_span(pos1, pos2);
    let rect2 = Rect::new_span(pos2, pos3);

    let get = |g: &GridController, pos: Pos| {
        g.sheet(sheet_id)
            .get_formatting_value::<TextColor>(pos)
            .unwrap_or_default()
    };

    let expected_summary = |rect| TransactionSummary {
        cell_regions_modified: vec![(sheet_id, rect)],
        ..Default::default()
    };

    assert_eq!(get(&g, pos1), "");
    assert_eq!(get(&g, pos2), "");
    assert_eq!(get(&g, pos3), "");
    assert_eq!(
        g.set_cell_text_color(sheet_id, rect1, Some("blue".to_string()), None),
        expected_summary(rect1),
    );
    println!("{:#?}", g);
    assert_eq!(get(&g, pos1), "blue");
    assert_eq!(get(&g, pos2), "blue");
    assert_eq!(get(&g, pos3), "");
    assert_eq!(
        g.set_cell_text_color(sheet_id, rect2, Some("red".to_string()), None),
        expected_summary(rect2),
    );
    assert_eq!(get(&g, pos1), "blue");
    assert_eq!(get(&g, pos2), "red");
    assert_eq!(get(&g, pos3), "red");
    assert_eq!(g.undo(None), Some(expected_summary(rect2)));
    assert_eq!(get(&g, pos1), "blue");
    assert_eq!(get(&g, pos2), "blue");
    assert_eq!(get(&g, pos3), "");
    assert_eq!(g.undo(None), Some(expected_summary(rect1)));
    assert_eq!(get(&g, pos1), "");
    assert_eq!(get(&g, pos2), "");
    assert_eq!(get(&g, pos3), "");
    assert_eq!(g.redo(None), Some(expected_summary(rect1)));
    assert_eq!(get(&g, pos1), "blue");
    assert_eq!(get(&g, pos2), "blue");
    assert_eq!(get(&g, pos3), "");
    assert_eq!(g.redo(None), Some(expected_summary(rect2)));
    assert_eq!(get(&g, pos1), "blue");
    assert_eq!(get(&g, pos2), "red");
    assert_eq!(get(&g, pos3), "red");
}

#[test]
fn test_code_cell_value_overwrite() {
    let mut g = GridController::new();
    let s = g.sheet_ids()[0];
    let pos = Pos { x: 3, y: -5 };

    let code_cell_value = CodeCellValue {
        language: CodeCellLanguage::Formula,
        code_string: "=PI()".to_string(),
        formatted_code_string: None,
        last_modified: String::new(),
        output: None,
    };

    assert_eq!(None, g.sheet(s).get_cell_value(pos));
    assert_eq!(None, g.sheet(s).get_code_cell(pos));

    g.set_cell_value(s, pos, CellValue::Number(10.0), None);
    assert_eq!(
        Some(CellValue::Number(10.0)),
        g.sheet(s).get_cell_value(pos),
    );
    assert_eq!(None, g.sheet(s).get_code_cell(pos));

    g.set_code_cell_value(s, pos, code_cell_value.clone(), None);
    assert_eq!(None, g.sheet(s).get_cell_value(pos));
    assert_eq!(Some(&code_cell_value), g.sheet(s).get_code_cell(pos));

    g.set_cell_value(s, pos, CellValue::Number(20.0), None);
    assert_eq!(
        Some(CellValue::Number(20.0)),
        g.sheet(s).get_cell_value(pos),
    );
    assert_eq!(None, g.sheet(s).get_code_cell(pos));

    g.undo(None);
    assert_eq!(None, g.sheet(s).get_cell_value(pos));
    assert_eq!(Some(&code_cell_value), g.sheet(s).get_code_cell(pos));

    g.undo(None);
    assert_eq!(
        Some(CellValue::Number(10.0)),
        g.sheet(s).get_cell_value(pos),
    );
    assert_eq!(None, g.sheet(s).get_code_cell(pos));

    g.undo(None);
    assert_eq!(None, g.sheet(s).get_cell_value(pos));
    assert_eq!(None, g.sheet(s).get_code_cell(pos));

    g.redo(None);
    assert_eq!(
        Some(CellValue::Number(10.0)),
        g.sheet(s).get_cell_value(pos),
    );
    assert_eq!(None, g.sheet(s).get_code_cell(pos));

    g.redo(None);
    assert_eq!(None, g.sheet(s).get_cell_value(pos));
    assert_eq!(Some(&code_cell_value), g.sheet(s).get_code_cell(pos));

    g.redo(None);
    assert_eq!(
        Some(CellValue::Number(20.0)),
        g.sheet(s).get_cell_value(pos),
    );
    assert_eq!(None, g.sheet(s).get_code_cell(pos));
}

// fn test_render_fill() {
//     let mut g = GridController::new();
//     let sheet_id = g.sheet_ids()[0];
//     g.grid.set_cell_fill_color(
//         &sheet_id,
//         &Rect {
//             min: Pos { x: 1, y: 1 },
//             max: Pos { x: 10, y: 10 },
//         },
//         "blue".to_string(),
//     );
//     g.grid.set_cell_fill_color(
//         &sheet_id,
//         &Rect {
//             min: Pos { x: 1, y: 15 },
//             max: Pos { x: 10, y: 20 },
//         },
//         "blue".to_string(),
//     );
//     g.grid.set_cell_fill_color(
//         &sheet_id,
//         &Rect {
//             min: Pos { x: 1, y: 10 },
//             max: Pos { x: 10, y: 15 },
//         },
//         "blue".to_string(),
//     );
//     let render_fills = g.sheet(sheet_id).get_render_fills(Rect {
//         min: Pos { x: -100, y: -100 },
//         max: Pos { x: 100, y: 100 },
//     });
//     assert_eq!(10, render_fills.len())
// }
