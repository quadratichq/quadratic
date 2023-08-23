use fractional_index::ZenoIndex;
use serde::{Deserialize, Serialize};
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

mod block;
mod borders;
mod bounds;
mod code;
mod column;
mod formatting;
mod ids;
pub mod js_types;
mod legacy;
mod response;
mod sheet;

use block::{Block, BlockContent, CellValueBlockContent, SameValue};
pub use borders::{CellBorder, CellBorderStyle, CellBorders};
pub use bounds::GridBounds;
pub use code::*;
pub use column::{Column, ColumnData};
pub use formatting::{
    Bold, BoolSummary, CellAlign, CellFmtAttr, CellWrap, FillColor, Italic, NumericFormat,
    NumericFormatKind, TextColor,
};
pub use ids::*;
pub use sheet::Sheet;

use crate::{CellValue, Pos, Rect, Value};

use self::legacy::JsSheet;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct Grid {
    sheets: Vec<Sheet>,
}
impl Default for Grid {
    fn default() -> Self {
        Self::new()
    }
}
impl Grid {
    pub fn new() -> Self {
        let mut ret = Grid { sheets: vec![] };
        ret.add_sheet(None, None)
            .expect("error adding initial sheet");
        ret
    }
    /// create an ordered list of JsSheet ids
    fn get_ordered_list(sheets: &Vec<JsSheet>) -> Vec<(String, ZenoIndex)> {
        let mut order_to_sort_list: Vec<(String, String)> = sheets
            .iter()
            .map(|sheet| (sheet.id.clone(), sheet.order.clone()))
            .collect();
        order_to_sort_list.sort_by(|a, b| a.1.cmp(&b.1));
        let mut last: Option<ZenoIndex> = None;
        let mut order_list: Vec<(String, ZenoIndex)> = vec![];
        order_to_sort_list.iter().for_each(|entry| {
            let order = match last {
                Some(ref last) => ZenoIndex::new_after(&last),
                None => ZenoIndex::default(),
            };
            order_list.push((entry.0.clone(), order.clone()));
            last = Some(order.clone());
        });
        order_list
    }
    pub fn from_legacy(file: &legacy::GridFile) -> Result<Self, &'static str> {
        use legacy::*;

        let GridFile::V1_4(file) = file;
        let mut ret = Grid::new();
        ret.sheets = vec![];
        let order_list = Grid::get_ordered_list(&file.sheets);

        for js_sheet in &file.sheets {
            let sheet_id = SheetId::new();
            let find_order = order_list
                .iter()
                .find(|order| order.0 == js_sheet.id)
                .unwrap();
            let order = find_order.1.clone();
            ret.add_sheet(
                Some(Sheet::new(sheet_id, js_sheet.name.clone(), order.clone())),
                None,
            )
            .map_err(|_| "duplicate sheet name")?;
            let sheet = ret.sheet_mut_from_id(sheet_id);

            // Load cell data
            for js_cell in &js_sheet.cells {
                let column = sheet.get_or_create_column(js_cell.x).0.id;

                if let Some(cell_code) = js_cell.to_cell_code(sheet) {
                    let row = sheet.get_or_create_row(js_cell.y).id;
                    let code_cell_ref = CellRef {
                        sheet: sheet.id,
                        column,
                        row,
                    };
                    if let Some(output) = cell_code
                        .output
                        .as_ref()
                        .and_then(CodeCellRunOutput::output_value)
                    {
                        let source = code_cell_ref;
                        match output {
                            Value::Single(_) => {
                                let x = js_cell.x;
                                let y = js_cell.y;
                                let column = sheet.get_or_create_column(x).1;
                                column.spills.set(y, Some(source));
                            }
                            Value::Array(array) => {
                                for dy in 0..array.height() {
                                    for dx in 0..array.width() {
                                        let x = js_cell.x + dx as i64;
                                        let y = js_cell.y + dy as i64;
                                        let column = sheet.get_or_create_column(x).1;
                                        column.spills.set(y, Some(source));
                                    }
                                }
                            }
                        }
                    }
                    sheet.set_code_cell_value(
                        Pos {
                            x: js_cell.x,
                            y: js_cell.y,
                        },
                        Some(cell_code),
                    );
                } else if let Some(cell_value) = js_cell.to_cell_value() {
                    let x = js_cell.x;
                    let y = js_cell.y;
                    sheet.set_cell_value(Pos { x, y }, cell_value);
                }
            }

            for js_format in &js_sheet.formats {
                let (_, column) = sheet.get_or_create_column(js_format.x);

                column.align.set(js_format.y, js_format.alignment);
                column.wrap.set(js_format.y, js_format.wrapping);

                column
                    .numeric_format
                    .set(js_format.y, js_format.text_format.clone());

                column.bold.set(js_format.y, js_format.bold);
                column.italic.set(js_format.y, js_format.italic);

                column
                    .text_color
                    .set(js_format.y, js_format.text_color.clone());
                column
                    .fill_color
                    .set(js_format.y, js_format.fill_color.clone());
            }

            sheet.recalculate_bounds();
        }

