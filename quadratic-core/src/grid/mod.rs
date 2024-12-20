pub use bounds::GridBounds;
pub use cells_accessed::*;
pub use code_cell::*;
pub use code_run::*;
pub use column::{Column, ColumnData};
pub use contiguous::{Block, Contiguous2D, ContiguousBlocks};
pub use data_table::*;
pub use formats::Format;
pub use formatting::{
    Bold, CellAlign, CellVerticalAlign, CellWrap, FillColor, Italic, NumericCommas,
    NumericDecimals, NumericFormat, NumericFormatKind, StrikeThrough, TextColor, Underline,
};
pub use ids::*;
use serde::{Deserialize, Serialize};
pub use sheet::Sheet;
pub use sheet_formatting::SheetFormatting;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::CellValue;
#[cfg(test)]
use crate::{Array, Pos};

mod block;
mod bounds;
mod cells_accessed;
mod code_cell;
mod code_run;
pub mod column;
pub mod contiguous;
pub mod data_table;
pub mod file;
pub mod formats;
pub mod formatting;
mod ids;
pub mod js_types;
pub mod resize;
pub mod search;
pub mod selection;
pub mod series;
pub mod sheet;
pub mod sheet_formatting;
pub mod sheets;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
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
        let mut ret = Grid::new_blank();
        ret.add_sheet(None);
        ret
    }
    pub fn new_blank() -> Self {
        Grid { sheets: vec![] }
    }

    /// Creates a grid for testing.
    pub fn test() -> Self {
        let mut ret = Grid::new_blank();
        let sheet = Sheet::test();
        ret.add_sheet(Some(sheet));
        ret
    }

    #[cfg(test)]
    pub fn from_array(base_pos: Pos, array: &Array) -> Self {
        let mut ret = Grid::new();
        let sheet = &mut ret.sheets_mut()[0];
        for ((x, y), value) in array.size().iter().zip(array.cell_values_slice()) {
            let x = base_pos.x + x as i64;
            let y = base_pos.y + y as i64;
            let _ = sheet.set_cell_value(Pos { x, y }, value.clone());
        }
        ret
    }
}
