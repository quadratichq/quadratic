use std::collections::HashSet;

use indexmap::IndexMap;
use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::{
    Pos, Rect, SheetPos,
    a1::A1Context,
    grid::{CodeRun, DataTable, SheetId, SheetRegionMap},
};

use anyhow::{Result, anyhow};

pub mod cache;

use cache::SheetDataTablesCache;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SheetDataTables {
    #[serde(with = "crate::util::indexmap_serde")]
    data_tables: IndexMap<Pos, DataTable>,

    // cache of tables in the sheet, as is. This takes spills / errors into account
    cache: SheetDataTablesCache,

    // region map indicating output rects of data tables ignoring spills (as if un spilled)
    // as spills are ignored, rects can overlap i.e. same position can have multiple tables trying to output
    // single cell output values are not stored here, check `has_data_table_anchor` map for single cell values
    // this is used for spill calculation and when spill is ignored
    un_spilled_output_rects: SheetRegionMap,
}

impl Default for SheetDataTables {
    fn default() -> Self {
        Self::new()
    }
}

impl IntoIterator for SheetDataTables {
    type Item = (Pos, DataTable);
    type IntoIter = indexmap::map::IntoIter<Pos, DataTable>;

    fn into_iter(self) -> Self::IntoIter {
        self.data_tables.into_iter()
    }
}

impl SheetDataTables {
    /// Constructs a new empty sheet data tables.
    pub(crate) fn new() -> Self {
        Self {
            data_tables: IndexMap::new(),
            cache: SheetDataTablesCache::default(),
            un_spilled_output_rects: SheetRegionMap::new(),
        }
    }

    /// Returns the number of data tables in the sheet data tables.
    pub(crate) fn len(&self) -> usize {
        self.data_tables.len()
    }

    /// Returns the index (position in indexmap) of the data table at the given position, if it exists.
    pub(crate) fn get_index_of(&self, pos: &Pos) -> Option<usize> {
        self.data_tables.get_index_of(pos)
    }

    /// Returns the data table at the given position, if it exists.
    pub fn get_at(&self, pos: &Pos) -> Option<&DataTable> {
        self.data_tables.get(pos)
    }

    /// Returns the data table at the given position, if it exists, along with its index and position.
    pub(crate) fn get_full_at(&self, pos: &Pos) -> Option<(usize, &DataTable)> {
        self.data_tables
            .get_full(pos)
            .map(|(index, _, data_table)| (index, data_table))
    }

