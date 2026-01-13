use std::{collections::HashSet, fmt, hash::Hash};

use crate::{
    CopyFormats, Pos, Rect,
    a1::{A1Selection, CellRefRange, RefRangeBounds, UNBOUNDED},
    grid::GridBounds,
    util::sort_bounds,
};

use serde::{Deserialize, Serialize};

use super::{block::Block, contiguous_blocks::ContiguousBlocks};

/// Key-value store from cell positions to values, optimized for contiguous
/// rectangles with the same value, particularly along columns. All (infinitely
/// many) values are initialized to default.
///
/// Supports infinite blocks down, right, and down-right.
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Contiguous2D<T>(
    #[serde(bound = "T: Serialize + for<'a> Deserialize<'a>")] // shouldn't serde infer this?
    ContiguousBlocks<ContiguousBlocks<T>>,
);
impl<T: fmt::Debug> fmt::Debug for Contiguous2D<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for xy_block in &self.0 {
            let x1 = xy_block.start as i64;
            let x2 = match xy_block.end {
                u64::MAX => None,
                finite => Some(finite as i64 - 1),
            };

            let x1_name = crate::a1::column_name(x1);
            let x2_name = x2.map(crate::a1::column_name).unwrap_or_default();

            if xy_block.len() == Some(1) {
                writeln!(f, "column {x1_name} ({})", xy_block.start)?;
            } else {
                write!(f, "columns {x1_name}:{x2_name} ")?;
                match x2 {
                    Some(x2) => write!(f, "({x1}..={x2})")?,
                    None => write!(f, "({x1}..)")?,
                }
                writeln!(f)?;
            }

            for y_block in &xy_block.value {
                let y1 = y_block.start as i64;
                let y2 = match y_block.end {
                    u64::MAX => None,
                    finite => Some(finite as i64 - 1),
                };
                let ref_range_bounds = RefRangeBounds::new_relative(
                    x1,
                    y1,
                    x2.unwrap_or(i64::MAX),
                    y2.unwrap_or(i64::MAX),
                )
                .to_string(); // required for padding
                writeln!(f, "    {ref_range_bounds:<10}  {:?}", y_block.value)?;
            }
        }

        Ok(())
    }
}
impl<T: Default> Default for Contiguous2D<T> {
    fn default() -> Self {
        Self(ContiguousBlocks::default())
    }
}
impl<T: Default> Contiguous2D<T> {
    /// Constructs an empty map.
    pub fn new() -> Self {
        Self::default()
    }
}
impl<T: Default + Clone + PartialEq> From<ContiguousBlocks<Option<ContiguousBlocks<T>>>>
    for Contiguous2D<T>
{
    fn from(value: ContiguousBlocks<Option<ContiguousBlocks<T>>>) -> Self {
        Self(value.map(Option::unwrap_or_default))
    }
}
impl<T: Default + Clone + PartialEq> From<Contiguous2D<T>>
    for ContiguousBlocks<Option<ContiguousBlocks<T>>>
{
    fn from(value: Contiguous2D<T>) -> Self {
        value.0.map(|col| (!col.is_all_default()).then_some(col))
    }
}
impl<T: Default + Clone + PartialEq + fmt::Debug> Contiguous2D<T> {
    /// Constructs a [`Contiguous2D`] containing `value` inside a (possibly
    /// infinite) rectangle and `T::default()` everywhere else.
    ///
    /// All coordinates are inclusive.
    ///
    /// If `x2` or `y2` are `None`, the rectangle is infinite in that direction.
    pub fn from_rect(x1: i64, y1: i64, x2: Option<i64>, y2: Option<i64>, value: T) -> Self {
        match convert_rect(x1, y1, x2, y2) {
            None => Self::default(),
            Some((x1, y1, x2, y2)) => Self(ContiguousBlocks::from_block(Block {
                start: x1,
                end: x2,
                value: ContiguousBlocks::from_block(Block {
                    start: y1,
                    end: y2,
                    value,
                }),
            })),
        }
    }

