use crate::{
    RefAdjust,
    a1::CellRefRangeEnd,
    grid::SheetId,
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
};
use anyhow::Result;
use rstar::Point;
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};
use ts_rs::TS;
use wasm_bindgen::prelude::*;

/// Cell position {x, y}.
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[derive(
    Serialize, Deserialize, PartialEq, Eq, Hash, Ord, PartialOrd, Default, Copy, Clone, TS,
)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct Pos {
    /// Column
    #[cfg_attr(test, proptest(strategy = "crate::a1::PROPTEST_COORDINATE_I64"))]
    pub x: i64,

    /// Row
    #[cfg_attr(test, proptest(strategy = "crate::a1::PROPTEST_COORDINATE_I64"))]
    pub y: i64,
    //
    // We use a small range for proptest because most tests want to see what
    // happens when values are nearby.
}

impl Pos {
    // TODO: change this to 1,1
    pub const ORIGIN: Self = Self { x: 1, y: 0 };

    pub fn new(x: i64, y: i64) -> Self {
        Self { x, y }
    }

    pub fn as_sheet_pos(&self, sheet_id: SheetId) -> SheetPos {
        SheetPos {
            x: self.x,
            y: self.y,
            sheet_id,
        }
    }

    /// Returns which quadrant the cell position is in.
    pub(crate) fn quadrant(self) -> (i64, i64) {
        (
            self.x.div_euclid(CELL_SHEET_WIDTH as _),
            self.y.div_euclid(CELL_SHEET_HEIGHT as _),
        )
    }

    /// Converts from a Pos to a quadrant Pos.
    pub(crate) fn as_quadrant(&mut self) {
        self.x = self.x.div_euclid(CELL_SHEET_WIDTH as _);
        self.y = self.y.div_euclid(CELL_SHEET_HEIGHT as _);
    }

    /// Returns an A1-style relative reference to the cell position.
    pub(crate) fn a1_string(self) -> String {
        let col = crate::a1::column_name(self.x);
        let row = self.y;
        format!("{col}{row}")
    }

    pub(crate) fn try_a1_string(a1: &str) -> Option<Self> {
        if let Ok(end) = CellRefRangeEnd::parse_end(a1, None) {
            if end.is_unbounded() {
                return None;
            }
            return Some(Pos {
                x: end.col(),
                y: end.row(),
            });
        }
        None
    }

    /// Translates the pos in place by the given delta, clamping the result to the given min.
    pub(crate) fn translate_in_place(&mut self, x: i64, y: i64, min_x: i64, min_y: i64) {
        self.x = (self.x + x).max(min_x);
        self.y = (self.y + y).max(min_y);
    }

    /// Returns a new Pos translated by the given delta, clamping the result to the given min.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub(crate) fn translate(&self, x: i64, y: i64, min_x: i64, min_y: i64) -> Self {
        let mut pos = *self;
        pos.translate_in_place(x, y, min_x, min_y);
        pos
    }

    /// Adjusts coordinates by `adjust`, clamping the result within the sheet
    /// bounds.
    ///
    /// **Note:** `adjust.sheet_id` and `adjust.relative_only` are ignored by
    /// this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub(crate) fn saturating_adjust(self, adjust: RefAdjust) -> Self {
        let x_start = adjust.x_start;
        let dx = if self.x < x_start { 0 } else { adjust.dx };

        let y_start = adjust.y_start;
        let dy = if self.y < y_start { 0 } else { adjust.dy };

        Self {
            x: self.x.saturating_add(dx).max(1),
            y: self.y.saturating_add(dy).max(1),
        }
    }
}

impl From<(i64, i64)> for Pos {
    fn from(pos: (i64, i64)) -> Self {
        Pos { x: pos.0, y: pos.1 }
    }
}
impl From<(i32, i32)> for Pos {
    fn from(pos: (i32, i32)) -> Self {
        Pos {
            x: pos.0 as i64,
            y: pos.1 as i64,
        }
    }
}
impl From<(u32, u32)> for Pos {
    fn from(pos: (u32, u32)) -> Self {
        Pos {
            x: pos.0 as i64,
            y: pos.1 as i64,
        }
    }
}
impl From<(usize, usize)> for Pos {
    fn from(pos: (usize, usize)) -> Self {
        Pos {
            x: pos.0 as i64,
            y: pos.1 as i64,
        }
    }
}
impl From<[i64; 2]> for Pos {
    fn from(pos: [i64; 2]) -> Self {
        Pos {
            x: pos[0],
            y: pos[1],
        }
    }
}
impl From<SheetPos> for Pos {
    fn from(sheet_pos: SheetPos) -> Self {
        Pos {
            x: sheet_pos.x,
            y: sheet_pos.y,
        }
    }
}
impl From<&str> for Pos {
    fn from(s: &str) -> Self {
        Self::try_a1_string(s).expect("invalid cell reference")
    }
}

