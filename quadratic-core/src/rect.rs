use std::{collections::HashSet, ops::RangeInclusive};

use rstar::{AABB, RTreeObject};
use serde::{Deserialize, Serialize};
use smallvec::{SmallVec, smallvec};
use wasm_bindgen::prelude::*;

use crate::{ArraySize, Pos, SheetRect, cell_values::CellValues, grid::SheetId};

// TODO: these methods should take `Rect`, not `&Rect` (because `Rect` is `Copy`)

/// Rectangular region of cells.
#[derive(
    Serialize,
    Deserialize,
    Debug,
    Default,
    Copy,
    Clone,
    PartialEq,
    Eq,
    Hash,
    Ord,
    PartialOrd,
    ts_rs::TS,
)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct Rect {
    /// Upper-left corner.
    pub min: Pos,

    /// Lower-right corner.
    pub max: Pos,
}
impl Rect {
    /// Creates a rect from two x, y positions. Normalizes the rectangle.
    pub fn new(x0: i64, y0: i64, x1: i64, y1: i64) -> Rect {
        let min = Pos {
            x: x0.min(x1),
            y: y0.min(y1),
        };
        let max = Pos {
            x: x0.max(x1),
            y: y0.max(y1),
        };
        Rect { min, max }
    }

    /// Constructs a rectangle spanning two positions
    pub fn new_span(pos1: Pos, pos2: Pos) -> Rect {
        use std::cmp::{max, min};

        Rect {
            min: Pos {
                x: min(pos1.x, pos2.x),
                y: min(pos1.y, pos2.y),
            },
            max: Pos {
                x: max(pos1.x, pos2.x),
                y: max(pos1.y, pos2.y),
            },
        }
    }

    pub fn to_sheet_rect(&self, sheet_id: SheetId) -> SheetRect {
        SheetRect {
            min: self.min,
            max: self.max,
            sheet_id,
        }
    }

    /// Creates a rectangle from one x, y position and a width and height
    pub fn from_numbers(x: i64, y: i64, w: i64, h: i64) -> Rect {
        Rect {
            min: Pos { x, y },
            max: Pos {
                x: x + w - 1,
                y: y + h - 1,
            },
        }
    }

    /// Constructs a new rectangle containing only a single cell.
    pub fn single_pos(pos: Pos) -> Rect {
        Rect { min: pos, max: pos }
    }

    /// Extends the rectangle enough to include a cell.
    pub fn extend_to(&mut self, pos: Pos) {
        self.min.x = std::cmp::min(self.min.x, pos.x);
        self.min.y = std::cmp::min(self.min.y, pos.y);
        self.max.x = std::cmp::max(self.max.x, pos.x);
        self.max.y = std::cmp::max(self.max.y, pos.y);
    }

    /// Constructs a rectangle from an X range and a Y range.
    pub fn from_ranges(xs: RangeInclusive<i64>, ys: RangeInclusive<i64>) -> Rect {
        Rect {
            min: Pos {
                x: *xs.start(),
                y: *ys.start(),
            },
            max: Pos {
                x: *xs.end(),
                y: *ys.end(),
            },
        }
    }

    pub fn size(self) -> ArraySize {
        ArraySize::new(self.width(), self.height()).expect("empty rectangle has no size")
    }

    /// Constructs a rectangle from a top-left position and a size.
    pub fn from_pos_and_size(top_left: Pos, size: ArraySize) -> Self {
        Rect {
            min: top_left,
            max: Pos {
                x: top_left.x + size.w.get() as i64 - 1,
                y: top_left.y + size.h.get() as i64 - 1,
            },
        }
    }

    /// Returns whether a position is contained within the rectangle.
    pub fn contains(&self, pos: Pos) -> bool {
        self.x_range().contains(&pos.x) && self.y_range().contains(&pos.y)
    }

    /// Returns whether other is fully contained within self
    pub fn contains_rect(&self, other: &Rect) -> bool {
        self.x_range().contains(&other.min.x)
            && self.x_range().contains(&other.max.x)
            && self.y_range().contains(&other.min.y)
            && self.y_range().contains(&other.max.y)
    }

