use std::collections::HashSet;

use indexmap::IndexMap;
use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::{
    MultiPos, Pos, Rect,
    grid::{CodeRun, DataTable, SheetRegionMap},
};

use anyhow::{Result, anyhow};

pub mod cache;
pub(crate) mod in_table_code;
pub(crate) mod multi_cell_tables_cache;

use cache::SheetDataTablesCache;

#[derive(Serialize, Deserialize, Clone, PartialEq)]
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

impl From<IndexMap<Pos, DataTable>> for SheetDataTables {
    fn from(mut data_tables: IndexMap<Pos, DataTable>) -> Self {
        let mut data_tables_pos = Vec::new();
        data_tables.iter_mut().for_each(|(pos, dt)| {
            dt.spill_data_table = false;
            data_tables_pos.push(*pos);
        });

        let mut sheet_data_tables = Self::new();
        sheet_data_tables.data_tables = data_tables;
        for (index, pos) in data_tables_pos.iter().enumerate() {
            sheet_data_tables.update_spill_and_cache(index, pos, None);
        }
        sheet_data_tables
    }
}

impl SheetDataTables {
    /// Constructs a new empty sheet data tables.
    pub fn new() -> Self {
        Self {
            data_tables: IndexMap::new(),
            cache: SheetDataTablesCache::default(),
            un_spilled_output_rects: SheetRegionMap::new(),
        }
    }

    /// Returns true if the sheet data tables are empty.
    pub fn is_empty(&self) -> bool {
        self.data_tables.is_empty()
    }

    /// Returns the number of data tables in the sheet data tables.
    pub fn len(&self) -> usize {
        self.data_tables.len()
    }