impl fmt::Display for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({}, {})", self.a1_string(), self.x, self.y)
    }
}

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

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, ts_rs::TS)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct ScreenRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// Used for referencing a pos during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SheetPos {
    pub x: i64,
    pub y: i64,
    pub sheet_id: SheetId,
}

impl SheetPos {
    #[cfg(test)]
    pub(crate) fn test() -> Self {
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

impl From<(i64, i64, SheetId)> for SheetPos {
    fn from((x, y, sheet_id): (i64, i64, SheetId)) -> Self {
        Self { x, y, sheet_id }
    }
}

impl From<(Pos, SheetId)> for SheetPos {
    fn from((pos, sheet_id): (Pos, SheetId)) -> Self {
        Self {
            x: pos.x,
            y: pos.y,
            sheet_id,
        }
    }
}

impl FromStr for SheetPos {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<SheetPos>(s).map_err(|e| e.to_string())
    }
}

impl fmt::Debug for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Pos ({}, {}) {}", self.x, self.y, self.a1_string())
    }
}

impl SheetPos {
    pub(crate) fn new(sheet_id: SheetId, x: i64, y: i64) -> Self {
        Self { sheet_id, x, y }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        Pos, RefAdjust, SheetPos,
        grid::SheetId,
        renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    };

    #[test]
    fn test_to_sheet_pos() {
        let pos = Pos { x: 1, y: 2 };
        let sheet_id = SheetId::new();
        assert_eq!(
            pos.as_sheet_pos(sheet_id),
            SheetPos {
                x: 1,
                y: 2,
                sheet_id
            }
        );
    }

    #[test]
    fn test_quadrant_size() {
        assert_eq!(Pos { x: 1, y: 2 }.quadrant(), (0, 0));
        assert_eq!(Pos { x: -1, y: -2 }.quadrant(), (-1, -1));
        assert_eq!(
            Pos {
                x: CELL_SHEET_WIDTH as _,
                y: CELL_SHEET_HEIGHT as _
            }
            .quadrant(),
            (1, 1)
        );
        assert_eq!(
            Pos {
                x: -2 * CELL_SHEET_WIDTH as i64,
                y: -2 * CELL_SHEET_HEIGHT as i64
            }
            .quadrant(),
            (-2, -2)
        );
    }

    #[test]
    fn test_a1_string() {
        let pos = Pos { x: 2, y: 2 };
        assert_eq!(pos.a1_string(), "B2");
        let pos = Pos { x: 1, y: 1 };
        assert_eq!(pos.a1_string(), "A1");
        let pos = Pos { x: 26, y: 1 };
        assert_eq!(pos.a1_string(), "Z1");
        let pos = Pos { x: 27, y: 2 };
        assert_eq!(pos.a1_string(), "AA2");
        let pos = Pos { x: 52, y: 3 };
        assert_eq!(pos.a1_string(), "AZ3");
    }

    #[test]
    fn test_pos_into() {
        let pos: Pos = (1, 2).into();
        assert_eq!(pos, Pos { x: 1, y: 2 });

        let sheet_id = SheetId::new();
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let check_pos: Pos = sheet_pos.into();
        assert_eq!(check_pos, Pos { x: 1, y: 2 });

        let pos: Pos = (1, 2).into();
        assert_eq!(pos, Pos { x: 1, y: 2 });

        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let pos: Pos = sheet_pos.into();
        assert_eq!(pos, Pos { x: 1, y: 2 });
    }

    #[test]
    fn sheet_pos_from_str() {
        let sheet_id = SheetId::new();
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let sheet_pos_str = serde_json::to_string(&sheet_pos).unwrap();
        let parsed_sheet_pos: SheetPos = sheet_pos_str.parse().unwrap();
        assert_eq!(parsed_sheet_pos, sheet_pos);
    }