    /// Returns whether a rectangle intersects with the rectangle.
    pub fn intersects(self, other: Rect) -> bool {
        !(other.max.x < self.min.x
            || other.min.x > self.max.x
            || other.max.y < self.min.y
            || other.min.y > self.max.y)
    }

    /// Returns the range of X values in the rectangle.
    pub fn x_range(self) -> RangeInclusive<i64> {
        self.min.x..=self.max.x
    }

    /// Returns the range of Y values in the rectangle.
    pub fn y_range(self) -> RangeInclusive<i64> {
        self.min.y..=self.max.y
    }

    /// Returns the width of the region.
    pub fn width(&self) -> u32 {
        (self.max.x - self.min.x + 1) as u32
    }
    /// Returns the height of the region.
    pub fn height(&self) -> u32 {
        (self.max.y - self.min.y + 1) as u32
    }

    pub fn len(&self) -> u32 {
        self.width() * self.height()
    }

    pub fn is_empty(&self) -> bool {
        self.width() == 0 || self.height() == 0
    }

    pub fn translate(&self, x: i64, y: i64) -> Self {
        let mut rect = *self;
        rect.translate_in_place(x, y);
        rect
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.min.x += x;
        self.min.y += y;
        self.max.x += x;
        self.max.y += y;
    }

    pub fn iter(self) -> impl Iterator<Item = Pos> {
        let Rect { min, max } = self;
        (min.y..=max.y).flat_map(move |y| (min.x..=max.x).map(move |x| Pos { x, y }))
    }

    pub fn union(&self, other: &Self) -> Self {
        let min_x = std::cmp::min(self.min.x, other.min.x);
        let min_y = std::cmp::min(self.min.y, other.min.y);
        let max_x = std::cmp::max(self.max.x, other.max.x);
        let max_y = std::cmp::max(self.max.y, other.max.y);
        Rect {
            min: Pos { x: min_x, y: min_y },
            max: Pos { x: max_x, y: max_y },
        }
    }

    pub fn union_in_place(&mut self, other: &Self) {
        self.min.x = self.min.x.min(other.min.x);
        self.min.y = self.min.y.min(other.min.y);
        self.max.x = self.max.x.max(other.max.x);
        self.max.y = self.max.y.max(other.max.y);
    }

    /// Normalizes the rectangle, ensuring min.x <= max.x and min.y <= max.y.
    /// Returns a new normalized rectangle.
    pub fn normalize(self) -> Self {
        Rect {
            min: Pos {
                x: self.min.x.min(self.max.x),
                y: self.min.y.min(self.max.y),
            },
            max: Pos {
                x: self.min.x.max(self.max.x),
                y: self.min.y.max(self.max.y),
            },
        }
    }

    /// Normalizes the rectangle in place, ensuring min.x <= max.x and min.y <= max.y.
    pub fn normalize_in_place(&mut self) {
        if self.min.x > self.max.x {
            std::mem::swap(&mut self.min.x, &mut self.max.x);
        }
        if self.min.y > self.max.y {
            std::mem::swap(&mut self.min.y, &mut self.max.y);
        }
    }

    pub fn count(&self) -> usize {
        self.width() as usize * self.height() as usize
    }

    /// Creates a bounding rect from a list of positions
    pub fn from_positions(positions: Vec<Pos>) -> Option<Rect> {
        if positions.is_empty() {
            return None;
        }

        let mut min_x = i64::MAX;
        let mut min_y = i64::MAX;
        let mut max_x = i64::MIN;
        let mut max_y = i64::MIN;

        for pos in positions {
            min_x = min_x.min(pos.x);
            min_y = min_y.min(pos.y);
            max_x = max_x.max(pos.x);
            max_y = max_y.max(pos.y);
        }

        Some(Rect {
            min: Pos { x: min_x, y: min_y },
            max: Pos { x: max_x, y: max_y },
        })
    }

    pub fn extend_x(&mut self, x: i64) {
        self.min.x = self.min.x.min(x);
        self.max.x = self.max.x.max(x);
    }

    pub fn extend_y(&mut self, y: i64) {
        self.min.y = self.min.y.min(y);
        self.max.y = self.max.y.max(y);
    }

