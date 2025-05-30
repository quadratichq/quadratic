//! This is a subset of the cache of data tables that is used by both
//! SheetDataTables and the client. Only SheetDataTables can modify the cache.

use crate::{Pos, Rect, grid::Contiguous2D};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[wasm_bindgen]
pub struct DataTablesCache {
    // boolean map indicating presence of data table root cell at a position
    // uses Contiguous2D for efficient storage and fast lookup
    // NOTE: the bool cannot be false
    pub(super) has_data_table_anchor: Contiguous2D<Option<bool>>,

    // position map indicating presence of data table output at a position,
    // each position value is the root cell position of the data table
    // this accounts for table spills hence values cannot overlap
    // single cell output values are not stored here, check `has_data_table_anchor` map for single cell values
    pub(super) spilled_output_rects: Contiguous2D<Option<Pos>>,
}

#[wasm_bindgen]
impl DataTablesCache {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: Vec<u8>) -> Self {
        serde_json::from_slice::<DataTablesCache>(&bytes).unwrap_or_default()
    }

    /// Returns what table is the table Pos at the given position.
    #[wasm_bindgen(js_name = "getTableInPos")]
    pub fn table_in_pos(&self, x: i32, y: i32) -> Option<Pos> {
        let pos = Pos {
            x: x as i64,
            y: y as i64,
        };
        if self.has_data_table_anchor.get(pos).is_some() {
            Some(pos)
        } else {
            self.spilled_output_rects
                .get(pos)
                .map(|pos| Some(pos))
                .flatten()
        }
    }

    /// Returns all tables in the given rect.
    #[wasm_bindgen(js_name = "getTablesInRect")]
    pub fn tables_in_rect(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<Pos> {
        self.spilled_output_rects
            .unique_values_in_rect(Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64))
            .into_iter()
            .flatten()
            .collect()
    }
}
