// Re-export the base types from quadratic-core-shared
pub use quadratic_core_shared::{Pos, SheetPos};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{RefAdjust, a1::CellRefRangeEnd};

// Extension trait for Pos with core-specific A1 functionality
pub trait PosA1Ext {
    /// Returns an A1-style relative reference to the cell position.
    fn a1_string(self) -> String;

    fn try_a1_string(a1: &str) -> Option<Pos>;

    /// Returns an A1-style debug string
    fn a1_debug_string(self) -> String;

    /// Translates the pos in place by the given delta, clamping the result to the given min.
    fn translate_in_place(&mut self, x: i64, y: i64, min_x: i64, min_y: i64);

    /// Returns a new Pos translated by the given delta, clamping the result to the given min.
    fn translate_clamped(&self, x: i64, y: i64, min_x: i64, min_y: i64) -> Pos;

    /// Adjusts coordinates by `adjust`, clamping the result within the sheet
    /// bounds. Returns a new Pos.
    fn saturating_translate(&self, dx: i64, dy: i64) -> Pos;

    /// Adjusts coordinates by `adjust`, clamping the result within the sheet
    /// bounds.
    fn saturating_adjust(self, adjust: RefAdjust) -> Pos;
}

impl PosA1Ext for Pos {
    fn a1_string(self) -> String {
        let col = crate::a1::column_name(self.x);
        let row = self.y;
        format!("{col}{row}")
    }

    fn try_a1_string(a1: &str) -> Option<Pos> {
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

    fn a1_debug_string(self) -> String {
        format!("Pos ({}, {}) {}", self.x, self.y, self.a1_string())
    }

    fn translate_in_place(&mut self, x: i64, y: i64, min_x: i64, min_y: i64) {
        self.x = (self.x + x).max(min_x);
        self.y = (self.y + y).max(min_y);
    }

    fn translate_clamped(&self, x: i64, y: i64, min_x: i64, min_y: i64) -> Pos {
        let mut pos = *self;
        pos.translate_in_place(x, y, min_x, min_y);
        pos
    }

    fn saturating_translate(&self, dx: i64, dy: i64) -> Pos {
        let adjust = RefAdjust::new_translate(dx, dy);
        self.saturating_adjust(adjust)
    }

    fn saturating_adjust(self, adjust: RefAdjust) -> Pos {
        let x_start = adjust.x_start;
        let dx = if self.x < x_start { 0 } else { adjust.dx };

        let y_start = adjust.y_start;
        let dy = if self.y < y_start { 0 } else { adjust.dy };

        Pos {
            x: self.x.saturating_add(dx).max(1),
            y: self.y.saturating_add(dy).max(1),
        }
    }
}

// Extension trait for Rect with core-specific A1 functionality
pub trait RectA1Ext {
    fn a1_string(&self) -> String;

    #[cfg(test)]
    fn test_a1(s: &str) -> crate::Rect;
}

impl RectA1Ext for crate::Rect {
    fn a1_string(&self) -> String {
        format!("{}:{}", self.min.a1_string(), self.max.a1_string())
    }

    #[cfg(test)]
    fn test_a1(s: &str) -> crate::Rect {
        use crate::a1::A1Context;

        crate::a1::CellRefRange::test_a1(s)
            .to_rect(&A1Context::default())
            .unwrap()
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

#[cfg(test)]
mod test {
    use crate::{
        Pos, RefAdjust, SheetPos, SheetRect,
        grid::SheetId,
        renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
        pos::PosA1Ext,
    };

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
    fn test_translate_clamped() {
        // Basic positive translation
        let pos = Pos::new(5, 5);
        let translated = pos.translate_clamped(2, 3, 0, 0);
        assert_eq!(translated, Pos::new(7, 8));
        assert_eq!(pos, Pos::new(5, 5)); // Original unchanged

        // Negative translation
        let pos = Pos::new(5, 5);
        let translated = pos.translate_clamped(-2, -3, 0, 0);
        assert_eq!(translated, Pos::new(3, 2));
        assert_eq!(pos, Pos::new(5, 5)); // Original unchanged

        // Translation with clamping
        let pos = Pos::new(5, 5);
        let translated = pos.translate_clamped(-10, -10, 2, 3);
        assert_eq!(translated, Pos::new(2, 3));
        assert_eq!(pos, Pos::new(5, 5)); // Original unchanged

        // Translation with no effect due to clamping
        let pos = Pos::new(2, 3);
        let translated = pos.translate_clamped(-5, -5, 2, 3);
        assert_eq!(translated, Pos::new(2, 3));
        assert_eq!(pos, Pos::new(2, 3)); // Original unchanged
    }

    #[test]
    fn test_min() {
        // Basic case where first pos has smaller values
        let pos1 = Pos::new(1, 2);
        let pos2 = Pos::new(3, 4);
        assert_eq!(pos1.min(pos2), Pos::new(1, 2));

        // Mixed cases where each pos has one smaller value
        let pos1 = Pos::new(1, 5);
        let pos2 = Pos::new(3, 2);
        assert_eq!(pos1.min(pos2), Pos::new(1, 2));

        // Negative numbers
        let pos1 = Pos::new(-5, -2);
        let pos2 = Pos::new(-3, -4);
        assert_eq!(pos1.min(pos2), Pos::new(-5, -4));

        // Equal values
        let pos1 = Pos::new(3, 3);
        let pos2 = Pos::new(3, 3);
        assert_eq!(pos1.min(pos2), Pos::new(3, 3));
    }

    #[test]
    fn test_max() {
        // Basic case where second pos has larger values
        let pos1 = Pos::new(1, 2);
        let pos2 = Pos::new(3, 4);
        assert_eq!(pos1.max(pos2), Pos::new(3, 4));

        // Mixed cases where each pos has one larger value
        let pos1 = Pos::new(5, 2);
        let pos2 = Pos::new(3, 4);
        assert_eq!(pos1.max(pos2), Pos::new(5, 4));

        // Negative numbers
        let pos1 = Pos::new(-5, -2);
        let pos2 = Pos::new(-3, -4);
        assert_eq!(pos1.max(pos2), Pos::new(-3, -2));

        // Equal values
        let pos1 = Pos::new(3, 3);
        let pos2 = Pos::new(3, 3);
        assert_eq!(pos1.max(pos2), Pos::new(3, 3));
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
