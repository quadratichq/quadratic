//! Prepare borders for rendering.

use crate::{
    Pos, Rect,
    a1::UNBOUNDED,
    grid::{
        DataTable,
        sheet::borders::{JsBorderHorizontal, JsBorderVertical},
        sheet::merge_cells::MergeCells,
    },
};
use std::collections::HashMap;

use super::*;

impl Borders {
    /// Builds a cache of anchor positions to their merge cell rects for efficient lookup.
    fn build_merge_rect_cache(merge_cells: &MergeCells, border_rect: Rect) -> HashMap<Pos, Rect> {
        let mut cache = HashMap::new();

        // Get all merged cells that intersect with the border area
        // Expand the search rect to include cells above/below and left/right of borders
        let expanded_rect = Rect::new(
            border_rect.min.x.saturating_sub(1),
            border_rect.min.y.saturating_sub(1),
            border_rect.max.x.saturating_add(1),
            border_rect.max.y.saturating_add(1),
        );

        let merged_rects = merge_cells.get_merge_cells(expanded_rect);
        for merge_rect in merged_rects {
            let anchor = merge_rect.min;
            cache.insert(anchor, merge_rect);
        }

        cache
    }

    /// Helper function to check if a horizontal border should be rendered for merged cells.
    /// Horizontal border at row y is the bottom border of cell at (x, y-1) and top border of cell at (x, y).
    /// Returns (should_render, border_to_use) where border_to_use is from the anchor cell if needed.
    fn check_horizontal_border_for_merge(
        &self,
        x: i64,
        y: i64,
        merge_cells: Option<&MergeCells>,
        merge_rect_cache: Option<&HashMap<Pos, Rect>>,
        original_border: BorderStyleTimestamp,
    ) -> (bool, BorderStyleTimestamp) {
        let Some(merge_cells) = merge_cells else {
            return (true, original_border);
        };
        let Some(merge_rect_cache) = merge_rect_cache else {
            return (true, original_border);
        };

        // Horizontal border at row y is between row y-1 and row y
        // First check if both cells are in the same merged cell (internal border - don't render)
        if y > 1 {
            let pos_above = Pos { x, y: y - 1 };
            let pos_below = Pos { x, y };

            if let (Some(anchor_above), Some(anchor_below)) = (
                merge_cells.get_anchor(pos_above),
                merge_cells.get_anchor(pos_below),
            ) {
                if anchor_above == anchor_below {
                    // Both cells are in the same merged cell - internal border, don't render
                    return (false, original_border);
                }
            }
        }

        // Check cell above (y-1) - this border is its bottom border
        let mut should_render_above = true;
        let mut border_from_above = original_border;
        if y > 1 {
            let pos_above = Pos { x, y: y - 1 };
            if let Some(anchor_above) = merge_cells.get_anchor(pos_above) {
                if let Some(&merge_rect_above) = merge_rect_cache.get(&anchor_above) {
                    // Cell above is in a merged cell
                    if anchor_above == pos_above {
                        // It's the anchor - only render bottom border if on bottom edge
                        if merge_rect_above.max.y == y - 1 {
                            if let Some(anchor_bottom_border) = self.bottom.get(anchor_above) {
                                border_from_above = anchor_bottom_border;
                            }
                        } else {
                            // Anchor's bottom border not on edge - don't render from this cell
                            should_render_above = false;
                        }
                    } else {
                        // Not anchor - only render if on bottom edge, use anchor's bottom border
                        if merge_rect_above.max.y == y - 1 {
                            if let Some(anchor_bottom_border) = self.bottom.get(anchor_above) {
                                border_from_above = anchor_bottom_border;
                            }
                        } else {
                            // Not on edge - don't render from this cell
                            should_render_above = false;
                        }
                    }
                }
            }
        }

        // Check cell below (y) - this border is its top border
        let mut should_render_below = true;
        let mut border_from_below = original_border;
        let pos_below = Pos { x, y };
        if let Some(anchor_below) = merge_cells.get_anchor(pos_below) {
            if let Some(&merge_rect_below) = merge_rect_cache.get(&anchor_below) {
                // Cell below is in a merged cell
                if anchor_below == pos_below {
                    // It's the anchor - always render top border (anchor is always on top edge)
                    if let Some(anchor_top_border) = self.top.get(anchor_below) {
                        border_from_below = anchor_top_border;
                    }
                } else {
                    // Not anchor - only render if on top edge, use anchor's top border
                    if merge_rect_below.min.y == y {
                        if let Some(anchor_top_border) = self.top.get(anchor_below) {
                            border_from_below = anchor_top_border;
                        }
                    } else {
                        // Not on edge - don't render from this cell
                        should_render_below = false;
                    }
                }
            }
        }

        // Render if either cell says to render, prefer border from anchor cell
        if should_render_below {
            return (true, border_from_below);
        }
        if should_render_above {
            return (true, border_from_above);
        }

        // Neither cell is in a merged cell, or merged cell logic didn't apply
        (true, original_border)
    }

