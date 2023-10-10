use std::fmt;
use std::ops::Range;

use serde::{Deserialize, Serialize};
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::{grid::SheetId, ArraySize};

/// Cell position {x, y}.
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[derive(
    Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Ord, PartialOrd,
)]
#[cfg_attr(feature = "js", wasm_bindgen)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Pos {
    /// Column
    #[cfg_attr(test, proptest(strategy = "-4..=4_i64"))]
    pub x: i64,

    /// Row
    #[cfg_attr(test, proptest(strategy = "-4..=4_i64"))]
    pub y: i64,
    //
    // We use a small range for proptest because most tests want to see what
    // happens when values are nearby.
}
impl Pos {
    pub const ORIGIN: Self = Self { x: 0, y: 0 };

    /// Returns which quadrant the cell position is in.
    pub fn quadrant(self) -> (i64, i64) {
        (
            self.x.div_euclid(crate::QUADRANT_SIZE as _),
            self.y.div_euclid(crate::QUADRANT_SIZE as _),
        )
    }

    /// Returns an A1-style reference to the cell position.
    pub fn a1_string(self) -> String {
        let col = crate::util::column_name(self.x);
        if self.y < 0 {
            format!("{col}n{}", -self.y)
        } else {
            format!("{col}{}", self.y.to_string())
        }
    }

    /// Adds information about which sheet the position is in.
    pub fn with_sheet(self, sheet_id: SheetId) -> SheetPos {
        let Pos { x, y } = self;
        SheetPos { x, y, sheet_id }
    }
}
impl From<(i64, i64)> for Pos {
    fn from(pos: (i64, i64)) -> Self {
        Pos { x: pos.0, y: pos.1 }
    }
}
impl From<SheetPos> for Pos {
    fn from(pos: SheetPos) -> Self {
        Pos { x: pos.x, y: pos.y }
    }
}
impl fmt::Display for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

/// Rectangular region of cells.
#[derive(
    Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Ord, PartialOrd,
)]
#[cfg_attr(feature = "js", wasm_bindgen, derive(ts_rs::TS))]
pub struct Rect {
    /// Upper-left corner.
    pub min: Pos,
    /// Lower-right corner.
    pub max: Pos,
}
impl Rect {
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
    pub fn from_ranges(xs: Range<i64>, ys: Range<i64>) -> Rect {
        Rect {
            min: Pos {
                x: xs.start,
                y: ys.start,
            },
            max: Pos {
                x: xs.end - 1,
                y: ys.end - 1,
            },
        }
    }

    pub fn size(self) -> ArraySize {
        ArraySize::new(self.width(), self.height()).expect("empty rectangle has no size")
    }

    /// Returns whether a position is contained within the rectangle.
    pub fn contains(self, pos: Pos) -> bool {
        self.x_range().contains(&pos.x) && self.y_range().contains(&pos.y)
    }

    /// Returns the range of X values in the rectangle.
    pub fn x_range(self) -> Range<i64> {
        self.min.x..self.max.x + 1
    }
    /// Returns the range of Y values in the rectangle.
    pub fn y_range(self) -> Range<i64> {
        self.min.y..self.max.y + 1
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
        self.width() == 0 && self.height() == 0
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct ScreenRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// Used for referencing a pos during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct SheetPos {
    pub x: i64,
    pub y: i64,
    pub sheet_id: SheetId,
}
impl fmt::Display for SheetPos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({}, {})", self.sheet_id, self.x, self.y)
    }
}
impl SheetPos {
    pub fn without_sheet(self) -> Pos {
        let SheetPos { x, y, .. } = self;
        Pos { x, y }
    }
}

/// Used for referencing a range during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct SheetRect {
    /// Upper-left corner.
    pub min: Pos,
    /// Lower-right corner.
    pub max: Pos,
    /// The sheet that this region is on.
    pub sheet_id: SheetId,
}
impl SheetRect {
    /// Constructs a new rectangle containing only a single cell.
    pub fn single_pos(pos: SheetPos) -> SheetRect {
        SheetRect {
            sheet_id: pos.sheet_id,
            min: Pos { x: pos.x, y: pos.y },
            max: Pos { x: pos.x, y: pos.y },
        }
    }
    /// Returns whether a position is contained within the rectangle.
    pub fn contains(self, pos: SheetPos) -> bool {
        self.sheet_id == pos.sheet_id
            && self.x_range().contains(&pos.x)
            && self.y_range().contains(&pos.y)
    }
    /// Returns whether a rectangle intersects with the rectangle.
    pub fn intersects(self, other: SheetRect) -> bool {
        // https://en.wikipedia.org/wiki/Hyperplane_separation_theorem#:~:text=the%20following%20form%3A-,Separating%20axis%20theorem,-%E2%80%94%C2%A0Two%20closed
        self.sheet_id == other.sheet_id
            && !(other.max.x < self.min.x
                || other.min.x > self.max.x
                || other.max.y < self.min.y
                || other.min.y > self.max.y)
    }
    /// Returns the range of X values in the rectangle.
    pub fn x_range(self) -> Range<i64> {
        self.min.x..self.max.x + 1
    }
    /// Returns the range of Y values in the rectangle.
    pub fn y_range(self) -> Range<i64> {
        self.min.y..self.max.y + 1
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
