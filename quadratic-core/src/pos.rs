use crate::{
    grid::SheetId,
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
};
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};
use wasm_bindgen::prelude::*;

/// Cell position {x, y}.
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[derive(
    Serialize,
    Deserialize,
    Debug,
    PartialEq,
    Eq,
    Hash,
    Ord,
    PartialOrd,
    Default,
    Copy,
    Clone,
    ts_rs::TS,
)]
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

    pub fn new(x: i64, y: i64) -> Self {
        Self { x, y }
    }

    pub fn to_sheet_pos(&self, sheet_id: SheetId) -> SheetPos {
        SheetPos {
            x: self.x,
            y: self.y,
            sheet_id,
        }
    }

    /// Returns which quadrant the cell position is in.
    pub fn quadrant(self) -> (i64, i64) {
        (
            self.x.div_euclid(CELL_SHEET_WIDTH as _),
            self.y.div_euclid(CELL_SHEET_HEIGHT as _),
        )
    }

    /// Converts from a Pos to a quadrant Pos.
    pub fn to_quadrant(&mut self) {
        self.x = self.x.div_euclid(CELL_SHEET_WIDTH as _);
        self.y = self.y.div_euclid(CELL_SHEET_HEIGHT as _);
    }

    /// Returns an A1-style reference to the cell position.
    pub fn a1_string(self) -> String {
        let col = crate::util::column_name(self.x);
        if self.y < 0 {
            format!("{col}n{}", -self.y)
        } else {
            format!("{col}{}", self.y)
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
impl From<SheetPos> for Pos {
    fn from(sheet_pos: SheetPos) -> Self {
        Pos {
            x: sheet_pos.x,
            y: sheet_pos.y,
        }
    }
}
impl fmt::Display for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
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

impl SheetPos {
    pub fn new(sheet_id: SheetId, x: i64, y: i64) -> Self {
        Self { sheet_id, x, y }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        grid::SheetId,
        renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
        Pos, SheetPos, SheetRect,
    };
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_to_sheet_pos() {
        let pos = Pos { x: 1, y: 2 };
        let sheet_id = SheetId::new();
        assert_eq!(
            pos.to_sheet_pos(sheet_id),
            SheetPos {
                x: 1,
                y: 2,
                sheet_id
            }
        );
    }

    #[test]
    #[parallel]
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
    #[parallel]
    fn test_a1_string() {
        let pos = Pos { x: 1, y: 2 };
        assert_eq!(pos.a1_string(), "B2");
        let pos = Pos { x: 0, y: 0 };
        assert_eq!(pos.a1_string(), "A0");
        let pos = Pos { x: 26, y: 0 };
        assert_eq!(pos.a1_string(), "AA0");
        let pos = Pos { x: 26, y: 1 };
        assert_eq!(pos.a1_string(), "AA1");
        let pos = Pos { x: 26, y: -1 };
        assert_eq!(pos.a1_string(), "AAn1");
    }

    #[test]
    #[parallel]
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
    #[parallel]
    fn test_sheet_rect_new_pos_span() {
        let pos1 = SheetPos {
            x: 1,
            y: 2,
            sheet_id: SheetId::new(),
        };
        let pos2 = SheetPos {
            x: 3,
            y: 4,
            sheet_id: SheetId::new(),
        };
        let rect = SheetRect::new_span(pos1, pos2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    #[parallel]
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
    #[parallel]
    fn to_quadrant() {
        let mut pos = Pos { x: 1, y: 2 };
        pos.to_quadrant();
        assert_eq!(pos, Pos { x: 0, y: 0 });

        let mut pos = Pos {
            x: CELL_SHEET_WIDTH as _,
            y: CELL_SHEET_HEIGHT as _,
        };
        pos.to_quadrant();
        assert_eq!(pos, Pos { x: 1, y: 1 });

        let mut pos = Pos {
            x: -2 * CELL_SHEET_WIDTH as i64,
            y: -2 * CELL_SHEET_HEIGHT as i64,
        };
        pos.to_quadrant();
        assert_eq!(pos, Pos { x: -2, y: -2 });
    }

    #[test]
    #[parallel]
    fn pos_new() {
        let pos = Pos::new(1, 2);
        assert_eq!(pos, Pos { x: 1, y: 2 });
    }
}
