//! Adjust borders for merged cells.

use crate::{
    Rect,
    a1::UNBOUNDED,
    grid::sheet::{
        borders::{BorderSide, BorderStyleTimestamp, Borders},
        merge_cells::MergeCells,
    },
};

impl Borders {
    /// Adjust the borders for a merged cell. This is a rect of borders on a
    /// given side set with a given border style.
    ///
    /// If there are any overlapping merged cells, we need to adjust the borders
    /// to account for the merged cells. The merged cells always use their
    /// anchor cell's borders as the border style across the entire merged cell
    /// range, treating it as a single cell instead of a collection of cells.
    pub(crate) fn adjust_for_merge_cells(
        &self,
        side: BorderSide,
        x1: u64,
        y1: u64,
        x2: Option<u64>,
        y2: Option<u64>,
        border: BorderStyleTimestamp,
        merge_cells: Option<&MergeCells>,
    ) -> Vec<(u64, u64, Option<u64>, Option<u64>, BorderStyleTimestamp)> {
        if let Some(merge_cells) = merge_cells {
            let borders = match side {
                BorderSide::Top => &self.top,
                BorderSide::Bottom => &self.bottom,
                BorderSide::Left => &self.left,
                BorderSide::Right => &self.right,
            };
            let border_rect = Rect::new(
                x1 as i64,
                y1 as i64,
                x2.map(|x2| x2 as i64).unwrap_or(UNBOUNDED as i64),
                y2.map(|y2| y2 as i64).unwrap_or(UNBOUNDED as i64),
            );
            let merged_cells = merge_cells.get_merge_cells(border_rect);

            if merged_cells.is_empty() {
                return vec![(x1, y1, x2, y2, border)];
            }

            let mut result = vec![];
            let mut segments = vec![(x1, y1, x2, y2, border)];

            for merged_cell in merged_cells {
                let anchor_border = borders.get(merged_cell.min);
                let mut new_segments = vec![];

                for (seg_x1, seg_y1, seg_x2, seg_y2, seg_border) in segments {
                    let seg_rect = Rect::new(
                        seg_x1 as i64,
                        seg_y1 as i64,
                        seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED as i64),
                        seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED as i64),
                    );

                    // Check if this segment intersects with the merged cell
                    if !seg_rect.intersects(merged_cell) {
                        // No intersection, keep the segment as-is
                        new_segments.push((seg_x1, seg_y1, seg_x2, seg_y2, seg_border));
                        continue;
                    }

                    match side {
                        BorderSide::Top => {
                            // Top border: check if y1 is inside the merged cell
                            // Top border at y_min is the top edge (keep), inside is cleared
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;
                            let seg_y1_i64 = seg_y1 as i64;
                            let is_inside = seg_y1_i64 > merge_y_min && seg_y1_i64 <= merge_y_max;
                            let is_at_top_edge = seg_y1_i64 == merge_y_min;

                            // Split along x-axis
                            let seg_x2_val = seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED as i64);
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;

                            // Part before merged cell (if any)
                            if (seg_x1 as i64) < merge_x_min {
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    Some((merge_x_min - 1) as u64),
                                    seg_y2,
                                    seg_border,
                                ));
                            }

                            // Part overlapping with merged cell
                            let overlap_x1 = seg_x1.max(merge_x_min as u64);
                            let overlap_x2 = if is_at_top_edge {
                                // At top edge, extend to span full width of merged cell
                                merge_x_max
                            } else {
                                seg_x2_val.min(merge_x_max)
                            };
                            if (overlap_x1 as i64) <= overlap_x2 {
                                if is_inside {
                                    // Border is inside merged cell, clear it (don't add)
                                } else if is_at_top_edge {
                                    // At top edge, use anchor border and span full width
                                    if let Some(anchor_border) = anchor_border {
                                        new_segments.push((
                                            overlap_x1,
                                            seg_y1,
                                            Some(overlap_x2 as u64),
                                            seg_y2,
                                            anchor_border,
                                        ));
                                    } else {
                                        new_segments.push((
                                            overlap_x1,
                                            seg_y1,
                                            Some(overlap_x2 as u64),
                                            seg_y2,
                                            seg_border,
                                        ));
                                    }
                                } else {
                                    // Outside merged cell, keep original
                                    new_segments.push((
                                        overlap_x1,
                                        seg_y1,
                                        Some(overlap_x2 as u64),
                                        seg_y2,
                                        seg_border,
                                    ));
                                }
                            }

                            // Part after merged cell (if any)
                            if seg_x2_val > merge_x_max {
                                new_segments.push((
                                    (merge_x_max + 1) as u64,
                                    seg_y1,
                                    seg_x2,
                                    seg_y2,
                                    seg_border,
                                ));
                            } else if seg_x2.is_none() && merge_x_max < UNBOUNDED as i64 {
                                new_segments.push((
                                    (merge_x_max + 1) as u64,
                                    seg_y1,
                                    None,
                                    seg_y2,
                                    seg_border,
                                ));
                            }
                        }
                        BorderSide::Bottom => {
                            // Bottom border: stored at y1, represents border at y1+1
                            // Bottom border at y_max represents border at y_max+1 (bottom edge - keep)
                            // Bottom borders at y where y_min < y <= y_max are inside (clear)
                            // Note: seg_y1 is already y+1 when called from borders_render.rs
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;
                            let seg_y1_i64 = seg_y1 as i64;
                            // Border at merge_y_max + 1 is at the bottom edge (between last row and next row)
                            // This represents a border stored at merge_y_max
                            let is_at_bottom_edge = seg_y1_i64 == merge_y_max + 1;
                            let is_inside = seg_y1_i64 > merge_y_min && seg_y1_i64 <= merge_y_max;

                            // Split along x-axis
                            let seg_x2_val = seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED as i64);
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;

