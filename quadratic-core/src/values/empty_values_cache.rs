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

/// Skip building the cache for arrays larger than this to avoid slow import and high memory use.
const EMPTY_VALUES_CACHE_MAX_CELLS: usize = 100_000;

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

        if values.len() > EMPTY_VALUES_CACHE_MAX_CELLS {
            return Self::new();
        }

        let width = array_size.w.get() as i64;
        let height = array_size.h.get() as i64;
        let width_usize = width as usize;

        // Collect empty positions first, then set only those. For tables with few empty
        // cells (e.g. 99k cells, 10 empty), this avoids 99k set() calls.
        let empty_positions: SmallVec<[Pos; 8]> = values
            .iter()
            .enumerate()
            .filter_map(|(i, value)| {
                if value.is_blank_or_empty_string() {
                    let x = (i % width_usize) as i64;
                    let y = (i / width_usize) as i64;
                    Some(Pos { x, y }.translate(1, 1, 1, 1))
                } else {
                    None
                }
            })
            .collect();

        let mut cache = Contiguous2D::new();
        cache.set_rect(1, 1, Some(width), Some(height), Some(None));
        for pos in empty_positions {
            cache.set(pos, Some(Some(true)));
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

        // Clear cache when table grows past threshold so cache presence doesn't depend on history.
        let cell_count = array_size.w.get() as usize * array_size.h.get() as usize;
        if cell_count > EMPTY_VALUES_CACHE_MAX_CELLS {
            self.cache = None;
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
