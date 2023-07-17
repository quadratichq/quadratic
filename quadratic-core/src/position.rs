use serde::{Deserialize, Serialize};
use std::fmt;
use std::ops::RangeInclusive;
use wasm_bindgen::prelude::*;

/// Cell position {x, y}.
#[derive(
    Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Ord, PartialOrd,
)]
#[wasm_bindgen]
pub struct Pos {
    /// Column
    pub x: i64,
    /// Row
    pub y: i64,
}
#[wasm_bindgen]
impl Pos {
    #[wasm_bindgen(constructor)]
    pub fn new(x: i64, y: i64) -> Self {
        Self { x, y }
    }
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
        crate::util::column_name(self.x) + &self.y.to_string()
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
#[wasm_bindgen]
pub struct Rect {
    /// Upper-left corner.
    pub min: Pos,
    /// Lower-right corner.
    pub max: Pos,
}
#[wasm_bindgen]
impl Rect {
    /// Constructs a rectangle spanning two positions
    #[wasm_bindgen(constructor)]
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
    #[wasm_bindgen]
    pub fn single_pos(pos: Pos) -> Rect {
        Rect { min: pos, max: pos }
    }
    /// Extends the rectangle enough to include a cell.
    #[wasm_bindgen]
    pub fn extend_to(&mut self, pos: Pos) {
        self.min.x = std::cmp::min(self.min.x, pos.x);
        self.min.y = std::cmp::min(self.min.y, pos.y);
        self.max.x = std::cmp::max(self.max.x, pos.x);
        self.max.y = std::cmp::max(self.max.y, pos.y);
    }
}
impl Rect {
    /// Returns the inclusive range of X values in the rectangle.
    pub fn x_range(self) -> RangeInclusive<i64> {
        self.min.x..=self.max.x
    }
    /// Returns the inclusive range of Y values in the rectangle.
    pub fn y_range(self) -> RangeInclusive<i64> {
        self.min.y..=self.max.y
    }
}