    pub fn to_hashes(&self) -> HashSet<Pos> {
        let mut hashes = HashSet::new();
        let min_hash = self.min.quadrant();
        let max_hash = self.max.quadrant();
        for x in min_hash.0..=max_hash.0 {
            for y in min_hash.1..=max_hash.1 {
                hashes.insert(Pos { x, y });
            }
        }
        hashes
    }

    pub fn a1_string(&self) -> String {
        format!("{}:{}", self.min.a1_string(), self.max.a1_string())
    }

    /// Finds the intersection of two rectangles.
    pub fn intersection(&self, other: &Rect) -> Option<Rect> {
        let x1 = self.min.x.max(other.min.x);
        let y1 = self.min.y.max(other.min.y);
        let x2 = self.max.x.min(other.max.x);
        let y2 = self.max.y.min(other.max.y);

        if x1 <= x2 && y1 <= y2 {
            Some(Rect {
                min: Pos { x: x1, y: y1 },
                max: Pos { x: x2, y: y2 },
            })
        } else {
            None
        }
    }

    /// Subtracts `other` from `self`. This will result in 0 to 4 rectangles.
    pub fn subtract(self, other: Rect) -> SmallVec<[Rect; 4]> {
        if self.intersection(&other).is_none() {
            smallvec![self]
        } else {
            let above_other = (self.min.y < other.min.y)
                .then(|| Rect::new(self.min.x, self.min.y, self.max.x, other.min.y - 1));
            let below_other = (self.max.y > other.max.y)
                .then(|| Rect::new(self.min.x, other.max.y + 1, self.max.x, self.max.y));
            let lr_top = std::cmp::max(self.min.y, other.min.y);
            let lr_bottom = std::cmp::min(self.max.y, other.max.y);
            let left_of_other = (self.min.x < other.min.x)
                .then(|| Rect::new(self.min.x, lr_top, other.min.x - 1, lr_bottom));
            let right_of_other = (self.max.x > other.max.x)
                .then(|| Rect::new(other.max.x + 1, lr_top, self.max.x, lr_bottom));
            [above_other, below_other, left_of_other, right_of_other]
                .into_iter()
                .flatten()
                .collect()
        }
    }

    // whether two rects can merge without leaving a gap (but allow overlap)
    pub fn can_merge(&self, other: &Rect) -> bool {
        // Check if the rectangles are adjacent or overlapping in either x or y direction
        let x_merge = self.min.x <= other.max.x && other.min.x <= self.max.x;
        let y_merge = self.min.y <= other.max.y && other.min.y <= self.max.y;

        // Check if one rectangle fully contains the other
        let contains = self.contains(other.min) && self.contains(other.max)
            || other.contains(self.min) && other.contains(self.max);

        // Check if the rectangles have the same height and can merge horizontally
        let horizontal_merge = self.height() == other.height() && x_merge;

        // Check if the rectangles have the same width and can merge vertically
        let vertical_merge = self.width() == other.width() && y_merge;

        // The rectangles can merge if they can merge horizontally, vertically, or if one contains the other
        horizontal_merge || vertical_merge || contains
    }

    /// Returns whether a column is contained within the rectangle.
    pub fn contains_col(&self, col: i64) -> bool {
        col >= self.min.x && col <= self.max.x
    }

    /// Returns whether a row is contained within the rectangle.
    pub fn contains_row(&self, row: i64) -> bool {
        row >= self.min.y && row <= self.max.y
    }

    /// Returns intersection of a range of columns with the rectangle
    pub fn cols_range(&self, from: i64, to: i64) -> Vec<i64> {
        (self.min.x..=self.max.x)
            .filter(|x| *x >= from && *x <= to)
            .collect()
    }

    /// Returns intersection of a range of rows with the rectangle
    pub fn rows_range(&self, from: i64, to: i64) -> Vec<i64> {
        (self.min.y..=self.max.y)
            .filter(|y| *y >= from && *y <= to)
            .collect()
    }

    #[cfg(test)]
    /// Creates a rectangle from a string like "A1:B2".
    pub fn test_a1(s: &str) -> Self {
        use crate::a1::A1Context;

        crate::a1::CellRefRange::test_a1(s)
            .to_rect(&A1Context::default())
            .unwrap()
    }
}

