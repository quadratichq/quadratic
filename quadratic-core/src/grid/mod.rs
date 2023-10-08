use anyhow::{bail, Result};
use std::collections::HashMap;
use std::str::FromStr;

use lexicon_fractional_index::key_between;
use serde::{Deserialize, Serialize};
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

mod block;
pub mod borders;
mod bounds;
mod code;
mod column;
pub mod file;
mod formatting;
mod ids;
pub mod js_types;
mod offsets;
mod response;
pub mod series;
pub mod sheet;

use block::{Block, BlockContent, CellValueBlockContent, SameValue};
pub use borders::{
    generate_borders, set_region_borders, BorderSelection, BorderStyle, CellBorderLine,
    SheetBorders,
};
pub use bounds::GridBounds;
pub use code::*;
pub use column::{Column, ColumnData};
pub use formatting::{
    Bold, BoolSummary, CellAlign, CellFmtAttr, CellWrap, FillColor, Italic, NumericDecimals,
    NumericFormat, NumericFormatKind, TextColor,
};
pub use ids::*;
pub use sheet::Sheet;

use crate::{
    controller::compute::{SheetPos, SheetRect},
    CellValue, Pos, Rect, Value,
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct Grid {
    sheets: Vec<Sheet>,
    dependencies: HashMap<SheetPos, Vec<SheetRect>>,
}
impl Default for Grid {
    fn default() -> Self {
        Self::new()
    }
}
impl Grid {
    pub fn new() -> Self {
        let mut ret = Grid {
            sheets: vec![],
            dependencies: HashMap::new(),
        };
        ret.add_sheet(None).expect("error adding initial sheet");
        ret
    }
    pub fn sheets(&self) -> &[Sheet] {
        &self.sheets
    }
    pub fn dependencies_mut(&mut self) -> &mut HashMap<SheetPos, Vec<SheetRect>> {
        &mut self.dependencies
    }
    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.sheets.iter().map(|sheet| sheet.id).collect()
    }
    pub fn sheet_mut_from_name(&mut self, name: String) -> Option<&Sheet> {
        if let Some(sheet) = self.sheets.iter().find(|sheet| sheet.name == name) {
            Some(sheet)
        } else {
            None
        }
    }
    pub fn sheet_from_name(&self, name: String) -> Option<&Sheet> {
        self.sheets.iter().find(|sheet| sheet.name == name)
    }
    pub fn sheets_mut(&mut self) -> &mut [Sheet] {
        &mut self.sheets
    }
    pub fn sort_sheets(&mut self) {
        self.sheets.sort_by(|a, b| a.order.cmp(&b.order));
    }
    pub fn end_order(&self) -> String {
        let last_order = self.sheets.last().map(|last| last.order.clone());
        key_between(&last_order, &None).unwrap()
    }
    pub fn previous_sheet_order(&self, sheet_id: SheetId) -> Option<String> {
        let mut previous: Option<&Sheet> = None;
        for sheet in self.sheets.iter() {
            if sheet.id == sheet_id {
                return previous.map(|previous| previous.order.clone());
            }
            previous = Some(sheet);
        }
        None
    }
    pub fn next_sheet(&self, sheet_id: SheetId) -> Option<&Sheet> {
        let mut next = false;
        for sheet in self.sheets.iter() {
            if next {
                return Some(sheet);
            }
            if sheet.id == sheet_id {
                next = true;
            };
        }
        None
    }
    /// Adds a sheet to the grid. Returns an error if the sheet name is already
    /// in use.
    pub fn add_sheet(&mut self, sheet: Option<Sheet>) -> Result<SheetId> {
        // for new sheets, order is after the last one
        let sheet = sheet.unwrap_or_else(|| {
            Sheet::new(
                SheetId::new(),
                format!("Sheet {}", self.sheets.len() + 1),
                self.end_order(),
            )
        });

        // error if duplicate name
        let id = sheet.id;
        if self
            .sheets
            .iter()
            .any(|old_sheet| old_sheet.name == sheet.name)
        {
            bail!("sheet name already in use");
        }
        self.sheets.push(sheet);
        self.sort_sheets();
        Ok(id)
    }
    pub fn remove_sheet(&mut self, sheet_id: SheetId) -> Sheet {
        let i = self.sheet_id_to_index(sheet_id);
        match i {
            Some(i) => self.sheets.remove(i),
            None => unreachable!(
                "remove_sheet should never be called with a sheet_id that doesn't exist"
            ),
        }
    }
    /// Moves a sheet before another sheet
    pub fn move_sheet(&mut self, target: SheetId, order: String) {
        let target = self.sheet_mut_from_id(target);
        target.order = order;
        self.sort_sheets();
    }
    pub fn sheet_id_to_index(&self, id: SheetId) -> Option<usize> {
        self.sheets.iter().position(|sheet| sheet.id == id)
    }
    pub fn sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        Some(self.sheets.get(index)?.id)
    }
    pub fn sheet_has_id(&self, sheet_id: Option<SheetId>) -> bool {
        let Some(sheet_id) = sheet_id else {
            return false;
        };
        self.sheets.iter().any(|s| s.id == sheet_id)
    }
    pub fn sheet_from_id(&self, sheet_id: SheetId) -> &Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &self.sheets[sheet_index]
    }
    pub fn sheet_mut_from_id(&mut self, sheet_id: SheetId) -> &mut Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &mut self.sheets[sheet_index]
    }

    pub fn sheet_from_string(&self, sheet_id: String) -> &Sheet {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        self.sheet_from_id(sheet_id)
    }
    pub fn sheet_mut_from_string(&mut self, sheet_id: String) -> &Sheet {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        self.sheet_mut_from_id(sheet_id)
    }

    /// Returns a list of rectangles that exactly covers a region. Ignores IDs
    /// for columns and rows that don't exist.
    pub(crate) fn region_rects(&self, region: &RegionRef) -> impl Iterator<Item = (SheetId, Rect)> {
        let sheet_id = region.sheet;
        let sheet = self.sheet_from_id(sheet_id);
        sheet.region_rects(region).map(move |rect| (sheet_id, rect))
    }
}

#[cfg(test)]
mod tests;