    /// Returns the index of either a Table or a sub-Table at the given
    /// multi-pos, if it exists.
    pub fn get_index_of(&self, multi_pos: &MultiPos) -> Option<usize> {
        match multi_pos {
            MultiPos::Pos(pos) => self.data_tables.get_index_of(pos),
            MultiPos::TablePos(table_pos) => {
                if let Some(parent_data_table) = self.data_tables.get(&table_pos.parent_pos) {
                    if let Some(tables) = &parent_data_table.tables {
                        tables.data_tables.get_index_of(&table_pos.sub_table_pos)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
        }
    }

    /// Returns the data table at the given position, if it exists.
    pub fn get_at(&self, multi_pos: &MultiPos) -> Option<&DataTable> {
        match multi_pos {
            MultiPos::Pos(pos) => self.data_tables.get(pos),
            MultiPos::TablePos(table_pos) => {
                if let Some(data_table) = self.data_tables.get(&table_pos.parent_pos) {
                    data_table
                        .tables
                        .as_ref()
                        .and_then(|tables| tables.data_tables.get(&table_pos.sub_table_pos))
                } else {
                    None
                }
            }
        }
    }

    /// Returns a mutable reference to the DataTable. This should be used with
    /// caution, as it allows the DataTable to be modified in place.
    pub fn get_at_mut(&mut self, pos: &Pos) -> Option<&mut DataTable> {
        self.data_tables.get_mut(pos)
    }

    /// Updates mutual spill and cache for the data table at the given index and
    /// position.
    ///
    /// This function only updates spill due to another data table, not due to
    /// cell values in columns.
    ///
    /// Returns set of dirty rectangle, which are the rects that need to be
    /// rendered due to the spill calculation.
    fn update_spill_and_cache(
        &mut self,
        index: usize,
        pos: &Pos,
        old_output_rect: Option<Rect>,
    ) -> HashSet<Rect> {
        let mut dirty_rects = HashSet::new();
        let mut old_rect = None;
        let mut new_rect = None;

        // remove data table from cache
        if let Some(old_spilled_output_rect) = old_output_rect {
            if old_spilled_output_rect.len() == 1 {
                self.cache.single_cell_tables.set(*pos, None);
            } else {
                let rects = self
                    .cache
                    .multi_cell_tables
                    .nondefault_rects_in_rect(old_spilled_output_rect)
                    .filter(|(_, b)| b == &Some(*pos))
                    .map(|(rect, _)| rect)
                    .collect::<Vec<_>>();
                for rect in rects {
                    self.cache
                        .multi_cell_tables
                        .set_rect(rect.min.x, rect.min.y, rect.max.x, rect.max.y, None);
                }

                self.cache
                    .remove_from_in_table_code(old_spilled_output_rect);
            }

            self.un_spilled_output_rects.remove_pos(*pos);

            old_rect = Some(old_spilled_output_rect);
        }

        // check for self spill and other data tables spill due of this table
        let mut spill_current_data_table = false;
        let mut other_data_tables_to_spill = HashSet::new();
        if let Some(data_table) = self.data_tables.get(pos) {
            let current_un_spilled_output_rect = data_table.output_rect(*pos, true);

            // calculate self spill
            spill_current_data_table = self
                .get_in_rect_sorted(current_un_spilled_output_rect, false)
                .any(|other| other.0 < index);

            // if no self spill, check for other data table spill due to this table
            if !spill_current_data_table && !data_table.spill_value {
                other_data_tables_to_spill = self
                    .cache
                    .multi_cell_tables
                    .unique_values_in_rect(current_un_spilled_output_rect);
            }
        }

        // add this table to cache
        if let Some(data_table) = self.data_tables.get_mut(pos) {
            data_table.spill_data_table = spill_current_data_table;

            let new_spilled_output_rect = data_table.output_rect(*pos, false);

            if new_spilled_output_rect.len() == 1 {
                self.cache.single_cell_tables.set(*pos, Some(true));
            } else {
                self.cache.multi_cell_tables.set_rect(
                    new_spilled_output_rect.min.x,
                    new_spilled_output_rect.min.y,
                    new_spilled_output_rect.max.x,
                    new_spilled_output_rect.max.y,
                    Some(data_table),
                );

                self.cache.add_to_in_table_code(*pos, data_table);
            }

            let new_un_spilled_output_rect = data_table.output_rect(*pos, true);
            if new_un_spilled_output_rect.len() > 1 {
                self.un_spilled_output_rects
                    .insert(*pos, new_un_spilled_output_rect);
            }

            new_rect = Some(new_spilled_output_rect);
        }

        // spill other tables due to this table
        for spill_pos in other_data_tables_to_spill.into_iter().flatten() {
            if let Ok((_, spilled_dirty_rect)) =
                self.modify_data_table_at(&spill_pos.into(), |table| {
                    table.spill_data_table = true;
                    Ok(())
                })
            {
                dirty_rects.extend(spilled_dirty_rect);
            }
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
                for (other_index, other_pos, other_data_table) in self
                    .get_in_rect_sorted(updated_rect, true)
                    .filter(|other| other.0 >= index && &other.1 != pos)
                {
                    let other_old_output_rect =
                        Some(other_data_table.output_rect(other_pos, false));
                    other_data_tables_to_update.push((
                        other_index,
                        other_pos,
                        other_old_output_rect,
                    ));
                }

                dirty_rects.insert(updated_rect);
            }

            for (other_index, other_pos, other_old_output_rects) in other_data_tables_to_update {
                let other_dirty_rects =
                    self.update_spill_and_cache(other_index, &other_pos, other_old_output_rects);
                dirty_rects.extend(other_dirty_rects);
            }
        }

        dirty_rects
    }

    /// Modifies the data table at the given position, updating its spill and cache.
    pub fn modify_data_table_at(
        &mut self,
        multi_pos: &MultiPos,
        f: impl FnOnce(&mut DataTable) -> Result<()>,
    ) -> Result<(&DataTable, HashSet<Rect>)> {
        let err = || anyhow!("Data table not found at {multi_pos:?} in modify_data_table_at");

        let mut dirty_rects = HashSet::new();

        match multi_pos {
            MultiPos::Pos(pos) => {
                let (index, _, data_table) = self.data_tables.get_full_mut(pos).ok_or_else(err)?;

                let old_output_rect = Some(data_table.output_rect(*pos, false));

                f(data_table)?;

                dirty_rects.extend(self.update_spill_and_cache(index, pos, old_output_rect));
            }
            MultiPos::TablePos(table_pos) => {
                let (parent_index, _, parent_data_table) = self
                    .data_tables
                    .get_full_mut(&table_pos.parent_pos)
                    .ok_or_else(err)?;

                let old_parent_output_rect =
                    Some(parent_data_table.output_rect(table_pos.parent_pos, false));

                let nested_tables = parent_data_table.tables.as_mut().ok_or_else(err)?;

                let (_, nested_rects) =
                    nested_tables.modify_data_table_at(&table_pos.sub_table_pos.into(), f)?;

                dirty_rects.extend(nested_rects);

                // Update the parent table's spill and cache
                dirty_rects.extend(self.update_spill_and_cache(
                    parent_index,
                    &table_pos.parent_pos,
                    old_parent_output_rect,
                ));
            }
        }

        let data_table = self.get_at(multi_pos).ok_or_else(err)?;

        Ok((data_table, dirty_rects))
    }

    /// Returns the anchor position of the data table which contains the given position, if it exists.
    pub fn get_pos_contains(&self, pos: Pos) -> Option<Pos> {
        self.cache.get_pos_contains(pos)
    }

    /// Returns the data table (with anchor position) that contains the given position, if it exists.
    pub fn get_contains(&self, pos: Pos) -> Option<(Pos, &DataTable)> {
        self.get_pos_contains(pos).and_then(|data_table_pos| {
            self.data_tables
                .get(&data_table_pos)
                .map(|data_table| (data_table_pos, data_table))
        })
    }

    /// Returns an iterator over all positions in the sheet data tables that intersect with a given rectangle.
    pub fn iter_pos_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = Pos> {
        self.cache
            .single_cell_tables
            .nondefault_rects_in_rect(rect)
            .flat_map(|(rect, _)| {
                rect.x_range()
                    .flat_map(move |x| rect.y_range().map(move |y| Pos { x, y }))
            })
            .chain(
                if !ignore_spill_error {
                    self.cache.multi_cell_tables.unique_values_in_rect(rect)
                } else {
                    HashSet::new()
                }
                .into_iter()
                .flatten(),
            )
            .chain(if ignore_spill_error {
                self.un_spilled_output_rects
                    .get_positions_associated_with_region(rect)
            } else {
                HashSet::new()
            })
            .sorted_unstable()
            .dedup()
    }

    /// Returns the rectangles that have some value in the given rectangle.
    pub fn get_nondefault_rects_in_rect(&self, rect: Rect) -> impl Iterator<Item = Rect> {
        self.cache.get_nondefault_rects_in_rect(rect)
    }

    /// Returns an iterator over all data tables in the sheet data tables that intersect with a given rectangle.
    pub fn get_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, Pos, &DataTable)> {
        self.iter_pos_in_rect(rect, ignore_spill_error)
            .filter_map(|pos| {
                self.data_tables
                    .get_full(&pos)
                    .map(|(index, _, data_table)| (index, pos, data_table))
            })
    }

    /// Returns an iterator over all data tables in the sheet data tables that intersect with a given rectangle, sorted by index.
    pub fn get_in_rect_sorted(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, Pos, &DataTable)> {
        self.get_in_rect(rect, ignore_spill_error)
            .sorted_by(|a, b| a.0.cmp(&b.0))
    }

    /// Returns an iterator over all data tables in the sheet data tables that intersect with a given rectangle.
    fn get_in_rect_with_child_tables_recursive(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
        parent_pos: Option<Pos>,
    ) -> impl Iterator<Item = (usize, MultiPos, &DataTable)> {
        self.iter_pos_in_rect(rect, ignore_spill_error)
            .flat_map(move |data_table_pos| {
                let mut results = Vec::new();

                if let Some((index, _, data_table)) = self.data_tables.get_full(&data_table_pos) {
                    let multi_pos = parent_pos
                        .map(|parent_pos| MultiPos::new_table_pos(parent_pos, data_table_pos))
                        .unwrap_or(data_table_pos.to_multi_pos());

                    results.push((index, multi_pos, data_table));

                    // Add child code runs if enabled
                    if let Some(sub_tables) = data_table.tables.as_ref() {
                        sub_tables
                            .get_in_rect_with_child_tables_recursive(
                                rect.translate(
                                    -data_table_pos.x,
                                    -data_table_pos.y - data_table.y_adjustment(true),
                                ),
                                ignore_spill_error,
                                Some(data_table_pos),
                            )
                            .for_each(|(sub_index, sub_table_pos, sub_data_table)| {
                                results.push((sub_index, sub_table_pos, sub_data_table));
                            });
                    };
                }

                results.into_iter()
            })
    }

    /// Returns an iterator over all data tables in the sheet data tables that intersect with a given rectangle.
    pub fn get_in_rect_with_child_tables(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, MultiPos, &DataTable)> {
        self.get_in_rect_with_child_tables_recursive(rect, ignore_spill_error, None)
    }

    /// Returns an iterator over all code runs in the sheet data tables that intersect with a given rectangle.
    pub fn get_code_runs_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, MultiPos, &CodeRun)> {
        self.get_in_rect_with_child_tables(rect, ignore_spill_error)
            .filter_map(|(index, multi_pos, data_table)| {
                data_table
                    .code_run()
                    .map(|code_run| (index, multi_pos, code_run))
            })
    }