impl From<Pos> for Rect {
    fn from(pos: Pos) -> Self {
        Rect { min: pos, max: pos }
    }
}

impl From<SheetRect> for Rect {
    fn from(sheet_rect: SheetRect) -> Self {
        Rect {
            min: sheet_rect.min,
            max: sheet_rect.max,
        }
    }
}

impl From<&CellValues> for Rect {
    fn from(values: &CellValues) -> Self {
        Rect::from_numbers(0, 0, values.w as i64, values.h as i64)
    }
}

impl RTreeObject for Rect {
    type Envelope = AABB<Pos>;

    fn envelope(&self) -> Self::Envelope {
        // Clamp coordinates to prevent overflow in R-tree calculations
        // while preserving the original coordinates everywhere else
        const MAX_SAFE_COORD: i64 = i32::MAX as i64;
        const MIN_SAFE_COORD: i64 = -(i32::MAX as i64);

        let safe_min = Pos {
            x: self.min.x.clamp(MIN_SAFE_COORD, MAX_SAFE_COORD),
            y: self.min.y.clamp(MIN_SAFE_COORD, MAX_SAFE_COORD),
        };
        let safe_max = Pos {
            x: self.max.x.clamp(MIN_SAFE_COORD, MAX_SAFE_COORD),
            y: self.max.y.clamp(MIN_SAFE_COORD, MAX_SAFE_COORD),
        };

        AABB::from_corners(safe_min, safe_max)
    }
}

