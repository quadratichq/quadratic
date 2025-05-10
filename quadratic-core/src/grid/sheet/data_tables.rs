use indexmap::IndexMap;
use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::{
    Pos, Rect,
    grid::{CodeRun, Contiguous2D, DataTable},
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SheetDataTables {
    #[serde(with = "crate::util::indexmap_serde")]
    data_tables: IndexMap<Pos, DataTable>,

    has_data_table: Contiguous2D<Option<bool>>,

    output_rects: Contiguous2D<Option<Pos>>,
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
            output_rects: Contiguous2D::new(),
        }
    }

    pub fn from_data_tables(data_tables: IndexMap<Pos, DataTable>) -> Self {
        let mut has_data_table = Contiguous2D::new();
        let mut output_rects = Contiguous2D::new();
        data_tables.iter().for_each(|(pos, table)| {
            has_data_table.set(*pos, Some(true));
            let output_rect = table.output_rect(*pos, false);
            if output_rect.len() > 1 {
                output_rects.set_rect(
                    output_rect.min.x,
                    output_rect.min.y,
                    Some(output_rect.max.x),
                    Some(output_rect.max.y),
                    Some(*pos),
                );
            }
        });

        Self {
            data_tables,
            has_data_table,
            output_rects,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.data_tables.is_empty()
    }

    pub fn len(&self) -> usize {
        self.data_tables.len()
    }

    fn update_output_rects(
        &mut self,
        pos: &Pos,
        old_output_rect: Option<Rect>,
        new_output_rect: Option<Rect>,
    ) {
        if let Some(old_output_rect) = old_output_rect {
            self.has_data_table.set(old_output_rect.min, None);
            if old_output_rect.len() > 1 {
                self.output_rects.set_rect(
                    old_output_rect.min.x,
                    old_output_rect.min.y,
                    Some(old_output_rect.max.x),
                    Some(old_output_rect.max.y),
                    None,
                );
            }
        }

        if let Some(new_output_rect) = new_output_rect {
            self.has_data_table.set(new_output_rect.min, Some(true));
            if new_output_rect.len() > 1 {
                self.output_rects.set_rect(
                    new_output_rect.min.x,
                    new_output_rect.min.y,
                    Some(new_output_rect.max.x),
                    Some(new_output_rect.max.y),
                    Some(*pos),
                );
            }
        }
    }

    pub fn get_index_of(&self, pos: &Pos) -> Option<usize> {
        self.data_tables.get_index_of(pos)
    }

    pub fn get_at_index(&self, index: usize) -> Option<(&Pos, &DataTable)> {
        self.data_tables.get_index(index)
    }

    pub fn get_mut_at_index(&mut self, index: usize) -> Option<(&Pos, &mut DataTable)> {
        self.data_tables.get_index_mut(index)
    }

    pub fn get_at(&self, pos: &Pos) -> Option<&DataTable> {
        self.data_tables.get(pos)
    }

    pub fn get_mut_at(&mut self, pos: &Pos) -> Option<&mut DataTable> {
        self.data_tables.get_mut(pos)
    }

    pub fn get_pos_contains(&self, pos: &Pos) -> Option<Pos> {
        if self.data_tables.get(pos).is_some() {
            Some(*pos)
        } else {
            self.output_rects.get(*pos)
        }
    }

    pub fn get_contains(&self, pos: &Pos) -> Option<(Pos, &DataTable)> {
        if let Some(data_table) = self.data_tables.get(pos) {
            Some((*pos, data_table))
        } else {
            self.output_rects.get(*pos).and_then(|data_table_pos| {
                self.data_tables
                    .get(&data_table_pos)
                    .map(|data_table| (data_table_pos, data_table))
            })
        }
    }

    pub fn get_mut_contains(&mut self, pos: &Pos) -> Option<(Pos, &mut DataTable)> {
        if let Some(data_table_pos) = self.output_rects.get(*pos) {
            self.data_tables
                .get_mut(&data_table_pos)
                .map(|data_table| (data_table_pos, data_table))
        } else {
            self.data_tables
                .get_mut(pos)
                .map(|data_table| (*pos, data_table))
        }
    }

    pub fn get_pos_in_rect(&self, rect: Rect) -> impl Iterator<Item = Pos> {
        self.has_data_table
            .nondefault_rects_in_rect(rect)
            .flat_map(|(rect, _)| {
                rect.x_range()
                    .flat_map(move |x| rect.y_range().map(move |y| Pos { x, y }))
            })
            .chain(
                self.output_rects
                    .unique_values_in_rect(rect)
                    .into_iter()
                    .flatten(),
            )
            .sorted_unstable()
            .dedup()
    }

    pub fn get_in_rect(&self, rect: Rect) -> impl Iterator<Item = (Pos, &DataTable)> {
        self.get_pos_in_rect(rect).filter_map(|pos| {
            self.data_tables
                .get(&pos)
                .map(|data_table| (pos, data_table))
        })
    }

    pub fn insert_full(&mut self, pos: &Pos, data_table: DataTable) -> (usize, Option<DataTable>) {
        let new_output_rect = data_table.output_rect(*pos, false);

        let (index, old_data_table) = self.data_tables.insert_full(*pos, data_table);

        let old_output_rect = old_data_table
            .as_ref()
            .map(|dt| dt.output_rect(*pos, false));

        self.update_output_rects(pos, old_output_rect, Some(new_output_rect));

        (index, old_data_table)
    }

    pub fn insert_sorted(
        &mut self,
        pos: &Pos,
        data_table: DataTable,
    ) -> (usize, Option<DataTable>) {
        let new_output_rect = data_table.output_rect(*pos, false);

        let (index, old_data_table) = self.data_tables.insert_sorted(*pos, data_table);

        let old_output_rect = old_data_table
            .as_ref()
            .map(|dt| dt.output_rect(*pos, false));

        self.update_output_rects(pos, old_output_rect, Some(new_output_rect));

        (index, old_data_table)
    }

    pub fn insert_before(
        &mut self,
        index: usize,
        pos: &Pos,
        data_table: DataTable,
    ) -> (usize, Option<DataTable>) {
        let new_output_rect = data_table.output_rect(*pos, false);

        let (index, old_data_table) = self.data_tables.insert_before(index, *pos, data_table);

        let old_output_rect = old_data_table
            .as_ref()
            .map(|dt| dt.output_rect(*pos, false));

        self.update_output_rects(pos, old_output_rect, Some(new_output_rect));

        (index, old_data_table)
    }

    pub fn shift_remove_full(&mut self, pos: &Pos) -> Option<(usize, Pos, DataTable)> {
        let old_data_table_full = self.data_tables.shift_remove_full(pos);

        let old_output_rect = old_data_table_full
            .as_ref()
            .map(|dt| dt.2.output_rect(*pos, false));

        self.update_output_rects(pos, old_output_rect, None);

        old_data_table_full
    }

    pub fn shift_remove(&mut self, pos: &Pos) -> Option<DataTable> {
        let old_data_table = self.data_tables.shift_remove(pos);

        let old_output_rect = old_data_table
            .as_ref()
            .map(|dt| dt.output_rect(*pos, false));

        self.update_output_rects(pos, old_output_rect, None);

        old_data_table
    }

    pub fn column_bounds(&self, column: i64) -> (i64, i64) {
        let has_data_min = self.has_data_table.col_min(column);
        let output_rects_min = self.output_rects.col_min(column);
        let min = match (has_data_min > 0, output_rects_min > 0) {
            (true, true) => has_data_min.min(output_rects_min),
            (true, false) => has_data_min,
            (false, true) => output_rects_min,
            (false, false) => 0,
        };

        let has_data_max = self.has_data_table.col_max(column);
        let output_rects_max = self.output_rects.col_max(column);
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
        let output_rects_min = self.output_rects.row_min(row);
        let min = match (has_data_min > 0, output_rects_min > 0) {
            (true, true) => has_data_min.min(output_rects_min),
            (true, false) => has_data_min,
            (false, true) => output_rects_min,
            (false, false) => 0,
        };

        let has_data_max = self.has_data_table.row_max(row);
        let output_rects_max = self.output_rects.row_max(row);
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
            self.output_rects.finite_bounds(),
        ) {
            (Some(has_data_table_bounds), Some(output_rects_bounds)) => {
                Some(has_data_table_bounds.union(&output_rects_bounds))
            }
            (Some(has_data_table_bounds), None) => Some(has_data_table_bounds),
            (None, Some(output_rects_bounds)) => Some(output_rects_bounds),
            (None, None) => None,
        }
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

    pub fn iter(&self) -> impl Iterator<Item = (&Pos, &DataTable)> {
        self.data_tables.iter()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = (&Pos, &mut DataTable)> {
        self.data_tables.iter_mut()
    }

    pub fn retain(&mut self, f: impl FnMut(&Pos, &mut DataTable) -> bool) {
        self.data_tables.retain(f);
    }
}
