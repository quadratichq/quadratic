use crate::{
    controller::transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    grid::SheetId,
    ArraySize,
};
use serde::{Deserialize, Serialize};
use std::ops::Range;
use std::{fmt, str::FromStr};

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

impl FromStr for SheetPos {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<SheetPos>(s).map_err(|e| e.to_string())
    }
}

/// Used for referencing a range during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct SheetRect {
    /// Upper-left corner.
    pub min: Pos,
    /// Lower-right corner.
    pub max: Pos,
    /// The sheet that this region is on.
    pub sheet_id: SheetId,
}

impl SheetRect {
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

    /// Constructs a new SheetRect from two positions and a sheet id.
    pub fn new_pos_span(pos1: Pos, pos2: Pos, sheet_id: SheetId) -> SheetRect {
        use std::cmp::{max, min};
        SheetRect {
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

    pub fn new_span(pos1: SheetPos, pos2: SheetPos) -> SheetRect {
        SheetRect::new_pos_span(pos1.into(), pos2.into(), pos1.sheet_id)
    }
    /// Returns whether a position is contained within the rectangle.
    pub fn contains(self, sheet_pos: SheetPos) -> bool {
        self.sheet_id == sheet_pos.sheet_id
            && self.x_range().contains(&sheet_pos.x)
            && self.y_range().contains(&sheet_pos.y)
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
    pub fn size(&self) -> ArraySize {
        ArraySize::new(self.width() as u32, self.height() as u32)
            .expect("empty rectangle has no size")
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
    pub fn from_sheet_pos_and_size(top_left: SheetPos, size: ArraySize) -> Self {
        SheetRect {
            min: top_left.into(),
            max: Pos {
                x: top_left.x + size.w.get() as i64 - 1,
                y: top_left.y + size.h.get() as i64 - 1,
            },
            sheet_id: top_left.sheet_id,
        }
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

impl FromStr for SheetRect {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<SheetRect>(s).map_err(|e| e.to_string())
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
        controller::transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
        grid::SheetId,
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
    fn test_sheet_rect_from_numbers() {
        let rect = SheetRect::from_numbers(1, 2, 3, 4, SheetId::new());
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
    }

    #[test]
    #[parallel]
    fn test_sheet_rect_union() {
        let sheet_id = SheetId::new();
        let rect1 = SheetRect::from_numbers(1, 2, 3, 4, sheet_id);
        let rect2 = SheetRect::from_numbers(2, 3, 4, 5, sheet_id);
        let rect = rect1.union(&rect2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 5, y: 7 });
    }

    #[test]
    #[parallel]
    #[should_panic]
    fn test_sheet_rect_union_different_sheets() {
        let rect1 = SheetRect::from_numbers(1, 2, 3, 4, SheetId::new());
        let rect2 = SheetRect::from_numbers(2, 3, 4, 5, SheetId::new());
        let _ = rect1.union(&rect2);
    }

    #[test]
    #[parallel]
    fn test_top_left() {
        let sheet_id = SheetId::new();
        let rect = SheetRect::from_numbers(1, 2, 3, 4, sheet_id);
        assert_eq!(
            rect.top_left(),
            SheetPos {
                x: 1,
                y: 2,
                sheet_id
            }
        );
    }

    #[test]
    #[parallel]
    fn from_sheet_rect_to_pos() {
        let sheet_id = SheetId::new();
        let rect = SheetRect::from_numbers(1, 2, 3, 4, sheet_id);
        let pos: Pos = rect.into();
        assert_eq!(pos, Pos { x: 1, y: 2 });
    }

    #[test]
    #[parallel]
    fn from_sheet_rect_to_sheet_pos() {
        let sheet_id = SheetId::new();
        let rect = SheetRect::from_numbers(1, 2, 3, 4, sheet_id);
        let sheet_pos: SheetPos = rect.into();
        assert_eq!(
            sheet_pos,
            SheetPos {
                x: 1,
                y: 2,
                sheet_id
            }
        );
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
}
