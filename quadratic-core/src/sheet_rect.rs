use std::collections::HashSet;
use std::ops::Range;
use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::Rect;
use crate::a1::UNBOUNDED;
use crate::{ArraySize, Pos, SheetPos, grid::SheetId};

/// Used for referencing a range during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
pub struct SheetRect {
    /// Upper-left corner.
    pub min: Pos,
    /// Lower-right corner.
    pub max: Pos,
    /// The sheet that this region is on.
    pub sheet_id: SheetId,
}

impl SheetRect {
    pub(crate) fn new(x0: i64, y0: i64, x1: i64, y1: i64, sheet_id: SheetId) -> Self {
        SheetRect {
            min: Pos { x: x0, y: y0 },
            max: Pos { x: x1, y: y1 },
            sheet_id,
        }
    }

    #[cfg(test)]
    pub(crate) fn single_sheet_pos(sheet_pos: SheetPos) -> SheetRect {
        SheetRect {
            min: sheet_pos.into(),
            max: sheet_pos.into(),
            sheet_id: sheet_pos.sheet_id,
        }
    }

    pub(crate) fn single_pos(pos: Pos, sheet_id: SheetId) -> SheetRect {
        SheetRect {
            min: pos,
            max: pos,
            sheet_id,
        }
    }

    /// Constructs a new SheetRect from two positions and a sheet id.
    pub(crate) fn new_pos_span(pos1: Pos, pos2: Pos, sheet_id: SheetId) -> SheetRect {
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

    pub(crate) fn from_numbers(x: i64, y: i64, w: i64, h: i64, sheet_id: SheetId) -> SheetRect {
        SheetRect {
            min: Pos { x, y },
            max: Pos {
                x: x + w - 1,
                y: y + h - 1,
            },
            sheet_id,
        }
    }

    /// Returns whether a position is contained within the rectangle.
    pub(crate) fn contains(self, sheet_pos: SheetPos) -> bool {
        self.sheet_id == sheet_pos.sheet_id
            && self.x_range().contains(&sheet_pos.x)
            && self.y_range().contains(&sheet_pos.y)
    }
    /// Returns the range of X values in the rectangle.
    pub(crate) fn x_range(self) -> Range<i64> {
        self.min.x..i64::checked_add(self.max.x, 1).unwrap_or(UNBOUNDED)
    }
    /// Returns the range of Y values in the rectangle.
    pub(crate) fn y_range(self) -> Range<i64> {
        self.min.y..i64::checked_add(self.max.y, 1).unwrap_or(UNBOUNDED)
    }
    pub(crate) fn width(&self) -> usize {
        (self.max.x - self.min.x + 1) as usize
    }
    pub(crate) fn height(&self) -> usize {
        (self.max.y - self.min.y + 1) as usize
    }
    pub(crate) fn size(&self) -> ArraySize {
        ArraySize::new(self.width() as u32, self.height() as u32)
            .expect("empty rectangle has no size")
    }
    pub(crate) fn from_sheet_pos_and_size(top_left: SheetPos, size: ArraySize) -> Self {
        SheetRect {
            min: top_left.into(),
            max: Pos {
                x: top_left.x + size.w.get() as i64 - 1,
                y: top_left.y + size.h.get() as i64 - 1,
            },
            sheet_id: top_left.sheet_id,
        }
    }
    pub(crate) fn union(&self, other: &Self) -> Self {
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

    /// Returns the position of the cell at the given offset (0-indexed) within
    /// the rectangle, or `None` if the coordinates are outside the rectangle.
    pub(crate) fn index_cell(&self, x: u32, y: u32) -> Option<SheetPos> {
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

    pub(crate) fn as_hashes(&self) -> HashSet<Pos> {
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

    pub(crate) fn as_rect(&self) -> Rect {
        Rect::new_span(self.min, self.max)
    }

    pub(crate) fn as_region(&self) -> (SheetId, Rect) {
        (self.sheet_id.to_owned(), self.as_rect())
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

#[cfg(test)]
mod test {

    use super::*;

    #[test]
    fn test_sheet_rect_from_numbers() {
        let rect = SheetRect::from_numbers(1, 2, 3, 4, SheetId::new());
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
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
    fn from_sheet_rect_to_pos() {
        let sheet_id = SheetId::new();
        let rect = SheetRect::from_numbers(1, 2, 3, 4, sheet_id);
        let pos: Pos = rect.into();
        assert_eq!(pos, Pos { x: 1, y: 2 });
    }

    #[test]
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
}