    /// Constructs a Contiguous2D from a selection and a value set across the
    /// selection.
    pub fn new_from_selection(selection: &A1Selection, value: T) -> Contiguous2D<T> {
        let mut c: Contiguous2D<T> = Contiguous2D::new();
        selection.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                let start_col = range.start.col();
                let start_row = range.start.row();
                let end_col = if range.end.col.is_unbounded() {
                    None
                } else {
                    Some(range.end.col())
                };
                let end_row = if range.end.row.is_unbounded() {
                    None
                } else {
                    Some(range.end.row())
                };
                c.set_rect(start_col, start_row, end_col, end_row, value.clone());
            }
            // this is handled separately as we need to create different format
            // operations for tables
            CellRefRange::Table { .. } => (),
        });
        c
    }

    /// Returns an exact set of blocks representing the values in `range`.
    fn xy_blocks_in_range(
        &self,
        range: RefRangeBounds,
    ) -> impl Iterator<Item = Block<Vec<Block<&T>>>> {
        let [x1, x2, y1, y2] = range_to_rect(range);
        self.0.blocks_for_range(x1, x2).map(move |columns_block| {
            columns_block.map(|column| column.blocks_for_range(y1, y2).collect())
        })
    }

    /// Returns whether the whole sheet is default.
    pub fn is_all_default(&self) -> bool {
        self.0.is_all_default()
    }

    /// Returns whether the values in a rectangle are all default.
    pub fn is_all_default_in_rect(&self, rect: Rect) -> bool {
        self.is_all_default_in_range(RefRangeBounds::new_relative_rect(rect))
    }

    /// Returns whether the values in a range are all default.
    pub fn is_all_default_in_range(&self, range: RefRangeBounds) -> bool {
        let [x1, x2, y1, y2] = range_to_rect(range);
        self.0
            .blocks_touching_range(x1, x2)
            .all(move |columns_block| columns_block.value.is_all_default_in_range(y1, y2))
    }

    /// Returns true if there are any non-default values in infinite blocks.
    ///
    /// An infinite block is one where either the x-range or y-range extends to
    /// infinity (i.e., column fills, row fills, or sheet fills).
    pub fn has_infinite_non_default(&self) -> bool {
        let default = T::default();
        self.0.iter().any(|x_block| {
            // Skip if all values in this column range are default
            if x_block.value.is_all_default() {
                return false;
            }
            // Check if x is infinite (row fill or sheet fill)
            if x_block.end == u64::MAX {
                return true;
            }
            // Check if any y block within is infinite (column fill)
            x_block
                .value
                .iter()
                .any(|y_block| y_block.end == u64::MAX && y_block.value != default)
        })
    }

    /// Returns a set of unique values in a rect.
    pub fn unique_values_in_rect(&self, rect: Rect) -> HashSet<T>
    where
        T: Eq + Hash,
    {
        self.unique_values_in_range(RefRangeBounds::new_relative_rect(rect))
    }

    /// Returns a set of unique values in a range.
    pub fn unique_values_in_range(&self, range: RefRangeBounds) -> HashSet<T>
    where
        T: Eq + Hash,
    {
        let [x1, x2, y1, y2] = range_to_rect(range);
        self.0
            .blocks_touching_range(x1, x2)
            .flat_map(move |columns_block| columns_block.value.blocks_touching_range(y1, y2))
            .map(|y_block| y_block.value.clone())
            .collect()
    }

    /// Returns a list of rectangles containing non-default values.
    pub fn nondefault_rects_in_rect(&self, rect: Rect) -> impl Iterator<Item = (Rect, T)> {
        self.nondefault_rects_in_range(RefRangeBounds::new_relative_rect(rect))
    }

    /// Returns a list of rectangles containing non-default values within a rect,
    /// combining rects that have the same value into a single bounding rect.
    ///
    /// This is useful when the internal representation splits a contiguous region
    /// into multiple rects (e.g., across column boundaries), and you want to
    /// combine them back together.
    pub fn nondefault_rects_in_rect_combined(&self, rect: Rect) -> Vec<(Rect, T)>
    where
        T: Eq + Hash,
    {
        self.nondefault_rects_in_range_combined(RefRangeBounds::new_relative_rect(rect))
    }

    /// Returns a list of rectangles containing non-default values within a range,
    /// combining rects that have the same value into a single bounding rect.
    ///
    /// This is useful when the internal representation splits a contiguous region
    /// into multiple rects (e.g., across column boundaries), and you want to
    /// combine them back together.
    ///
    /// Note: This returns the FULL rects for values that appear in the range,
    /// not just the portion that intersects with the range. This is useful for
    /// cases like merged cells where you want the complete merged cell rect
    /// even if only part of it intersects the search range.
    pub fn nondefault_rects_in_range_combined(&self, range: RefRangeBounds) -> Vec<(Rect, T)>
    where
        T: Eq + Hash,
    {
        use std::collections::HashMap;

        let [x1, x2, y1, y2] = range_to_rect(range);
        let u64_to_i64 = |u: u64| u.try_into().unwrap_or(i64::MAX);
        let default = T::default();

        // Get blocks that touch the range (efficient - only touches relevant blocks)
        // Use blocks_touching_range to get FULL blocks, not clipped ones
        let mut value_to_rects: HashMap<T, Vec<Rect>> = HashMap::new();

        for column_block in self.0.blocks_touching_range(x1, x2) {
            for y_block in column_block.value.blocks_touching_range(y1, y2) {
                // Skip default blocks - same pattern as unique_values_in_range
                let value = y_block.value.clone();
                if value != default {
                    // Collect the FULL block rect (blocks_touching_range gives us full blocks)
                    let full_block_rect = Rect::new(
                        u64_to_i64(column_block.start),
                        u64_to_i64(y_block.start),
                        u64_to_i64(column_block.end.saturating_sub(1)),
                        u64_to_i64(y_block.end.saturating_sub(1)),
                    );
                    value_to_rects
                        .entry(value)
                        .or_default()
                        .push(full_block_rect);
                }
            }
        }

        if value_to_rects.is_empty() {
            return Vec::new();
        }

        // Combine rects with the same value into bounding boxes
        value_to_rects
            .into_iter()
            .map(|(value, rects)| {
                if rects.is_empty() {
                    return (Rect::new(0, 0, 0, 0), value);
                }

                let min_x = rects
                    .iter()
                    .map(|r| r.min.x)
                    .min()
                    .expect("min_x should exist since rects is not empty");
                let min_y = rects
                    .iter()
                    .map(|r| r.min.y)
                    .min()
                    .expect("min_y should exist since rects is not empty");
                let max_x = rects
                    .iter()
                    .map(|r| r.max.x)
                    .max()
                    .expect("max_x should exist since rects is not empty");
                let max_y = rects
                    .iter()
                    .map(|r| r.max.y)
                    .max()
                    .expect("max_y should exist since rects is not empty");

                (Rect::new(min_x, min_y, max_x, max_y), value)
            })
            .collect()
    }

    /// Returns an iterator over all non-default rectangles, combining rects that have
    /// the same value into single bounding rects.
    ///
    /// This is optimized for iterating over the entire contiguous 2D structure by
    /// directly iterating over all blocks and computing bounding boxes on the fly,
    /// avoiding the overhead of range filtering and intermediate Vec allocations.
    pub fn nondefault_rects_all_combined(&self) -> impl Iterator<Item = (Rect, T)>
    where
        T: Eq + Hash,
    {
        use std::collections::HashMap;

        let u64_to_i64 = |u: u64| u.try_into().unwrap_or(i64::MAX);
        let default = T::default();

        // Iterate directly over all blocks and compute bounding boxes on the fly
        let mut value_to_bounds: HashMap<T, (i64, i64, i64, i64)> = HashMap::new();

        for column_block in self.0.iter() {
            for y_block in column_block.value.iter() {
                let value = y_block.value.clone();
                if value != default {
                    let rect_min_x = u64_to_i64(column_block.start);
                    let rect_min_y = u64_to_i64(y_block.start);
                    let rect_max_x = u64_to_i64(column_block.end.saturating_sub(1));
                    let rect_max_y = u64_to_i64(y_block.end.saturating_sub(1));

                    value_to_bounds
                        .entry(value)
                        .and_modify(|bounds| {
                            bounds.0 = bounds.0.min(rect_min_x);
                            bounds.1 = bounds.1.min(rect_min_y);
                            bounds.2 = bounds.2.max(rect_max_x);
                            bounds.3 = bounds.3.max(rect_max_y);
                        })
                        .or_insert((rect_min_x, rect_min_y, rect_max_x, rect_max_y));
                }
            }
        }

        value_to_bounds
            .into_iter()
            .map(|(value, (min_x, min_y, max_x, max_y))| {
                (Rect::new(min_x, min_y, max_x, max_y), value)
            })
    }

    /// Returns a list of rectangles containing non-default values.
    pub fn nondefault_rects_in_range(
        &self,
        range: RefRangeBounds,
    ) -> impl Iterator<Item = (Rect, T)> {
        let [x1, x2, y1, y2] = range_to_rect(range);
        let u64_to_i64 = |u: u64| u.try_into().unwrap_or(i64::MAX);
        self.0
            .blocks_for_range(x1, x2)
            .flat_map(move |columns_block| {
                let default = T::default();
                columns_block
                    .value
                    .blocks_for_range(y1, y2)
                    .filter(move |y_block| *y_block.value != default)
                    .map(move |y_block| {
                        // Rectangle is guaranteed to be finite because input is
                        // also a finite rectangle.
                        let rect = Rect::new(
                            u64_to_i64(columns_block.start),
                            u64_to_i64(y_block.start),
                            u64_to_i64(columns_block.end.saturating_sub(1)),
                            u64_to_i64(y_block.end.saturating_sub(1)),
                        );
                        (rect, y_block.value.clone())
                    })
            })
    }

    /// Returns a single value. Returns `T::default()` if `pos` is invalid.
    pub fn get(&self, pos: Pos) -> T {
        // IIFE to mimic try_block
        (|| {
            let (x, y) = convert_pos(pos)?;
            self.0.get(x)?.get(y)
        })()
        .cloned()
        .unwrap_or_default()
    }

    /// Returns the Y block bounds (min_y, max_y inclusive) and value for the
    /// given position. This is useful for rectangular data like merged cells
    /// where the Y extent is stored contiguously in a single block.
    ///
    /// Returns `(y_min, y_max, value)` or None if the position is invalid.
    pub fn get_y_block_bounds(&self, pos: Pos) -> Option<(i64, i64, T)> {
        let (x, y) = convert_pos(pos)?;
        let x_block = self.0.get_block_containing(x)?;
        let y_block = x_block.value.get_block_containing(y)?;

        let y_min = y_block.start as i64;
        let y_max = if y_block.end == u64::MAX {
            i64::MAX
        } else {
            y_block.end.saturating_sub(1) as i64
        };
        Some((y_min, y_max, y_block.value.clone()))
    }

    /// Sets a single value and returns the old one, or `T::default()` if `pos`
    /// is invalid.
    pub fn set(&mut self, pos: Pos, value: T) -> T {
        // IIFE to mimic try_block
        (|| {
            let (x, y) = convert_pos(pos)?;
            self.0.update(x, |col| col.set(y, value))?
        })()
        .unwrap_or_default()
    }

    /// For each non-`None` value in `other`, updates the range in `self` using
    /// `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    pub fn update_from<U: PartialEq, R: Clone + PartialEq>(
        &mut self,
        other: &Contiguous2D<Option<U>>,
        update_fn: impl Fn(&mut T, &U) -> Option<R>,
    ) -> Contiguous2D<Option<R>> {
        self.0
            .update_non_default_from(&other.0, |col, col_update| {
                Some(
                    col.update_non_default_from(col_update, |value, value_update| {
                        update_fn(value, value_update.as_ref()?)
                    }),
                )
            })
            .into()
    }

    /// Sets non-`None` values from `other`, and returns the blocks to set to
    /// undo it.
    pub fn set_from(&mut self, other: &Contiguous2D<Option<T>>) -> Contiguous2D<Option<T>> {
        self.update_from(other, |value, new_value| {
            (value != new_value).then(|| std::mem::replace(value, new_value.clone()))
        })
    }

    /// For each non-`None` value in `other`, calls `predicate` with the
    /// corresponding values in `self` and `other`. Returns `true` if **any**
    /// invocation of `predicate` returns true.
    pub fn zip_any<U: PartialEq>(
        &self,
        other: &Contiguous2D<Option<U>>,
        predicate: impl Fn(&T, &U) -> bool,
    ) -> bool {
        self.0.zip_any(&other.0, |self_column, other_column| {
            self_column.zip_any(other_column, |self_value, other_value| {
                let Some(value) = other_value else {
                    return false;
                };
                predicate(self_value, value)
            })
        })
    }

    /// Sets multiple block of values in the same column range.
    pub fn raw_set_xy_blocks(
        &mut self,
        xy_block: Block<impl Clone + IntoIterator<Item = Block<T>>>,
    ) {
        let x1 = xy_block.start;
        let x2 = xy_block.end;
        self.0.update_range(x1, x2, |column_data| {
            for y_block in xy_block.value.clone() {
                column_data.raw_set_block(y_block);
            }
        });
    }

    /// Returns all data as 2D blocks.
    pub fn xy_blocks(&self) -> impl Iterator<Item = Block<impl Iterator<Item = &Block<T>>>> {
        self.0
            .iter()
            .map(|column_block| column_block.map_ref(|column_data| column_data.iter()))
    }

    /// Returns all data as owned 2D blocks.
    pub fn into_xy_blocks(self) -> impl Iterator<Item = Block<impl Iterator<Item = Block<T>>>> {
        self.0
            .into_iter()
            .map(|column_block| column_block.map(|column_data| column_data.into_iter()))
    }

    /// Translates all non-default values.
    ///
    /// Values before 1,1 are truncated.
    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.0.translate_in_place(x);
        for column_data in self.0.values_mut() {
            column_data.value.translate_in_place(y);
        }
    }

    /// Sets a rectangle to the same value and returns the blocks to set undo
    /// it.
    ///
    /// All coordinates are inclusive.
    ///
    /// If `x2` or `y2` are `None`, the rectangle is infinite in that direction.
    pub fn set_rect(
        &mut self,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
        value: T,
    ) -> Contiguous2D<Option<T>> {
        self.set_from(&Contiguous2D::from_rect(x1, y1, x2, y2, Some(value)))
    }

    /// Returns the upper bound on the finite regions in the given column.
    /// Returns 0 if there are no values.
    pub fn col_max(&self, column: i64) -> i64 {
        let Some(column) = convert_coord(column) else {
            return 0;
        };
        let Some(column_data) = self.0.get(column) else {
            return 0;
        };

        // `.try_into()` will only fail if there are finite values beyond
        // `i64::MAX`. In that case there's no correct answer.
        column_data.finite_max().try_into().unwrap_or(UNBOUNDED)
    }

    pub fn col_min(&self, column: i64) -> i64 {
        let Some(column) = convert_coord(column) else {
            return 0;
        };
        let Some(column_data) = self.0.get(column) else {
            return 0;
        };
        column_data.min().unwrap_or(0) as i64
    }

    /// Returns the upper bound on the finite regions in the given row. Returns
    /// 0 if there are no values.
    pub fn row_max(&self, row: i64) -> i64 {
        let Some(row) = convert_coord(row) else {
            return 0;
        };

        let default = T::default();

        // Find the last block of columns that has a non-default value at the
        // given row, then return `finite_max()` for that block.
        self.0
            .iter()
            .rev()
            .find_map(|column_block| {
                let column_data = &column_block.value;
                (*column_data.get(row)? != default).then(|| column_block.finite_max())
            })
            .unwrap_or(0)
            // `.try_into()` will only fail if there are finite values beyond
            // `i64::MAX`. In that case there's no correct answer.
            .try_into()
            .unwrap_or(UNBOUNDED)
    }

    /// Returns the lower bound on the finite regions in the given row. Returns
    /// 0 if there are no values.
    pub fn row_min(&self, row: i64) -> i64 {
        let Some(row) = convert_coord(row) else {
            return 0;
        };
        // Find the first block of columns that has a non-default value at the
        // given row, then return `min()` for that block.
        self.0
            .iter()
            .find_map(|column_block| {
                let column_data = &column_block.value;
                (*column_data.get(row)? != T::default()).then_some(column_block.start)
            })
            .unwrap_or(0) as i64
    }

    /// Removes a column and returns the values that used to inhabit it. Returns
    /// `None` if `column` is out of range.
    pub fn remove_column(&mut self, column: i64) -> Option<Contiguous2D<Option<T>>> {
        let ret = self.copy_column(column);
        let column = convert_coord(column)?;
        self.0.shift_remove(column, column.saturating_add(1));
        ret
    }

    /// Returns a new [`Contiguous2D`] containing a single column from `self`.
    /// Returns `None` if `column` is out of range.
    pub fn copy_column(&self, column: i64) -> Option<Contiguous2D<Option<T>>> {
        let column = convert_coord(column)?;

        let mut ret: Contiguous2D<Option<T>> = Contiguous2D::new();

        let column_data =
            self.0
                .get(column)
                .cloned()
                .unwrap_or_default()
                .map(|v| match v == T::default() {
                    true => None,
                    false => Some(v),
                });
        ret.0.set(column, column_data);
        Some(ret)
    }

    /// Inserts a column and optionally populates it based on the column before
    /// or after it.
    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
        // This is required when migrating versions < 1.7.1 having negative
        // column offsets. When inserting a column at a negative offset, we need
        // insert at column 1 with no copy.
        if column < 1 {
            self.0.shift_insert(1, 2, ContiguousBlocks::default());
            return;
        }

        let Some(column) = convert_coord(column) else {
            return;
        };
        let values = match copy_formats {
            CopyFormats::Before => column.checked_sub(1).and_then(|i| self.0.get(i).cloned()),
            CopyFormats::After => self.0.get(column).cloned(),
            CopyFormats::None => None,
        };
        self.0
            .shift_insert(column, column.saturating_add(1), values.unwrap_or_default());
    }

    /// Removes a row and returns the values that used to inhabit it.
    pub fn remove_row(&mut self, row: i64) -> Option<Contiguous2D<Option<T>>> {
        let ret = self.copy_row(row);
        let row = convert_coord(row)?;
        self.0.update_all(|column_data| {
            column_data.shift_remove(row, row.saturating_add(1));
            None::<std::convert::Infallible> // can change to `None::<!>` when that stabilizes
        });
        ret
    }

    /// Returns a new [`Contiguous2D`] containing a single row from `self`.
    /// Returns `None` if `row` is out of range.
    pub fn copy_row(&self, row: i64) -> Option<Contiguous2D<Option<T>>> {
        let row = convert_coord(row)?;
        let mut ret = Contiguous2D::new();
        ret.0
            .update_non_default_from(&self.0, |ret_column, self_column| {
                ret_column.set(row, self_column.get(row).cloned());
                None::<std::convert::Infallible> // can change to `None::<!>` when that stabilizes
            });
        Some(ret)
    }

    /// Inserts a row and optionally populates it based on the row before
    /// or after it.
    pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
        // This is required when migrating versions < 1.7.1 having negative
        // row offsets. When inserting a row at a negative offset, we need
        // insert at row 1 with no copy.
        if row < 1 {
            self.0.update_all(|column_data| {
                column_data.shift_insert(1, 2, T::default());
                None::<()> // no return value needed
            });
            return;
        }

        let Some(row) = convert_coord(row) else {
            return;
        };
        self.0.update_all(|column_data| {
            let value = match copy_formats {
                CopyFormats::Before => row.checked_sub(1).and_then(|i| column_data.get(i).cloned()),
                CopyFormats::After => column_data.get(row).cloned(),
                CopyFormats::None => None,
            };
            column_data.shift_insert(row, row.saturating_add(1), value.unwrap_or_default());
            None::<()> // no return value needed
        });
    }

    /// Constructs a new [`Contiguous2D`] by applying a pure function to every
    /// value.
    pub fn map_ref<U: Clone + PartialEq>(&self, f: impl Fn(&T) -> U) -> Contiguous2D<U> {
        Contiguous2D(self.0.map_ref(|column| column.map_ref(&f)))
    }

    /// Returns the values in a Rect as a Vec of values, organized by y then x.
    pub fn rect_values(&self, rect: Rect) -> Vec<Option<T>> {
        let mut values = vec![None; rect.len() as usize];
        for x in rect.x_range() {
            let dx = x - rect.min.x;
            let Some(x) = convert_coord(x) else { continue };
            let Some(column) = self.0.get(x) else {
                continue;
            };
            for y in rect.y_range() {
                let dy = y - rect.min.y;
                let Some(y) = convert_coord(y) else { continue };
                let Some(value) = column.get(y) else { continue };
                values[dy as usize * rect.width() as usize + dx as usize] = Some(value.clone());
            }
        }
        values
    }

    /// Returns whether any of the non-default values in `self` intersects
    /// `rect`.
    pub fn intersects(&self, rect: Rect) -> bool {
        // Fast path for single-cell lookups
        if rect.len() == 1 {
            return self.get(rect.min) != T::default();
        }
        self.nondefault_rects_in_rect(rect).next().is_some()
    }

    /// Returns whether a column contains entirely default values.
    pub fn is_col_default(&self, col: i64) -> bool {
        let Some(col) = convert_coord(col) else {
            return true;
        };
        self.0.get(col).is_none_or(|column| column.is_all_default())
    }

    /// Returns whether a row contains entirely default values.
    pub fn is_row_default(&self, row: i64) -> bool {
        let default = T::default();
        self.all_in_row(row, |value| *value == default)
    }

    /// Returns whether any cell in the column satisfies the predicate
    pub fn any_in_col(&self, col: i64, f: impl Fn(&T) -> bool) -> bool {
        let Some(col) = convert_coord(col) else {
            return f(&T::default());
        };
        self.0
            .get(col)
            .is_some_and(|column| column.iter().any(|block| f(&block.value)))
    }
    /// Returns whether all cells in the column satisfy the predicate.
    pub fn all_in_col(&self, col: i64, f: impl Fn(&T) -> bool) -> bool {
        !self.any_in_col(col, |value| !f(value))
    }

    /// Returns whether any cell in the row satisfies the predicate.
    pub fn any_in_row(&self, row: i64, f: impl Fn(&T) -> bool) -> bool {
        let Some(row) = convert_coord(row) else {
            return f(&T::default());
        };
        self.0.iter().any(|column_block| {
            let column_data = &column_block.value;
            column_data.get(row).is_some_and(&f)
        })
    }
    /// Returns whether all cells in the row satisfy the predicate.
    pub fn all_in_row(&self, row: i64, f: impl Fn(&T) -> bool) -> bool {
        !self.any_in_row(row, |value| !f(value))
    }

    /// Returns the bounding rect of the contiguous 2d.
    pub fn bounding_rect(&self) -> Option<Rect> {
        if self.is_all_default() {
            return None;
        }

        let mut min_x = i64::MAX;
        let mut max_x = i64::MIN;
        let mut min_y = i64::MAX;
        let mut max_y = i64::MIN;

        let mut found_any = false;

        for xy_block in self.xy_blocks() {
            let x1 = xy_block.start as i64;
            let x2 = match xy_block.end {
                u64::MAX => i64::MAX,
                finite => (finite - 1) as i64,
            };

            for y_block in xy_block.value {
                let y1 = y_block.start as i64;
                let y2 = match y_block.end {
                    u64::MAX => i64::MAX,
                    finite => (finite - 1) as i64,
                };

                if y_block.value != T::default() {
                    found_any = true;
                    min_x = min_x.min(x1);
                    max_x = max_x.max(x2);
                    min_y = min_y.min(y1);
                    max_y = max_y.max(y2);
                }
            }
        }

        if found_any {
            Some(Rect::new(min_x, min_y, max_x, max_y))
        } else {
            None
        }
    }
}

