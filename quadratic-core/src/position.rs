use std::fmt;
use std::ops::Range;

use serde::{Deserialize, Serialize};
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::{grid::SheetId, ArraySize, QUADRANT_SIZE};

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
            self.x.div_euclid(QUADRANT_SIZE as _),
            self.y.div_euclid(QUADRANT_SIZE as _),
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

/// Rectangular region of cells.
#[derive(
    Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Ord, PartialOrd,
)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), wasm_bindgen)]
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

    pub fn to_sheet_rect(&self, sheet_id: SheetId) -> SheetRect {
        SheetRect {
            min: self.min,
            max: self.max,
            sheet_id,
        }
    }

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
    pub fn contains(self, pos: Pos) -> bool {
        self.x_range().contains(&pos.x) && self.y_range().contains(&pos.y)
    }

    /// Returns whether a rectangle intersects with the rectangle.
    pub fn intersects(self, other: Rect) -> bool {
        !(other.max.x < self.min.x
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

    pub fn translate(&mut self, x: i64, y: i64) {
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
        self.width() == 0 && self.height() == 0
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

// cannot go from Rect to SheetRect; need to use Rect.to_sheet_rect(sheet_id)
#[allow(clippy::from_over_into)]
impl Into<Rect> for SheetRect {
    fn into(self) -> Rect {
        Rect {
            min: self.min,
            max: self.max,
        }
    }
}

impl SheetPos {
    pub fn new(sheet_id: SheetId, x: i64, y: i64) -> Self {
        Self { sheet_id, x, y }
    }
}

#[cfg(test)]
mod test {
    use crate::{grid::SheetId, Pos, Rect, SheetPos, SheetRect, QUADRANT_SIZE};

    #[test]
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
    fn test_quadrant_size() {
        let pos = Pos { x: 1, y: 2 };
        assert_eq!(pos.quadrant(), (0, 0));
        let quadrant_size = QUADRANT_SIZE as i64;
        let pos = Pos {
            x: quadrant_size + 1,
            y: quadrant_size + 1,
        };
        assert_eq!(pos.quadrant(), (1, 1));
    }

    #[test]
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
        let rect = Rect::from_ranges(1..4, 2..5);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_size() {
        let rect = Rect::from_ranges(1..4, 2..5);
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
        let rect = Rect::from_ranges(1..4, 2..5);
        assert!(rect.contains(Pos { x: 1, y: 2 }));
        assert!(rect.contains(Pos { x: 3, y: 4 }));
        assert!(!rect.contains(Pos { x: 0, y: 2 }));
        assert!(!rect.contains(Pos { x: 1, y: 1 }));
        assert!(!rect.contains(Pos { x: 4, y: 2 }));
        assert!(!rect.contains(Pos { x: 1, y: 5 }));
    }

    #[test]
    fn test_intersects() {
        let rect = Rect::from_ranges(1..5, 2..6);
        assert!(rect.intersects(Rect::from_ranges(1..4, 2..5)));
        assert!(rect.intersects(Rect::from_ranges(2..5, 3..6)));
        assert!(rect.intersects(Rect::from_ranges(0..2, 2..5)));
        assert!(rect.intersects(Rect::from_ranges(1..4, 0..3)));
        assert!(rect.intersects(Rect::from_ranges(4..6, 2..5)));
        assert!(rect.intersects(Rect::from_ranges(1..4, 5..7)));
        assert!(!rect.intersects(Rect::from_ranges(0..1, 2..5)));
        assert!(!rect.intersects(Rect::from_ranges(1..4, 0..1)));
        assert!(!rect.intersects(Rect::from_ranges(5..6, 2..5)));
        assert!(!rect.intersects(Rect::from_ranges(1..4, 6..7)));
    }

    #[test]
    fn test_x_range() {
        let rect = Rect::from_ranges(1..4, 2..5);
        assert_eq!(rect.x_range(), 1..4);
    }

    #[test]
    fn test_y_range() {
        let rect = Rect::from_ranges(1..4, 2..5);
        assert_eq!(rect.y_range(), 2..5);
    }

    #[test]
    fn test_width() {
        let rect = Rect::from_ranges(1..4, 2..5);
        assert_eq!(rect.width(), 3);
    }

    #[test]
    fn test_height() {
        let rect = Rect::from_ranges(1..4, 2..5);
        assert_eq!(rect.height(), 3);
    }

    #[test]
    fn test_len() {
        let rect = Rect::from_ranges(1..4, 2..5);
        assert_eq!(rect.len(), 9);
    }

    #[test]
    fn test_is_empty() {
        let rect = Rect::from_ranges(1..4, 2..5);
        assert!(!rect.is_empty());
        let rect = Rect::from_numbers(0, 1, 1, 0);
        assert!(rect.is_empty());
        let rect = Rect::from_numbers(0, 1, 0, 1);
        assert!(rect.is_empty());
    }

    #[test]
    fn test_translate() {
        let mut rect = Rect::from_ranges(1..4, 2..5);
        rect.translate(1, 2);
        assert_eq!(rect.min, Pos { x: 2, y: 4 });
        assert_eq!(rect.max, Pos { x: 4, y: 6 });
    }

    #[test]
    fn test_iter() {
        let rect = Rect::from_ranges(1..4, 2..5);
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
    fn test_sheet_rect_from_numbers() {
        let rect = SheetRect::from_numbers(1, 2, 3, 4, SheetId::new());
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
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
    fn test_sheet_rect_union() {
        let sheet_id = SheetId::new();
        let rect1 = SheetRect::from_numbers(1, 2, 3, 4, sheet_id);
        let rect2 = SheetRect::from_numbers(2, 3, 4, 5, sheet_id);
        let rect = rect1.union(&rect2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 5, y: 7 });
    }

    #[test]
    #[should_panic]
    fn test_sheet_rect_union_different_sheets() {
        let rect1 = SheetRect::from_numbers(1, 2, 3, 4, SheetId::new());
        let rect2 = SheetRect::from_numbers(2, 3, 4, 5, SheetId::new());
        let _ = rect1.union(&rect2);
    }

    #[test]
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
}
