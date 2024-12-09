use std::fmt::Debug;

use crate::{grid::GridBounds, A1Selection, CellRefRange, CopyFormats, Pos, Rect};

use serde::{Deserialize, Serialize};

use super::{block::Block, contiguous_blocks::ContiguousBlocks};

/// Key-value store from cell positions to values, optimized for contiguous
/// rectangles with the same value, particularly along columns. All (infinitely
/// many) values are initialized to default.
///
/// Supports infinite blocks down, right, and down-right.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct Contiguous2D<T>(
    #[serde(bound = "T: Serialize + for<'a> Deserialize<'a>")] // shouldn't serde infer this?
    ContiguousBlocks<ContiguousBlocks<T>>,
);
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
impl<T: Default + Clone + PartialEq + Debug> Contiguous2D<T> {
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
                let start = range.start.unpack_xy_default(1);
                if let Some(end) = range.end {
                    let end = end.unpack_xy();
                    c.set_rect(start[0], start[1], end[0], end[1], value.clone());
                } else {
                    match (range.start.col, range.start.row) {
                        (Some(_), Some(_)) => {
                            c.set(start.into(), value.clone());
                        }
                        (Some(_), None) => {
                            c.set_rect(start[0], start[1], Some(start[0]), None, value.clone());
                        }
                        (None, Some(_)) => {
                            c.set_rect(start[0], start[1], None, Some(start[1]), value.clone());
                        }
                        (None, None) => {
                            c.set_rect(start[0], start[1], None, None, value.clone());
                        }
                    }
                }
            }
        });
        c
    }

    /// Returns whether the whole sheet is default.
    pub fn is_all_default(&self) -> bool {
        self.0.is_all_default()
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
        column_data.finite_max().try_into().unwrap_or(i64::MAX)
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
            .unwrap_or(i64::MAX)
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

        let mut ret = Contiguous2D::new();
        let column_data = self.0.get(column).cloned().unwrap_or_default().map(Some);
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
        // TODO(perf): this could be optimized a LOT using `.non_default_blocks()`
        let default = T::default();
        for x in rect.x_range() {
            let Some(x) = convert_coord(x) else { continue };
            let Some(column) = self.0.get(x) else {
                continue;
            };
            for y in rect.y_range() {
                let Some(y) = convert_coord(y) else { continue };
                if column.get(y).is_some_and(|v| *v != default) {
                    return true;
                }
            }
        }
        false
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
}

impl<T: Clone + PartialEq + Debug> Contiguous2D<Option<T>> {
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
    pub fn to_rects_with_bounds<'a>(
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

/// Casts an `i64` rectangle that INCLUDES both bounds to a `u64` rectangle that
/// INCLUDES the starts and EXCLUDES the ends. Clamps the results to greater
/// than 1. Returns `None` if there is no part of the rectangle that intersects
/// the valid region. `u64::MAX` represents infinity.
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
#[serial_test::parallel]
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
    fn test_copy_column() {
        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        let copy = c.copy_column(3).unwrap();
        assert_eq!(copy.get(Pos { x: 3, y: 2 }), Some(Some(true)));
    }

    #[test]
    fn test_to_rects_with_bounds() {
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
        let mut rects = c.to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true);
        assert_eq!(rects.next().unwrap(), (2, 2, 10, 10, true));

        let mut c = Contiguous2D::<Option<bool>>::new();
        c.set_rect(2, 2, None, None, Some(true));
        let mut rects = c.to_rects_with_bounds(sheet_bounds, columns_bounds, rows_bounds, true);
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

        dbg!(&c);
        let copy = c.copy_column(3).unwrap();
        dbg!(&copy);
        assert!(copy.is_all_default());
    }
}
