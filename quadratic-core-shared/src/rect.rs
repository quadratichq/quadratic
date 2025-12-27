//! Rectangle types for cell regions.

use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fmt, ops::RangeInclusive, str::FromStr};

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "rstar")]
use rstar::{RTreeObject, AABB};

#[cfg(feature = "smallvec")]
use smallvec::{smallvec, SmallVec};

use crate::{Pos, SheetId, SheetPos};

/// Rectangular region of cells.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Ord, PartialOrd)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct Rect {
    /// Upper-left corner
    pub min: Pos,
    /// Lower-right corner
    pub max: Pos,
}

impl Rect {
    /// Creates a rect from two x, y positions. Normalizes the rectangle.
    pub fn new(x0: i64, y0: i64, x1: i64, y1: i64) -> Self {
        Self {
            min: Pos::new(x0.min(x1), y0.min(y1)),
            max: Pos::new(x0.max(x1), y0.max(y1)),
        }
    }

    /// Constructs a rectangle spanning two positions
    pub fn new_span(pos1: Pos, pos2: Pos) -> Self {
        Self {
            min: pos1.min(pos2),
            max: pos1.max(pos2),
        }
    }

    /// Constructs a new rectangle containing only a single cell.
    pub fn single_pos(pos: Pos) -> Self {
        Self { min: pos, max: pos }
    }

    /// Creates a rectangle from position and width/height
    pub fn from_numbers(x: i64, y: i64, w: i64, h: i64) -> Self {
        Self {
            min: Pos { x, y },
            max: Pos {
                x: x + w - 1,
                y: y + h - 1,
            },
        }
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

    /// Returns the width of the rectangle
    #[inline]
    pub fn width(&self) -> u32 {
        (self.max.x - self.min.x + 1) as u32
    }

    /// Returns the height of the rectangle
    #[inline]
    pub fn height(&self) -> u32 {
        (self.max.y - self.min.y + 1) as u32
    }

    /// Returns whether the rectangle is empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.width() == 0 || self.height() == 0
    }

    /// Returns whether a position is contained within the rectangle
    #[inline]
    pub fn contains(&self, pos: Pos) -> bool {
        pos.x >= self.min.x && pos.x <= self.max.x && pos.y >= self.min.y && pos.y <= self.max.y
    }

    /// Returns whether another rectangle is fully contained within this one
    #[inline]
    pub fn contains_rect(&self, other: &Rect) -> bool {
        self.contains(other.min) && self.contains(other.max)
    }

    /// Returns whether this rectangle intersects with another
    #[inline]
    pub fn intersects(&self, other: Rect) -> bool {
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

    /// Returns the intersection of two rectangles, if any
    pub fn intersection(&self, other: &Rect) -> Option<Rect> {
        let min_x = self.min.x.max(other.min.x);
        let min_y = self.min.y.max(other.min.y);
        let max_x = self.max.x.min(other.max.x);
        let max_y = self.max.y.min(other.max.y);

        if min_x <= max_x && min_y <= max_y {
            Some(Rect {
                min: Pos::new(min_x, min_y),
                max: Pos::new(max_x, max_y),
            })
        } else {
            None
        }
    }

    /// Returns the union of two rectangles
    pub fn union(&self, other: &Self) -> Self {
        Rect {
            min: self.min.min(other.min),
            max: self.max.max(other.max),
        }
    }

    /// Extends the rectangle to include a position
    pub fn extend_to(&mut self, pos: Pos) {
        self.min = self.min.min(pos);
        self.max = self.max.max(pos);
    }

    /// Translate the rectangle by a delta
    pub fn translate(&self, x: i64, y: i64) -> Self {
        let mut rect = *self;
        rect.translate_in_place(x, y);
        rect
    }

    /// Translate the rectangle by a delta in place
    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.min.x += x;
        self.min.y += y;
        self.max.x += x;
        self.max.y += y;
    }

    /// Iterate over all positions in the rectangle
    pub fn iter(&self) -> impl Iterator<Item = Pos> + '_ {
        (self.min.y..=self.max.y)
            .flat_map(move |y| (self.min.x..=self.max.x).map(move |x| Pos::new(x, y)))
    }

    /// Count of cells in the rectangle
    pub fn count(&self) -> usize {
        self.width() as usize * self.height() as usize
    }

    /// Convert to a SheetRect with the given sheet ID
    pub fn to_sheet_rect(&self, sheet_id: SheetId) -> SheetRect {
        SheetRect {
            min: self.min,
            max: self.max,
            sheet_id,
        }
    }

    /// Returns the number of cells in the rectangle
    pub fn len(&self) -> u32 {
        self.width() * self.height()
    }

    /// Merge this rectangle with another in place
    pub fn union_in_place(&mut self, other: &Self) {
        self.min.x = self.min.x.min(other.min.x);
        self.min.y = self.min.y.min(other.min.y);
        self.max.x = self.max.x.max(other.max.x);
        self.max.y = self.max.y.max(other.max.y);
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

    /// Subtracts `other` from `self`. This will result in 0 to 4 rectangles.
    #[cfg(feature = "smallvec")]
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
}