impl<T: Clone + PartialEq + fmt::Debug> Contiguous2D<Option<T>> {
    /// Constructs an update Contiguous2D from a selection and a value set
    /// across the selection, or returns `None` if the value is `None`.
    ///
    /// `value` must be `None` if there is no update to do, and `Some` if there
    /// is an update to do.
    pub fn new_from_opt_selection(selection: &A1Selection, value: Option<T>) -> Option<Self> {
        Some(Self::new_from_selection(selection, Some(value?)))
    }

    /// Returns the set of (potentially infinite) rectangles that have values.
    /// Each rectangle is `(x1, y1, x2, y2)`, where `None` is unbounded. All
    /// coordinates are inclusive.
    ///
    /// `None` values are skipped.
    pub fn to_rects(&self) -> impl '_ + Iterator<Item = (i64, i64, Option<i64>, Option<i64>, T)> {
        self.0
            .iter()
            .flat_map(|x_block| {
                let column = &x_block.value;
                let x1 = x_block.start;
                let x2 = (x_block.end < u64::MAX).then_some(x_block.end.saturating_sub(1));
                column.iter().map(move |y_block| {
                    let y1 = y_block.start;
                    let y2 = (y_block.end < u64::MAX).then_some(y_block.end.saturating_sub(1));
                    (x1, y1, x2, y2, y_block.value.clone())
                })
            })
            .filter_map(|(x1, y1, x2, y2, value)| {
                // Convert to i64. If overflow on the conversion, skip it.
                let x1 = x1.try_into().ok()?;
                let x2 = x2.and_then(|x| x.try_into().ok());
                let y1 = y1.try_into().ok()?;
                let y2 = y2.and_then(|y| y.try_into().ok());
                Some((x1, y1, x2, y2, value?))
            })
    }

    /// Returns the set of rectangles that have values. Each rectangle is `(x1,
    /// y1, x2, y2, value)` with inclusive coordinates. Unlike `to_rects()`,
    /// this returns concrete coordinates rather than potentially infinite
    /// bounds.
    ///
    /// `None` values are skipped.
    pub fn to_rects_with_grid_bounds<'a>(
        &'a self,
        sheet_bounds: impl 'a + Fn(bool) -> Option<Rect>,
        columns_bounds: impl 'a + Fn(i64, i64, bool) -> Option<(i64, i64)>,
        rows_bounds: impl 'a + Fn(i64, i64, bool) -> Option<(i64, i64)>,
        ignore_formatting: bool,
    ) -> impl 'a + Iterator<Item = (i64, i64, i64, i64, T)> {
        let sheet_bounds = sheet_bounds(ignore_formatting);
        self.to_rects()
            .filter_map(move |(x1, y1, x2, y2, value)| match (x2, y2) {
                (Some(x2), Some(y2)) => Some((x1, y1, x2, y2, value)),
                (None, Some(y2)) => rows_bounds(y1, y2, ignore_formatting)
                    .map(|(_, x2)| (x1, y1, x2.max(x1), y2, value)),
                (Some(x2), None) => columns_bounds(x1, x2, ignore_formatting)
                    .map(|(_, y2)| (x1, y1, x2, y2.max(y1), value)),
                _ => {
                    sheet_bounds.map(|rect| (x1, y1, rect.max.x.max(x1), rect.max.y.max(y1), value))
                }
            })
    }

    /// Constructs an update for a selection, taking values from `self` at every
    /// location in the selection.
    pub fn get_update_for_selection(
        &self,
        selection: &A1Selection,
    ) -> Contiguous2D<Option<crate::ClearOption<T>>> {
        let mut c: Contiguous2D<Option<crate::ClearOption<T>>> = Contiguous2D::new();
        selection.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                for xy_block in self.xy_blocks_in_range(*range) {
                    c.0.update_range(xy_block.start, xy_block.end, |column| {
                        for y_block in &xy_block.value {
                            column.update_range(y_block.start, y_block.end, |old_value| {
                                *old_value = Some(crate::ClearOption::from(y_block.value.clone()));
                            });
                        }
                    });
                }
            }
            // this is handled separately as we need to create different format
            // operations for tables
            CellRefRange::Table { .. } => (),
        });
        c
    }

    /// Constructs an update for a range, taking values from `self` at every
    /// location in the range.
    ///
    /// `clear_on_none` controls whether to clear the value if it is `None`.
    /// If `false`, the value will be left as is.
    pub fn get_update_for_range(
        &self,
        range: RefRangeBounds,
        clear_on_none: bool,
    ) -> Contiguous2D<Option<crate::ClearOption<T>>> {
        let mut c: Contiguous2D<Option<crate::ClearOption<T>>> = Contiguous2D::new();
        for xy_block in self.xy_blocks_in_range(range) {
            c.0.update_range(xy_block.start, xy_block.end, |column| {
                for y_block in &xy_block.value {
                    column.update_range(y_block.start, y_block.end, |old_value| {
                        match y_block.value {
                            Some(_) => {
                                *old_value = Some(crate::ClearOption::from(y_block.value.clone()));
                            }
                            None => {
                                if clear_on_none {
                                    *old_value = Some(crate::ClearOption::Clear);
                                }
                            }
                        }
                    });
                }
            });
        }
        c
    }

    /// Constructs an update for a rect, taking values from `self` at every
    /// location in the rect.
    ///
    /// `clear_on_none` controls whether to clear the value if it is `None`.
    /// If `false`, the value will be left as is.
    pub fn get_update_for_rect(
        &self,
        rect: Rect,
        clear_on_none: bool,
    ) -> Contiguous2D<Option<crate::ClearOption<T>>> {
        self.get_update_for_range(RefRangeBounds::new_relative_rect(rect), clear_on_none)
    }

    /// Returns an iterator over the blocks in the contiguous 2d.
    pub fn into_iter(&self) -> impl '_ + Iterator<Item = (u64, u64, Option<u64>, Option<u64>, T)> {
        self.0.iter().flat_map(|x_block| {
            let column = &x_block.value;
            let x1 = x_block.start;
            let x2 = (x_block.end < u64::MAX).then_some(x_block.end.saturating_sub(1));
            column.iter().filter_map(move |y_block| {
                let y1 = y_block.start;
                let y2 = (y_block.end < u64::MAX).then_some(y_block.end.saturating_sub(1));
                Some((x1, y1, x2, y2, y_block.value.clone()?))
            })
        })
    }

    /// Returns the finite bounds of the contiguous 2d.
    pub fn finite_bounds(&self) -> Option<Rect> {
        let mut bounds = GridBounds::default();
        self.into_iter().for_each(|(x1, y1, x2, y2, _)| {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                bounds.add_rect(Rect::new(x1 as i64, y1 as i64, x2 as i64, y2 as i64));
            }
        });
        bounds.into()
    }
}