    /// Updates mutual spill and cache for the data table at the given index and position.
    ///
    /// This function only updates spill due to another data table, not due to cell values in columns.
    ///
    /// Returns set of dirty rectangle
    #[function_timer::function_timer]
    fn update_spill_and_cache(
        &mut self,
        index: usize,
        pos: Pos,
        old_output_rect: Option<Rect>,
    ) -> HashSet<Rect> {
        let mut dirty_rects = HashSet::new();
        let mut old_rect = None;
        let mut new_rect = None;

        // remove data table from cache
        if let Some(old_spilled_output_rect) = old_output_rect {
            let rects = self
                .cache
                .data_tables
                .nondefault_rects_in_rect(old_spilled_output_rect)
                .filter(|(_, b)| b == &Some(pos))
                .map(|(rect, _)| rect)
                .collect::<Vec<_>>();
            for rect in rects {
                self.cache
                    .data_tables
                    .set_rect(rect.min.x, rect.min.y, rect.max.x, rect.max.y, None);
            }

            self.un_spilled_output_rects.remove_pos(pos);

            old_rect = Some(old_spilled_output_rect);
        }

        // calculate self spill due to other tables
        let mut current_data_table_spill = false;
        if let Some(data_table) = self.data_tables.get(&pos) {
            let current_un_spilled_output_rect = data_table.output_rect(pos, true);

            current_data_table_spill = self
                .get_in_rect_sorted(current_un_spilled_output_rect, false)
                .any(|(intersecting_index, intersecting_pos, _)| {
                    intersecting_index < index
                        || (intersecting_pos != pos
                            && current_un_spilled_output_rect.contains(intersecting_pos))
                });
        }

        // add this table to cache
        if let Some(data_table) = self.data_tables.get_mut(&pos) {
            data_table.spill_data_table = current_data_table_spill;

            let new_spilled_output_rect = data_table.output_rect(pos, false);
            self.cache.data_tables.set_rect(
                new_spilled_output_rect.min.x,
                new_spilled_output_rect.min.y,
                new_spilled_output_rect.max.x,
                new_spilled_output_rect.max.y,
                Some(data_table),
            );

            let new_un_spilled_output_rect = data_table.output_rect(pos, true);
            if new_un_spilled_output_rect.len() > 1 {
                self.un_spilled_output_rects
                    .insert(pos, new_un_spilled_output_rect);
            }

            new_rect = Some(new_spilled_output_rect);
        }

        // check for changes in output rect and any other table spill / unspill due to changes in output rect
        if old_rect != new_rect {
            let updated_rect = match (old_rect, new_rect) {
                (Some(old_rect), Some(new_rect)) => Some(old_rect.union(&new_rect)),
                (Some(old_rect), None) => Some(old_rect),
                (None, Some(new_rect)) => Some(new_rect),
                (None, None) => None,
            };

            let mut other_data_tables_to_update = Vec::new();
            if let Some(updated_rect) = updated_rect {
                // Optimization: For new single-cell formulas (old_rect=None, new_rect=1x1),
                // we only need to check if this cell is inside another table's un-spilled output.
                // This is faster than the general get_in_rect_sorted query.
                let is_new_single_cell = old_rect.is_none() && updated_rect.len() == 1;

                if is_new_single_cell {
                    // Fast path: check only un_spilled_output_rects for overlapping tables
                    for other_pos in self
                        .un_spilled_output_rects
                        .get_positions_associated_with_region(updated_rect)
                    {
                        if other_pos != pos
                            && let Some((other_index, other_data_table)) =
                                self.get_full_at(&other_pos)
                        {
                            let other_old_output_rect =
                                Some(other_data_table.output_rect(other_pos, false));
                            other_data_tables_to_update.push((
                                other_index,
                                other_pos,
                                other_old_output_rect,
                            ));
                        }
                    }
                } else {
                    // General path: check all tables in the updated rect
                    for (other_index, other_pos, other_data_table) in self
                        .get_in_rect_sorted(updated_rect, true)
                        .filter(|(_, other_pos, _)| *other_pos != pos)
                    {
                        let other_old_output_rect =
                            Some(other_data_table.output_rect(other_pos, false));
                        other_data_tables_to_update.push((
                            other_index,
                            other_pos,
                            other_old_output_rect,
                        ));
                    }
                }

                dirty_rects.insert(updated_rect);
            }

            for (other_index, other_pos, other_old_output_rects) in other_data_tables_to_update {
                let other_dirty_rects =
                    self.update_spill_and_cache(other_index, other_pos, other_old_output_rects);
                dirty_rects.extend(other_dirty_rects);
            }
        }

        dirty_rects
    }

    /// Modifies the data table at the given position, updating its spill and cache.
    pub(crate) fn modify_data_table_at(
        &mut self,
        pos: &Pos,
        f: impl FnOnce(&mut DataTable) -> Result<()>,
    ) -> Result<(&DataTable, HashSet<Rect>)> {
        let err = || anyhow!("Data table not found at {:?} in modify_data_table_at", pos);
        let (index, _, data_table) = self.data_tables.get_full_mut(pos).ok_or_else(err)?;
        let old_output_rect = Some(data_table.output_rect(*pos, false));

        f(data_table)?;

        let dirty_rects = self.update_spill_and_cache(index, *pos, old_output_rect);

        let data_table = self.data_tables.get(pos).ok_or_else(err)?;
        Ok((data_table, dirty_rects))
    }

