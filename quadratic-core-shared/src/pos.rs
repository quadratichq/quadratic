//! Position types for cell coordinates.

use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "rstar")]
use rstar::Point;

use crate::{
    constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    SheetId,
};

/// Cell position {x, y}.
#[derive(Serialize, Deserialize, Default, Copy, Clone, PartialEq, Eq, Hash, Ord, PartialOrd)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct Pos {
    /// Column
    pub x: i64,
    /// Row
    pub y: i64,
}

impl Pos {
    /// Origin position (1, 1)
    pub const ORIGIN: Self = Self { x: 1, y: 1 };

    /// Create a new position
    #[inline]
    pub const fn new(x: i64, y: i64) -> Self {
        Self { x, y }
    }

    /// Convert to a SheetPos with the given sheet ID
    #[inline]
    pub const fn to_sheet_pos(self, sheet_id: SheetId) -> SheetPos {
        SheetPos {
            x: self.x,
            y: self.y,
            sheet_id,
        }
    }

    /// Returns which quadrant (hash bucket) the cell position is in.
    #[inline]
    pub fn quadrant(self) -> (i64, i64) {
        (
            self.x.div_euclid(CELL_SHEET_WIDTH as i64),
            self.y.div_euclid(CELL_SHEET_HEIGHT as i64),
        )
    }

    /// Converts from a Pos to a quadrant Pos in place.
    #[inline]
    pub fn to_quadrant(&mut self) {
        self.x = self.x.div_euclid(CELL_SHEET_WIDTH as i64);
        self.y = self.y.div_euclid(CELL_SHEET_HEIGHT as i64);
    }

    /// Returns a new Pos with the minimum x and y values.
    #[inline]
    pub fn min(self, other: Self) -> Self {
        Pos {
            x: self.x.min(other.x),
            y: self.y.min(other.y),
        }
    }

    /// Returns a new Pos with the maximum x and y values.
    #[inline]
    pub fn max(self, other: Self) -> Self {
        Pos {
            x: self.x.max(other.x),
            y: self.y.max(other.y),
        }
    }
}

impl fmt::Debug for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Pos ({}, {})", self.x, self.y)
    }
}

impl fmt::Display for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

impl From<(i64, i64)> for Pos {
    #[inline]
    fn from((x, y): (i64, i64)) -> Self {
        Pos { x, y }
    }
}

impl From<(i32, i32)> for Pos {
    #[inline]
    fn from((x, y): (i32, i32)) -> Self {
        Pos {
            x: x as i64,
            y: y as i64,
        }
    }
}

impl From<(u32, u32)> for Pos {
    #[inline]
    fn from((x, y): (u32, u32)) -> Self {
        Pos {
            x: x as i64,
            y: y as i64,
        }
    }
}

impl From<(usize, usize)> for Pos {
    #[inline]
    fn from((x, y): (usize, usize)) -> Self {
        Pos {
            x: x as i64,
            y: y as i64,
        }
    }
}

impl From<[i64; 2]> for Pos {
    #[inline]
    fn from([x, y]: [i64; 2]) -> Self {
        Pos { x, y }
    }
}

#[cfg(feature = "rstar")]
impl Point for Pos {
    type Scalar = i64;

    const DIMENSIONS: usize = 2;

    fn generate(mut generator: impl FnMut(usize) -> Self::Scalar) -> Self {
        Pos::new(generator(0), generator(1))
    }

    fn nth(&self, index: usize) -> Self::Scalar {
        [self.x, self.y][index]
    }

    fn nth_mut(&mut self, index: usize) -> &mut Self::Scalar {
        [&mut self.x, &mut self.y][index]
    }
}

/// Position with an associated sheet ID.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetPos {
    pub x: i64,
    pub y: i64,
    pub sheet_id: SheetId,
}

impl SheetPos {
    /// Create a new SheetPos
    #[inline]
    pub const fn new(sheet_id: SheetId, x: i64, y: i64) -> Self {
        Self { sheet_id, x, y }
    }

    /// Replace the pos with a new pos
    pub fn replace_pos(&mut self, pos: Pos) {
        self.x = pos.x;
        self.y = pos.y;
    }

    #[cfg(test)]
    pub fn test() -> Self {
        Self {
            x: 1,
            y: 1,
            sheet_id: SheetId::TEST,
        }
    }
}

impl fmt::Display for SheetPos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({}, {})", self.sheet_id, self.x, self.y)
    }
}

impl From<SheetPos> for Pos {
    #[inline]
    fn from(sp: SheetPos) -> Self {
        Pos { x: sp.x, y: sp.y }
    }
}

impl From<(i64, i64, SheetId)> for SheetPos {
    #[inline]
    fn from((x, y, sheet_id): (i64, i64, SheetId)) -> Self {
        Self { x, y, sheet_id }
    }
}

impl From<(Pos, SheetId)> for SheetPos {
    #[inline]
    fn from((pos, sheet_id): (Pos, SheetId)) -> Self {
        Self {
            x: pos.x,
            y: pos.y,
            sheet_id,
        }
    }
}

#[cfg(feature = "json")]
impl FromStr for SheetPos {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<SheetPos>(s).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pos_new() {
        let pos = Pos::new(1, 2);
        assert_eq!(pos.x, 1);
        assert_eq!(pos.y, 2);
    }

    #[test]
    fn test_pos_quadrant() {
        assert_eq!(Pos::new(0, 0).quadrant(), (0, 0));
        assert_eq!(Pos::new(14, 29).quadrant(), (0, 0));
        assert_eq!(Pos::new(15, 30).quadrant(), (1, 1));
        assert_eq!(Pos::new(-1, -1).quadrant(), (-1, -1));
    }

    #[test]
    fn test_pos_min_max() {
        let a = Pos::new(1, 5);
        let b = Pos::new(3, 2);
        assert_eq!(a.min(b), Pos::new(1, 2));
        assert_eq!(a.max(b), Pos::new(3, 5));
    }

    #[test]
    fn test_pos_from_tuple() {
        let pos: Pos = (1i64, 2i64).into();
        assert_eq!(pos, Pos::new(1, 2));
    }

    #[test]
    fn test_sheet_pos() {
        let sheet_id = SheetId::test();
        let sp = SheetPos::new(sheet_id, 1, 2);
        assert_eq!(sp.x, 1);
        assert_eq!(sp.y, 2);
        assert_eq!(sp.sheet_id, sheet_id);

        let pos: Pos = sp.into();
        assert_eq!(pos, Pos::new(1, 2));
    }
}
