use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use smallvec::SmallVec;

use crate::{ArraySize, CellValue, Pos, Rect, grid::Contiguous2D};

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct EmptyValuesCache {
    // Option<Option<bool>>> because this is the update for SheetDataTablesCache -> MultiCellTablesCache -> multi_cell_tables_empty
    // This gets applied / removed when the data table is visible / spilled.
    //
    // Some(None) -> non-empty
    // Some(Some(true)) -> empty
    cache: Option<Contiguous2D<Option<Option<bool>>>>,
}

impl From<(&ArraySize, &SmallVec<[CellValue; 1]>)> for EmptyValuesCache {
    fn from((array_size, values): (&ArraySize, &SmallVec<[CellValue; 1]>)) -> Self {
        // required only in app for client side interactions
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return Self::new();
        }

        // tracks only multi-cell tables
        if values.len() <= 1 {
            return Self::new();
        }

        let width = array_size.w.get() as usize;

        // collect all the empty cells
        let mut empty = Vec::<Pos>::new();
        for (i, value) in values.iter().enumerate() {
            if value.is_blank_or_empty_string() {
                let x = i % width;
                let y = i / width;
                empty.push((x, y).into());
            }
        }

        // if there are no empty cells, we don't need to store the cache
        if empty.is_empty() {
            return Self::new();
        }

        let height = array_size.h.get();

        let mut cache = Contiguous2D::new();

        // mark all cells (array rect) as Some(None) -> non-empty
        cache.set_rect(1, 1, Some(width as i64), Some(height as i64), Some(None));

        // then mark empty cells as Some(Some(true))
        for pos in empty {
            cache.set(pos.translate(1, 1, 1, 1), Some(Some(true)));
        }

        Self { cache: Some(cache) }
    }
}

impl EmptyValuesCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns a clone of the cache, this needs to be translated to sheet coordinates
    /// before can be applied to the SheetDataTablesCache
    /// Hidden columns and sorted rows are handled in the SheetDataTablesCache
    pub fn get_cache_cloned(&self) -> Option<Contiguous2D<Option<Option<bool>>>> {
        self.cache.clone()
    }

    /// Updates cache for a single value change in array
    /// Checks and removes the cache if all cells are non-empty
    pub fn set_value(&mut self, array_size: &ArraySize, pos: Pos, blank: bool) {
        // required only in app for client side interactions
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            self.cache = None;
            return;
        }

        if !blank && self.cache.is_none() {
            return;
        }

        if let Some(cache) = self.cache.as_mut() {
            let val = if blank { Some(Some(true)) } else { Some(None) };
            cache.set(pos.translate(1, 1, 1, 1), val);
        } else {
            let width = array_size.w.get() as i64;
            let height = array_size.h.get() as i64;

            let mut cache = Contiguous2D::new();
            cache.set_rect(1, 1, Some(width), Some(height), Some(None));
            cache.set(pos.translate(1, 1, 1, 1), Some(Some(true)));
            self.cache = Some(cache);
        }

        self.check_and_remove_cache(array_size);
    }

    /// Removes a row from the cache
    /// Checks and removes the cache if all cells are non-empty
    pub fn remove_row(&mut self, array_size: &ArraySize, row: i64) {
        // required only in app for client side interactions
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            self.cache = None;
            return;
        }

        self.cache.as_mut().map(|cache| cache.remove_row(row + 1));

        self.check_and_remove_cache(array_size);
    }

    /// Checks and removes the cache if all cells are non-empty
    fn check_and_remove_cache(&mut self, array_size: &ArraySize) {
        let width = array_size.w.get() as i64;
        let height = array_size.h.get() as i64;

        let can_remove = self.cache.as_ref().is_some_and(|cache| {
            cache
                .unique_values_in_rect(Rect::new(1, 1, width, height))
                .iter()
                .all(|val| val == &Some(None))
        });

        if can_remove {
            self.cache = None;
        }
    }
}