    /// Returns an iterator over all code runs in the sheet data tables that intersect with a given rectangle, sorted by index.
    pub fn get_code_runs_in_rect_sorted(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, MultiPos, &CodeRun)> {
        self.get_code_runs_in_rect(rect, ignore_spill_error)
            .sorted_by(|a, b| a.0.cmp(&b.0))
    }

    /// Returns a Vec of (index, position) for all data tables in the sheet data tables that intersect with given columns, sorted by index.
    pub fn get_pos_in_columns_sorted(
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
    pub fn get_pos_after_column_sorted(
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

    /// Returns a Vec of (index, position) for all data tables in the sheet data tables intersect with given rows, sorted by index.
    pub fn get_pos_in_rows_sorted(
        &self,
        rows: &[i64],
        ignore_spill_error: bool,
    ) -> Vec<(usize, Pos)> {
        let mut all_pos = HashSet::new();
        for &row in rows.iter() {
            let row_rect = Rect::new(1, row, i64::MAX, row);
            all_pos.extend(
                self.get_in_rect(row_rect, ignore_spill_error)
                    .map(|(index, pos, _)| (index, pos)),
            );
        }
        all_pos
            .into_iter()
            .sorted_by(|a, b| a.0.cmp(&b.0))
            .collect::<Vec<_>>()
    }

    /// Returns a Vec of (index, position) for all data tables in the sheet data tables intersect with region after the given row (inclusive), sorted by index.
    pub fn get_pos_after_row_sorted(
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
    pub fn insert_full(
        &mut self,
        multi_pos: &MultiPos,
        mut data_table: DataTable,
    ) -> Result<(usize, Option<DataTable>, HashSet<Rect>)> {
        data_table.spill_data_table = false;

        match multi_pos {
            MultiPos::Pos(pos) => {
                let (index, old_data_table) = self.data_tables.insert_full(*pos, data_table);

                let old_output_rect = old_data_table
                    .as_ref()
                    .map(|dt| dt.output_rect(*pos, false));

                let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rect);

                Ok((index, old_data_table, dirty_rects))
            }
            MultiPos::TablePos(table_pos) => {
                let err = || anyhow!("Data table not found at {:?} in insert_full", multi_pos);

                let mut old_index = None;
                let mut old_data_table = None;
                let mut dirty_rects = HashSet::new();

                let (_, rects) =
                    self.modify_data_table_at(&table_pos.parent_pos.into(), |parent_data_table| {
                        let (index, data_table, rects) = parent_data_table
                            .tables
                            .get_or_insert_default()
                            .insert_full(&table_pos.sub_table_pos.into(), data_table)?;

                        old_index = Some(index);
                        old_data_table = Some(data_table);
                        dirty_rects.extend(rects);

                        Ok(())
                    })?;

                dirty_rects.extend(rects);

                if let (Some(index), Some(data_table)) = (old_index, old_data_table) {
                    Ok((index, data_table, dirty_rects))
                } else {
                    Err(err())
                }
            }
        }
    }

    /// Inserts a data table before the given index, updating mutual spill and cache.
    pub fn insert_before(
        &mut self,
        mut index: usize,
        multi_pos: &MultiPos,
        mut data_table: DataTable,
    ) -> Result<(usize, Option<DataTable>, HashSet<Rect>)> {
        data_table.spill_data_table = false;

        match multi_pos {
            MultiPos::Pos(pos) => {
                index = index.min(self.len());

                let (index, old_data_table) =
                    self.data_tables.insert_before(index, *pos, data_table);

                let old_output_rect = old_data_table
                    .as_ref()
                    .map(|dt| dt.output_rect(*pos, false));

                let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rect);

                Ok((index, old_data_table, dirty_rects))
            }
            MultiPos::TablePos(table_pos) => {
                let err = || anyhow!("Data table not found at {:?} in insert_before", multi_pos);

                let mut old_index = None;
                let mut old_data_table = None;
                let mut dirty_rects = HashSet::new();

                let (_, rects) =
                    self.modify_data_table_at(&table_pos.parent_pos.into(), |parent_data_table| {
                        let sub_tables = parent_data_table.tables.get_or_insert_default();

                        index = index.min(sub_tables.len());

                        let (index, data_table, rects) = sub_tables.insert_before(
                            index,
                            &table_pos.sub_table_pos.into(),
                            data_table,
                        )?;

                        old_index = Some(index);
                        old_data_table = Some(data_table);
                        dirty_rects.extend(rects);

                        Ok(())
                    })?;

                dirty_rects.extend(rects);

                if let (Some(index), Some(data_table)) = (old_index, old_data_table) {
                    Ok((index, data_table, dirty_rects))
                } else {
                    Err(err())
                }
            }
        }
    }

    /// Removes a data table at the given position, updating mutual spill and cache.
    pub fn shift_remove_full(
        &mut self,
        multi_pos: &MultiPos,
    ) -> Result<(usize, MultiPos, DataTable, HashSet<Rect>)> {
        let err = || {
            anyhow!(
                "Data table not found at {:?} in shift_remove_full",
                multi_pos
            )
        };

        match multi_pos {
            MultiPos::Pos(pos) => {
                let (index, _, old_data_table) =
                    self.data_tables.shift_remove_full(pos).ok_or_else(err)?;

                let old_output_rect = Some(old_data_table.output_rect(*pos, false));

                let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rect);

                Ok((index, *multi_pos, old_data_table, dirty_rects))
            }
            MultiPos::TablePos(table_pos) => {
                let mut old_index = None;
                let mut old_data_table = None;
                let mut dirty_rects = HashSet::new();

                let (_, rects) =
                    self.modify_data_table_at(&table_pos.parent_pos.into(), |parent_data_table| {
                        let (index, _, data_table, rects) = parent_data_table
                            .tables
                            .as_mut()
                            .ok_or_else(err)?
                            .shift_remove_full(&table_pos.sub_table_pos.into())?;

                        old_index = Some(index);
                        old_data_table = Some(data_table);
                        dirty_rects.extend(rects);

                        Ok(())
                    })?;

                dirty_rects.extend(rects);

                if let (Some(index), Some(data_table)) = (old_index, old_data_table) {
                    Ok((index, *multi_pos, data_table, dirty_rects))
                } else {
                    Err(err())
                }
            }
        }
    }

