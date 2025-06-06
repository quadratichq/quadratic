//! This is a subset of the cache of data tables that is used by both
//! SheetDataTables and the client. Only SheetDataTables can modify the cache.

use std::collections::HashSet;

use crate::{
    Pos, Rect, Value,
    a1::RefRangeBounds,
    grid::{Contiguous2D, DataTable},
};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetDataTablesCache {
    // boolean map indicating presence of single cell data table at a position
    // this takes spills and errors into account, which are also single cell tables
    // NOTE: the bool cannot be false
    pub(crate) single_cell_tables: Contiguous2D<Option<bool>>,

    // cache of output rect and empty values for multi-cell data tables
    pub(crate) multi_cell_tables: MultiCellTablesCache,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MultiCellTablesCache {
    // position map indicating presence of multi-cell data table at a position
    // each position value is the root cell position of the data table
    // this accounts for table spills hence values cannot overlap
    multi_cell_tables: Contiguous2D<Option<Pos>>,

    // position map indicating presence of empty cells within a multi-cell data table
    // this is used to assist with finding the next cell with content
    // NOTE: the bool cannot be false
    multi_cell_tables_empty: Contiguous2D<Option<bool>>,
}

impl MultiCellTablesCache {
    pub fn new() -> Self {
        Self {
            multi_cell_tables: Contiguous2D::new(),
            multi_cell_tables_empty: Contiguous2D::new(),
        }
    }

    pub fn get(&self, pos: Pos) -> Option<Pos> {
        self.multi_cell_tables.get(pos)
    }

    pub fn set_rect(
        &mut self,
        x1: i64,
        y1: i64,
        x2: i64,
        y2: i64,
        value: Option<(&Pos, &DataTable)>,
    ) {
        if let Some((pos, data_table)) = value {
            self.multi_cell_tables
                .set_rect(x1, y1, Some(x2), Some(y2), Some(*pos));
            if let Value::Array(array) = &data_table.value {
                if let Some(mut empty_values_cache) = array.empty_values_cache_ref() {
                    // mark table name and column headers as non-empty
                    let y_adjustment = data_table.y_adjustment(true);
                    if y_adjustment > 0 {
                        self.multi_cell_tables_empty.set_rect(
                            x1,
                            y1,
                            Some(x2),
                            Some(y1 + y_adjustment - 1),
                            None,
                        );
                    }

                    // update empty values cache
                    empty_values_cache
                        .translate_in_place(pos.x - 1, pos.y + data_table.y_adjustment(true) - 1);
                    self.multi_cell_tables_empty.set_from(&empty_values_cache);
                } else {
                    self.multi_cell_tables_empty
                        .set_rect(x1, y1, Some(x2), Some(y2), None);
                }
            }
        } else {
            self.multi_cell_tables
                .set_rect(x1, y1, Some(x2), Some(y2), None);
            self.multi_cell_tables_empty
                .set_rect(x1, y1, Some(x2), Some(y2), None);
        }
    }

    pub fn is_all_default_in_rect(&self, rect: Rect) -> bool {
        self.multi_cell_tables.is_all_default_in_rect(rect)
    }

    pub fn nondefault_rects_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Option<Pos>)> {
        self.multi_cell_tables.nondefault_rects_in_rect(rect)
    }

    pub fn unique_values_in_rect(&self, rect: Rect) -> HashSet<Option<Pos>> {
        self.multi_cell_tables.unique_values_in_rect(rect)
    }

    pub fn unique_values_in_range(&self, range: RefRangeBounds) -> HashSet<Option<Pos>> {
        self.multi_cell_tables.unique_values_in_range(range)
    }

    pub fn col_min(&self, column: i64) -> i64 {
        self.multi_cell_tables.col_min(column)
    }

    pub fn col_max(&self, column: i64) -> i64 {
        self.multi_cell_tables.col_max(column)
    }

    pub fn row_min(&self, row: i64) -> i64 {
        self.multi_cell_tables.row_min(row)
    }

    pub fn row_max(&self, row: i64) -> i64 {
        self.multi_cell_tables.row_max(row)
    }

    pub fn finite_bounds(&self) -> Option<Rect> {
        self.multi_cell_tables.finite_bounds()
    }
}