                            // Part before merged cell (if any)
                            if (seg_x1 as i64) < merge_x_min {
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    Some((merge_x_min - 1) as u64),
                                    seg_y2,
                                    seg_border,
                                ));
                            }

                            // Part overlapping with merged cell
                            let overlap_x1 = seg_x1.max(merge_x_min as u64);
                            let overlap_x2 = if is_at_bottom_edge {
                                // At bottom edge, extend to span full width of merged cell
                                merge_x_max
                            } else {
                                seg_x2_val.min(merge_x_max)
                            };
                            if (overlap_x1 as i64) <= overlap_x2 {
                                if is_inside {
                                    // Border is inside merged cell, clear it (don't add)
                                } else if is_at_bottom_edge {
                                    // At bottom edge, use anchor border and span full width
                                    if let Some(anchor_border) = anchor_border {
                                        new_segments.push((
                                            overlap_x1,
                                            seg_y1,
                                            Some(overlap_x2 as u64),
                                            seg_y2,
                                            anchor_border,
                                        ));
                                    } else {
                                        new_segments.push((
                                            overlap_x1,
                                            seg_y1,
                                            Some(overlap_x2 as u64),
                                            seg_y2,
                                            seg_border,
                                        ));
                                    }
                                } else {
                                    // Outside merged cell, keep original
                                    new_segments.push((
                                        overlap_x1,
                                        seg_y1,
                                        Some(overlap_x2 as u64),
                                        seg_y2,
                                        seg_border,
                                    ));
                                }
                            }

                            // Part after merged cell (if any)
                            if seg_x2_val > merge_x_max {
                                new_segments.push((
                                    (merge_x_max + 1) as u64,
                                    seg_y1,
                                    seg_x2,
                                    seg_y2,
                                    seg_border,
                                ));
                            } else if seg_x2.is_none() && merge_x_max < UNBOUNDED as i64 {
                                new_segments.push((
                                    (merge_x_max + 1) as u64,
                                    seg_y1,
                                    None,
                                    seg_y2,
                                    seg_border,
                                ));
                            }
                        }
                        BorderSide::Left => {
                            // Left border: check if x1 is inside the merged cell
                            // Left border at x_min is the left edge (keep), inside is cleared
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;
                            let seg_x1_i64 = seg_x1 as i64;
                            let is_inside = seg_x1_i64 > merge_x_min && seg_x1_i64 <= merge_x_max;
                            let is_at_left_edge = seg_x1_i64 == merge_x_min;

                            // Split along y-axis
                            let seg_y2_val = seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED as i64);
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;

                            // Part before merged cell (if any)
                            if (seg_y1 as i64) < merge_y_min {
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    seg_x2,
                                    Some((merge_y_min - 1) as u64),
                                    seg_border,
                                ));
                            }

                            // Part overlapping with merged cell
                            let overlap_y1 = seg_y1.max(merge_y_min as u64);
                            let overlap_y2 = if is_at_left_edge {
                                // At left edge, extend to span full height of merged cell
                                merge_y_max
                            } else {
                                seg_y2_val.min(merge_y_max)
                            };
                            if (overlap_y1 as i64) <= overlap_y2 {
                                if is_inside {
                                    // Border is inside merged cell, clear it (don't add)
                                } else if is_at_left_edge {
                                    // At left edge, use anchor border and span full height
                                    if let Some(anchor_border) = anchor_border {
                                        new_segments.push((
                                            seg_x1,
                                            overlap_y1,
                                            seg_x2,
                                            Some(overlap_y2 as u64),
                                            anchor_border,
                                        ));
                                    } else {
                                        new_segments.push((
                                            seg_x1,
                                            overlap_y1,
                                            seg_x2,
                                            Some(overlap_y2 as u64),
                                            seg_border,
                                        ));
                                    }
                                } else {
                                    // Outside merged cell, keep original
                                    new_segments.push((
                                        seg_x1,
                                        overlap_y1,
                                        seg_x2,
                                        Some(overlap_y2 as u64),
                                        seg_border,
                                    ));
                                }
                            }

                            // Part after merged cell (if any)
                            if seg_y2_val > merge_y_max {
                                new_segments.push((
                                    seg_x1,
                                    (merge_y_max + 1) as u64,
                                    seg_x2,
                                    seg_y2,
                                    seg_border,
                                ));
                            } else if seg_y2.is_none() && merge_y_max < UNBOUNDED as i64 {
                                new_segments.push((
                                    seg_x1,
                                    (merge_y_max + 1) as u64,
                                    seg_x2,
                                    None,
                                    seg_border,
                                ));
                            }
                        }
                        BorderSide::Right => {
                            // Right border: stored at x1, represents border at x1+1
                            // Right border at x_max represents border at x_max+1 (right edge - keep)
                            // Right borders at x where x_min < x <= x_max are inside (clear)
                            // Note: seg_x1 is already x+1 when called from borders_render.rs
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;
                            let seg_x1_i64 = seg_x1 as i64;
                            // Border at merge_x_max + 1 is at the right edge (between last column and next column)
                            // This represents a border stored at merge_x_max
                            let is_at_right_edge = seg_x1_i64 == merge_x_max + 1;
                            let is_inside = seg_x1_i64 > merge_x_min && seg_x1_i64 <= merge_x_max;

                            // Split along y-axis
                            let seg_y2_val = seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED as i64);
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;

                            // Part before merged cell (if any)
                            if (seg_y1 as i64) < merge_y_min {
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    seg_x2,
                                    Some((merge_y_min - 1) as u64),
                                    seg_border,
                                ));
                            }

                            // Part overlapping with merged cell
                            let overlap_y1 = seg_y1.max(merge_y_min as u64);
                            let overlap_y2 = if is_at_right_edge {
                                // At right edge, extend to span full height of merged cell
                                merge_y_max
                            } else {
                                seg_y2_val.min(merge_y_max)
                            };
                            if (overlap_y1 as i64) <= overlap_y2 {
                                if is_inside {
                                    // Border is inside merged cell, clear it (don't add)
                                } else if is_at_right_edge {
                                    // At right edge, use anchor border and span full height
                                    if let Some(anchor_border) = anchor_border {
                                        new_segments.push((
                                            seg_x1,
                                            overlap_y1,
                                            seg_x2,
                                            Some(overlap_y2 as u64),
                                            anchor_border,
                                        ));
                                    } else {
                                        new_segments.push((
                                            seg_x1,
                                            overlap_y1,
                                            seg_x2,
                                            Some(overlap_y2 as u64),
                                            seg_border,
                                        ));
                                    }
                                } else {
                                    // Outside merged cell, keep original
                                    new_segments.push((
                                        seg_x1,
                                        overlap_y1,
                                        seg_x2,
                                        Some(overlap_y2 as u64),
                                        seg_border,
                                    ));
                                }
                            }

                            // Part after merged cell (if any)
                            if seg_y2_val > merge_y_max {
                                new_segments.push((
                                    seg_x1,
                                    (merge_y_max + 1) as u64,
                                    seg_x2,
                                    seg_y2,
                                    seg_border,
                                ));
                            } else if seg_y2.is_none() && merge_y_max < UNBOUNDED as i64 {
                                new_segments.push((
                                    seg_x1,
                                    (merge_y_max + 1) as u64,
                                    seg_x2,
                                    None,
                                    seg_border,
                                ));
                            }
                        }
                    }
                }

                segments = new_segments;
            }

            result.extend(segments);
            result
        } else {
            vec![(x1, y1, x2, y2, border)]
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        a1::A1Selection,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle, JsBorderHorizontal},
    };

    #[test]
    fn test_merged_cells_borders_simple() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set borders on the merged cell
        gc.set_borders(
            A1Selection::test_a1("B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // Get rendered borders with merge cells
        let horizontal = sheet
            .borders
            .horizontal_borders(None, Some(&sheet.merge_cells))
            .unwrap();

        assert_eq!(
            horizontal,
            vec![
                JsBorderHorizontal {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 2,
                    y: 2,
                    width: Some(3),
                    unbounded: false,
                },
                JsBorderHorizontal {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 2,
                    y: 4,
                    width: Some(3),
                    unbounded: false,
                }
            ]
        );

        // let vertical = sheet
        //     .borders
        //     .vertical_borders(None, Some(&sheet.merge_cells))
        //     .unwrap();
    }
}