    /// Returns the bounds of the column at the given index.
    pub fn column_bounds(&self, column: i64) -> Option<(i64, i64)> {
        self.cache.column_bounds(column)
    }

    /// Returns the bounds of the row at the given index.
    pub fn row_bounds(&self, row: i64) -> Option<(i64, i64)> {
        self.cache.row_bounds(row)
    }

    /// Returns the finite bounds of the sheet data tables.
    pub fn finite_bounds(&self) -> Option<Rect> {
        self.cache.finite_bounds()
    }

    /// Returns an iterator over all data tables in the sheet data tables.
    pub fn expensive_iter(&self) -> impl Iterator<Item = (&Pos, &DataTable)> {
        self.data_tables.iter()
    }

    /// Returns an iterator over all data tables in the sheet data tables, including sub-tables.
    pub fn expensive_iter_with_sub_tables(&self) -> impl Iterator<Item = (MultiPos, &DataTable)> {
        let mut results = vec![];
        self.data_tables.iter().for_each(|(table_pos, data_table)| {
            results.push((table_pos.to_multi_pos(), data_table));
            if let Some(tables) = &data_table.tables {
                tables.data_tables.iter().for_each(|(pos, data_table)| {
                    results.push((MultiPos::new_table_pos(*table_pos, *pos), data_table));
                });
            }
        });
        results.into_iter()
    }

