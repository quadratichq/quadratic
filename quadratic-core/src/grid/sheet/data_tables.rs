use std::collections::HashSet;

use indexmap::IndexMap;
use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::{
    Pos, Rect,
    grid::{CodeRun, Contiguous2D, DataTable, SheetRegionMap},
};

use anyhow::{Result, anyhow};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SheetDataTables {
    #[serde(with = "crate::util::indexmap_serde")]
    data_tables: IndexMap<Pos, DataTable>,

    has_data_table: Contiguous2D<Option<bool>>,

    spilled_output_rects: Contiguous2D<Option<Pos>>,

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
    pub fn new() -> Self {
        Self {
            data_tables: IndexMap::new(),
            has_data_table: Contiguous2D::new(),
            spilled_output_rects: Contiguous2D::new(),
            un_spilled_output_rects: SheetRegionMap::new(),
        }
    }

    pub fn from_data_tables(mut data_tables: IndexMap<Pos, DataTable>) -> Self {
        let mut data_tables_pos = Vec::new();
        data_tables.iter_mut().for_each(|(pos, dt)| {
            dt.spill_data_table = false;
            data_tables_pos.push(*pos);
        });

        let mut sheet_data_tables = Self::new();
        sheet_data_tables.data_tables = data_tables;
        for (index, pos) in data_tables_pos.iter().enumerate() {
            sheet_data_tables.update_spill_and_cache(index, pos, None, false, None);
        }
        sheet_data_tables
    }

    pub fn is_empty(&self) -> bool {
        self.data_tables.is_empty()
    }

    pub fn len(&self) -> usize {
        self.data_tables.len()
    }

    fn update_spill_and_cache(
        &mut self,
        index: usize,
        pos: &Pos,
        old_output_rects: Option<(Rect, Rect)>,
        deleted: bool,
        force_spill_self: Option<bool>,
    ) -> HashSet<Rect> {
        let mut dirty_rects = HashSet::new();
        let mut old_rect = None;
        let mut new_rect = None;

        // remove data table from cache
        if let Some((old_spilled_output_rect, old_un_spilled_output_rect)) = old_output_rects {
            self.has_data_table.set(*pos, None);

            if old_spilled_output_rect.len() > 1 {
                self.spilled_output_rects.set_rect(
                    old_spilled_output_rect.min.x,
                    old_spilled_output_rect.min.y,
                    Some(old_spilled_output_rect.max.x),
                    Some(old_spilled_output_rect.max.y),
                    None,
                );
            }

            if old_un_spilled_output_rect.len() > 1 {
                self.un_spilled_output_rects
                    .remove_pos(old_un_spilled_output_rect.min);
            }

            old_rect = Some(old_spilled_output_rect);
        }

        // if not delete, check for self spill
        // if no self spill, check for other data table spill due to this table
        if !deleted {
            let mut spill_data_table = false;
            let mut data_tables_to_spill = HashSet::new();
            if let Some(data_table) = self.get_at(pos) {
                let new_un_spilled_output_rect = data_table.output_rect(*pos, true);
                // can spill only if it's not a single cell
                if new_un_spilled_output_rect.len() > 1 {
                    // force spill this table due to an incomming change
                    if let Some(force_spill_self) = force_spill_self {
                        spill_data_table = force_spill_self
                    }
                    // calculate self spill
                    else {
                        spill_data_table = self
                            .get_in_rect_sorted(new_un_spilled_output_rect, false)
                            .any(|other| other.0 < index);
                    }

                    // if no self spill, check for other data table spill due to this table
                    if !spill_data_table {
                        data_tables_to_spill = self
                            .spilled_output_rects
                            .unique_values_in_rect(new_un_spilled_output_rect);
                    }
                }
            }

            // spill other tables due to this table
            for spill_pos in data_tables_to_spill {
                if let Some(spill_pos) = spill_pos {
                    if let Ok((_, spilled_dirty_rect)) =
                        self.modify_data_table_at(&spill_pos, Some(true), |table| {
                            table.spill_data_table = true;
                            Ok(())
                        })
                    {
                        dirty_rects.extend(spilled_dirty_rect);
                    }
                }
            }

            // add this table to cache
            if let Some(data_table) = self.data_tables.get_mut(pos) {
                self.has_data_table.set(*pos, Some(true));

                data_table.spill_data_table = spill_data_table;
                let new_spilled_output_rect = data_table.output_rect(*pos, false);
                let new_un_spilled_output_rect = data_table.output_rect(*pos, true);

                if new_spilled_output_rect.len() > 1 {
                    self.spilled_output_rects.set_rect(
                        new_spilled_output_rect.min.x,
                        new_spilled_output_rect.min.y,
                        Some(new_spilled_output_rect.max.x),
                        Some(new_spilled_output_rect.max.y),
                        Some(*pos),
                    );
                }

                if new_un_spilled_output_rect.len() > 1 {
                    self.un_spilled_output_rects
                        .insert(new_un_spilled_output_rect.min, new_un_spilled_output_rect);
                }

                new_rect = Some(new_spilled_output_rect);
            }
        }

        // check for changes in output rect and any other table spill / unspill due to changes in output rect
        if old_rect != new_rect {
            let mut other_data_tables_to_update = Vec::new();

            let updated_rect = match (old_rect, new_rect) {
                (Some(old_rect), Some(new_rect)) => Some(old_rect.union(&new_rect)),
                (Some(old_rect), None) => Some(old_rect),
                (None, Some(new_rect)) => Some(new_rect),
                (None, None) => None,
            };

            if let Some(updated_rect) = updated_rect {
                for (other_index, other_pos, other_data_table) in self
                    .get_in_rect_sorted(updated_rect, true)
                    .filter(|other| other.0 > index || (deleted && other.0 == index))
                {
                    let other_old_output_rects = Some((
                        other_data_table.output_rect(other_pos, false),
                        other_data_table.output_rect(other_pos, true),
                    ));
                    other_data_tables_to_update.push((
                        other_index,
                        other_pos,
                        other_old_output_rects,
                    ));
                }

                dirty_rects.insert(updated_rect);
            }

            for (other_index, other_pos, other_old_output_rects) in other_data_tables_to_update {
                let other_dirty_rects = self.update_spill_and_cache(
                    other_index,
                    &other_pos,
                    other_old_output_rects,
                    false,
                    None,
                );
                dirty_rects.extend(other_dirty_rects);
            }
        }

        dirty_rects
    }

    pub fn get_index_of(&self, pos: &Pos) -> Option<usize> {
        self.data_tables.get_index_of(pos)
    }

    pub fn get_at_index(&self, index: usize) -> Option<(&Pos, &DataTable)> {
        self.data_tables.get_index(index)
    }

    pub fn get_at(&self, pos: &Pos) -> Option<&DataTable> {
        self.data_tables.get(pos)
    }

    pub fn modify_data_table_at(
        &mut self,
        pos: &Pos,
        force_spill_self: Option<bool>,
        f: impl FnOnce(&mut DataTable) -> Result<()>,
    ) -> Result<(&DataTable, HashSet<Rect>)> {
        let err = || anyhow!("Data table not found at {:?} in modify_data_table_at", pos);
        let index = self.get_index_of(pos).ok_or_else(err)?;
        let data_table = self.data_tables.get_mut(pos).ok_or_else(err)?;
        let old_output_rects = Some((
            data_table.output_rect(*pos, false),
            data_table.output_rect(*pos, true),
        ));

        f(data_table)?;

        let dirty_rects =
            self.update_spill_and_cache(index, pos, old_output_rects, false, force_spill_self);

        let data_table = self.data_tables.get(pos).ok_or_else(err)?;
        Ok((data_table, dirty_rects))
    }

    pub fn get_pos_contains(&self, pos: &Pos) -> Option<Pos> {
        if self.data_tables.get(pos).is_some() {
            Some(*pos)
        } else {
            self.spilled_output_rects.get(*pos)
        }
    }

    pub fn get_contains(&self, pos: &Pos) -> Option<(Pos, &DataTable)> {
        if let Some(data_table) = self.data_tables.get(pos) {
            Some((*pos, data_table))
        } else {
            self.spilled_output_rects
                .get(*pos)
                .and_then(|data_table_pos| {
                    self.data_tables
                        .get(&data_table_pos)
                        .map(|data_table| (data_table_pos, data_table))
                })
        }
    }

    pub fn get_mut_contains(&mut self, pos: &Pos) -> Option<(Pos, &mut DataTable)> {
        if let Some(data_table_pos) = self.spilled_output_rects.get(*pos) {
            self.data_tables
                .get_mut(&data_table_pos)
                .map(|data_table| (data_table_pos, data_table))
        } else {
            self.data_tables
                .get_mut(pos)
                .map(|data_table| (*pos, data_table))
        }
    }

    pub fn get_pos_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = Pos> {
        self.has_data_table
            .nondefault_rects_in_rect(rect)
            .flat_map(|(rect, _)| {
                rect.x_range()
                    .flat_map(move |x| rect.y_range().map(move |y| Pos { x, y }))
            })
            .chain(
                if !ignore_spill_error {
                    self.spilled_output_rects.unique_values_in_rect(rect)
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

    pub fn get_in_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (Pos, &DataTable)> {
        self.get_pos_in_rect(rect, ignore_spill_error)
            .filter_map(|pos| {
                self.data_tables
                    .get(&pos)
                    .map(|data_table| (pos, data_table))
            })
    }

    pub fn get_in_rect_sorted(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = (usize, Pos, &DataTable)> {
        self.get_pos_in_rect(rect, ignore_spill_error)
            .filter_map(|pos| {
                self.data_tables
                    .get_full(&pos)
                    .map(|(index, _, data_table)| (index, pos, data_table))
            })
            .sorted_by(|a, b| a.0.cmp(&b.0))
    }

    pub fn insert_full(
        &mut self,
        pos: &Pos,
        mut data_table: DataTable,
    ) -> (usize, Option<DataTable>, HashSet<Rect>) {
        data_table.spill_data_table = false;

        let (index, old_data_table) = self.data_tables.insert_full(*pos, data_table);

        let old_output_rects = old_data_table
            .as_ref()
            .map(|dt| (dt.output_rect(*pos, false), dt.output_rect(*pos, true)));

        let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rects, false, None);

        (index, old_data_table, dirty_rects)
    }

    pub fn insert_sorted(
        &mut self,
        pos: &Pos,
        mut data_table: DataTable,
    ) -> (usize, Option<DataTable>, HashSet<Rect>) {
        data_table.spill_data_table = false;

        let (index, old_data_table) = self.data_tables.insert_sorted(*pos, data_table);

        let old_output_rects = old_data_table
            .as_ref()
            .map(|dt| (dt.output_rect(*pos, false), dt.output_rect(*pos, true)));

        let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rects, false, None);

        (index, old_data_table, dirty_rects)
    }

    pub fn insert_before(
        &mut self,
        index: usize,
        pos: &Pos,
        mut data_table: DataTable,
    ) -> (usize, Option<DataTable>, HashSet<Rect>) {
        data_table.spill_data_table = false;

        let (index, old_data_table) = self.data_tables.insert_before(index, *pos, data_table);

        let old_output_rects = old_data_table
            .as_ref()
            .map(|dt| (dt.output_rect(*pos, false), dt.output_rect(*pos, true)));

        let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rects, false, None);

        (index, old_data_table, dirty_rects)
    }

    pub fn shift_remove_full(
        &mut self,
        pos: &Pos,
    ) -> Option<(usize, Pos, DataTable, HashSet<Rect>)> {
        let (index, _, old_data_table) = self.data_tables.shift_remove_full(pos)?;

        let old_output_rects = Some((
            old_data_table.output_rect(*pos, false),
            old_data_table.output_rect(*pos, true),
        ));

        let dirty_rects = self.update_spill_and_cache(index, pos, old_output_rects, true, None);

        Some((index, *pos, old_data_table, dirty_rects))
    }

    pub fn shift_remove(&mut self, pos: &Pos) -> Option<(DataTable, HashSet<Rect>)> {
        self.shift_remove_full(pos).map(|full| (full.2, full.3))
    }

    pub fn column_bounds(&self, column: i64) -> (i64, i64) {
        let has_data_min = self.has_data_table.col_min(column);
        let output_rects_min = self.spilled_output_rects.col_min(column);
        let min = match (has_data_min > 0, output_rects_min > 0) {
            (true, true) => has_data_min.min(output_rects_min),
            (true, false) => has_data_min,
            (false, true) => output_rects_min,
            (false, false) => 0,
        };

        let has_data_max = self.has_data_table.col_max(column);
        let output_rects_max = self.spilled_output_rects.col_max(column);
        let max = match (has_data_max > 0, output_rects_max > 0) {
            (true, true) => has_data_max.max(output_rects_max),
            (true, false) => has_data_max,
            (false, true) => output_rects_max,
            (false, false) => 0,
        };

        (min, max)
    }

    pub fn row_bounds(&self, row: i64) -> (i64, i64) {
        let has_data_min = self.has_data_table.row_min(row);
        let output_rects_min = self.spilled_output_rects.row_min(row);
        let min = match (has_data_min > 0, output_rects_min > 0) {
            (true, true) => has_data_min.min(output_rects_min),
            (true, false) => has_data_min,
            (false, true) => output_rects_min,
            (false, false) => 0,
        };

        let has_data_max = self.has_data_table.row_max(row);
        let output_rects_max = self.spilled_output_rects.row_max(row);
        let max = match (has_data_max > 0, output_rects_max > 0) {
            (true, true) => has_data_max.max(output_rects_max),
            (true, false) => has_data_max,
            (false, true) => output_rects_max,
            (false, false) => 0,
        };

        (min, max)
    }

    pub fn finite_bounds(&self) -> Option<Rect> {
        match (
            self.has_data_table.finite_bounds(),
            self.spilled_output_rects.finite_bounds(),
        ) {
            (Some(has_data_table_bounds), Some(output_rects_bounds)) => {
                Some(has_data_table_bounds.union(&output_rects_bounds))
            }
            (Some(has_data_table_bounds), None) => Some(has_data_table_bounds),
            (None, Some(output_rects_bounds)) => Some(output_rects_bounds),
            (None, None) => None,
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&Pos, &DataTable)> {
        self.data_tables.iter()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = (&Pos, &mut DataTable)> {
        self.data_tables.iter_mut()
    }

    pub fn iter_code_runs(&self) -> impl Iterator<Item = (Pos, &CodeRun)> {
        self.data_tables
            .iter()
            .flat_map(|(pos, data_table)| data_table.code_run().map(|code_run| (*pos, code_run)))
    }

    pub fn iter_code_runs_mut(&mut self) -> impl Iterator<Item = (Pos, &mut CodeRun)> {
        self.data_tables.iter_mut().flat_map(|(pos, data_table)| {
            data_table.code_run_mut().map(|code_run| (*pos, code_run))
        })
    }
}
