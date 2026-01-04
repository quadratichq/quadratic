//! Rust-native fill rendering that produces RenderFill and SheetFill directly.
//!
//! This mirrors the logic in `rendering/fills.rs` but produces types from
//! `quadratic-core-shared` directly, eliminating conversion overhead.

use crate::{Pos, Rect, grid::Sheet};
use quadratic_core_shared::{RenderFill, Rgba, SheetFill};

/// Parse a CSS color string to Rgba.
/// Supports hex (#RGB, #RRGGBB, #RRGGBBAA) and rgb()/rgba() formats.
fn parse_color(color: &str) -> Rgba {
    Rgba::from_css(color).unwrap_or(Rgba::TRANSPARENT)
}

impl Sheet {
    /// Returns finite fills that intersect with the given rect (Rust-native version).
    pub fn get_rust_render_fills_in_rect(&self, rect: Rect) -> Vec<RenderFill> {
        self.formats
            .fill_color
            .to_rects()
            .filter_map(|(x0, y0, x1, y1, color)| {
                if let (Some(x1), Some(y1)) = (x1, y1) {
                    let fill_rect = Rect::new_span(Pos { x: x0, y: y0 }, Pos { x: x1, y: y1 });
                    if fill_rect.intersects(rect) {
                        Some(RenderFill {
                            x: x0,
                            y: y0,
                            w: (x1 - x0 + 1) as u32,
                            h: (y1 - y0 + 1) as u32,
                            color: parse_color(&color),
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .chain(
                self.data_tables
                    .expensive_iter()
                    .filter_map(|(pos, dt)| {
                        let reverse_display_buffer = dt.get_reverse_display_buffer();
                        dt.formats.as_ref().map(|formats| {
                            formats.fill_color.to_rects().flat_map(
                                move |(mut x0, mut y0, x1, y1, color)| {
                                    let mut fills = vec![];
                                    if dt.has_spill() || dt.has_error() {
                                        return fills;
                                    }
                                    let mut output_rect = dt.output_rect(*pos, false);
                                    output_rect.min.y += dt.y_adjustment(true);
                                    let mut x1 = x1.unwrap_or(output_rect.width() as i64);
                                    let mut y1 = y1.unwrap_or(output_rect.height() as i64);
                                    x0 = dt
                                        .get_display_index_from_column_index(x0 as u32 - 1, false);
                                    x1 =
                                        dt.get_display_index_from_column_index(x1 as u32 - 1, true);
                                    y0 -= 1;
                                    y1 -= 1;
                                    let fills_min_y = (pos.y + dt.y_adjustment(false)).max(pos.y);
                                    if dt.display_buffer.is_some() {
                                        for y in y0..=y1 {
                                            let x = output_rect.min.x + x0;
                                            let x1 = output_rect.min.x + x1;
                                            let mut y = dt
                                                .get_display_index_from_reverse_display_buffer(
                                                    y as u64,
                                                    reverse_display_buffer.as_ref(),
                                                )
                                                as i64;
                                            y += output_rect.min.y;
                                            if x1 >= x && y >= fills_min_y {
                                                let fill_rect =
                                                    Rect::new_span(Pos { x, y }, Pos { x: x1, y });
                                                if fill_rect.intersects(rect) {
                                                    fills.push(RenderFill {
                                                        x,
                                                        y,
                                                        w: (x1 - x + 1) as u32,
                                                        h: 1,
                                                        color: parse_color(&color),
                                                    });
                                                }
                                            }
                                        }
                                    } else {
                                        let x = output_rect.min.x + x0;
                                        let y = (output_rect.min.y + y0).max(fills_min_y);
                                        let x1 = output_rect.min.x + x1;
                                        let y1 = output_rect.min.y + y1;
                                        if x1 >= x && y1 >= y {
                                            let fill_rect =
                                                Rect::new_span(Pos { x, y }, Pos { x: x1, y: y1 });
                                            if fill_rect.intersects(rect) {
                                                fills.push(RenderFill {
                                                    x,
                                                    y,
                                                    w: (x1 - x + 1) as u32,
                                                    h: (y1 - y + 1) as u32,
                                                    color: parse_color(&color),
                                                });
                                            }
                                        };
                                    }
                                    fills
                                },
                            )
                        })
                    })
                    .flatten(),
            )
            .collect()
    }

    /// Returns all fills for the rows, columns, and sheet (Rust-native version).
    /// This does not return individual cell formats.
    pub fn get_rust_all_sheet_fills(&self) -> Vec<SheetFill> {
        self.formats
            .fill_color
            .to_rects()
            .filter_map(|(x0, y0, x1, y1, color)| {
                if x1.is_some() && y1.is_some() {
                    None
                } else {
                    Some(SheetFill {
                        x: x0 as u32,
                        y: y0 as u32,
                        w: x1.map(|x1| (x1 - x0 + 1) as u32),
                        h: y1.map(|y1| (y1 - y0 + 1) as u32),
                        color: parse_color(&color),
                    })
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{a1::A1Selection, controller::GridController};

    /// Large rect used to get all fills in tests
    const TEST_RECT: Rect = Rect {
        min: Pos { x: 1, y: 1 },
        max: Pos { x: 1000, y: 1000 },
    };

    #[track_caller]
    fn assert_fill_eq(fill: &RenderFill, x: i64, y: i64, w: u32, h: u32, color: &str) {
        assert_eq!(
            fill,
            &RenderFill {
                x,
                y,
                w,
                h,
                color: parse_color(color),
            }
        );
    }

    #[test]
    fn test_get_rust_all_sheet_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.get_rust_all_sheet_fills(), vec![]);

        gc.set_fill_color(
            &A1Selection::test_a1("B:D"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1("2"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let fills = sheet.get_rust_all_sheet_fills();
        assert_eq!(fills.len(), 2);
        assert_eq!(
            fills[0],
            SheetFill {
                x: 2,
                y: 3,
                w: Some(3),
                h: None,
                color: parse_color("red"),
            }
        );
        assert_eq!(
            fills[1],
            SheetFill {
                x: 5,
                y: 2,
                w: None,
                h: Some(1),
                color: parse_color("blue"),
            }
        );
    }

    #[test]
    fn test_get_rust_render_fills_in_rect_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.test_set_data_table(
            pos!(E2).to_sheet_pos(sheet_id),
            3,
            3,
            false,
            Some(true),
            Some(true),
        );
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 2]", gc.a1_context()),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 3]", gc.a1_context()),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.show_name = Some(true);
                dt.show_columns = Some(true);
                Ok(())
            })
            .unwrap();

        let fills = sheet.get_rust_render_fills_in_rect(TEST_RECT);
        assert_eq!(fills.len(), 2);
        assert_fill_eq(&fills[0], 6, 4, 1, 3, "red");
        assert_fill_eq(&fills[1], 7, 4, 1, 3, "blue");
    }
}