    /// Returns an iterator over all code runs in the sheet data tables.
    pub fn expensive_iter_code_runs(&self) -> impl Iterator<Item = (MultiPos, &CodeRun)> {
        self.data_tables
            .iter()
            .flat_map(move |(data_table_pos, data_table)| {
                data_table
                    .code_run()
                    .into_iter()
                    .map(move |code_run| (data_table_pos.to_multi_pos(), code_run))
                    .chain(data_table.tables.iter().flat_map(move |tables| {
                        tables
                            .data_tables
                            .iter()
                            .flat_map(move |(sub_table_pos, sub_table)| {
                                sub_table.code_run().map(|sub_code_run| {
                                    (
                                        MultiPos::new_table_pos(*data_table_pos, *sub_table_pos),
                                        sub_code_run,
                                    )
                                })
                            })
                    }))
            })
    }

    /// Exports the cache of data tables.
    pub fn cache_ref(&self) -> &SheetDataTablesCache {
        &self.cache
    }

    /// Returns true if the given rectangle has any content.
    pub fn has_content(&self, rect: Rect) -> bool {
        self.cache
            .get_nondefault_rects_in_rect(rect)
            .next()
            .is_some()
    }

    /// This is expensive used only for file migration (< v1.7.1), having data in -ve coordinates
    /// and Contiguous2d cache does not work for -ve coordinates
    pub fn migration_iter_mut(&mut self) -> impl Iterator<Item = (&Pos, &mut DataTable)> {
        self.data_tables.iter_mut()
    }

    /// This is expensive used only for file migration (< v1.7.1), having data in -ve coordinates
    /// and Contiguous2d cache does not work for -ve coordinates
    pub fn migration_iter_code_runs_mut(&mut self) -> impl Iterator<Item = (Pos, &mut CodeRun)> {
        self.data_tables.iter_mut().flat_map(|(pos, data_table)| {
            data_table.code_run_mut().map(|code_run| (*pos, code_run))
        })
    }

    /// Returns the data table at the given position, if it exists.
    #[cfg(test)]
    pub fn get_at_index(&self, index: usize) -> Option<(&Pos, &DataTable)> {
        self.data_tables.get_index(index)
    }
}

// Custom Debug implementation for SheetDataTables
impl std::fmt::Debug for SheetDataTables {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "SheetDataTables {{")?;
        writeln!(f, "  data_tables:")?;
        for (pos, table) in &self.data_tables {
            writeln!(f, "    {pos:?}: {table:?}")?;
        }
        writeln!(f, "}}")
    }
}

#[cfg(test)]
mod tests {
    use crate::{grid::CodeCellLanguage, test_util::*};

    #[test]
    fn test_spill_in_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);

        gc.set_code_cell(
            pos![sheet_id!A3],
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
            None,
            false,
        );
    }
}
