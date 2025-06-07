use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use smallvec::SmallVec;

use crate::{CellValue, Pos, grid::Contiguous2D};

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct EmptyValuesCache {
    cache: Option<Contiguous2D<Option<Option<bool>>>>,
}

impl From<(&SmallVec<[CellValue; 1]>, usize)> for EmptyValuesCache {
    fn from((values, width): (&SmallVec<[CellValue; 1]>, usize)) -> Self {
        // required only in app for client side interactions
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return Self::new();
        }

        // tracks only multi-cell tables
        if values.len() <= 1 {
            return Self::new();
        }

        let mut empty = Vec::<Pos>::new();
        for (i, value) in values.iter().enumerate() {
            if value.is_blank_or_empty_string() {
                let x = i % width;
                let y = i / width;
                empty.push((x + 1, y + 1).into());
            }
        }

        // if there are no empty cells, we don't need to store the cache
        if empty.is_empty() {
            return Self::new();
        }

        let mut cache = Contiguous2D::new();
        cache.set_rect(1, 1, None, None, Some(None));
        for pos in empty {
            cache.set(pos, Some(Some(true)));
        }

        Self { cache: Some(cache) }
    }
}

impl EmptyValuesCache {
    pub fn new() -> Self {
        Self { cache: None }
    }

    pub fn get_cache(&self) -> Option<Contiguous2D<Option<Option<bool>>>> {
        self.cache.clone()
    }

    pub fn remove_column(&mut self, column: i64) {
        self.cache
            .as_mut()
            .map(|cache| cache.remove_column(column + 1));
    }

    pub fn remove_row(&mut self, row: i64) {
        self.cache.as_mut().map(|cache| cache.remove_row(row + 1));
    }
}