    #[test]
    fn as_quadrant() {
        let mut pos = Pos { x: 1, y: 2 };
        pos.as_quadrant();
        assert_eq!(pos, Pos { x: 0, y: 0 });

        let mut pos = Pos {
            x: CELL_SHEET_WIDTH as _,
            y: CELL_SHEET_HEIGHT as _,
        };
        pos.as_quadrant();
        assert_eq!(pos, Pos { x: 1, y: 1 });

        let mut pos = Pos {
            x: -2 * CELL_SHEET_WIDTH as i64,
            y: -2 * CELL_SHEET_HEIGHT as i64,
        };
        pos.as_quadrant();
        assert_eq!(pos, Pos { x: -2, y: -2 });
    }

    #[test]
    fn pos_new() {
        let pos = Pos::new(1, 2);
        assert_eq!(pos, Pos { x: 1, y: 2 });
    }

    #[test]
    fn test_try_a1_string() {
        assert_eq!(Pos::try_a1_string("A1"), Some(Pos { x: 1, y: 1 }));
        assert_eq!(Pos::try_a1_string("d5"), Some(Pos { x: 4, y: 5 }));
        assert_eq!(Pos::try_a1_string("A"), None);
        assert_eq!(Pos::try_a1_string("1"), None);
        assert_eq!(Pos::try_a1_string("A:B"), None);
    }

    #[test]
    fn test_translate_in_place() {
        // Basic positive translation
        let mut pos = Pos::new(5, 5);
        pos.translate_in_place(2, 3, 0, 0);
        assert_eq!(pos, Pos::new(7, 8));

        // Negative translation
        let mut pos = Pos::new(5, 5);
        pos.translate_in_place(-2, -3, 0, 0);
        assert_eq!(pos, Pos::new(3, 2));

        // Translation with clamping
        let mut pos = Pos::new(5, 5);
        pos.translate_in_place(-10, -10, 2, 3);
        assert_eq!(pos, Pos::new(2, 3));

        // Translation with no effect due to clamping
        let mut pos = Pos::new(2, 3);
        pos.translate_in_place(-5, -5, 2, 3);
        assert_eq!(pos, Pos::new(2, 3));
    }

    #[test]
    fn test_translate() {
        // Basic positive translation
        let pos = Pos::new(5, 5);
        let translated = pos.translate(2, 3, 0, 0);
        assert_eq!(translated, Pos::new(7, 8));
        assert_eq!(pos, Pos::new(5, 5)); // Original unchanged

        // Negative translation
        let pos = Pos::new(5, 5);
        let translated = pos.translate(-2, -3, 0, 0);
        assert_eq!(translated, Pos::new(3, 2));
        assert_eq!(pos, Pos::new(5, 5)); // Original unchanged

        // Translation with clamping
        let pos = Pos::new(5, 5);
        let translated = pos.translate(-10, -10, 2, 3);
        assert_eq!(translated, Pos::new(2, 3));
        assert_eq!(pos, Pos::new(5, 5)); // Original unchanged

        // Translation with no effect due to clamping
        let pos = Pos::new(2, 3);
        let translated = pos.translate(-5, -5, 2, 3);
        assert_eq!(translated, Pos::new(2, 3));
        assert_eq!(pos, Pos::new(2, 3)); // Original unchanged
    }

    #[test]
    fn test_adjust_column_row() {
        let sheet_id = SheetId::TEST;

        let pos = pos![B3].saturating_adjust(RefAdjust::new_insert_column(sheet_id, 2));
        assert_eq!(pos, pos![C3]);

        let pos = pos![B3].saturating_adjust(RefAdjust::new_insert_row(sheet_id, 2));
        assert_eq!(pos, pos![B4]);

        let pos = pos![B3].saturating_adjust(RefAdjust::new_insert_column(sheet_id, 3));
        assert_eq!(pos, pos![B3]);

        let pos = pos![B3].saturating_adjust(RefAdjust::new_insert_column(sheet_id, 4));
        assert_eq!(pos, pos![B3]);

        let pos = pos![B3].saturating_adjust(RefAdjust::new_delete_column(sheet_id, 1));
        assert_eq!(pos, pos![A3]);

        let pos = pos![B3].saturating_adjust(RefAdjust::new_delete_row(sheet_id, 1));
        assert_eq!(pos, pos![B2]);
    }
}