/// Casts an `i64` position to a `u64` position. Returns `None` if the
/// coordinate is out of range (i.e., either coordinate is **less than 1**).
fn convert_pos(pos: Pos) -> Option<(u64, u64)> {
    Some((convert_coord(pos.x)?, convert_coord(pos.y)?))
}

/// Casts an `i64` coordinate to a `u64` coordinate. Returns `None` if the
/// coordinate is out of range (i.e., it is **less than 1**).
fn convert_coord(x: i64) -> Option<u64> {
    x.try_into().ok().filter(|&x| x >= 1)
}

/// Returns `[x1, x2, y1, y2]` for `range`.
///
/// `x1` and `y1` are inclusive; `x2` and `y2` are exclusive.
fn range_to_rect(range: RefRangeBounds) -> [u64; 4] {
    fn i64_to_u64(i: i64) -> u64 {
        if i == i64::MAX {
            u64::MAX
        } else {
            i.try_into().unwrap_or(0)
        }
    }

    let r = range.to_rect_unbounded();
    let x1 = i64_to_u64(r.min.x);
    let x2 = i64_to_u64(r.max.x).saturating_add(1);
    let y1 = i64_to_u64(r.min.y);
    let y2 = i64_to_u64(r.max.y).saturating_add(1);
    [x1, x2, y1, y2]
}

