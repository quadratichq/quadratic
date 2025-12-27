// Re-export the base type from quadratic-core-shared
pub use quadratic_core_shared::SheetRect;

use std::ops::Range;

use crate::a1::UNBOUNDED;
use crate::{ArraySize, Pos, SheetPos, grid::SheetId};

// Core-specific extension for SheetRect
pub trait SheetRectCoreExt {
    fn x_range(self) -> Range<i64>;
    fn y_range(self) -> Range<i64>;
    fn size(&self) -> ArraySize;
    fn from_sheet_pos_and_size(top_left: SheetPos, size: ArraySize) -> SheetRect;
}

impl SheetRectCoreExt for SheetRect {
    /// Returns the range of X values in the rectangle.
    fn x_range(self) -> Range<i64> {
        self.min.x..i64::checked_add(self.max.x, 1).unwrap_or(UNBOUNDED)
    }

    /// Returns the range of Y values in the rectangle.
    fn y_range(self) -> Range<i64> {
        self.min.y..i64::checked_add(self.max.y, 1).unwrap_or(UNBOUNDED)
    }

    fn size(&self) -> ArraySize {
        ArraySize::new(self.width() as u32, self.height() as u32)
            .expect("empty rectangle has no size")
    }

    fn from_sheet_pos_and_size(top_left: SheetPos, size: ArraySize) -> SheetRect {
        SheetRect {
            min: top_left.into(),
            max: Pos {
                x: top_left.x + size.w.get() as i64 - 1,
                y: top_left.y + size.h.get() as i64 - 1,
            },
            sheet_id: top_left.sheet_id,
        }
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