    /// Helper function to check if a vertical border should be rendered for merged cells.
    /// Vertical border at column x is the right border of cell at (x-1, y) and left border of cell at (x, y).
    /// Returns (should_render, border_to_use) where border_to_use is from the anchor cell if needed.
    fn check_vertical_border_for_merge(
        &self,
        x: i64,
        y: i64,
        merge_cells: Option<&MergeCells>,
        merge_rect_cache: Option<&HashMap<Pos, Rect>>,
        original_border: BorderStyleTimestamp,
    ) -> (bool, BorderStyleTimestamp) {
        let Some(merge_cells) = merge_cells else {
            return (true, original_border);
        };
        let Some(merge_rect_cache) = merge_rect_cache else {
            return (true, original_border);
        };

        // Vertical border at column x is between column x-1 and column x
        // First check if both cells are in the same merged cell (internal border - don't render)
        if x > 1 {
            let pos_left = Pos { x: x - 1, y };
            let pos_right = Pos { x, y };

            if let (Some(anchor_left), Some(anchor_right)) = (
                merge_cells.get_anchor(pos_left),
                merge_cells.get_anchor(pos_right),
            ) {
                if anchor_left == anchor_right {
                    // Both cells are in the same merged cell - internal border, don't render
                    return (false, original_border);
                }
            }
        }

        // Check cell left (x-1) - this border is its right border
        let mut should_render_left = true;
        let mut border_from_left = original_border;
        if x > 1 {
            let pos_left = Pos { x: x - 1, y };
            if let Some(anchor_left) = merge_cells.get_anchor(pos_left) {
                if let Some(&merge_rect_left) = merge_rect_cache.get(&anchor_left) {
                    // Cell left is in a merged cell
                    if anchor_left == pos_left {
                        // It's the anchor - only render right border if on right edge
                        if merge_rect_left.max.x == x - 1 {
                            if let Some(anchor_right_border) = self.right.get(anchor_left) {
                                border_from_left = anchor_right_border;
                            }
                        } else {
                            // Anchor's right border not on edge - don't render from this cell
                            should_render_left = false;
                        }
                    } else {
                        // Not anchor - only render if on right edge, use anchor's right border
                        if merge_rect_left.max.x == x - 1 {
                            if let Some(anchor_right_border) = self.right.get(anchor_left) {
                                border_from_left = anchor_right_border;
                            }
                        } else {
                            // Not on edge - don't render from this cell
                            should_render_left = false;
                        }
                    }
                }
            }
        }

        // Check cell right (x) - this border is its left border
        let mut should_render_right = true;
        let mut border_from_right = original_border;
        let pos_right = Pos { x, y };
        if let Some(anchor_right) = merge_cells.get_anchor(pos_right) {
            if let Some(&merge_rect_right) = merge_rect_cache.get(&anchor_right) {
                // Cell right is in a merged cell
                if anchor_right == pos_right {
                    // It's the anchor - always render left border (anchor is always on left edge)
                    if let Some(anchor_left_border) = self.left.get(anchor_right) {
                        border_from_right = anchor_left_border;
                    }
                } else {
                    // Not anchor - only render if on left edge, use anchor's left border
                    if merge_rect_right.min.x == x {
                        if let Some(anchor_left_border) = self.left.get(anchor_right) {
                            border_from_right = anchor_left_border;
                        }
                    } else {
                        // Not on edge - don't render from this cell
                        should_render_right = false;
                    }
                }
            }
        }

        // Render if either cell says to render, prefer border from anchor cell
        if should_render_right {
            return (true, border_from_right);
        }
        if should_render_left {
            return (true, border_from_left);
        }

        // Neither cell is in a merged cell, or merged cell logic didn't apply
        (true, original_border)
    }
    /// Returns horizontal borders for rendering.
    pub(crate) fn horizontal_borders(
        &self,
        table: Option<(Pos, &DataTable)>,
    ) -> Option<Vec<JsBorderHorizontal>> {
        self.horizontal_borders_with_merge_cells(table, None)
    }