    /// Returns the anchor position of the data table which contains the given position, if it exists.
    pub(crate) fn get_pos_contains(&self, pos: Pos) -> Option<Pos> {
        self.cache.get_pos_contains(pos)
    }

    /// Returns the data table (with anchor position) that contains the given position, if it exists.
    pub(crate) fn get_contains(&self, pos: Pos) -> Option<(Pos, &DataTable)> {
        self.get_pos_contains(pos).and_then(|data_table_pos| {
            self.data_tables
                .get(&data_table_pos)
                .map(|data_table| (data_table_pos, data_table))
        })
    }

    /// Returns an iterator over all positions in the sheet data tables that intersect with a given rectangle.
    pub(crate) fn iter_pos_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = Pos> {
        let cache_positions = if !ignore_spill_error {
            self.cache.data_tables.unique_values_in_rect(rect)
        } else {
            HashSet::new()
        };

        let unspilled_positions = if ignore_spill_error {
            self.un_spilled_output_rects
                .get_positions_associated_with_region(rect)
        } else {
            HashSet::new()
        };

        cache_positions
            .into_iter()
            .flatten()
            .chain(unspilled_positions)
            .sorted_unstable()
            .dedup()
    }

    /// Returns the rectangles that have some value in the given rectangle.
    pub(crate) fn get_nondefault_rects_in_rect(&self, rect: Rect) -> impl Iterator<Item = Rect> {
        self.cache.get_nondefault_rects_in_rect(rect)
    }

