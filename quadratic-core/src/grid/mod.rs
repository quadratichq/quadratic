use crate::CellValue;
#[cfg(test)]
use crate::{Array, Pos};
use block::{Block, BlockContent, CellValueBlockContent, SameValue};
#[cfg(test)]
pub use borders::print_borders;
pub use borders::{
    generate_borders, generate_borders_full, get_cell_borders_in_rect, get_rect_borders,
    set_rect_borders, BorderSelection, BorderStyle, CellBorderLine, CellBorders, CellSide,
    IdSpaceBorders, LegacyCellBorder, LegacyCellBorders, SheetBorders,
};
pub use bounds::GridBounds;
pub use code_run::*;
pub use column::{Column, ColumnData};
pub use formatting::{
    Bold, BoolSummary, CellAlign, CellFmtAttr, CellWrap, FillColor, Italic, NumericCommas,
    NumericDecimals, NumericFormat, NumericFormatKind, RenderSize, TextColor,
};
pub use ids::*;
use serde::{Deserialize, Serialize};
pub use sheet::Sheet;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

mod block;
mod borders;
mod bounds;
mod code_run;
mod column;
pub mod file;
pub mod formatting;
mod ids;
pub mod js_types;
mod offsets;
pub mod series;
pub mod sheet;
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
        let mut ret = Grid { sheets: vec![] };
        ret.add_sheet(None);
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