        Ok(ret)
    }

    pub fn sheets(&self) -> &[Sheet] {
        &self.sheets
    }
    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.sheets.iter().map(|sheet| sheet.id).collect()
    }
    pub fn sheets_mut(&mut self) -> &mut [Sheet] {
        &mut self.sheets
    }
    pub fn sort_sheets(&mut self) {
        self.sheets.sort_by(|a, b| a.order.cmp(&b.order));
    }
    pub fn end_order(&self) -> ZenoIndex {
        if self.sheets.len() == 0 {
            ZenoIndex::default()
        } else {
            ZenoIndex::new_after(&self.sheets[self.sheets.len() - 1].order)
        }
    }
    pub fn between_order(ref left: Option<ZenoIndex>, ref right: Option<ZenoIndex>) -> ZenoIndex {
        let is_left = left.is_some();
        let is_right = right.is_some();
        if is_left && is_right {
            let left_unwrapped = left.clone().unwrap();
            let right_unwrapped = right.clone().unwrap();
            ZenoIndex::new_between(&left_unwrapped, &right_unwrapped).unwrap()
        } else if is_left {
            let left_unwrapped = left.clone().unwrap();
            ZenoIndex::new_after(&left_unwrapped)
        } else if is_right {
            let right_unwrapped = right.clone().unwrap();
            ZenoIndex::new_before(&right_unwrapped)
        } else {
            ZenoIndex::default()
        }
    }
    pub fn previous_sheet_order(&self, sheet_id: SheetId) -> Option<ZenoIndex> {
        let mut previous: Option<&Sheet> = None;
        for sheet in self.sheets.iter() {
            if sheet.id == sheet_id {
                return match previous {
                    Some(previous) => Some(previous.order.clone()),
                    None => None,
                };
            }
            previous = Some(sheet);
        }
        None
    }
    pub fn next_sheet_order(&self, sheet_id: SheetId) -> Option<ZenoIndex> {
        let mut next = false;
        for sheet in self.sheets.iter() {
            if next {
                return Some(sheet.order.clone());
            }
            if sheet.id == sheet_id {
                next = true;
            }
        }
        None
    }
    /// Adds a sheet to the grid. Returns an error if the sheet name is already
    /// in use.
    pub fn add_sheet(
        &mut self,
        sheet: Option<Sheet>,
        to_before: Option<Sheet>,
    ) -> Result<SheetId, ()> {
        // for new sheets, order is after the last one
        let mut sheet = sheet.unwrap_or_else(|| {
            Sheet::new(
                SheetId::new(),
                format!("Sheet {}", self.sheets.len()),
                self.end_order(),
            )
        });

        // determine order based on to_before
        let id = sheet.id;
        if self
            .sheets
            .iter()
            .any(|old_sheet| old_sheet.name == sheet.name)
        {
            return Err(());
        }
        let left = match to_before {
            Some(ref to_before) => self.previous_sheet_order(to_before.id),
            None => None,
        };
        let right = match to_before {
            Some(ref to_before) => Some(to_before.order.clone()),
            None => None,
        };
        sheet.order = Grid::between_order(left, right);
        self.sheets.push(sheet);
        self.sort_sheets();
        Ok(id)
    }
    pub fn remove_sheet(&mut self, sheet_id: SheetId) -> Option<Sheet> {
        let i = self.sheet_id_to_index(sheet_id)?;
        let ret = self.sheets.remove(i);
        Some(ret)
    }
    /// Moves a sheet to a specific index.
    pub fn move_sheet(&mut self, target: SheetId, to: usize) {
        let from = self.sheet_id_to_index(target).expect("bad sheet ID");
        if from < to {
            self.sheets[from..to].rotate_left(1);
        } else {
            self.sheets[to..=from].rotate_right(1);
        }
    }
    pub fn sheet_id_to_index(&self, id: SheetId) -> Option<usize> {
        self.sheets.iter().position(|sheet| sheet.id == id)
    }
    pub fn sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        let sheet = self.sheets.get(index);
        match sheet {
            Some(sheet) => Some(sheet.id),
            None => None,
        }
    }
    pub fn sheet_from_id(&self, sheet_id: SheetId) -> &Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &self.sheets[sheet_index]
    }
    pub fn sheet_mut_from_id(&mut self, sheet_id: SheetId) -> &mut Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &mut self.sheets[sheet_index]
    }

    /// Returns a list of rectangles that exactly covers a region. Ignores IDs
    /// for columns and rows that don't exist.
    pub(crate) fn region_rects(&self, region: &RegionRef) -> impl Iterator<Item = (SheetId, Rect)> {
        let sheet_id = region.sheet;
        let sheet = self.sheet_from_id(sheet_id);
        sheet.region_rects(region).map(move |rect| (sheet_id, rect))
    }

    pub fn to_legacy_file_format(&self) -> legacy::GridFileV1_4 {
        legacy::GridFileV1_4 {
            sheets: self
                .sheets
                .iter()
                .enumerate()
                .map(|(i, sheet)| sheet.export_to_legacy_file_format(i))
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests;