impl From<Pos> for Rect {
    fn from(pos: Pos) -> Self {
        Rect::single_pos(pos)
    }
}

impl From<SheetRect> for Rect {
    fn from(sr: SheetRect) -> Self {
        sr.to_rect()
    }
}

#[cfg(feature = "rstar")]
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

/// Rectangular region with an associated sheet ID.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct SheetRect {
    pub min: Pos,
    pub max: Pos,
    pub sheet_id: SheetId,
}

impl SheetRect {
    /// Create a new SheetRect
    pub fn new(x0: i64, y0: i64, x1: i64, y1: i64, sheet_id: SheetId) -> Self {
        Self {
            min: Pos { x: x0, y: y0 },
            max: Pos { x: x1, y: y1 },
            sheet_id,
        }
    }

    /// Create from a Rect and SheetId
    pub fn new_from_rect(rect: Rect, sheet_id: SheetId) -> Self {
        Self {
            min: rect.min,
            max: rect.max,
            sheet_id,
        }
    }

    /// Constructs a new SheetRect from two positions and a sheet id.
    pub fn new_pos_span(pos1: Pos, pos2: Pos, sheet_id: SheetId) -> Self {
        use std::cmp::{max, min};
        Self {
            min: Pos {
                x: min(pos1.x, pos2.x),
                y: min(pos1.y, pos2.y),
            },
            max: Pos {
                x: max(pos1.x, pos2.x),
                y: max(pos1.y, pos2.y),
            },
            sheet_id,
        }
    }

    /// Create from two sheet positions (uses first position's sheet_id)
    pub fn new_span(pos1: SheetPos, pos2: SheetPos) -> Self {
        Self::new_pos_span(pos1.into(), pos2.into(), pos1.sheet_id)
    }

    pub fn single_sheet_pos(sheet_pos: SheetPos) -> SheetRect {
        SheetRect {
            min: sheet_pos.into(),
            max: sheet_pos.into(),
            sheet_id: sheet_pos.sheet_id,
        }
    }

    pub fn single_pos(pos: Pos, sheet_id: SheetId) -> SheetRect {
        SheetRect {
            min: pos,
            max: pos,
            sheet_id,
        }
    }

    pub fn from_numbers(x: i64, y: i64, w: i64, h: i64, sheet_id: SheetId) -> SheetRect {
        SheetRect {
            min: Pos { x, y },
            max: Pos {
                x: x + w - 1,
                y: y + h - 1,
            },
            sheet_id,
        }
    }

    /// Convert to a Rect (dropping the sheet_id)
    pub fn to_rect(&self) -> Rect {
        Rect {
            min: self.min,
            max: self.max,
        }
    }

    /// Returns whether a position is contained within the rectangle.
    pub fn contains(self, sheet_pos: SheetPos) -> bool {
        self.sheet_id == sheet_pos.sheet_id
            && sheet_pos.x >= self.min.x
            && sheet_pos.x <= self.max.x
            && sheet_pos.y >= self.min.y
            && sheet_pos.y <= self.max.y
    }

    /// Returns whether a rectangle intersects with the rectangle.
    pub fn intersects(self, other: SheetRect) -> bool {
        self.sheet_id == other.sheet_id
            && !(other.max.x < self.min.x
                || other.min.x > self.max.x
                || other.max.y < self.min.y
                || other.min.y > self.max.y)
    }

    pub fn width(&self) -> usize {
        (self.max.x - self.min.x + 1) as usize
    }

    pub fn height(&self) -> usize {
        (self.max.y - self.min.y + 1) as usize
    }

    pub fn len(&self) -> usize {
        self.width() * self.height()
    }

    pub fn is_empty(&self) -> bool {
        self.width() == 0 || self.height() == 0
    }

    pub fn iter(self) -> impl Iterator<Item = SheetPos> {
        let SheetRect { min, max, .. } = self;
        (min.y..=max.y).flat_map(move |y| {
            (min.x..=max.x).map(move |x| SheetPos {
                x,
                y,
                sheet_id: self.sheet_id,
            })
        })
    }

    pub fn union(&self, other: &Self) -> Self {
        assert!(
            self.sheet_id == other.sheet_id,
            "Cannot union different sheets"
        );
        let min_x = std::cmp::min(self.min.x, other.min.x);
        let min_y = std::cmp::min(self.min.y, other.min.y);
        let max_x = std::cmp::max(self.max.x, other.max.x);
        let max_y = std::cmp::max(self.max.y, other.max.y);
        SheetRect {
            min: Pos { x: min_x, y: min_y },
            max: Pos { x: max_x, y: max_y },
            sheet_id: self.sheet_id,
        }
    }

