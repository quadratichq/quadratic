//! This is wasm_bindgen code that provides a JavaScript interface to the SheetContentCache.
//! This is meant for querying only, not for modifying the cache.
//! Cache modifications should be done through the quadratic-core struct only.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[cfg(test)]
use crate::grid::Sheet;
use crate::{
    Pos, Rect,
    compression::{SerializationFormat, deserialize},
    grid::Contiguous2D,
};

#[derive(Default, Debug, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct SheetContentCache {
    // bool will only be true (empty cells are None)
    has_cell_value: Contiguous2D<Option<bool>>,
}

#[cfg(test)]
impl From<&Sheet> for SheetContentCache {
    fn from(sheet: &Sheet) -> Self {
        SheetContentCache {
            has_cell_value: sheet.columns.has_cell_value_ref().to_owned(),
        }
    }
}

impl SheetContentCache {
    pub fn has_content(&self, pos: Pos) -> bool {
        // we can use is is_some() since the bool is always true
        self.has_cell_value.get(pos).is_some()
    }

    /// Returns the bounds of the column or None if the column is empty of
    /// content.
    pub fn column_bounds(&self, column: i64) -> Option<(i64, i64)> {
        let min = self.has_cell_value.col_min(column);
        if min == 0 {
            return None;
        }
        let max = self.has_cell_value.col_max(column);
        if max == 0 {
            return None;
        }
        Some((min, max))
    }

    /// Returns the bounds of the row or None if the row is empty of content.
    pub fn row_bounds(&self, row: i64) -> Option<(i64, i64)> {
        let min = self.has_cell_value.row_min(row);
        if min == 0 {
            return None;
        }
        let max = self.has_cell_value.row_max(row);
        if max == 0 {
            return None;
        }
        Some((min, max))
    }

    pub fn iter_content_in_rect(&self, rect: Rect) -> impl Iterator<Item = Pos> {
        self.has_cell_value
            .nondefault_rects_in_rect(rect)
            .flat_map(|(rect, _)| {
                rect.x_range()
                    .flat_map(move |x| rect.y_range().map(move |y| Pos { x, y }))
            })
    }
}

#[wasm_bindgen]
impl SheetContentCache {
    /// Creates an empty version of the cache.
    #[wasm_bindgen]
    pub fn new_empty() -> Self {
        SheetContentCache::default()
    }

    #[wasm_bindgen(constructor)]
    pub fn new(bytes: Vec<u8>) -> Self {
        deserialize::<SheetContentCache>(&SerializationFormat::Bincode, &bytes).unwrap_or_default()
    }

    #[wasm_bindgen(js_name = "hasContent")]
    pub fn js_has_content(&self, col: i32, row: i32) -> bool {
        self.has_content(Pos {
            x: col as i64,
            y: row as i64,
        })
    }

    #[wasm_bindgen(js_name = "hasContentInRect")]
    pub fn has_content_in_rect(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> bool {
        let rect = Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64);
        self.has_cell_value
            .nondefault_rects_in_rect(rect)
            .next()
            .is_some()
    }
}
