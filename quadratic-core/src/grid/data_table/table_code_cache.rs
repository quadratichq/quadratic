use serde::{Deserialize, Serialize};

use crate::{
    Pos, Value,
    grid::{Contiguous2D, DataTable, Sheet},
};

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableCodeCache {
    cache: Option<Contiguous2D<Option<Pos>>>,
}

impl TableCodeCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Creates a new InnerCodeValuesCache from an array.
    ///
    /// Note: this needs to be built after all data tables are already loaded
    /// since it relies on knowing the inner code table's size.
    pub fn from_data_table(sheet: &Sheet, data_table_pos: Pos, data_table: &DataTable) -> Self {
        if data_table.is_code() {
            return Self::new();
        }

        match &data_table.value {
            Value::Single(_) | Value::Tuple(_) => Self::default(),
            Value::Array(array) => {
                let width = array.width();

                let mut cache = Contiguous2D::new();

                for (i, value) in array.values_iter().enumerate() {
                    dbg!(&value);
                    if value.is_code() {
                        let x = i % width as usize;
                        let y = i / width as usize;
                        let code_table_pos =
                            Pos::new(data_table_pos.x + x as i64, data_table_pos.y + y as i64);
                        dbg!(&code_table_pos);
                        if let Some(code_table) = sheet.data_table_at(&code_table_pos) {
                            dbg!(&code_table);
                            let output_size = code_table.output_rect(code_table_pos, false);
                            cache.set_rect(
                                1 + x as i64,
                                1 + y as i64,
                                Some(1 + x as i64 + output_size.width() as i64),
                                Some(1 + y as i64 + output_size.height() as i64),
                                Some(code_table_pos),
                            );
                        }
                    }
                }

                if cache.is_all_default() {
                    Self::default()
                } else {
                    Self { cache: Some(cache) }
                }
            }
        }
    }

    //     let width = array.width();

    //     // collect all the code cells
    //     let mut code = Vec::<Pos>::new();
    //     for (i, value) in values.iter().enumerate() {
    //         if value.is_code() {
    //             let x = i % width;
    //             let y = i / width;
    //             if let Some(data_table)
    //         }
    //     }

    //     // if there are no empty cells, we don't need to store the cache
    //     if code.is_empty() {
    //         return Self::new();
    //     }

    //     let height = array_size.h.get();

    //     let mut cache = Contiguous2D::new();

    //     // mark all cells (array rect) as Some(None) -> non-empty
    //     cache.set_rect(1, 1, Some(width as i64), Some(height as i64), Some(None));

    //     // then mark empty cells as Some(Some(true))
    //     for pos in empty {
    //         cache.set(pos.translate(1, 1, 1, 1), Some(Some(true)));
    //     }

    //     Self { cache: Some(cache) }
    // }
    // }

    // /// Returns a clone of the cache, this needs to be translated to sheet coordinates
    // /// before can be applied to the SheetDataTablesCache
    // /// Hidden columns and sorted rows are handled in the SheetDataTablesCache
    // pub fn get_cache_owned(&self) -> Option<Contiguous2D<Option<Option<bool>>>> {
    //     self.cache.clone()
    // }

    // /// Updates cache for a single value change in array
    // /// Checks and removes the cache if all cells are non-empty
    // pub fn set_value(&mut self, array_size: &ArraySize, pos: Pos, blank: bool) {
    //     // required only in app for client side interactions
    //     if !cfg!(target_family = "wasm") && !cfg!(test) {
    //         self.cache = None;
    //         return;
    //     }

    //     if !blank && self.cache.is_none() {
    //         return;
    //     }

    //     if let Some(cache) = self.cache.as_mut() {
    //         let val = if blank { Some(Some(true)) } else { Some(None) };
    //         cache.set(pos.translate(1, 1, 1, 1), val);
    //     } else {
    //         let width = array_size.w.get() as i64;
    //         let height = array_size.h.get() as i64;

    //         let mut cache = Contiguous2D::new();
    //         cache.set_rect(1, 1, Some(width), Some(height), Some(None));
    //         cache.set(pos.translate(1, 1, 1, 1), Some(Some(true)));
    //         self.cache = Some(cache);
    //     }

    //     self.check_and_remove_cache(array_size);
    // }

    // /// Removes a row from the cache
    // /// Checks and removes the cache if all cells are non-empty
    // pub fn remove_row(&mut self, array_size: &ArraySize, row: i64) {
    //     // required only in app for client side interactions
    //     if !cfg!(target_family = "wasm") && !cfg!(test) {
    //         self.cache = None;
    //         return;
    //     }

    //     self.cache.as_mut().map(|cache| cache.remove_row(row + 1));

    //     self.check_and_remove_cache(array_size);
    // }

    // /// Checks and removes the cache if all cells are non-empty
    // fn check_and_remove_cache(&mut self, array_size: &ArraySize) {
    //     let width = array_size.w.get() as i64;
    //     let height = array_size.h.get() as i64;

    //     let can_remove = self.cache.as_ref().is_some_and(|cache| {
    //         cache
    //             .unique_values_in_rect(Rect::new(1, 1, width, height))
    //             .iter()
    //             .all(|val| val == &Some(None))
    //     });

    //     if can_remove {
    //         self.cache = None;
    //     }
    // }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{grid::CodeCellLanguage, test_util::*};

    #[test]
    fn test_create_from_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);

        gc.set_code_cell(
            pos![sheet_id!a3],
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
            None,
        );

        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();

        let cache = TableCodeCache::from_data_table(&gc.sheet(sheet_id), pos![A1], data_table);

        dbg!(&cache);
    }
}