    pub fn top_left(&self) -> SheetPos {
        SheetPos {
            x: self.min.x,
            y: self.min.y,
            sheet_id: self.sheet_id,
        }
    }

    /// Returns the position of the cell at the given offset (0-indexed) within
    /// the rectangle, or `None` if the coordinates are outside the rectangle.
    pub fn index_cell(&self, x: u32, y: u32) -> Option<SheetPos> {
        if (x as usize) < self.width() && (y as usize) < self.height() {
            Some(SheetPos {
                x: self.min.x + x as i64,
                y: self.min.y + y as i64,
                sheet_id: self.sheet_id,
            })
        } else {
            None
        }
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

    pub fn to_region(&self) -> (SheetId, Rect) {
        (self.sheet_id.to_owned(), self.to_rect())
    }
}

impl fmt::Display for SheetRect {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Sheet: {}, Min: {}, Max: {}",
            self.sheet_id, self.min, self.max,
        )
    }
}

impl From<SheetPos> for SheetRect {
    fn from(sheet_pos: SheetPos) -> Self {
        SheetRect {
            min: sheet_pos.into(),
            max: sheet_pos.into(),
            sheet_id: sheet_pos.sheet_id,
        }
    }
}

impl From<SheetRect> for Pos {
    fn from(sheet_rect: SheetRect) -> Self {
        sheet_rect.min
    }
}

impl From<SheetRect> for SheetPos {
    fn from(sheet_rect: SheetRect) -> Self {
        SheetPos {
            x: sheet_rect.min.x,
            y: sheet_rect.min.y,
            sheet_id: sheet_rect.sheet_id,
        }
    }
}

impl From<(i64, i64, i64, i64, SheetId)> for SheetRect {
    fn from((x, y, w, h, sheet_id): (i64, i64, i64, i64, SheetId)) -> Self {
        SheetRect {
            min: Pos { x, y },
            max: Pos {
                x: x + w - 1,
                y: y + h - 1,
            },
            sheet_id,
        }
    }
}

#[cfg(feature = "json")]
impl FromStr for SheetRect {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<SheetRect>(s).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rect_new() {
        let rect = Rect::new(1, 2, 3, 4);
        assert_eq!(rect.min, Pos::new(1, 2));
        assert_eq!(rect.max, Pos::new(3, 4));

        // Test normalization
        let rect = Rect::new(3, 4, 1, 2);
        assert_eq!(rect.min, Pos::new(1, 2));
        assert_eq!(rect.max, Pos::new(3, 4));
    }

    #[test]
    fn test_rect_dimensions() {
        let rect = Rect::new(1, 1, 3, 4);
        assert_eq!(rect.width(), 3);
        assert_eq!(rect.height(), 4);
        assert_eq!(rect.count(), 12);
    }

    #[test]
    fn test_rect_contains() {
        let rect = Rect::new(1, 1, 3, 3);
        assert!(rect.contains(Pos::new(2, 2)));
        assert!(rect.contains(Pos::new(1, 1)));
        assert!(rect.contains(Pos::new(3, 3)));
        assert!(!rect.contains(Pos::new(0, 2)));
        assert!(!rect.contains(Pos::new(4, 2)));
    }

    #[test]
    fn test_rect_intersects() {
        let rect1 = Rect::new(1, 1, 3, 3);
        let rect2 = Rect::new(2, 2, 4, 4);
        let rect3 = Rect::new(5, 5, 6, 6);

        assert!(rect1.intersects(rect2));
        assert!(!rect1.intersects(rect3));
    }

    #[test]
    fn test_rect_intersection() {
        let rect1 = Rect::new(1, 1, 3, 3);
        let rect2 = Rect::new(2, 2, 4, 4);

        let intersection = rect1.intersection(&rect2).unwrap();
        assert_eq!(intersection, Rect::new(2, 2, 3, 3));
    }

    #[test]
    fn test_rect_union() {
        let rect1 = Rect::new(1, 1, 2, 2);
        let rect2 = Rect::new(3, 3, 4, 4);

        let union = rect1.union(&rect2);
        assert_eq!(union, Rect::new(1, 1, 4, 4));
    }

    #[test]
    fn test_rect_iter() {
        let rect = Rect::new(1, 1, 2, 2);
        let positions: Vec<Pos> = rect.iter().collect();
        assert_eq!(
            positions,
            vec![
                Pos::new(1, 1),
                Pos::new(2, 1),
                Pos::new(1, 2),
                Pos::new(2, 2),
            ]
        );
    }
}