    /// Returns an iterator over all data tables in the sheet data tables that intersect with a given rectangle.
    pub(crate) fn get_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, Pos, &DataTable)> {
        self.iter_pos_in_rect(rect, ignore_spill_error)
            .filter_map(|pos| {
                self.get_full_at(&pos)
                    .map(|(index, data_table)| (index, pos, data_table))
            })
    }

    /// Returns an iterator over all code runs in the sheet data tables that intersect with a given rectangle.
    pub(crate) fn get_code_runs_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, Pos, &CodeRun)> {
        self.iter_pos_in_rect(rect, ignore_spill_error)
            .filter_map(|pos| {
                self.get_full_at(&pos).and_then(|(index, data_table)| {
                    data_table.code_run().map(|code_run| (index, pos, code_run))
                })
            })
    }

    /// Returns an iterator over all data tables in the sheet data tables that intersect with a given rectangle, sorted by index.
    pub(crate) fn get_in_rect_sorted(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, Pos, &DataTable)> {
        self.get_in_rect(rect, ignore_spill_error)
            .sorted_by(|a, b| a.0.cmp(&b.0))
    }

    /// Returns an iterator over all code runs in the sheet data tables that intersect with a given rectangle, sorted by index.
    pub(crate) fn get_code_runs_in_sorted(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, Pos, &CodeRun)> {
        self.get_code_runs_in_rect(rect, ignore_spill_error)
            .sorted_by(|a, b| a.0.cmp(&b.0))
    }

    /// Returns a Vec of (index, position) for all data tables in the sheet data tables that intersect with given columns, sorted by index.
    pub(crate) fn get_pos_in_columns_sorted(
        &self,
        columns: &[i64],
        ignore_spill_error: bool,
    ) -> Vec<(usize, Pos)> {
        let mut all_pos = HashSet::new();
        for &column in columns.iter() {
            let column_rect = Rect::new(column, 1, column, i64::MAX);
            all_pos.extend(
                self.get_in_rect(column_rect, ignore_spill_error)
                    .map(|(index, pos, _)| (index, pos)),
            );
        }
        all_pos
            .into_iter()
            .sorted_by(|a, b| a.0.cmp(&b.0))
            .collect::<Vec<_>>()
    }

    /// Returns a Vec of (index, position) for all data tables in the sheet data tables intersect with region after the given column (inclusive), sorted by index.
    pub(crate) fn get_pos_after_column_sorted(
        &self,
        column: i64,
        ignore_spill_error: bool,
    ) -> Vec<(usize, Pos)> {
        let column_rect = Rect::new(column, 1, i64::MAX, i64::MAX);
        let all_pos = self
            .get_in_rect(column_rect, ignore_spill_error)
            .map(|(index, pos, _)| (index, pos));
        all_pos
            .into_iter()
            .sorted_by(|a, b| a.0.cmp(&b.0))
            .collect::<Vec<_>>()
    }

    /// Returns a Vec of (index, position) for all data tables in the sheet data tables intersect with region after the given row (inclusive), sorted by index.
    pub(crate) fn get_pos_after_row_sorted(
        &self,
        row: i64,
        ignore_spill_error: bool,
    ) -> Vec<(usize, Pos)> {
        let row_rect = Rect::new(1, row, i64::MAX, i64::MAX);
        let all_pos = self
            .get_in_rect(row_rect, ignore_spill_error)
            .map(|(index, pos, _)| (index, pos));
        all_pos
            .into_iter()
            .sorted_by(|a, b| a.0.cmp(&b.0))
            .collect::<Vec<_>>()
    }

    /// Inserts a data table at the given position, updating mutual spill and cache.
    pub(crate) fn insert_full(
        &mut self,
        pos: Pos,
        mut data_table: DataTable,
    ) -> (usize, Option<DataTable>, HashSet<Rect>) {
        data_table.spill_data_table = false;

        let (index, old_data_table) = self.data_tables.insert_full(pos, data_table);

        let old_output_rect = old_data_table.as_ref().map(|dt| dt.output_rect(pos, false));

        let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rect);

        (index, old_data_table, dirty_rects)
    }

    /// Inserts a data table before the given index, updating mutual spill and cache.
    #[function_timer::function_timer]
    pub(crate) fn insert_before(
        &mut self,
        mut index: usize,
        pos: Pos,
        mut data_table: DataTable,
    ) -> (usize, Option<DataTable>, HashSet<Rect>) {
        index = index.min(self.len());

        data_table.spill_data_table = false;

        let (index, old_data_table) = self.data_tables.insert_before(index, pos, data_table);

        let old_output_rect = old_data_table.as_ref().map(|dt| dt.output_rect(pos, false));

        let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rect);

        (index, old_data_table, dirty_rects)
    }

    /// Removes a data table at the given position, updating mutual spill and cache.
    pub(crate) fn shift_remove_full(
        &mut self,
        pos: &Pos,
    ) -> Option<(usize, Pos, DataTable, HashSet<Rect>)> {
        let (index, _, old_data_table) = self.data_tables.shift_remove_full(pos)?;

        let old_output_rect = Some(old_data_table.output_rect(*pos, false));

        let dirty_rects = self.update_spill_and_cache(index, *pos, old_output_rect);

        Some((index, *pos, old_data_table, dirty_rects))
    }

    /// Removes a data table at the given position, updating mutual spill and cache.
    pub(crate) fn shift_remove(&mut self, pos: &Pos) -> Option<(usize, DataTable, HashSet<Rect>)> {
        self.shift_remove_full(pos)
            .map(|full| (full.0, full.2, full.3))
    }

    /// Returns the bounds of the column at the given index.
    pub(crate) fn column_bounds(&self, column: i64) -> Option<(i64, i64)> {
        self.cache.column_bounds(column)
    }

    /// Returns the bounds of the row at the given index.
    pub(crate) fn row_bounds(&self, row: i64) -> Option<(i64, i64)> {
        self.cache.row_bounds(row)
    }

    /// Returns the finite bounds of the sheet data tables.
    pub(crate) fn finite_bounds(&mut self) -> Option<Rect> {
        self.cache.finite_bounds()
    }

    /// Returns an iterator over all data tables in the sheet data tables.
    pub(crate) fn expensive_iter(&self) -> impl Iterator<Item = (&Pos, &DataTable)> {
        self.data_tables.iter()
    }

    /// Calls a function to mutate all code cells.
    fn update_code_cells(&mut self, sheet_id: SheetId, func: impl Fn(&mut CodeRun, SheetPos)) {
        self.data_tables
            .iter_mut()
            .filter_map(|(data_table_pos, data_table)| {
                data_table
                    .code_run_mut()
                    .map(|code_run| (data_table_pos.to_sheet_pos(sheet_id), code_run))
            })
            .for_each(|(data_table_sheet_pos, data_table)| {
                func(data_table, data_table_sheet_pos);
            });
    }

    /// Replaces a sheet name when referenced in code cells.
    pub(crate) fn replace_sheet_name_in_code_cells(
        &mut self,
        sheet_id: SheetId,
        old_name: &str,
        new_name: &str,
    ) {
        let other_sheet_id = SheetId::new();
        let old_a1_context = A1Context::with_single_sheet(old_name, other_sheet_id);
        let new_a1_context = A1Context::with_single_sheet(new_name, other_sheet_id);
        self.update_code_cells(sheet_id, |code_run, data_table_sheet_pos| {
            code_run.replace_sheet_name_in_cell_references(
                &old_a1_context,
                &new_a1_context,
                data_table_sheet_pos,
            );
        });
    }

    /// Replaces the table name in all code cells that reference the old name.
    pub(crate) fn replace_table_name_in_code_cells(
        &mut self,
        sheet_id: SheetId,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        self.update_code_cells(sheet_id, |code_cell_value, pos| {
            code_cell_value
                .replace_table_name_in_cell_references(a1_context, pos, old_name, new_name);
        });
    }

    /// Replaces the column name in all code cells that reference the old name.
    pub(crate) fn replace_table_column_name_in_code_cells(
        &mut self,
        sheet_id: SheetId,
        table_name: &str,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        self.update_code_cells(sheet_id, |code_cell_value, pos| {
            code_cell_value.replace_column_name_in_cell_references(
                a1_context, pos, table_name, old_name, new_name,
            );
        });
    }

    /// Returns an iterator over all code runs in the sheet data tables.
    pub(crate) fn expensive_iter_code_runs(&self) -> impl Iterator<Item = (Pos, &CodeRun)> {
        self.data_tables
            .iter()
            .flat_map(|(pos, data_table)| data_table.code_run().map(|code_run| (*pos, code_run)))
    }

    /// This is expensive used only for file migration (< v1.7.1), having data in -ve coordinates
    /// and Contiguous2d cache does not work for -ve coordinates
    pub(crate) fn migration_iter_code_runs_mut(
        &mut self,
    ) -> impl Iterator<Item = (Pos, &mut CodeRun)> {
        self.data_tables.iter_mut().flat_map(|(pos, data_table)| {
            data_table.code_run_mut().map(|code_run| (*pos, code_run))
        })
    }

    /// Exports the cache of data tables.
    pub(crate) fn cache_ref(&self) -> &SheetDataTablesCache {
        &self.cache
    }

    /// Returns true if the given rectangle has any content.
    pub(crate) fn has_content_in_rect(&self, rect: Rect) -> bool {
        self.cache.has_content_in_rect(rect)
    }

    pub(crate) fn has_content_except(&self, rect: Rect, pos: Pos) -> bool {
        self.cache.has_content_except(rect, pos)
    }

    /// Returns true if the sheet data tables are empty.
    #[cfg(test)]
    pub(crate) fn is_empty(&self) -> bool {
        self.data_tables.is_empty()
    }

    /// Returns the data table at the given position, if it exists.
    #[cfg(test)]
    pub(crate) fn get_at_index(&self, index: usize) -> Option<(&Pos, &DataTable)> {
        self.data_tables.get_index(index)
    }
}
