use std::collections::{btree_map, BTreeMap};

use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use crate::grid::Contiguous2D;
use crate::{Pos, Rect};

/// Structure representing a selection using axis-aligned linear subspaces of a
/// sheet (i.e., the whole sheet, each column, each row, and each cell).
///
/// This is serialized in transactions, so any changes to it will break
/// transaction compatibility.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, ts_rs::TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct A1Subspaces {
    /// The (inclusive) position after which all columns and rows should be included.
    pub all: Option<Pos>,
    /// Within each column, the (inclusive) Y coordinate after which all cells
    /// should be included.
    pub cols: BTreeMap<u64, u64>,
    /// Within each row, the (inclusive) X coordinate after which all cells
    /// should be included.
    pub rows: BTreeMap<u64, u64>,
    /// Rectangles which should be included.
    pub rects: Vec<Rect>,
}
impl A1Subspaces {
    pub fn contains_pos(&self, pos: Pos) -> bool {
        let (px, py) = (pos.x as u64, pos.y as u64);
        self.all.is_some_and(|q| q.x <= pos.x && q.y <= pos.y)
            || self.cols.get(&px).is_some_and(|y| y <= &py)
            || self.rows.get(&py).is_some_and(|x| x <= &px)
            || self.rects.iter().any(|rect| rect.contains(pos))
    }

    /// Same as [`Self::get()`], but asserts that there are not overlapping
    /// regions at `pos`.
    #[cfg(test)]
    fn contains_pos_disjoint(&self, pos: Pos) -> bool {
        let (px, py) = (pos.x as u64, pos.y as u64);
        let count = self.all.is_some_and(|q| q.x <= pos.x && q.y <= pos.y) as usize
            + self.cols.get(&px).is_some_and(|y| y <= &py) as usize
            + self.rows.get(&py).is_some_and(|x| x <= &px) as usize
            + self.rects.iter().filter(|rect| rect.contains(pos)).count();
        assert!(
            count <= 1,
            "subspaces not disjoint! at {pos}, count={count}",
        );
        count == 1
    }

    pub fn add_rect(&mut self, rect: Rect) {
        self.rects.push(rect);
    }

    pub fn add_all(&mut self, new_all: std::ops::RangeFrom<Pos>) {
        let new_all = new_all.start;

        self.all = Some(match self.all {
            Some(old_all) => {
                if new_all.x <= old_all.x && new_all.y <= old_all.y {
                    // `new_all` completely contains `old_all`.
                    new_all
                } else {
                    // `new_all` does not contain `old_all`. Add rows or columns
                    // to represent the additional area of the new one.
                    //
                    // If `old_all` completely contains `new_all`, then these
                    // loops will have zero iterations.
                    for col in new_all.x..old_all.x {
                        self.add_column(col as u64, new_all.y as u64..);
                    }
                    for row in new_all.y..old_all.y {
                        self.add_row(row as u64, new_all.x as u64..);
                    }
                    old_all
                }
            }
            None => new_all,
        });
    }

    pub fn add_row(&mut self, row: u64, x_range: std::ops::RangeFrom<u64>) {
        match self.rows.entry(row) {
            btree_map::Entry::Vacant(e) => {
                e.insert(x_range.start);
            }
            btree_map::Entry::Occupied(mut e) => {
                if x_range.start < *e.get() {
                    e.insert(x_range.start);
                }
            }
        }
    }

    pub fn add_column(&mut self, col: u64, y_range: std::ops::RangeFrom<u64>) {
        match self.cols.entry(col) {
            btree_map::Entry::Vacant(e) => {
                e.insert(y_range.start);
            }
            btree_map::Entry::Occupied(mut e) => {
                if y_range.start < *e.get() {
                    e.insert(y_range.start);
                }
            }
        }
    }

    /// Returns whether `rect` intersects `self`.
    pub fn intersects_rect(&self, rect: Rect) -> bool {
        self.all
            .is_some_and(|all| all.x <= rect.max.x && all.y <= rect.max.y)
            || self.cols.iter().any(|(&col, &y_start)| {
                rect.x_range().contains(&(col as i64)) && y_start <= rect.max.y as u64
            })
            || self.rows.iter().any(|(&row, &x_start)| {
                rect.y_range().contains(&(row as i64)) && x_start <= rect.max.x as u64
            })
            || self.rects.iter().any(|r| r.intersects(rect))
    }