    /// Returns horizontal borders for rendering, with merged cell handling.
    pub(crate) fn horizontal_borders_with_merge_cells(
        &self,
        table: Option<(Pos, &DataTable)>,
        merge_cells: Option<&MergeCells>,
    ) -> Option<Vec<JsBorderHorizontal>> {
        let table = match table {
            Some((pos, table)) => {
                let mut table_rect = table.output_rect(pos, true);
                // use table data bounds for borders, exclude table name and column headers
                table_rect.min.y += table.y_adjustment(true);
                Some((table, table_rect))
            }
            None => None,
        };

        let mut horizontal_rects = self
            .top
            .into_iter()
            .map(|(x1, y1, x2, y2, border)| {
                if let Some((_table, table_rect)) = table {
                    let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x - 1);
                    let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                    (
                        adjust_x(x1),
                        adjust_y(y1),
                        if let Some(x2) = x2 {
                            Some(adjust_x(x2))
                        } else {
                            Some(table_rect.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(adjust_y(y2))
                        } else {
                            Some(table_rect.max.y as u64)
                        },
                        border,
                    )
                } else {
                    (x1, y1, x2, y2, border)
                }
            })
            .chain(self.bottom.into_iter().map(|(x1, y1, x2, y2, border)| {
                if let Some((_, table_rect)) = table {
                    let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x - 1);
                    let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                    // we use UNBOUNDED as a special value to indicate the last
                    // row of the table
                    if y1 == UNBOUNDED as u64 && y2 == Some(UNBOUNDED as u64) {
                        (
                            adjust_x(x1),
                            table_rect.max.y as u64 + 1,
                            if let Some(x2) = x2 {
                                Some(adjust_x(x2))
                            } else {
                                Some(table_rect.max.x as u64)
                            },
                            Some(table_rect.max.y as u64 + 1),
                            border,
                        )
                    } else {
                        (
                            adjust_x(x1),
                            adjust_y(y1) + 1,
                            if let Some(x2) = x2 {
                                Some(adjust_x(x2))
                            } else {
                                Some(table_rect.max.x as u64)
                            },
                            if let Some(y2) = y2 {
                                Some(adjust_y(y2) + 1)
                            } else {
                                Some(table_rect.max.y as u64 + 1)
                            },
                            border,
                        )
                    }
                } else {
                    (
                        x1,
                        y1.saturating_add_signed(1),
                        x2,
                        y2.map(|y2| y2.saturating_add_signed(1)),
                        border,
                    )
                }
            }))
            .collect::<Vec<_>>();
        horizontal_rects.sort_unstable_by(|a, b| a.4.timestamp.cmp(&b.4.timestamp));

        let mut horizontal = Contiguous2D::<Option<BorderStyleTimestamp>>::default();
        horizontal_rects
            .iter()
            .for_each(|(x1, y1, x2, y2, border)| {
                horizontal.set_rect(
                    *x1 as i64,
                    *y1 as i64,
                    x2.map(|x2| x2 as i64),
                    y2.map(|y2| y2 as i64),
                    Some(*border),
                );
            });