#[cfg(test)]
use proptest::prelude::*;
#[cfg(test)]
impl Arbitrary for Rect {
    type Parameters = ();

    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        (Pos::arbitrary(), Pos::arbitrary()).prop_map(|(a, b)| Rect::new_span(a, b))
    }

    type Strategy = proptest::strategy::Map<
        (<Pos as Arbitrary>::Strategy, <Pos as Arbitrary>::Strategy),
        fn((Pos, Pos)) -> Self,
    >;
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_rect_new_span() {
        let pos1 = Pos { x: 1, y: 2 };
        let pos2 = Pos { x: 3, y: 4 };
        let rect = Rect::new_span(pos1, pos2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_to_sheet_rect() {
        let pos1 = Pos { x: 1, y: 2 };
        let pos2 = Pos { x: 3, y: 4 };
        let sheet_id = SheetId::new();
        let rect = Rect::new_span(pos1, pos2).to_sheet_rect(sheet_id);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
        assert_eq!(rect.sheet_id, sheet_id);
    }

    #[test]
    fn test_from_numbers() {
        let rect = Rect::from_numbers(1, 2, 3, 4);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
    }

    #[test]
    fn test_single_pos() {
        let rect = Rect::single_pos(Pos { x: 1, y: 2 });
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });
    }

    #[test]
    fn test_extend_to() {
        let mut rect = Rect::single_pos(Pos { x: 1, y: 2 });
        rect.extend_to(Pos { x: 3, y: 4 });
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_from_ranges() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_size() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.size(), crate::ArraySize::new(3, 3).unwrap());
    }

    #[test]
    fn test_from_pos_and_size() {
        let rect =
            Rect::from_pos_and_size(Pos { x: 1, y: 2 }, crate::ArraySize::new(3, 4).unwrap());
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
    }

    #[test]
    fn test_contains() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(rect.contains(Pos { x: 1, y: 2 }));
        assert!(rect.contains(Pos { x: 3, y: 4 }));
        assert!(!rect.contains(Pos { x: 0, y: 2 }));
        assert!(!rect.contains(Pos { x: 1, y: 1 }));
        assert!(!rect.contains(Pos { x: 4, y: 2 }));
        assert!(!rect.contains(Pos { x: 1, y: 5 }));
    }

    #[test]
    fn test_intersects() {
        let rect = Rect::from_ranges(1..=4, 2..=5);
        assert!(rect.intersects(Rect::from_ranges(1..=3, 2..=4)));
        assert!(rect.intersects(Rect::from_ranges(2..=4, 3..=5)));
        assert!(rect.intersects(Rect::from_ranges(0..=1, 2..=4)));
        assert!(rect.intersects(Rect::from_ranges(1..=3, 0..=2)));
        assert!(rect.intersects(Rect::from_ranges(4..=5, 2..=4)));
        assert!(rect.intersects(Rect::from_ranges(1..=3, 5..=6)));
        assert!(!rect.intersects(Rect::from_ranges(0..=0, 2..=4)));
        assert!(!rect.intersects(Rect::from_ranges(1..=3, 0..=0)));
        assert!(!rect.intersects(Rect::from_ranges(5..=5, 2..=4)));
        assert!(!rect.intersects(Rect::from_ranges(1..=3, 6..=6)));
    }

    #[test]
    fn test_x_range() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.x_range(), 1..=3);
    }

    #[test]
    fn test_y_range() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.y_range(), 2..=4);
    }

    #[test]
    fn test_width() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.width(), 3);
    }

    #[test]
    fn test_height() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.height(), 3);
    }

    #[test]
    fn test_len() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.len(), 9);
    }

    #[test]
    fn test_is_empty() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(!rect.is_empty());
        let rect = Rect::from_numbers(0, 1, 1, 0);
        assert!(rect.is_empty());
        let rect = Rect::from_numbers(0, 1, 0, 1);
        assert!(rect.is_empty());
    }

    #[test]
    fn test_translate_in_place() {
        let mut rect = Rect::from_ranges(1..=3, 2..=4);
        rect.translate_in_place(1, 2);
        assert_eq!(rect.min, Pos { x: 2, y: 4 });
        assert_eq!(rect.max, Pos { x: 4, y: 6 });
    }

    #[test]
    fn test_iter() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        let mut iter = rect.iter();
        assert_eq!(iter.next(), Some(Pos { x: 1, y: 2 }));
        assert_eq!(iter.next(), Some(Pos { x: 2, y: 2 }));
        assert_eq!(iter.next(), Some(Pos { x: 3, y: 2 }));
        assert_eq!(iter.next(), Some(Pos { x: 1, y: 3 }));
        assert_eq!(iter.next(), Some(Pos { x: 2, y: 3 }));
        assert_eq!(iter.next(), Some(Pos { x: 3, y: 3 }));
        assert_eq!(iter.next(), Some(Pos { x: 1, y: 4 }));
        assert_eq!(iter.next(), Some(Pos { x: 2, y: 4 }));
        assert_eq!(iter.next(), Some(Pos { x: 3, y: 4 }));
        assert_eq!(iter.next(), None);
    }

    #[test]
    fn test_rect_combine() {
        let rect1 = Rect::from_numbers(1, 2, 3, 4);
        let rect2 = Rect::from_numbers(2, 3, 4, 5);
        let rect = rect1.union(&rect2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 5, y: 7 });
    }

    #[test]
    fn count() {
        let rect = Rect::from_numbers(1, 2, 3, 4);
        assert_eq!(rect.count(), 12);
    }

    #[test]
    fn rect_from_positions() {
        let positions = vec![Pos { x: 1, y: 1 }, Pos { x: 2, y: 2 }];
        let bounds = Rect::from_positions(positions).unwrap();
        assert_eq!(bounds.min.x, 1);
        assert_eq!(bounds.min.y, 1);
        assert_eq!(bounds.max.x, 2);
        assert_eq!(bounds.max.y, 2);
    }

    #[test]
    fn rect_from_pos() {
        let pos = Pos { x: 1, y: 2 };
        let rect: Rect = pos.into();
        assert_eq!(rect.min, pos);
        assert_eq!(rect.max, pos);
    }

    #[test]
    fn rect_new() {
        let rect = Rect::new(0, 1, 2, 3);
        assert_eq!(rect.min, Pos { x: 0, y: 1 });
        assert_eq!(rect.max, Pos { x: 2, y: 3 });
    }

    #[test]
    fn extend_x() {
        let mut rect = Rect::from_numbers(1, 2, 3, 4);
        rect.extend_x(5);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 5, y: 5 });
    }

    #[test]
    fn extend_y() {
        let mut rect = Rect::from_numbers(1, 2, 3, 4);
        rect.extend_y(5);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
    }

    #[test]
    fn rect_intersection() {
        let rect1 = Rect::new(1, 2, 3, 4);
        let rect2 = Rect::new(2, 3, 4, 5);
        let intersection = rect1.intersection(&rect2).unwrap();
        assert_eq!(intersection, Rect::new(2, 3, 3, 4));

        let rect3 = Rect::new(4, 5, 6, 7);
        assert!(rect1.intersection(&rect3).is_none());
        assert_eq!(rect2.intersection(&rect3).unwrap(), Rect::new(4, 5, 4, 5));
    }

    #[test]
    fn can_merge() {
        let rect = Rect::new(0, 0, 2, 2);

        assert!(rect.can_merge(&Rect::new(2, 0, 4, 2)));
        assert!(rect.can_merge(&Rect::new(0, 2, 2, 4)));
        assert!(!rect.can_merge(&Rect::new(3, 3, 5, 5)));
        assert!(rect.can_merge(&Rect::new(1, 1, 3, 3)));
        assert!(rect.can_merge(&Rect::new(0, 0, 4, 4)));
    }

    #[test]
    fn test_contains_col() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(rect.contains_col(2));
        assert!(!rect.contains_col(8));
    }

    #[test]
    fn test_contains_row() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(rect.contains_row(3));
        assert!(!rect.contains_row(8));
    }

    proptest! {
        #[test]
        fn test_rect_subtract(r1: Rect, r2: Rect) {
            let result = r1.subtract(r2);
            println!("result = {result:?}");

            let mut failed = false;

            for pos in crate::a1::proptest_positions_iter() {
                let expected = (r1.contains(pos) && !r2.contains(pos)) as u8;
                let mut actual = 0;
                for r in &result {
                    actual += r.contains(pos) as u8;
                }
                if actual != expected {
                    failed = true;
                    println!("failed at {pos}");
                }
            }

            if failed {
                // println!("FAIL!");
                // println!("r1 = {r1:?}");
                // println!("r2 = {r2:?}");
                // for r in result {
                //     println!("result: {r:?}");
                // }
                panic!("uncomment the lines above for debugging")
            }
        }
    }

    #[test]
    fn test_new_rect_normalized() {
        let rect = Rect::new(1, 2, 0, 0);
        assert_eq!(rect.min, Pos { x: 0, y: 0 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });

        let rect = Rect::new(1, 0, 0, 2);
        assert_eq!(rect.min, Pos { x: 0, y: 0 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });

        let rect = Rect::new(0, 2, 1, 0);
        assert_eq!(rect.min, Pos { x: 0, y: 0 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });
    }

    #[test]
    fn test_union_in_place() {
        let mut rect = Rect::new(0, 0, 1, 1);
        rect.union_in_place(&Rect::new(1, 1, 2, 2));
        assert_eq!(rect, Rect::new(0, 0, 2, 2));
    }

    #[test]
    fn test_normalize() {
        // Already normalized rect should remain unchanged
        let rect = Rect::new(0, 0, 1, 1);
        let normalized = rect.normalize();
        assert_eq!(normalized.min, Pos { x: 0, y: 0 });
        assert_eq!(normalized.max, Pos { x: 1, y: 1 });

        // X needs swapping
        let rect = Rect {
            min: Pos { x: 5, y: 0 },
            max: Pos { x: 1, y: 1 },
        };
        let normalized = rect.normalize();
        assert_eq!(normalized.min, Pos { x: 1, y: 0 });
        assert_eq!(normalized.max, Pos { x: 5, y: 1 });

        // Y needs swapping
        let rect = Rect {
            min: Pos { x: 0, y: 5 },
            max: Pos { x: 1, y: 1 },
        };
        let normalized = rect.normalize();
        assert_eq!(normalized.min, Pos { x: 0, y: 1 });
        assert_eq!(normalized.max, Pos { x: 1, y: 5 });

        // Both X and Y need swapping
        let rect = Rect {
            min: Pos { x: 5, y: 5 },
            max: Pos { x: 1, y: 1 },
        };
        let normalized = rect.normalize();
        assert_eq!(normalized.min, Pos { x: 1, y: 1 });
        assert_eq!(normalized.max, Pos { x: 5, y: 5 });

        // Single cell (min == max) should remain unchanged
        let rect = Rect::single_pos(Pos { x: 3, y: 4 });
        let normalized = rect.normalize();
        assert_eq!(normalized.min, Pos { x: 3, y: 4 });
        assert_eq!(normalized.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_normalize_in_place() {
        // Already normalized rect should remain unchanged
        let mut rect = Rect::new(0, 0, 1, 1);
        rect.normalize_in_place();
        assert_eq!(rect.min, Pos { x: 0, y: 0 });
        assert_eq!(rect.max, Pos { x: 1, y: 1 });

        // X needs swapping
        let mut rect = Rect {
            min: Pos { x: 5, y: 0 },
            max: Pos { x: 1, y: 1 },
        };
        rect.normalize_in_place();
        assert_eq!(rect.min, Pos { x: 1, y: 0 });
        assert_eq!(rect.max, Pos { x: 5, y: 1 });

        // Y needs swapping
        let mut rect = Rect {
            min: Pos { x: 0, y: 5 },
            max: Pos { x: 1, y: 1 },
        };
        rect.normalize_in_place();
        assert_eq!(rect.min, Pos { x: 0, y: 1 });
        assert_eq!(rect.max, Pos { x: 1, y: 5 });

        // Both X and Y need swapping
        let mut rect = Rect {
            min: Pos { x: 5, y: 5 },
            max: Pos { x: 1, y: 1 },
        };
        rect.normalize_in_place();
        assert_eq!(rect.min, Pos { x: 1, y: 1 });
        assert_eq!(rect.max, Pos { x: 5, y: 5 });

        // Single cell (min == max) should remain unchanged
        let mut rect = Rect::single_pos(Pos { x: 3, y: 4 });
        rect.normalize_in_place();
        assert_eq!(rect.min, Pos { x: 3, y: 4 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });

        // Negative coordinates
        let mut rect = Rect {
            min: Pos { x: -5, y: -10 },
            max: Pos { x: -10, y: -5 },
        };
        rect.normalize_in_place();
        assert_eq!(rect.min, Pos { x: -10, y: -10 });
        assert_eq!(rect.max, Pos { x: -5, y: -5 });
    }

    #[test]
    fn test_test_a1() {
        let rect = Rect::test_a1("B2:D4");
        assert_eq!(rect.min, Pos { x: 2, y: 2 });
        assert_eq!(rect.max, Pos { x: 4, y: 4 });
    }

    #[test]
    fn test_a1_string() {
        // Basic test with small coordinates
        let rect = Rect::new(1, 1, 3, 3);
        assert_eq!(rect.a1_string(), "A1:C3");

        // Test with larger column values that require multiple letters
        let rect = Rect::new(26, 1, 52, 6); // 26 = AA, 52 = BA
        assert_eq!(rect.a1_string(), "Z1:AZ6");

        // Test with larger row numbers
        let rect = Rect::new(1, 99, 3, 102);
        assert_eq!(rect.a1_string(), "A99:C102");

        // Test single cell
        let rect = Rect::single_pos(Pos { x: 1, y: 1 });
        assert_eq!(rect.a1_string(), "A1:A1");

        // Test non-sequential coordinates (should be normalized)
        let rect = Rect::new(5, 5, 2, 3); // will be normalized to (2,3) to (5,5)
        assert_eq!(rect.a1_string(), "B3:E5");
    }

    #[test]
    fn test_cols_range() {
        let rect = Rect::test_a1("B1:D4");
        assert_eq!(rect.cols_range(1, 2), vec![2]);
        assert_eq!(rect.cols_range(1, 5), vec![2, 3, 4]);
        assert_eq!(rect.cols_range(3, 4), vec![3, 4]);
        assert_eq!(rect.cols_range(6, 10), Vec::<i64>::new());
    }

    #[test]
    fn test_rows_range() {
        let rect = Rect::test_a1("A2:D4");
        assert_eq!(rect.rows_range(1, 2), vec![2]);
        assert_eq!(rect.rows_range(1, 5), vec![2, 3, 4]);
        assert_eq!(rect.rows_range(3, 4), vec![3, 4]);
        assert_eq!(rect.rows_range(6, 10), Vec::<i64>::new());
    }
}