    /// Ensures that regions are disjoint.
    pub fn make_disjoint(&mut self) {
        // Clear `self` -- we'll reconstruct it piece-by-piece
        let Self {
            all,
            cols,
            rows,
            mut rects,
        } = std::mem::take(self);

        self.all = all;

        for (col, y_start) in cols {
            // Check for overlap between the new column and `all`.
            if let Some(all) = self.all {
                if col >= all.x as u64 {
                    if y_start < all.y as u64 {
                        // Deal with the finite new region later.
                        rects.push(Rect::new(col as i64, y_start as i64, col as i64, all.y - 1));
                    }
                    continue; // The infinite region is completely contained by `all`.
                }
            }

            self.cols.insert(col, y_start);
        }

        for (row, mut x_start) in rows {
            // Check for overlap between the new row and `all`.
            if let Some(all) = self.all {
                if row >= all.y as u64 {
                    if x_start < all.x as u64 {
                        // Deal with the finite new region later.
                        rects.push(Rect::new(x_start as i64, row as i64, all.x - 1, row as i64));
                    }
                    continue; // The infinite region is completely contained by `all`.
                }
            }
            // Check for overlap between the new row and an existing column.
            if let Some((&last_overlapping_col, _y_start)) = self
                .cols
                .range(x_start..)
                .rev()
                .find(|(_col, &y_start)| y_start <= row)
            {
                // Deal with the finite partially-overlapping region later.
                rects.push(Rect::new(
                    x_start as i64,
                    row as i64,
                    last_overlapping_col as i64,
                    row as i64,
                ));
                x_start = last_overlapping_col + 1;
            }

            self.rows.insert(row, x_start);
        }

        // TODO: Consider a quadtree or other optimization to make this not be O(n)²
        for new_rect in rects {
            let mut new_rects: SmallVec<[Rect; 1]> = smallvec![new_rect];
            let subtract_from_each =
                |rect_list: &[Rect], r| rect_list.iter().flat_map(|q| q.subtract(r)).collect();

            if let Some(all) = self.all {
                if new_rect.max.x >= all.x && new_rect.max.y >= all.y {
                    let rect_of_all = Rect::new_span(all, new_rect.max);
                    new_rects = subtract_from_each(&new_rects, rect_of_all);
                }
            }

            for (&col, &y_start) in self.cols.range(new_rect.x_range_u64()) {
                if y_start <= new_rect.max.y as u64 {
                    // TODO: if this runs for many columns, the result could be
                    // very very inefficient (one rectangle per column).
                    let rect_of_col =
                        Rect::new(col as i64, y_start as i64, col as i64, new_rect.max.y);
                    new_rects = subtract_from_each(&new_rects, rect_of_col);
                }
            }

            for (&row, &x_start) in self.rows.range(new_rect.y_range_u64()) {
                if x_start <= new_rect.max.x as u64 {
                    // TODO: if this runs for many rows, the result could be
                    // very very inefficient (one rectangle per row).
                    let rect_of_row =
                        Rect::new(x_start as i64, row as i64, new_rect.max.x, row as i64);
                    new_rects = subtract_from_each(&new_rects, rect_of_row);
                }
            }

            for &r in &self.rects {
                new_rects = new_rects.into_iter().flat_map(|q| q.subtract(r)).collect();
            }

            self.rects.extend(new_rects);
        }
    }

    pub fn from_contiguous<T: Clone + PartialEq>(contiguous: Contiguous2D<T>) -> Self {
        let mut ret = A1Subspaces::default();
        for (x1, y1, x2, y2) in contiguous.to_rects() {
            match (x2, y2) {
                (None, None) => ret.all = Some(Pos::new(x1 as i64, y1 as i64)),
                (None, Some(y2)) => ret.rows.extend((y1..=y2).map(|y| (y, x1))),
                (Some(x2), None) => ret.cols.extend((x1..=x2).map(|x| (x, y1))),
                (Some(x2), Some(y2)) => ret
                    .rects
                    .push(Rect::new(x1 as i64, y1 as i64, x2 as i64, y2 as i64)),
            }
        }
        ret
    }

    /// Returns the length of a corresponding [`RunLengthEncoding`] for a
    /// formatting operation. This is equivalent to the number of cells in the
    /// finite rectangles of the selection, plus the number of rows and columns,
    /// plus 1 if there is an `all`.
    pub fn rle_len(&self) -> usize {
        (self.all.is_some() as usize)
            + self.cols.len()
            + self.rows.len()
            + self.rects.iter().map(|r| r.len() as usize).sum::<usize>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::A1Selection;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_a1_to_subspaces(selection: A1Selection) {
            // println!("selection = {}", selection.ranges.iter().join(","));
            let subspaces = selection.subspaces();
            // println!("subspaces = {subspaces:?}");
            for pos in crate::a1::proptest_positions_iter() {
                assert_eq!(
                    selection.might_contain_pos(pos),
                    subspaces.contains_pos_disjoint(pos),
                    "disagree at {pos}",
                );
            }
        }

        #[test]
        fn test_a1_intersects_rect(selection: A1Selection, r: Rect) {
            let subspaces = selection.subspaces();
            assert_eq!(
                r.iter().any(|pos| selection.might_contain_pos(pos)),
                subspaces.intersects_rect(r),
            );
        }
    }
}