        // Build merge rect cache for efficient lookups
        // Calculate the bounding rect of all borders we're processing
        let merge_rect_cache = merge_cells.and_then(|mc| {
            let border_rect =
                horizontal_rects
                    .iter()
                    .fold(None, |acc: Option<Rect>, (x1, y1, x2, y2, _)| {
                        let rect = Rect::new(
                            *x1 as i64,
                            *y1 as i64,
                            x2.map(|x| x as i64).unwrap_or(*x1 as i64),
                            y2.map(|y| y as i64).unwrap_or(*y1 as i64),
                        );
                        Some(acc.map(|a| a.union(&rect)).unwrap_or(rect))
                    });
            border_rect.map(|rect| Self::build_merge_rect_cache(mc, rect))
        });

        let mut horizontal_vec: Vec<JsBorderHorizontal> = vec![];
        horizontal.into_iter().for_each(|(x1, y1, x2, y2, border)| {
            if y2.is_some_and(|y2| y2 == y1) {
                // Single row border
                let y = y1 as i64;
                let x_start = x1 as i64;
                let x_end = x2.map(|x2| x2 as i64).unwrap_or(x_start);

                // Check each column in this border's range
                for x in x_start..=x_end {
                    let (should_render, border_to_use) = self.check_horizontal_border_for_merge(
                        x,
                        y,
                        merge_cells,
                        merge_rect_cache.as_ref(),
                        border,
                    );

                    if should_render {
                        horizontal_vec.push(JsBorderHorizontal {
                            color: border_to_use.color,
                            line: border_to_use.line,
                            x,
                            y,
                            width: Some(1),
                            unbounded: false,
                        });
                    }
                }
            } else if let Some(y2) = y2 {
                for y in y1..=y2 {
                    let x_start = x1 as i64;
                    let x_end = x2.map(|x2| x2 as i64).unwrap_or(x_start);

                    for x in x_start..=x_end {
                        let (should_render, border_to_use) = self
                            .check_horizontal_border_for_merge(
                                x,
                                y as i64,
                                merge_cells,
                                merge_rect_cache.as_ref(),
                                border,
                            );

                        if should_render {
                            horizontal_vec.push(JsBorderHorizontal {
                                color: border_to_use.color,
                                line: border_to_use.line,
                                x,
                                y: y as i64,
                                width: Some(1),
                                unbounded: false,
                            });
                        }
                    }
                }
            } else {
                // handle infinite horizontal - skip merged cell handling for unbounded
                horizontal_vec.push(JsBorderHorizontal {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    width: x2.map(|x2| x2 as i64 - x1 as i64 + 1),
                    unbounded: y2.is_none(),
                });
            }
        });

        // Merge contiguous borders with same style
        let mut merged: Vec<JsBorderHorizontal> = Vec::new();
        for border in horizontal_vec {
            if let Some(last) = merged.last_mut() {
                if last.y == border.y
                    && last.color == border.color
                    && last.line == border.line
                    && last.width.is_some()
                    && border.width.is_some()
                    && last.x + last.width.unwrap() == border.x
                {
                    last.width = Some(last.width.unwrap() + border.width.unwrap());
                    continue;
                }
            }
            merged.push(border);
        }

