//! This is wasm_bindgen code that provides a JavaScript interface to the SheetDataTablesCache.
//! This is meant for querying only, not for modifying the cache.
//! Cache modifications should be done through the SheetDataTables struct only.

use wasm_bindgen::prelude::*;

use crate::{
    Pos, Rect,
    compression::{SerializationFormat, deserialize},
    grid::sheet::data_tables::cache::SheetDataTablesCache,
    wasm_bindings::{js_a1_context::JsA1Context, js_selection::JsSelection},
};

#[wasm_bindgen]
impl SheetDataTablesCache {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: Vec<u8>) -> Self {
        deserialize::<SheetDataTablesCache>(&SerializationFormat::Bincode, &bytes)
            .unwrap_or_default()
    }

    #[wasm_bindgen(js_name = "new_empty")]
    pub fn new_empty() -> Self {
        SheetDataTablesCache {
            data_tables: Default::default(),
        }
    }

    /// Returns what table is the table Pos at the given position.
    #[wasm_bindgen(js_name = "getTableInPos")]
    pub fn table_in_pos(&self, x: i32, y: i32) -> Option<Pos> {
        let pos = Pos {
            x: x as i64,
            y: y as i64,
        };
        self.get_pos_contains(pos)
    }

    /// Returns all tables in the given rectangle.
    #[wasm_bindgen(js_name = "getTablesInRect")]
    pub fn tables_in_rect(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<Pos> {
        self.data_tables
            .unique_values_in_rect(Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64))
            .into_iter()
            .flatten()
            .collect()
    }

    /// Returns whether the rect has any type of table
    #[wasm_bindgen(js_name = "hasTableInRect")]
    pub fn has_table_in_rect(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> bool {
        let rect = Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64);
        self.data_tables.has_content_in_rect(rect)
    }

    #[wasm_bindgen(js_name = "hasCodeCellInSelection")]
    pub fn has_table_in_selection(
        &self,
        js_selection: &JsSelection,
        a1_context: &JsA1Context,
    ) -> bool {
        self.code_in_selection(js_selection.get_selection(), a1_context.get_context())
    }
}
