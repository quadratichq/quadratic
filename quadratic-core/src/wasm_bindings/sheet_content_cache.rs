//! This is wasm_bindgen code that provides a JavaScript interface to the SheetContentCache.
//! This is meant for querying only, not for modifying the cache.
//! Cache modifications should be done through the quadratic-core struct only.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{Pos, Rect, grid::Contiguous2D};

#[derive(Default, Debug, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct SheetContentCache {
    has_cell_value: Contiguous2D<Option<bool>>,
}

#[wasm_bindgen]
impl SheetContentCache {
    /// Creates an empty version of the cache.
    #[wasm_bindgen]
    pub fn new_empty() -> Self {
        SheetContentCache::default()
    }

    #[wasm_bindgen(constructor)]
    pub fn new(bytes: &[u8]) -> Self {
        postcard::from_bytes::<SheetContentCache>(&bytes).unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn has_content(&self, col: i32, row: i32) -> bool {
        self.has_cell_value
            .get(Pos {
                x: col as i64,
                y: row as i64,
            })
            .is_some()
    }

    #[wasm_bindgen]
    pub fn has_content_in_rect(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> bool {
        let rect = Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64);
        self.has_cell_value.intersects(rect)
    }
}