        if merged.is_empty() {
            None
        } else {
            Some(merged)
        }
    }

    /// Returns vertical borders for rendering.
    pub(crate) fn vertical_borders(
        &self,
        table: Option<(Pos, &DataTable)>,
    ) -> Option<Vec<JsBorderVertical>> {
        self.vertical_borders_with_merge_cells(table, None)
    }

    /// Returns vertical borders for rendering, with merged cell handling.
    pub(crate) fn vertical_borders_with_merge_cells(
        &self,
        table: Option<(Pos, &DataTable)>,
        merge_cells: Option<&MergeCells>,
    ) -> Option<Vec<JsBorderVertical>> {
        let table = match table {
            Some((pos, table)) => {
                let mut table_rect = table.output_rect(pos, true);

                // use table data bounds for borders, exclude table name and column headers
                table_rect.min.y += table.y_adjustment(true);

                Some((table, table_rect))
            }
            None => None,
        };

        let mut vertical_rects = self
            .left
            .into_iter()
            .map(|(x1, y1, x2, y2, border)| {
                if let Some((_, table_rect)) = table {
                    let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x - 1);
                    let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                    (
                        adjust_x(x1),
                        adjust_y(y1),
                        if let Some(x2) = x2 {
                            Some(adjust_x(x2))
                        } else {
                            Some(table_rect.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(adjust_y(y2))
                        } else {
                            Some(table_rect.max.y as u64)
                        },
                        border,
                    )
                } else {
                    (x1, y1, x2, y2, border)
                }
            })
            .chain(self.right.into_iter().map(|(x1, y1, x2, y2, border)| {
                if let Some((_, table_rect)) = table {
                    let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x);
                    let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                    // we use UNBOUNDED as a special value to indicate the last
                    // column of the table
                    if x1 == UNBOUNDED as u64 && x2 == Some(UNBOUNDED as u64) {
                        (
                            table_rect.max.x as u64 + 1,
                            adjust_y(y1),
                            Some(table_rect.max.x as u64 + 1),
                            if let Some(y2) = y2 {
                                Some(adjust_y(y2))
                            } else {
                                Some(table_rect.max.y as u64)
                            },
                            border,
                        )
                    } else {
                        (
                            adjust_x(x1),
                            adjust_y(y1),
                            if let Some(x2) = x2 {
                                Some(adjust_x(x2))
                            } else {
                                Some(table_rect.max.x as u64 + 1)
                            },
                            if let Some(y2) = y2 {
                                Some(adjust_y(y2))
                            } else {
                                Some(table_rect.max.y as u64)
                            },
                            border,
                        )
                    }
                } else {
                    (
                        x1.saturating_add(1),
                        y1,
                        x2.map(|x2| x2.saturating_add(1)),
                        y2,
                        border,
                    )
                }
            }))
            .collect::<Vec<_>>();
        vertical_rects.sort_unstable_by(|a, b| a.4.timestamp.cmp(&b.4.timestamp));

        let mut vertical = Contiguous2D::<Option<BorderStyleTimestamp>>::default();
        vertical_rects.iter().for_each(|(x1, y1, x2, y2, border)| {
            vertical.set_rect(
                *x1 as i64,
                *y1 as i64,
                x2.map(|x2| x2 as i64),
                y2.map(|y2| y2 as i64),
                Some(*border),
            );
        });

        // Build merge rect cache for efficient lookups
        let merge_rect_cache = merge_cells.and_then(|mc| {
            let border_rect =
                vertical_rects
                    .iter()
                    .fold(None, |acc: Option<Rect>, (x1, y1, x2, y2, _)| {
                        let rect = Rect::new(
                            *x1 as i64,
                            *y1 as i64,
                            x2.map(|x| x as i64).unwrap_or(*x1 as i64),
                            y2.map(|y| y as i64).unwrap_or(*y1 as i64),
                        );
                        Some(acc.map(|a| a.union(&rect)).unwrap_or(rect))
                    });
            border_rect.map(|rect| Self::build_merge_rect_cache(mc, rect))
        });

        let mut vertical_vec: Vec<JsBorderVertical> = vec![];
        vertical.into_iter().for_each(|(x1, y1, x2, y2, border)| {
            if x2.is_some_and(|x2| x2 == x1) {
                // Single column border
                let x = x1 as i64;
                let y_start = y1 as i64;
                let y_end = y2.map(|y2| y2 as i64).unwrap_or(y_start);

                // Check each row in this border's range
                for y in y_start..=y_end {
                    let (should_render, border_to_use) = self.check_vertical_border_for_merge(
                        x,
                        y,
                        merge_cells,
                        merge_rect_cache.as_ref(),
                        border,
                    );

                    if should_render {
                        vertical_vec.push(JsBorderVertical {
                            color: border_to_use.color,
                            line: border_to_use.line,
                            x,
                            y,
                            height: Some(1),
                            unbounded: false,
                        });
                    }
                }
            } else if let Some(x2) = x2 {
                for x in x1..=x2 {
                    let y_start = y1 as i64;
                    let y_end = y2.map(|y2| y2 as i64).unwrap_or(y_start);

                    for y in y_start..=y_end {
                        let (should_render, border_to_use) = self.check_vertical_border_for_merge(
                            x as i64,
                            y,
                            merge_cells,
                            merge_rect_cache.as_ref(),
                            border,
                        );

                        if should_render {
                            vertical_vec.push(JsBorderVertical {
                                color: border_to_use.color,
                                line: border_to_use.line,
                                x: x as i64,
                                y,
                                height: Some(1),
                                unbounded: false,
                            });
                        }
                    }
                }
            } else {
                // handle infinite vertical - skip merged cell handling for unbounded
                vertical_vec.push(JsBorderVertical {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    height: y2.map(|y2| y2 as i64 - y1 as i64 + 1),
                    unbounded: x2.is_none(),
                });
            }
        });

        // Merge contiguous borders with same style
        let mut merged: Vec<JsBorderVertical> = Vec::new();
        for border in vertical_vec {
            if let Some(last) = merged.last_mut() {
                if last.x == border.x
                    && last.color == border.color
                    && last.line == border.line
                    && last.height.is_some()
                    && border.height.is_some()
                    && last.y + last.height.unwrap() == border.y
                {
                    last.height = Some(last.height.unwrap() + border.height.unwrap());
                    continue;
                }
            }
            merged.push(border);
        }

        if merged.is_empty() {
            None
        } else {
            Some(merged)
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{a1::A1Selection, controller::GridController, grid::SheetId};

    use super::*;

    #[test]
    fn test_render_borders_none() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.horizontal_borders(None), None);
        assert_eq!(sheet.borders.vertical_borders(None), None);
    }

    #[test]
    fn test_render_borders_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 6);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 6);
    }

    #[test]
    fn test_render_borders_top() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders.vertical_borders(None).is_none());
    }

    #[test]
    fn test_render_borders_bottom() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Bottom,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders.vertical_borders(None).is_none());
    }

    #[test]
    fn test_render_borders_left() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Left,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None).is_none());
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 1);
    }

    #[test]
    fn test_render_borders_right() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Right,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None).is_none());
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 1);
    }

    #[test]
    fn test_render_borders_outer() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 2);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 2);
    }

    #[test]
    fn test_render_borders_inner() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Inner,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 4);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 4);
    }

    #[test]
    fn test_render_borders_horizontal() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Horizontal,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 4);
        assert!(sheet.borders.vertical_borders(None).is_none());
    }

    #[test]
    fn test_render_borders_vertical() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Vertical,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None).is_none());
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 4);
    }

    #[test]
    fn test_render_borders_infinite_all() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("a3:b4"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(SheetId::TEST);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 3);
        assert!(!horizontal[0].unbounded);

        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 3);
        assert!(!vertical[0].unbounded);

        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("*"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(SheetId::TEST);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(horizontal[0].unbounded);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 1);
        assert!(vertical[0].unbounded);
    }

    #[test]
    fn test_render_border_column() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("C"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(SheetId::TEST);
        assert_eq!(sheet.borders.horizontal_borders(None).unwrap().len(), 1);
        assert_eq!(sheet.borders.vertical_borders(None).unwrap().len(), 2);
    }

    #[test]
    fn test_render_borders_gap_in_all() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("*"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.clear_format_borders(&A1Selection::test_a1("b5:c6"), None, false);

        let sheet = gc.sheet(SheetId::TEST);

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Bottom, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Left, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Right, pos![b5]), None);

        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 8);
    }
}