/// Casts an `i64` rectangle that INCLUDES both bounds to a `u64` rectangle that
/// INCLUDES the starts and EXCLUDES the ends. Clamps the results to greater
/// than 1. Returns `None` if there is no part of the rectangle that intersects
/// the valid region. `u64::MAX` represents infinity.
///
/// Returns `(x1, y1, x2, y2)`.
///
/// TODO: when doing `i64 -> u64` refactor, consider making `Rect` do this
///       validation on construction. this means we'd need to handle infinity
///       everywhere.
fn convert_rect(
    x1: i64,
    y1: i64,
    x2: Option<i64>,
    y2: Option<i64>,
) -> Option<(u64, u64, u64, u64)> {
    let (x1, x2) = sort_bounds(x1, x2);
    let (y1, y2) = sort_bounds(y1, y2);

    let x1 = x1.try_into().unwrap_or(0).max(1);
    let x2 = x2
        .map(|x| x.try_into().unwrap_or(0))
        .unwrap_or(u64::MAX)
        .saturating_add(1);

    let y1 = y1.try_into().unwrap_or(0).max(1);
    let y2 = y2
        .map(|y| y.try_into().unwrap_or(0))
        .unwrap_or(u64::MAX)
        .saturating_add(1);

    (x1 < x2 && y1 < y2).then_some((x1, y1, x2, y2))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_empty() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        assert!(c.is_all_default());
        c.set(pos![A1], Some(true));
        assert!(!c.is_all_default());
        c.set(pos![A1], None);
        assert!(c.is_all_default());
    }

    #[test]
    fn test_set() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        assert_eq!(c.set(pos![A1], Some(true)), None);
        assert_eq!(c.get(pos![A1]), Some(true));
        assert_eq!(c.set(pos![A1], Some(false)), Some(true));
        assert_eq!(c.get(pos![A1]), Some(false));
    }

    #[test]
    fn test_set_rect() {
        let mut c = Contiguous2D::<Option<bool>>::new();

        let mut undo = Contiguous2D::<Option<Option<bool>>>::new();
        undo.set_rect(2, 2, Some(10), Some(10), Some(None));

        assert_eq!(c.set_rect(2, 2, Some(10), Some(10), Some(true)), undo);
        assert_eq!(c.get(pos![A1]), None);
        assert_eq!(c.get(pos![B2]), Some(true));
        assert_eq!(c.get(pos![J10]), Some(true));

        let mut undo2 = Contiguous2D::<Option<Option<bool>>>::new();
        undo2.set(Pos { x: 5, y: 5 }, Some(Some(true)));
        assert_eq!(c.set_rect(5, 5, Some(5), Some(5), Some(false)), undo2);
        assert_eq!(c.get(Pos { x: 5, y: 5 }), Some(false));

        c.set_from(&undo2);
        assert_eq!(c.get(Pos { x: 5, y: 5 }), Some(true));
        assert_eq!(c.get(pos![A1]), None);
        assert_eq!(c.get(pos![B2]), Some(true));

        c.set_from(&undo);
        assert_eq!(c.get(pos![A1]), None);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![J10]), None);
    }

    #[test]
    fn test_set_rect_infinite() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        let mut undo = Contiguous2D::<Option<Option<bool>>>::new();
        undo.set_rect(1, 1, None, None, Some(None));
        assert_eq!(c.set_rect(1, 1, None, None, Some(true)), undo);

        assert_eq!(c.get(pos![A1]), Some(true));
        assert_eq!(c.get(pos![B2]), Some(true));
        assert_eq!(c.get(pos![Z1000]), Some(true));
    }

    #[test]
    fn test_set_column() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        let mut undo = Contiguous2D::<Option<Option<bool>>>::new();
        undo.set_rect(2, 1, Some(2), None, Some(None));
        assert_eq!(c.set_rect(2, 1, Some(2), None, Some(true)), undo);

        assert_eq!(c.get(pos![B2]), Some(true));
        assert_eq!(c.get(pos![B100000]), Some(true));
        assert_eq!(c.get(pos![A1]), None);

        c.set_from(&undo);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![B100000]), None);
    }

    #[test]
    fn test_set_row() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        let mut undo = Contiguous2D::<Option<Option<bool>>>::new();
        undo.set_rect(1, 2, None, Some(2), Some(None));
        assert_eq!(c.set_rect(1, 2, None, Some(2), Some(true)), undo);

        assert_eq!(c.get(pos![A2]), Some(true));
        assert_eq!(c.get(pos![ZZZZ2]), Some(true));

        c.set_from(&undo);
        assert_eq!(c.get(pos![A2]), None);
        assert_eq!(c.get(pos![ZZZZ2]), None);
    }

    #[test]
    fn test_insert_column() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));

        c.insert_column(2, CopyFormats::After);

        assert_eq!(c.get(pos![B2]), Some(true));
        assert_eq!(c.get(pos![B10]), Some(true));
        assert_eq!(c.get(pos![B11]), None);

        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));

        c.insert_column(2, CopyFormats::Before);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![B10]), None);
    }

    #[test]
    fn test_insert_row() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        assert_eq!(c.get(pos![B2]), Some(true));

        c.insert_row(2, CopyFormats::After);

        assert_eq!(c.get(pos![B2]), Some(true));
        assert_eq!(c.get(pos![D2]), Some(true));
        assert_eq!(c.get(pos![K2]), None);

        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));

        c.insert_row(2, CopyFormats::Before);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![D2]), None);
    }

    #[test]
    fn test_remove_column() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        assert_eq!(c.get(Pos { x: 10, y: 2 }), Some(true));

        c.remove_column(3);
        assert_eq!(c.get(Pos { x: 10, y: 2 }), None);
        assert_eq!(c.get(Pos { x: 9, y: 2 }), Some(true));
    }

    #[test]
    fn test_remove_row() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        assert_eq!(c.get(Pos { x: 2, y: 10 }), Some(true));

        c.remove_row(3);
        assert_eq!(c.get(Pos { x: 2, y: 10 }), None);
        assert_eq!(c.get(Pos { x: 2, y: 9 }), Some(true));
    }

    #[test]
    fn test_rect_values() {
        let mut c = Contiguous2D::<bool>::new();
        c.set_rect(2, 2, Some(10), Some(10), true);
        assert_eq!(
            c.rect_values(Rect::test_a1("B2:J10")),
            vec![Some(true); 9 * 9]
        );
    }

    #[test]
    fn test_intersects() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        assert!(c.intersects(Rect::test_a1("A1:J10")));
        assert!(!c.intersects(Rect::test_a1("A1")));
    }

    #[test]
    fn test_new_from_selection() {
        let c = Contiguous2D::<Option<bool>>::new_from_selection(
            &A1Selection::test_a1("A1:B2"),
            Some(true),
        );
        assert_eq!(c.get(pos![A1]), Some(true));
        assert_eq!(c.get(pos![A2]), Some(true));
        assert_eq!(c.get(pos![B1]), Some(true));
        assert_eq!(c.get(pos![B2]), Some(true));
        assert_eq!(c.get(pos![C1]), None);
    }

    #[test]
    fn test_new_from_reverse_selection() {
        let c = Contiguous2D::<Option<bool>>::new_from_selection(
            &A1Selection::test_a1("B2:A1"),
            Some(true),
        );
        assert_eq!(c.get(pos![A1]), Some(true));
        assert_eq!(c.get(pos![A2]), Some(true));
        assert_eq!(c.get(pos![B1]), Some(true));
        assert_eq!(c.get(pos![B2]), Some(true));
        assert_eq!(c.get(pos![C1]), None);
    }

    #[test]
    fn test_copy_column() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        let copy = c.copy_column(3).unwrap();
        assert_eq!(copy.get(Pos { x: 3, y: 2 }), Some(Some(true)));
    }

    #[test]
    fn test_to_rects_with_grid_bounds() {
        fn sheet_bounds(_ignore_formatting: bool) -> Option<Rect> {
            Some(Rect::test_a1("A1:J10"))
        }

        fn columns_bounds(_start: i64, _end: i64, _ignore_formatting: bool) -> Option<(i64, i64)> {
            Some((1, 10))
        }

        fn rows_bounds(_start: i64, _end: i64, _ignore_formatting: bool) -> Option<(i64, i64)> {
            Some((1, 10))
        }

        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        let mut rects =
            c.to_rects_with_grid_bounds(sheet_bounds, columns_bounds, rows_bounds, true);
        assert_eq!(rects.next().unwrap(), (2, 2, 10, 10, true));

        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, None, None, Some(true));
        let mut rects =
            c.to_rects_with_grid_bounds(sheet_bounds, columns_bounds, rows_bounds, true);
        assert_eq!(rects.next().unwrap(), (2, 2, 10, 10, true));
    }

    #[test]
    fn test_contiguous_2d_zip_any() {
        let mut c = Contiguous2D::<u8>::new();
        let mut u = Contiguous2D::<Option<u8>>::new();

        assert!(!c.zip_any(&u, |a, b| a != b));

        c.set_rect(1, 1, Some(10), Some(3), 5);
        assert!(!c.zip_any(&u, |a, b| a != b));

        u.set_rect(1, 1, Some(10), Some(3), Some(5));
        assert!(!c.zip_any(&u, |a, b| a != b));

        u.set_rect(1, 1, Some(3), Some(10), Some(10));
        assert!(c.zip_any(&u, |a, b| a != b));

        c.set_rect(1, 1, Some(3), Some(10), 10);
        assert!(!c.zip_any(&u, |a, b| a != b));
    }

    #[test]
    fn test_to_rects() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, Some(3), Some(10), Some(true));
        assert_eq!(c.to_rects().count(), 1);
        assert_eq!(
            c.to_rects().next(),
            Some((1i64, 1i64, Some(3i64), Some(10i64), true))
        );
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, None, None, Some(false));
        assert_eq!(c.to_rects().next(), Some((1i64, 1i64, None, None, false)));

        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, Some(3), None, Some(true));
        c.set_rect(10, 10, None, Some(20), Some(true));
        assert_eq!(c.to_rects().count(), 2);
        assert_eq!(
            c.to_rects().next(),
            Some((1i64, 1i64, Some(3i64), None, true))
        );
        assert_eq!(
            c.to_rects().nth(1),
            Some((10i64, 10i64, None, Some(20i64), true))
        );
    }

    #[test]
    fn test_finite_bounds() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, Some(3), Some(10), Some(true));
        c.set_rect(20, 20, Some(100), None, Some(true));
        c.set_rect(200, 200, None, Some(200), Some(false));
        assert_eq!(c.finite_bounds(), Some(Rect::new(1, 1, 3, 10)));
    }

    #[test]
    fn test_into_iter() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        assert_eq!(c.into_iter().count(), 0);

        c.set_rect(1, 1, Some(3), Some(3), Some(true));
        let iter_result: Vec<_> = c.into_iter().collect();
        assert_eq!(iter_result.len(), 1);
        assert_eq!(iter_result[0], (1, 1, Some(3), Some(3), true));

        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, Some(2), Some(2), Some(true));
        c.set_rect(5, 5, None, Some(10), Some(false));

        let iter_result: Vec<_> = c.into_iter().collect();
        assert_eq!(iter_result.len(), 2);
        assert!(iter_result.contains(&(1, 1, Some(2), Some(2), true)));
        assert!(iter_result.contains(&(5, 5, None, Some(10), false)));
    }

    #[test]
    fn test_copy_row_is_all_default_after_delete() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, Some(3), Some(3), Some(true));
        let copy = c.copy_row(3).unwrap();
        assert!(!copy.is_all_default());
        c.set_rect(1, 1, Some(3), Some(3), None);
        assert!(c.is_all_default());
        let copy = c.copy_row(3).unwrap();
        assert!(copy.is_all_default());
    }

    #[test]
    fn test_copy_column_is_all_default_after_delete() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, Some(3), Some(3), Some(true));
        let copy = c.copy_column(3).unwrap();
        assert!(!copy.is_all_default());
        c.set_rect(1, 1, Some(3), Some(3), None);
        assert!(c.is_all_default());

        let copy = c.copy_column(3).unwrap();
        assert!(copy.is_all_default());
    }

    #[test]
    fn test_clear() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(1, 1, Some(3), Some(3), Some(true));
        c.set_rect(1, 1, None, None, None);
        assert!(c.is_all_default());
    }

    #[test]
    fn test_col_min() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(5, 2, Some(10), Some(3), Some(true));
        assert_eq!(c.col_min(1), 0);
        assert_eq!(c.col_min(5), 2);
        assert_eq!(c.col_min(10), 2);
        assert_eq!(c.col_min(11), 0);
    }

    #[test]
    fn test_row_min() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(5, 2, Some(10), Some(3), Some(true));
        assert_eq!(c.row_min(1), 0);
        assert_eq!(c.row_min(2), 5);
        assert_eq!(c.row_min(3), 5);
        assert_eq!(c.row_min(4), 0);
    }

    #[test]
    fn test_is_all_default_in_range() {
        let mut c = Contiguous2D::<bool>::new();
        assert!(c.is_all_default());
        c.set_rect(5, 2, Some(10), Some(3), true);
        assert!(!c.is_all_default());
        assert!(c.is_all_default_in_range(RefRangeBounds::new_relative(8, 1, i64::MAX, 1)));
        assert!(!c.is_all_default_in_range(RefRangeBounds::new_relative(8, 1, i64::MAX, 2)));
        assert!(c.is_all_default_in_range(RefRangeBounds::new_relative(5, 4, 5, 4)));
        assert!(!c.is_all_default_in_range(RefRangeBounds::new_relative(8, 3, 8, 3)));
        assert!(c.is_all_default_in_rect(Rect::new(5, 4, 5, 4)));
        assert!(!c.is_all_default_in_rect(Rect::new(8, 3, 8, 3)));
    }

    #[test]
    fn test_unique_values_in_range() {
        let mut c = Contiguous2D::<u8>::new();
        assert_eq!(
            HashSet::from_iter([0]),
            c.unique_values_in_range(RefRangeBounds::ALL),
        );
        c.set_rect(5, 2, Some(10), Some(3), 42);
        c.set_rect(8, 1, Some(9), Some(5), 99);
        assert_eq!(
            HashSet::from_iter([0, 42, 99]),
            c.unique_values_in_range(RefRangeBounds::ALL),
        );
        assert_eq!(
            HashSet::from_iter([0, 99]),
            c.unique_values_in_range(RefRangeBounds::new_relative(8, 1, i64::MAX, 1)),
        );
        assert_eq!(
            HashSet::from_iter([0, 42, 99]),
            c.unique_values_in_range(RefRangeBounds::new_relative(8, 1, i64::MAX, 2)),
        );
        assert_eq!(
            HashSet::from_iter([0]),
            c.unique_values_in_range(RefRangeBounds::new_relative(5, 4, 5, 4)),
        );
        assert_eq!(
            HashSet::from_iter([99]),
            c.unique_values_in_range(RefRangeBounds::new_relative(8, 3, 8, 3)),
        );
        assert_eq!(
            HashSet::from_iter([0]),
            c.unique_values_in_rect(Rect::new(5, 4, 5, 4)),
        );
        assert_eq!(
            HashSet::from_iter([99]),
            c.unique_values_in_rect(Rect::new(8, 3, 8, 3)),
        );
    }

    #[test]
    fn test_nondefault_rects_in_rect() {
        let mut c = Contiguous2D::<u8>::new();
        let r = Rect::new(5, 5, 10, 10);
        assert_eq!(HashSet::from([]), c.nondefault_rects_in_rect(r).collect());
        c.set_rect(1, 1, Some(8), Some(6), 42);
        c.set_rect(8, 3, None, None, 99);
        assert_eq!(
            HashSet::from([
                (Rect::new(5, 5, 7, 6), 42),
                (Rect::new(8, 5, 8, 10), 99),
                (Rect::new(9, 5, 10, 10), 99),
            ]),
            c.nondefault_rects_in_rect(r).collect()
        );
    }

    #[test]
    fn test_nondefault_rects_in_rect_combined() {
        use std::collections::HashSet;

        // Test empty case
        let c = Contiguous2D::<u8>::new();
        let r = Rect::new(5, 5, 10, 10);
        assert_eq!(
            Vec::<(Rect, u8)>::new(),
            c.nondefault_rects_in_rect_combined(r)
        );

        // Test single rect - should return as-is
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 2, Some(5), Some(5), 42);
        let r = Rect::new(1, 1, 10, 10);
        let result = c.nondefault_rects_in_rect_combined(r);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], (Rect::new(2, 2, 5, 5), 42));

        // Test multiple separate rects with different values - should not combine
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 2, Some(3), Some(3), 42);
        c.set_rect(5, 5, Some(6), Some(6), 99);
        let r = Rect::new(1, 1, 10, 10);
        let result: HashSet<_> = c.nondefault_rects_in_rect_combined(r).into_iter().collect();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&(Rect::new(2, 2, 3, 3), 42)));
        assert!(result.contains(&(Rect::new(5, 5, 6, 6), 99)));

        // Test multiple rects with same value that should be combined
        // This simulates a merged cell that spans multiple column blocks
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 2, Some(3), Some(5), 42); // Column 2-3, rows 2-5
        c.set_rect(4, 2, Some(5), Some(5), 42); // Column 4-5, rows 2-5 (same value)
        let r = Rect::new(1, 1, 10, 10);
        let result = c.nondefault_rects_in_rect_combined(r);
        assert_eq!(result.len(), 1);
        // Should combine into bounding box: columns 2-5, rows 2-5
        assert_eq!(result[0], (Rect::new(2, 2, 5, 5), 42));

        // Test rects that are split across column boundaries with same value
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(2), Some(3), 100);
        c.set_rect(3, 1, Some(4), Some(3), 100);
        c.set_rect(5, 1, Some(6), Some(3), 100);
        let r = Rect::new(1, 1, 10, 10);
        let result = c.nondefault_rects_in_rect_combined(r);
        assert_eq!(result.len(), 1);
        // Should combine all three into one bounding box
        assert_eq!(result[0], (Rect::new(1, 1, 6, 3), 100));

        // Test mixed: some values combine, some don't
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(2), Some(2), 10);
        c.set_rect(3, 1, Some(4), Some(2), 10); // Same value as above, should combine
        c.set_rect(5, 1, Some(6), Some(2), 20); // Different value, separate
        let r = Rect::new(1, 1, 10, 10);
        let result: HashSet<_> = c.nondefault_rects_in_rect_combined(r).into_iter().collect();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&(Rect::new(1, 1, 4, 2), 10)));
        assert!(result.contains(&(Rect::new(5, 1, 6, 2), 20)));

        // Test with Option<Pos> (like merge cells)
        let mut c = Contiguous2D::<Option<Pos>>::new();
        let anchor1 = Pos { x: 1, y: 1 };
        let anchor2 = Pos { x: 5, y: 5 };
        c.set_rect(1, 1, Some(3), Some(3), Some(anchor1));
        c.set_rect(4, 1, Some(5), Some(3), Some(anchor1)); // Same anchor, should combine
        c.set_rect(6, 6, Some(8), Some(8), Some(anchor2)); // Different anchor, separate
        let r = Rect::new(1, 1, 10, 10);
        let result: HashSet<_> = c.nondefault_rects_in_rect_combined(r).into_iter().collect();
        assert_eq!(result.len(), 2);
        // First two should combine
        assert!(result.contains(&(Rect::new(1, 1, 5, 3), Some(anchor1))));
        assert!(result.contains(&(Rect::new(6, 6, 8, 8), Some(anchor2))));

        // Test that full rects are returned even when search range only partially intersects
        // This is the key behavior for merged cells - if a merged cell extends beyond
        // the search range, we want the full merged cell rect, not just the intersection
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 3, Some(5), Some(3), 42); // Data at B3:E3
        let r = Rect::new(2, 2, 3, 3); // Search B2:C3 (only partially intersects)
        let result = c.nondefault_rects_in_rect_combined(r);
        assert_eq!(result.len(), 1);
        // Should return full rect B3:E3, not just the intersection B3:C3
        assert_eq!(result[0], (Rect::new(2, 3, 5, 3), 42));
    }

    #[test]
    fn test_nondefault_rects_all_combined() {
        use std::collections::HashSet;

        // Test empty case
        let c = Contiguous2D::<u8>::new();
        let result: Vec<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result, Vec::<(Rect, u8)>::new());

        // Test single rect
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 2, Some(5), Some(5), 42);
        let result: Vec<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], (Rect::new(2, 2, 5, 5), 42));

        // Test multiple separate rects with different values - should not combine
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 2, Some(3), Some(3), 42);
        c.set_rect(5, 5, Some(6), Some(6), 99);
        let result: HashSet<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&(Rect::new(2, 2, 3, 3), 42)));
        assert!(result.contains(&(Rect::new(5, 5, 6, 6), 99)));

        // Test multiple rects with same value that should be combined
        // This simulates a merged cell that spans multiple column blocks
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 2, Some(3), Some(5), 42); // Column 2-3, rows 2-5
        c.set_rect(4, 2, Some(5), Some(5), 42); // Column 4-5, rows 2-5 (same value)
        let result: Vec<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result.len(), 1);
        // Should combine into bounding box: columns 2-5, rows 2-5
        assert_eq!(result[0], (Rect::new(2, 2, 5, 5), 42));

        // Test rects that are split across column boundaries with same value
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(2), Some(3), 100);
        c.set_rect(3, 1, Some(4), Some(3), 100);
        c.set_rect(5, 1, Some(6), Some(3), 100);
        let result: Vec<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result.len(), 1);
        // Should combine all three into one bounding box
        assert_eq!(result[0], (Rect::new(1, 1, 6, 3), 100));

        // Test mixed: some values combine, some don't
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(2), Some(2), 10);
        c.set_rect(3, 1, Some(4), Some(2), 10); // Same value as above, should combine
        c.set_rect(5, 1, Some(6), Some(2), 20); // Different value, separate
        let result: HashSet<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&(Rect::new(1, 1, 4, 2), 10)));
        assert!(result.contains(&(Rect::new(5, 1, 6, 2), 20)));

        // Test with Option<Pos> (like merge cells)
        let mut c = Contiguous2D::<Option<Pos>>::new();
        let anchor1 = Pos { x: 1, y: 1 };
        let anchor2 = Pos { x: 5, y: 5 };
        c.set_rect(1, 1, Some(3), Some(3), Some(anchor1));
        c.set_rect(4, 1, Some(5), Some(3), Some(anchor1)); // Same anchor, should combine
        c.set_rect(6, 6, Some(8), Some(8), Some(anchor2)); // Different anchor, separate
        let result: HashSet<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result.len(), 2);
        // First two should combine
        assert!(result.contains(&(Rect::new(1, 1, 5, 3), Some(anchor1))));
        assert!(result.contains(&(Rect::new(6, 6, 8, 8), Some(anchor2))));

        // Test that it produces same results as nondefault_rects_in_range_combined(RefRangeBounds::ALL)
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(3), Some(3), 42);
        c.set_rect(5, 5, Some(7), Some(7), 99);
        c.set_rect(10, 10, Some(12), Some(12), 42); // Same value as first, should combine
        let all_result: HashSet<_> = c.nondefault_rects_all_combined().collect();
        let range_result: HashSet<_> = c
            .nondefault_rects_in_range_combined(RefRangeBounds::ALL)
            .into_iter()
            .collect();
        assert_eq!(all_result, range_result);

        // Test with infinite ranges
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, None, None, 42); // Infinite range
        let result: Vec<_> = c.nondefault_rects_all_combined().collect();
        assert_eq!(result.len(), 1);
        // Should handle infinite ranges correctly
        assert_eq!(result[0].1, 42);
    }

    #[test]
    fn test_bounding_rect() {
        // Test empty/all default case
        let c = Contiguous2D::<u8>::new();
        assert_eq!(c.bounding_rect(), None);

        // Test single cell
        let mut c = Contiguous2D::<u8>::new();
        c.set(pos![A1], 42);
        assert_eq!(c.bounding_rect(), Some(Rect::new(1, 1, 1, 1)));

        // Test single rectangle
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(2, 3, Some(5), Some(7), 42);
        assert_eq!(c.bounding_rect(), Some(Rect::new(2, 3, 5, 7)));

        // Test multiple separate regions
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(3), Some(3), 42);
        c.set_rect(10, 10, Some(15), Some(12), 99);
        assert_eq!(c.bounding_rect(), Some(Rect::new(1, 1, 15, 12)));

        // Test with some regions that are default (should be ignored)
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(5, 5, Some(8), Some(8), 42);
        c.set_rect(1, 1, Some(2), Some(2), 0); // default value, should be ignored
        assert_eq!(c.bounding_rect(), Some(Rect::new(5, 5, 8, 8)));

        // Test infinite regions (should be clamped to i64::MAX)
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(5, 5, None, None, 42);
        assert_eq!(c.bounding_rect(), Some(Rect::new(5, 5, i64::MAX, i64::MAX)));

        // Test mixed finite and infinite regions
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(3), Some(3), 42);
        c.set_rect(10, 10, None, Some(15), 99);
        assert_eq!(c.bounding_rect(), Some(Rect::new(1, 1, i64::MAX, 15)));

        // Test after clearing all values
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(5), Some(5), 42);
        assert_eq!(c.bounding_rect(), Some(Rect::new(1, 1, 5, 5)));
        c.set_rect(1, 1, Some(5), Some(5), 0); // set to default
        assert_eq!(c.bounding_rect(), None);
    }

    #[test]
    fn test_get_y_block_bounds() {
        // Test single rect
        let mut c = Contiguous2D::<Option<u8>>::new();
        c.set_rect(2, 3, Some(5), Some(7), Some(42));

        // Query within the rect - should return Y bounds and value
        let result = c.get_y_block_bounds(pos![B3]);
        assert_eq!(result, Some((3, 7, Some(42))));

        let result = c.get_y_block_bounds(pos![E7]);
        assert_eq!(result, Some((3, 7, Some(42))));

        // Query outside the rect - returns default value bounds
        let result = c.get_y_block_bounds(pos![A1]);
        assert!(result.is_some());
        let (_, _, value) = result.unwrap();
        assert_eq!(value, None); // default value

        // Test two adjacent rects with same Y range but different values
        let mut c = Contiguous2D::<Option<u8>>::new();
        c.set_rect(2, 2, Some(4), Some(4), Some(10)); // B2:D4
        c.set_rect(5, 2, Some(7), Some(4), Some(20)); // E2:G4

        // Query first rect
        let result = c.get_y_block_bounds(pos![B2]);
        assert_eq!(result, Some((2, 4, Some(10))));

        let result = c.get_y_block_bounds(pos![D4]);
        assert_eq!(result, Some((2, 4, Some(10))));

        // Query second rect - should have different value
        let result = c.get_y_block_bounds(pos![E2]);
        assert_eq!(result, Some((2, 4, Some(20))));

        let result = c.get_y_block_bounds(pos![G4]);
        assert_eq!(result, Some((2, 4, Some(20))));

        // Query gap between rects (column A)
        let result = c.get_y_block_bounds(pos![A2]);
        assert!(result.is_some());
        let (_, _, value) = result.unwrap();
        assert_eq!(value, None); // default value
    }

    #[test]
    fn test_has_infinite_non_default() {
        // Empty/default has no infinite non-default values
        let c = Contiguous2D::<u8>::new();
        assert!(!c.has_infinite_non_default());

        // Finite rectangle has no infinite values
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(5), Some(5), 42);
        assert!(!c.has_infinite_non_default());

        // Infinite in y (column fill) should return true
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(3), None, 42);
        assert!(c.has_infinite_non_default());

        // Infinite in x (row fill) should return true
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, None, Some(3), 42);
        assert!(c.has_infinite_non_default());

        // Infinite in both (sheet fill) should return true
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, None, None, 42);
        assert!(c.has_infinite_non_default());

        // Infinite block with default value should return false
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, None, None, 0); // default value
        assert!(!c.has_infinite_non_default());

        // Mixed finite and infinite - should return true
        let mut c = Contiguous2D::<u8>::new();
        c.set_rect(1, 1, Some(5), Some(5), 42);
        c.set_rect(10, 1, Some(12), None, 99);
        assert!(c.has_infinite_non_default());

        // Test with Option type (like SheetFormattingType uses)
        let c = Contiguous2D::<Option<String>>::new();
        assert!(!c.has_infinite_non_default());

        let mut c = Contiguous2D::<Option<String>>::new();
        c.set_rect(1, 1, Some(3), None, Some("color".to_string()));
        assert!(c.has_infinite_non_default());

        let mut c = Contiguous2D::<Option<String>>::new();
        c.set_rect(1, 1, None, Some(5), Some("color".to_string()));
        assert!(c.has_infinite_non_default());
    }
}
