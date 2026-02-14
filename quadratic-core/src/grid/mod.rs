pub use bounds::GridBounds;
pub use cells_accessed::*;
pub use column::Column;
pub use contiguous::{Block, Contiguous2D, ContiguousBlocks};
pub use data_table::*;
pub use formats::Format;
pub use formatting::{
    Bold, CellAlign, CellVerticalAlign, CellWrap, FillColor, Italic, NumericCommas,
    NumericDecimals, NumericFormat, NumericFormatKind, StrikeThrough, TextColor, Underline,
};
pub use ids::*;
use indexmap::IndexMap;
pub use region_map::RegionMap;
use serde::{Deserialize, Serialize};
pub use sheet::Sheet;
pub use sheet_formatting::SheetFormatting;
pub use sheet_region_map::SheetRegionMap;

#[cfg(test)]
use crate::{Array, Pos};

mod a1_context;
pub mod ai;
mod block;
mod bounds;
mod cells_accessed;
mod cells_accessed_cache;
pub mod column;
pub mod contiguous;
pub mod data_table;
pub mod file;
pub mod formats;
pub mod formatting;
mod ids;
pub mod js_types;
pub mod memory_payload;
mod region_map;
pub mod resize;
pub mod search;
pub mod selection;
pub mod series;
pub mod sheet;
pub mod sheet_formatting;
mod sheet_region_map;
pub mod sheets;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Grid {
    pub sheets: IndexMap<SheetId, Sheet>,
}
impl Default for Grid {
    fn default() -> Self {
        Self::new()
    }
}
impl Grid {
    pub fn new() -> Self {
        let mut ret = Grid::new_blank();
        ret.add_sheet(None);
        ret
    }

    pub fn new_blank() -> Self {
        Grid {
            sheets: IndexMap::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.sheets.len() == 1
            && self
                .sheets
                .values()
                .next()
                .unwrap()
                .bounds(false)
                .is_empty()
    }

    /// Creates a grid for testing.
    pub fn test() -> Self {
        let mut ret = Grid::new_blank();
        let sheet = Sheet::test();
        ret.add_sheet(Some(sheet));
        ret
    }

    pub fn migration_retain_positive_non_default_offsets(&mut self) {
        self.sheets.iter_mut().for_each(|(_, sheet)| {
            sheet
                .offsets
                .migration_retain_positive_non_default_offsets();
        });
    }

    #[cfg(test)]
    pub fn from_array(base_pos: Pos, array: &Array) -> Self {
        let mut ret = Grid::new();
        let sheet = ret.first_sheet_mut();
        for ((x, y), value) in array.size().iter().zip(array.cell_values_slice()) {
            let x = base_pos.x + x as i64;
            let y = base_pos.y + y as i64;
            sheet.set_value(Pos { x, y }, value.clone());
        }
        ret
    }

    #[cfg(test)]
    pub fn origin_in_first_sheet(&self) -> crate::SheetPos {
        crate::Pos::ORIGIN.to_sheet_pos(self.sheets()[0].id)
    }
}

#[cfg(test)]
mod test {
    use crate::controller::GridController;

    use super::*;

    #[test]
    fn test_is_empty() {
        let mut gc = GridController::new();
        assert!(gc.grid().is_empty());

        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "1".to_string(), None, false);
        assert!(!gc.grid().is_empty());

        let grid = Grid::new();
        assert!(grid.is_empty());
    }
}
