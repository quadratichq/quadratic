use itertools::Itertools;
use lexicon_fractional_index::key_between;
use serde::{Deserialize, Serialize};
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::{grid::*, Array, CellValue, Pos, Rect, RunLengthEncoding};

#[derive(Debug, Default, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,
}
impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new())
    }
    pub fn from_grid(grid: Grid) -> Self {
        GridController {
            grid,
            undo_stack: vec![],
            redo_stack: vec![],
        }
    }
    pub fn populate_with_random_floats(&mut self, sheet_id: SheetId, region: &Rect) {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        sheet.with_random_floats(region);
    }

    pub fn grid(&self) -> &Grid {
        &self.grid
    }

    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.grid.sheets().iter().map(|sheet| sheet.id).collect()
    }
    pub fn sheet(&self, sheet_id: SheetId) -> &Sheet {
        self.grid.sheet_from_id(sheet_id)
    }

    pub fn set_sheet_name(
        &mut self,
        sheet_id: SheetId,
        name: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let transaction = Transaction {
            ops: vec![Operation::SetSheetName { sheet_id, name }],
            cursor,
        };
        self.transact_forward(transaction)
    }

    pub fn set_sheet_color(
        &mut self,
        sheet_id: SheetId,
        color: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let transaction = Transaction {
            ops: vec![Operation::SetSheetColor { sheet_id, color }],
            cursor,
        };
        self.transact_forward(transaction)
    }

    pub fn set_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: CellValue,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let region = RegionRef::from(cell_ref);
        let values = Array::from(value);
        let ops = vec![Operation::SetCellValues { region, values }];
        self.transact_forward(Transaction { ops, cursor })
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

    pub fn add_sheet(&mut self, cursor: Option<String>) -> TransactionSummary {
        let sheet_names = &self
            .grid
            .sheets()
            .iter()
            .map(|s| s.name.as_str())
            .collect_vec();

        let id = SheetId::new();
        let name = crate::util::unused_name("Sheet", &sheet_names);
        let order = self.grid.end_order();
        let sheet = Sheet::new(id, name, order);
        let ops = vec![Operation::AddSheet { sheet }];
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn delete_sheet(
        &mut self,
        sheet_id: SheetId,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let mut ops = vec![Operation::DeleteSheet { sheet_id }];
        if self.sheet_ids().len() == 1 {
            let id = SheetId::new();
            let name = String::from("Sheet 1");
            let order = self.grid.end_order();
            let sheet = Sheet::new(id, name, order);
            ops.push(Operation::AddSheet { sheet });
        }
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn move_sheet(
        &mut self,
        sheet_id: SheetId,
        to_before: Option<SheetId>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = vec![Operation::ReorderSheet {
            target: sheet_id,
            to_before,
        }];
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn duplicate_sheet(
        &mut self,
        sheet_id: SheetId,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let source = self.grid.sheet_from_id(sheet_id);
        let mut new_sheet = self.sheet(sheet_id).clone();
        new_sheet.id = SheetId::new();
        new_sheet.name = format!("{} Copy", new_sheet.name);
        let right = self.grid.next_sheet(sheet_id);
        let right_order = match right {
            Some(right) => Some(right.order.clone()),
            None => None,
        };
        new_sheet.order = key_between(&Some(source.order.clone()), &right_order).unwrap();
        let ops = vec![Operation::AddSheet { sheet: new_sheet }];
        self.transact_forward(Transaction { ops, cursor })
    }

    fn transact_forward(&mut self, transaction: Transaction) -> TransactionSummary {
        let (reverse_transaction, summary) = self.transact(transaction);
        self.redo_stack.clear();
        self.undo_stack.push(reverse_transaction);
        summary
    }
    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    pub fn undo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        let transaction = self.undo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let (mut reverse_transaction, mut summary) = self.transact(transaction);
        reverse_transaction.cursor = cursor;
        self.redo_stack.push(reverse_transaction);
        summary.cursor = cursor_old;
        Some(summary)
    }
    pub fn redo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        let transaction = self.redo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let (mut reverse_transaction, mut summary) = self.transact(transaction);
        reverse_transaction.cursor = cursor;
        self.undo_stack.push(reverse_transaction);
        summary.cursor = cursor_old;
        Some(summary)
    }

    fn transact(&mut self, transaction: Transaction) -> (Transaction, TransactionSummary) {
        let mut rev_ops = vec![];
        let mut sheets_with_changed_bounds = vec![];
        let mut summary = TransactionSummary::default();
        for op in transaction.ops {
            if let Some(new_dirty_sheet) = op.sheet_with_changed_bounds() {
                if !sheets_with_changed_bounds.contains(&new_dirty_sheet) {
                    sheets_with_changed_bounds.push(new_dirty_sheet)
                }
            }
            match op {
                Operation::SetCellValues { region, values } => {
                    summary
                        .cell_regions_modified
                        .extend(self.grid.region_rects(&region));

                    let sheet = self.grid.sheet_mut_from_id(region.sheet);

                    let Some(size) = region.size() else {continue};
                    let old_values = region
                        .iter()
                        .zip(values.into_cell_values_vec())
                        .map(|(cell_ref, value)| {
                            let pos = sheet.cell_ref_to_pos(cell_ref)?;
                            let response = sheet.set_cell_value(pos, value)?;
                            Some(response.old_value)
                        })
                        .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                        .collect();
                    let old_values = Array::new_row_major(size, old_values)
                        .expect("error constructing array of old values for SetCells operation");
                    rev_ops.push(Operation::SetCellValues {
                        region,
                        values: old_values,
                    });
                }

                Operation::SetCellFormats { region, attr } => {
                    summary
                        .cell_regions_modified
                        .extend(self.grid.region_rects(&region));

                    let old_attr = match attr {
                        CellFmtArray::Align(align) => CellFmtArray::Align(
                            self.set_cell_formats_for_type::<CellAlign>(&region, align),
                        ),
                        CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
                            self.set_cell_formats_for_type::<CellWrap>(&region, wrap),
                        ),
                        CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
                            self.set_cell_formats_for_type::<NumericFormat>(&region, num_fmt),
                        ),
                        CellFmtArray::Bold(bold) => CellFmtArray::Bold(
                            self.set_cell_formats_for_type::<Bold>(&region, bold),
                        ),
                        CellFmtArray::Italic(italic) => CellFmtArray::Italic(
                            self.set_cell_formats_for_type::<Italic>(&region, italic),
                        ),
                        CellFmtArray::TextColor(text_color) => CellFmtArray::TextColor(
                            self.set_cell_formats_for_type::<TextColor>(&region, text_color),
                        ),
                        CellFmtArray::FillColor(fill_color) => CellFmtArray::FillColor(
                            self.set_cell_formats_for_type::<FillColor>(&region, fill_color),
                        ),
                    };
                    rev_ops.push(Operation::SetCellFormats {
                        region,
                        attr: old_attr,
                    })
                }

                Operation::AddSheet { sheet } => {
                    // todo: need to handle the case where sheet.order overlaps another sheet order
                    // this may happen after (1) delete a sheet; (2) MP update w/an added sheet; and (3) undo the deleted sheet

                    let sheet_id = sheet.id.clone();
                    self.grid
                        .add_sheet(Some(sheet))
                        .expect("duplicate sheet name");
                    summary.sheet_list_modified = true;
                    rev_ops.push(Operation::DeleteSheet { sheet_id });
                }
                Operation::DeleteSheet { sheet_id } => {
                    let deleted_sheet = self.grid.remove_sheet(sheet_id);
                    if let Some(sheet) = deleted_sheet {
                        summary.sheet_list_modified = true;
                        rev_ops.push(Operation::AddSheet { sheet });
                    }
                }

                Operation::ReorderSheet { target, to_before } => {
                    let original = self.grid.next_sheet(target);
                    let original_before = match original {
                        Some(original) => Some(original.id.clone()),
                        None => None,
                    };
                    self.grid.move_sheet(target, to_before);
                    rev_ops.push(Operation::ReorderSheet {
                        target,
                        to_before: original_before,
                    });
                }

                Operation::SetSheetName { sheet_id, name } => {
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    let old_name = sheet.name.clone();
                    sheet.name = name;
                    rev_ops.push(Operation::SetSheetName {
                        sheet_id,
                        name: old_name,
                    });
                    summary.sheet_list_modified = true;
                }

                Operation::SetSheetColor { sheet_id, color } => {
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    let old_color = sheet.color.clone();
                    sheet.color = color;
                    rev_ops.push(Operation::SetSheetColor {
                        sheet_id,
                        color: old_color,
                    });
                    summary.sheet_list_modified = true;
                }
            }
        }
        for dirty_sheet in sheets_with_changed_bounds {
            self.grid
                .sheet_mut_from_id(dirty_sheet)
                .recalculate_bounds();
        }
        rev_ops.reverse();

        let reverse_transaction = Transaction {
            ops: rev_ops,
            cursor: transaction.cursor,
        };

        (reverse_transaction, summary)
    }

    fn set_cell_formats_for_type<A: CellFmtAttr>(
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
    fn region(&mut self, sheet_id: SheetId, rect: Rect) -> RegionRef {
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
    fn existing_region(&self, sheet_id: SheetId, rect: Rect) -> RegionRef {
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Transaction {
    ops: Vec<Operation>,
    cursor: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Operation {
    SetCellValues {
        region: RegionRef,
        values: Array,
    },
    SetCellFormats {
        region: RegionRef,
        attr: CellFmtArray,
    },

    AddSheet {
        sheet: Sheet,
    },
    DeleteSheet {
        sheet_id: SheetId,
    },

    SetSheetName {
        sheet_id: SheetId,
        name: String,
    },

    SetSheetColor {
        sheet_id: SheetId,
        color: Option<String>,
    },

    ReorderSheet {
        target: SheetId,
        to_before: Option<SheetId>,
    },
}
impl Operation {
    pub fn sheet_with_changed_bounds(&self) -> Option<SheetId> {
        match self {
            Operation::SetCellValues { region, .. } => Some(region.sheet),
            Operation::SetCellFormats { region, .. } => Some(region.sheet),

            Operation::AddSheet { .. } => None,
            Operation::DeleteSheet { .. } => None,

            Operation::SetSheetColor { .. } => None,
            Operation::SetSheetName { .. } => None,

            Operation::ReorderSheet { .. } => None,
        }
    }
}

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

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct TransactionSummary {
    /// Cell and text formatting regions modified.
    pub cell_regions_modified: Vec<(SheetId, Rect)>,
    /// Sheets where any fills have been modified.
    pub fill_sheets_modified: Vec<SheetId>,
    /// Sheets where any borders have been modified.
    pub border_sheets_modified: Vec<SheetId>,

    /// Locations of code cells that were modified. They may no longer exist.
    pub code_cells_modified: Vec<(SheetId, Pos)>,

    /// Sheet metadata or order was modified.
    pub sheet_list_modified: bool,

    /// Cursor location for undo/redo operation
    pub cursor: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn test_add_delete_reorder_sheets() {
        let mut g = GridController::new();
        g.add_sheet(None);
        g.add_sheet(None);
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];
        let s2 = old_sheet_ids[1];
        let s3 = old_sheet_ids[2];

        let mut test_reorder = |a, b, expected: [SheetId; 3]| {
            g.move_sheet(a, b, None);
            assert_eq!(expected.to_vec(), g.sheet_ids());
            g.undo(None);
            assert_eq!(old_sheet_ids, g.sheet_ids());
        };

        test_reorder(s1, Some(s2), [s1, s2, s3]);
        test_reorder(s1, Some(s3), [s2, s1, s3]);
        test_reorder(s1, None, [s2, s3, s1]);
        test_reorder(s2, Some(s1), [s2, s1, s3]);
        test_reorder(s2, Some(s3), [s1, s2, s3]);
        test_reorder(s2, None, [s1, s3, s2]);
        test_reorder(s3, Some(s1), [s3, s1, s2]);
        test_reorder(s3, Some(s2), [s1, s3, s2]);
        test_reorder(s3, None, [s1, s2, s3]);

        let mut test_delete = |a, expected: [SheetId; 2]| {
            g.delete_sheet(a, None);
            assert_eq!(expected.to_vec(), g.sheet_ids());
            g.undo(None);
            assert_eq!(old_sheet_ids, g.sheet_ids());
        };

        test_delete(s1, [s2, s3]);
        test_delete(s2, [s1, s3]);
        test_delete(s3, [s1, s2]);
    }

    #[test]
    fn test_duplicate_sheet() {
        let mut g = GridController::new();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        g.set_sheet_name(s1, String::from("Nice Name"), None);
        g.duplicate_sheet(s1, None);
        let sheet_ids = g.sheet_ids();
        let s2 = sheet_ids[1];

        let sheet1 = g.sheet(s1);
        let sheet2 = g.sheet(s2);

        assert_eq!(sheet2.name, format!("{} Copy", sheet1.name));
    }

    #[test]
    fn test_delete_last_sheet() {
        let mut g = GridController::new();
        let sheet_ids = g.sheet_ids();
        let first_sheet_id = sheet_ids[0].clone();

        g.delete_sheet(first_sheet_id, None);
        let new_sheet_ids = g.sheet_ids();
        assert_eq!(new_sheet_ids.len(), 1);
        assert_ne!(new_sheet_ids[0], sheet_ids[0]);

        g.undo(None);
        let new_sheet_ids_2 = g.sheet_ids();
        assert_eq!(sheet_ids[0], new_sheet_ids_2[0]);

        g.redo(None);
        let new_sheet_ids_3 = g.sheet_ids();
        assert_eq!(new_sheet_ids[0], new_sheet_ids_3[0]);
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
}
