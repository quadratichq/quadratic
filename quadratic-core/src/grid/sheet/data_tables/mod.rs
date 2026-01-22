use std::collections::HashSet;

use indexmap::IndexMap;
use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::{
    MultiPos, Pos, Rect, SheetPos, TablePos,
    a1::A1Context,
    grid::{CodeRun, DataTable, SheetId, SheetRegionMap},
};

use anyhow::{Result, anyhow};

pub mod cache;
pub mod in_table_code;

pub use in_table_code::InTableCodeCache;

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

    // cache of code cells within tables (for in-table formulas/code)
    #[serde(default)]
    in_table_code_cache: InTableCodeCache,
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
            in_table_code_cache: InTableCodeCache::new(),
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

    // -------------------------------------------------------------------------
    // MultiPos accessors for nested table support
    // -------------------------------------------------------------------------

    /// Returns the data table at the given MultiPos.
    ///
    /// For `MultiPos::Pos`, returns the top-level data table.
    /// For `MultiPos::TablePos`, returns the nested data table within the parent table.
    pub fn get_at_multi_pos(&self, multi_pos: &MultiPos) -> Option<&DataTable> {
        match multi_pos {
            MultiPos::Pos(pos) => self.get_at(pos),
            MultiPos::TablePos(table_pos) => self.get_nested_table(table_pos),
        }
    }

    /// Returns a nested data table at the given TablePos.
    pub fn get_nested_table(&self, table_pos: &TablePos) -> Option<&DataTable> {
        let parent = self.get_at(&table_pos.parent_pos)?;
        let nested_tables = parent.tables.as_ref()?;
        nested_tables.get_at(&table_pos.sub_table_pos)
    }

    /// Returns the index of the data table at the given MultiPos.
    ///
    /// For `MultiPos::Pos`, returns the top-level index.
    /// For `MultiPos::TablePos`, returns the index in the nested tables.
    #[allow(dead_code)] // Part of MultiPos API, will be used when full in-table code support is added
    pub(crate) fn get_index_of_multi_pos(&self, multi_pos: &MultiPos) -> Option<usize> {
        match multi_pos {
            MultiPos::Pos(pos) => self.get_index_of(pos),
            MultiPos::TablePos(table_pos) => {
                let parent = self.get_at(&table_pos.parent_pos)?;
                let nested_tables = parent.tables.as_ref()?;
                nested_tables.get_index_of(&table_pos.sub_table_pos)
            }
        }
    }

    /// Modifies the data table at the given MultiPos, updating its spill and cache.
    ///
    /// For `MultiPos::Pos`, modifies the top-level data table.
    /// For `MultiPos::TablePos`, modifies the nested data table within the parent table.
    pub(crate) fn modify_data_table_at_multi_pos(
        &mut self,
        multi_pos: &MultiPos,
        f: impl FnOnce(&mut DataTable) -> Result<()>,
    ) -> Result<HashSet<Rect>> {
        match multi_pos {
            MultiPos::Pos(pos) => {
                let (_, dirty_rects) = self.modify_data_table_at(pos, f)?;
                Ok(dirty_rects)
            }
            MultiPos::TablePos(table_pos) => self.modify_nested_table(table_pos, f),
        }
    }

    /// Modifies a nested data table at the given TablePos.
    fn modify_nested_table(
        &mut self,
        table_pos: &TablePos,
        f: impl FnOnce(&mut DataTable) -> Result<()>,
    ) -> Result<HashSet<Rect>> {
        let parent_pos = table_pos.parent_pos;
        let sub_pos = table_pos.sub_table_pos;

        // We need to modify the parent table to get access to its nested tables
        let mut dirty_rects = HashSet::new();

        let err = || {
            anyhow!(
                "Data table not found at {:?} in modify_nested_table",
                parent_pos
            )
        };
        let (index, _, parent_table) = self.data_tables.get_full_mut(&parent_pos).ok_or_else(err)?;
        let old_output_rect = Some(parent_table.output_rect(parent_pos, false));

        // Get or create the nested tables
        let nested_tables = parent_table.tables.get_or_insert_with(SheetDataTables::new);

        // Modify the nested table
        let nested_err = || {
            anyhow!(
                "Nested data table not found at {:?} in modify_nested_table",
                sub_pos
            )
        };
        let nested_table = nested_tables
            .data_tables
            .get_mut(&sub_pos)
            .ok_or_else(nested_err)?;

        f(nested_table)?;

        // Update spill and cache for the parent table
        dirty_rects.extend(self.update_spill_and_cache(index, parent_pos, old_output_rect));

        Ok(dirty_rects)
    }

    /// Inserts a data table at the given MultiPos.
    ///
    /// For `MultiPos::Pos`, inserts at top-level.
    /// For `MultiPos::TablePos`, inserts into the parent table's nested tables.
    pub(crate) fn insert_at_multi_pos(
        &mut self,
        multi_pos: &MultiPos,
        data_table: DataTable,
    ) -> Result<HashSet<Rect>> {
        match multi_pos {
            MultiPos::Pos(pos) => {
                let (_, _, dirty_rects) = self.insert_full(*pos, data_table);
                Ok(dirty_rects)
            }
            MultiPos::TablePos(table_pos) => self.insert_nested_table(table_pos, data_table),
        }
    }

    /// Inserts a nested data table at the given TablePos.
    fn insert_nested_table(
        &mut self,
        table_pos: &TablePos,
        data_table: DataTable,
    ) -> Result<HashSet<Rect>> {
        let parent_pos = table_pos.parent_pos;
        let sub_pos = table_pos.sub_table_pos;

        let err = || {
            anyhow!(
                "Parent data table not found at {:?} in insert_nested_table",
                parent_pos
            )
        };
        let (index, _, parent_table) = self.data_tables.get_full_mut(&parent_pos).ok_or_else(err)?;
        let old_output_rect = Some(parent_table.output_rect(parent_pos, false));

        // Calculate the display position of the nested cell for dirty rect
        // Note: sub_pos is in data coordinates; we need to convert to display coordinates
        let y_adjustment = parent_table.y_adjustment(true);
        let display_col = parent_table.get_display_index_from_column_index(sub_pos.x as u32, true);
        // For rows, without sorting the display index equals the data index
        let display_row = sub_pos.y;
        let cell_display_pos = Pos::new(
            parent_pos.x + display_col as i64,
            parent_pos.y + y_adjustment + display_row,
        );

        // Get or create the nested tables
        let nested_tables = parent_table.tables.get_or_insert_with(SheetDataTables::new);

        // Insert the nested table
        nested_tables.data_tables.insert(sub_pos, data_table);

        // Update spill and cache for the parent table
        let mut dirty_rects = self.update_spill_and_cache(index, parent_pos, old_output_rect);

        // Also mark the specific cell as dirty so it re-renders
        dirty_rects.insert(Rect::single_pos(cell_display_pos));

        Ok(dirty_rects)
    }

    /// Removes a data table at the given MultiPos.
    ///
    /// For `MultiPos::Pos`, removes from top-level.
    /// For `MultiPos::TablePos`, removes from the parent table's nested tables.
    pub(crate) fn remove_at_multi_pos(
        &mut self,
        multi_pos: &MultiPos,
    ) -> Option<(DataTable, HashSet<Rect>)> {
        match multi_pos {
            MultiPos::Pos(pos) => {
                let (_, data_table, dirty_rects) = self.shift_remove(pos)?;
                Some((data_table, dirty_rects))
            }
            MultiPos::TablePos(table_pos) => self.remove_nested_table(table_pos),
        }
    }

    /// Removes a nested data table at the given TablePos.
    fn remove_nested_table(&mut self, table_pos: &TablePos) -> Option<(DataTable, HashSet<Rect>)> {
        let parent_pos = table_pos.parent_pos;
        let sub_pos = table_pos.sub_table_pos;

        let (index, _, parent_table) = self.data_tables.get_full_mut(&parent_pos)?;
        let old_output_rect = Some(parent_table.output_rect(parent_pos, false));

        // Get the nested tables
        let nested_tables = parent_table.tables.as_mut()?;

        // Remove the nested table
        let removed_table = nested_tables.data_tables.shift_remove(&sub_pos)?;

        // Update spill and cache for the parent table
        let dirty_rects = self.update_spill_and_cache(index, parent_pos, old_output_rect);

        Some((removed_table, dirty_rects))
    }

    // -------------------------------------------------------------------------
    // In-table code cache methods
    // -------------------------------------------------------------------------

    /// Adds a code cell to the in-table code cache.
    pub(crate) fn add_in_table_code(&mut self, table_pos: &TablePos) {
        self.in_table_code_cache.add(table_pos);
    }

    /// Removes a code cell from the in-table code cache.
    pub(crate) fn remove_in_table_code(&mut self, table_pos: &TablePos) -> bool {
        self.in_table_code_cache.remove(table_pos)
    }

    /// Returns true if the given TablePos has a code cell.
    pub fn has_in_table_code(&self, table_pos: &TablePos) -> bool {
        self.in_table_code_cache.contains(table_pos)
    }

    /// Returns true if the given MultiPos has an in-table code cell.
    pub fn has_in_table_code_multi_pos(&self, multi_pos: &MultiPos) -> bool {
        self.in_table_code_cache.contains_multi_pos(multi_pos)
    }

    /// Returns all code cells within the given parent table.
    pub fn code_cells_in_table(&self, parent_pos: &Pos) -> impl Iterator<Item = TablePos> + '_ {
        self.in_table_code_cache.code_cells_in_table(parent_pos)
    }

    /// Returns all in-table code cells across all tables.
    pub fn all_in_table_code_cells(&self) -> impl Iterator<Item = TablePos> + '_ {
        self.in_table_code_cache.all_code_cells()
    }

    /// Clears all code cells for a specific table.
    #[allow(dead_code)] // Part of in-table code API, will be used when full support is added
    pub(crate) fn clear_table_code(&mut self, parent_pos: &Pos) -> Option<HashSet<Pos>> {
        self.in_table_code_cache.clear_table(parent_pos)
    }

    /// Returns true if any tables in the rect have code cells.
    pub fn has_in_table_code_in_rect(&self, rect: Rect) -> bool {
        self.in_table_code_cache.has_code_in_rect(rect)
    }

    /// Returns a reference to the in-table code cache.
    pub fn in_table_code_cache(&self) -> &InTableCodeCache {
        &self.in_table_code_cache
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        Array, CellValue, Value,
        cellvalue::Import,
        grid::data_table::{DataTable, DataTableKind},
    };
    use chrono::Utc;

    fn create_test_table(name: &str) -> DataTable {
        let values = vec![CellValue::Text("A".to_string())];
        let size = crate::ArraySize::new(1, 1).unwrap();
        let array = Array::new_row_major(size, values.into()).unwrap();

        DataTable {
            kind: DataTableKind::Import(Import::new("test.csv".to_string())),
            name: CellValue::Text(name.to_string()),
            value: Value::Array(array),
            last_modified: Utc::now(),
            header_is_first_row: false,
            column_headers: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            spill_value: false,
            spill_data_table: false,
            spill_merged_cell: false,
            alternating_colors: true,
            formats: None,
            borders: None,
            show_name: None,
            show_columns: None,
            chart_pixel_output: None,
            chart_output: None,
            tables: None,
        }
    }

    #[test]
    fn test_get_at_multi_pos_regular() {
        let mut tables = SheetDataTables::new();
        let pos = Pos::new(1, 1);
        let table = create_test_table("Table1");

        tables.insert_full(pos, table);

        // Should find table at regular Pos
        let multi_pos = MultiPos::Pos(pos);
        assert!(tables.get_at_multi_pos(&multi_pos).is_some());

        // Should not find table at different Pos
        let other_pos = MultiPos::Pos(Pos::new(5, 5));
        assert!(tables.get_at_multi_pos(&other_pos).is_none());
    }

    #[test]
    fn test_nested_table_operations() {
        let mut tables = SheetDataTables::new();
        let parent_pos = Pos::new(1, 1);

        // Create parent table
        let mut parent_table = create_test_table("ParentTable");
        parent_table.tables = Some(SheetDataTables::new());
        tables.insert_full(parent_pos, parent_table);

        // Insert nested table
        let table_pos = TablePos::new(parent_pos, Pos::new(0, 0));
        let nested_table = create_test_table("NestedTable");

        let result = tables.insert_at_multi_pos(&MultiPos::TablePos(table_pos), nested_table);
        assert!(result.is_ok());

        // Verify nested table exists
        assert!(tables.get_at_multi_pos(&MultiPos::TablePos(table_pos)).is_some());

        // Get the nested table
        let nested = tables.get_nested_table(&table_pos);
        assert!(nested.is_some());
        assert_eq!(nested.unwrap().name, CellValue::Text("NestedTable".to_string()));

        // Remove nested table
        let removed = tables.remove_at_multi_pos(&MultiPos::TablePos(table_pos));
        assert!(removed.is_some());
        let (removed_table, _) = removed.unwrap();
        assert_eq!(removed_table.name, CellValue::Text("NestedTable".to_string()));

        // Verify nested table is gone
        assert!(tables.get_at_multi_pos(&MultiPos::TablePos(table_pos)).is_none());
    }

    #[test]
    fn test_in_table_code_cache_integration() {
        let mut tables = SheetDataTables::new();

        // Add code cells to cache
        let table_pos1 = TablePos::from_coords(1, 1, 0, 0);
        let table_pos2 = TablePos::from_coords(1, 1, 1, 0);
        let table_pos3 = TablePos::from_coords(5, 5, 0, 0);

        tables.add_in_table_code(&table_pos1);
        tables.add_in_table_code(&table_pos2);
        tables.add_in_table_code(&table_pos3);

        // Verify they're in the cache
        assert!(tables.has_in_table_code(&table_pos1));
        assert!(tables.has_in_table_code(&table_pos2));
        assert!(tables.has_in_table_code(&table_pos3));

        // Check multi_pos version
        assert!(tables.has_in_table_code_multi_pos(&MultiPos::TablePos(table_pos1)));
        assert!(!tables.has_in_table_code_multi_pos(&MultiPos::Pos(Pos::new(1, 1))));

        // Get code cells in table at (1,1)
        let cells: Vec<_> = tables.code_cells_in_table(&Pos::new(1, 1)).collect();
        assert_eq!(cells.len(), 2);

        // Get all code cells
        let all_cells: Vec<_> = tables.all_in_table_code_cells().collect();
        assert_eq!(all_cells.len(), 3);

        // Remove one
        assert!(tables.remove_in_table_code(&table_pos1));
        assert!(!tables.has_in_table_code(&table_pos1));

        // Check has_in_table_code_in_rect
        assert!(tables.has_in_table_code_in_rect(Rect::new(0, 0, 10, 10)));
        assert!(!tables.has_in_table_code_in_rect(Rect::new(20, 20, 30, 30)));
    }
}
