//! Adjust borders for merged cells.

use crate::{
    Rect,
    a1::UNBOUNDED,
    grid::sheet::{
        borders::{BorderSide, BorderStyleTimestamp, Borders},
        merge_cells::MergeCells,
    },
};

/// Return type for adjust_for_merge_cells to reduce type complexity
type BorderAdjustmentResult = Vec<(u64, u64, Option<u64>, Option<u64>, BorderStyleTimestamp)>;

impl Borders {
    /// Adjust the borders for a merged cell. The input is a rect of borders on a
    /// given side set with a given border style.
    ///
    /// If there are any overlapping merged cells, we need to adjust the borders
    /// to account for the merged cells. The merged cells always use their
    /// anchor cell's borders as the border style across the entire merged cell
    /// range, treating it as a single cell instead of a collection of cells.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn adjust_for_merge_cells(
        &self,
        side: BorderSide,
        x1: u64,
        y1: u64,
        x2: Option<u64>,
        y2: Option<u64>,
        border: BorderStyleTimestamp,
        merge_cells: Option<&MergeCells>,
    ) -> BorderAdjustmentResult {
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
                x2.map(|x2| x2 as i64).unwrap_or(UNBOUNDED),
                y2.map(|y2| y2 as i64).unwrap_or(UNBOUNDED),
            );
            let merged_cells = merge_cells.get_merge_cells(border_rect);

            if merged_cells.is_empty() {
                return vec![(x1, y1, x2, y2, border)];
            }

            let mut result = vec![];

            // working list of segments
            let mut segments = vec![(x1, y1, x2, y2, border)];

            for merged_cell in merged_cells {
                let anchor_border = borders.get(merged_cell.min);
                let mut new_segments = vec![];

                for (seg_x1, seg_y1, seg_x2, seg_y2, seg_border) in segments {
                    let seg_rect = Rect::new(
                        seg_x1 as i64,
                        seg_y1 as i64,
                        seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED),
                        seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED),
                    );

                    // Check if this segment intersects with the merged cell
                    if !seg_rect.intersects(merged_cell) {
                        // No intersection, keep the segment as-is
                        new_segments.push((seg_x1, seg_y1, seg_x2, seg_y2, seg_border));
                        continue;
                    }

                    match side {
                        BorderSide::Top => {
                            // Top border: no +1 adjustment
                            // - y < merge_y_min: above the merged cell, keep as-is
                            // - y == merge_y_min: top edge, extend with anchor border
                            // - y in (merge_y_min, merge_y_max]: inside, should be cleared
                            // - y > merge_y_max: below the merged cell, keep as-is
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;

                            let seg_y1_i64 = seg_y1 as i64;
                            let seg_y2_val = seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED);
                            let seg_x2_val = seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED);

                            // Part 1: Borders at y < merge_y_min (above the merged cell)
                            // These don't need adjustment, keep as-is
                            if seg_y1_i64 < merge_y_min {
                                let part_y2 = (merge_y_min - 1).min(seg_y2_val);
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    seg_x2,
                                    Some(part_y2 as u64),
                                    seg_border,
                                ));
                            }

                            // Part 2: Borders at y == merge_y_min (the top edge)
                            if seg_y1_i64 <= merge_y_min && seg_y2_val >= merge_y_min {
                                // Add the edge border spanning the full width of merged cell
                                if let Some(anchor_border) = anchor_border {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        merge_y_min as u64,
                                        Some(merge_x_max as u64),
                                        Some(merge_y_min as u64),
                                        anchor_border,
                                    ));
                                } else {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        merge_y_min as u64,
                                        Some(merge_x_max as u64),
                                        Some(merge_y_min as u64),
                                        seg_border,
                                    ));
                                }

                                // Also keep parts outside the merged cell's x range at edge y
                                if (seg_x1 as i64) < merge_x_min {
                                    new_segments.push((
                                        seg_x1,
                                        merge_y_min as u64,
                                        Some((merge_x_min - 1) as u64),
                                        Some(merge_y_min as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_x2_val > merge_x_max {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        merge_y_min as u64,
                                        seg_x2,
                                        Some(merge_y_min as u64),
                                        seg_border,
                                    ));
                                } else if seg_x2.is_none() && merge_x_max < UNBOUNDED {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        merge_y_min as u64,
                                        None,
                                        Some(merge_y_min as u64),
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 3: Borders at y in (merge_y_min, merge_y_max] (inside)
                            // Clear the portion inside the merged cell's x-range,
                            // but KEEP the portions outside the merged cell's x-range
                            let inside_y_min = (merge_y_min + 1).max(seg_y1_i64);
                            let inside_y_max = merge_y_max.min(seg_y2_val);
                            if inside_y_min <= inside_y_max {
                                // There are y values inside the merged cell
                                // Output the x portions that are outside the merged cell
                                if (seg_x1 as i64) < merge_x_min {
                                    new_segments.push((
                                        seg_x1,
                                        inside_y_min as u64,
                                        Some((merge_x_min - 1) as u64),
                                        Some(inside_y_max as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_x2_val > merge_x_max {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        inside_y_min as u64,
                                        seg_x2,
                                        Some(inside_y_max as u64),
                                        seg_border,
                                    ));
                                } else if seg_x2.is_none() && merge_x_max < UNBOUNDED {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        inside_y_min as u64,
                                        None,
                                        Some(inside_y_max as u64),
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 4: Borders at y > merge_y_max (below the merged cell)
                            if seg_y2_val > merge_y_max {
                                let part_y1 = (merge_y_max + 1).max(seg_y1_i64);
                                new_segments.push((
                                    seg_x1,
                                    part_y1 as u64,
                                    seg_x2,
                                    seg_y2,
                                    seg_border,
                                ));
                            }
                        }
                        BorderSide::Bottom => {
                            // Bottom border: after +1 adjustment from borders_render.rs
                            // - y <= merge_y_min: above the merged cell, keep as-is
                            // - y in (merge_y_min, merge_y_max]: inside, should be cleared
                            // - y == merge_y_max + 1: bottom edge, extend with anchor's border
                            // - y > merge_y_max + 1: below the merged cell, keep as-is
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;

                            let seg_y1_i64 = seg_y1 as i64;
                            let seg_y2_val = seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED);
                            let seg_x2_val = seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED);

                            let bottom_edge_y = merge_y_max + 1;

                            // Part 1: Borders at y <= merge_y_min (above the inside region)
                            // These don't need adjustment for this merged cell, keep as-is
                            if seg_y1_i64 <= merge_y_min {
                                let part_y2 = merge_y_min.min(seg_y2_val);
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    seg_x2,
                                    Some(part_y2 as u64),
                                    seg_border,
                                ));
                            }

                            // Part 2: Borders at y in (merge_y_min, bottom_edge_y) (inside)
                            // Clear the portion inside the merged cell's x-range,
                            // but KEEP the portions outside the merged cell's x-range
                            let inside_y_min = (merge_y_min + 1).max(seg_y1_i64);
                            let inside_y_max = (bottom_edge_y - 1).min(seg_y2_val);
                            if inside_y_min <= inside_y_max {
                                // There are y values inside the merged cell
                                // Output the x portions that are outside the merged cell
                                if (seg_x1 as i64) < merge_x_min {
                                    new_segments.push((
                                        seg_x1,
                                        inside_y_min as u64,
                                        Some((merge_x_min - 1) as u64),
                                        Some(inside_y_max as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_x2_val > merge_x_max {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        inside_y_min as u64,
                                        seg_x2,
                                        Some(inside_y_max as u64),
                                        seg_border,
                                    ));
                                } else if seg_x2.is_none() && merge_x_max < UNBOUNDED {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        inside_y_min as u64,
                                        None,
                                        Some(inside_y_max as u64),
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 3: Borders at y == bottom_edge_y (the bottom edge)
                            // OR if the segment includes the anchor's bottom border (which
                            // would be inside after +1 adjustment), render at the bottom edge
                            let anchor_bottom_y = merge_y_min + 1; // anchor's bottom after +1
                            let includes_anchor_bottom =
                                seg_y1_i64 <= anchor_bottom_y && seg_y2_val >= anchor_bottom_y;
                            let includes_edge =
                                seg_y1_i64 <= bottom_edge_y && seg_y2_val >= bottom_edge_y;

                            if includes_anchor_bottom || includes_edge {
                                // Add the edge border spanning the full width of merged cell
                                // Use anchor's border as the source of truth
                                if let Some(anchor_border) = anchor_border {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        bottom_edge_y as u64,
                                        Some(merge_x_max as u64),
                                        Some(bottom_edge_y as u64),
                                        anchor_border,
                                    ));
                                } else {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        bottom_edge_y as u64,
                                        Some(merge_x_max as u64),
                                        Some(bottom_edge_y as u64),
                                        seg_border,
                                    ));
                                }

                                // Also keep parts outside the merged cell's x range at edge y
                                if (seg_x1 as i64) < merge_x_min {
                                    new_segments.push((
                                        seg_x1,
                                        bottom_edge_y as u64,
                                        Some((merge_x_min - 1) as u64),
                                        Some(bottom_edge_y as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_x2_val > merge_x_max {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        bottom_edge_y as u64,
                                        seg_x2,
                                        Some(bottom_edge_y as u64),
                                        seg_border,
                                    ));
                                } else if seg_x2.is_none() && merge_x_max < UNBOUNDED {
                                    new_segments.push((
                                        (merge_x_max + 1) as u64,
                                        bottom_edge_y as u64,
                                        None,
                                        Some(bottom_edge_y as u64),
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 4: Borders at y > bottom_edge_y (below the merged cell)
                            if seg_y2_val > bottom_edge_y {
                                let part_y1 = (bottom_edge_y + 1).max(seg_y1_i64);
                                new_segments.push((
                                    seg_x1,
                                    part_y1 as u64,
                                    seg_x2,
                                    seg_y2,
                                    seg_border,
                                ));
                            }
                        }
                        BorderSide::Left => {
                            // Left border: no +1 adjustment
                            // - x < merge_x_min: left of the merged cell, keep as-is
                            // - x == merge_x_min: left edge, extend with anchor border
                            // - x in (merge_x_min, merge_x_max]: inside, should be cleared
                            // - x > merge_x_max: right of the merged cell, keep as-is
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;

                            let seg_x1_i64 = seg_x1 as i64;
                            let seg_x2_val = seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED);
                            let seg_y2_val = seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED);

                            // Part 1: Borders at x < merge_x_min (left of the merged cell)
                            // These don't need adjustment, keep as-is
                            if seg_x1_i64 < merge_x_min {
                                let part_x2 = (merge_x_min - 1).min(seg_x2_val);
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    Some(part_x2 as u64),
                                    seg_y2,
                                    seg_border,
                                ));
                            }

                            // Part 2: Borders at x == merge_x_min (the left edge)
                            if seg_x1_i64 <= merge_x_min && seg_x2_val >= merge_x_min {
                                // Add the edge border spanning the full height of merged cell
                                if let Some(anchor_border) = anchor_border {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        merge_y_min as u64,
                                        Some(merge_x_min as u64),
                                        Some(merge_y_max as u64),
                                        anchor_border,
                                    ));
                                } else {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        merge_y_min as u64,
                                        Some(merge_x_min as u64),
                                        Some(merge_y_max as u64),
                                        seg_border,
                                    ));
                                }

                                // Also keep parts outside the merged cell's y range at edge x
                                if (seg_y1 as i64) < merge_y_min {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        seg_y1,
                                        Some(merge_x_min as u64),
                                        Some((merge_y_min - 1) as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_y2_val > merge_y_max {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(merge_x_min as u64),
                                        seg_y2,
                                        seg_border,
                                    ));
                                } else if seg_y2.is_none() && merge_y_max < UNBOUNDED {
                                    new_segments.push((
                                        merge_x_min as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(merge_x_min as u64),
                                        None,
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 3: Borders at x in (merge_x_min, merge_x_max] (inside)
                            // Clear the portion inside the merged cell's y-range,
                            // but KEEP the portions outside the merged cell's y-range
                            let inside_x_min = (merge_x_min + 1).max(seg_x1_i64);
                            let inside_x_max = merge_x_max.min(seg_x2_val);
                            if inside_x_min <= inside_x_max {
                                // There are x values inside the merged cell
                                // Output the y portions that are outside the merged cell
                                if (seg_y1 as i64) < merge_y_min {
                                    new_segments.push((
                                        inside_x_min as u64,
                                        seg_y1,
                                        Some(inside_x_max as u64),
                                        Some((merge_y_min - 1) as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_y2_val > merge_y_max {
                                    new_segments.push((
                                        inside_x_min as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(inside_x_max as u64),
                                        seg_y2,
                                        seg_border,
                                    ));
                                } else if seg_y2.is_none() && merge_y_max < UNBOUNDED {
                                    new_segments.push((
                                        inside_x_min as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(inside_x_max as u64),
                                        None,
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 4: Borders at x > merge_x_max (right of the merged cell)
                            if seg_x2_val > merge_x_max {
                                let part_x1 = (merge_x_max + 1).max(seg_x1_i64);
                                new_segments.push((
                                    part_x1 as u64,
                                    seg_y1,
                                    seg_x2,
                                    seg_y2,
                                    seg_border,
                                ));
                            }
                        }
                        BorderSide::Right => {
                            // Right border: after +1 adjustment from borders_render.rs
                            // - x <= merge_x_min: left of the merged cell, keep as-is
                            // - x in (merge_x_min, merge_x_max]: inside, should be cleared
                            // - x == merge_x_max + 1: right edge, extend with anchor's border
                            // - x > merge_x_max + 1: right of the merged cell, keep as-is
                            let merge_x_min = merged_cell.min.x;
                            let merge_x_max = merged_cell.max.x;
                            let merge_y_min = merged_cell.min.y;
                            let merge_y_max = merged_cell.max.y;

                            let seg_x1_i64 = seg_x1 as i64;
                            let seg_x2_val = seg_x2.map(|x| x as i64).unwrap_or(UNBOUNDED);
                            let seg_y2_val = seg_y2.map(|y| y as i64).unwrap_or(UNBOUNDED);

                            let right_edge_x = merge_x_max + 1;

                            // Part 1: Borders at x <= merge_x_min (left of the inside region)
                            // These don't need adjustment for this merged cell, keep as-is
                            if seg_x1_i64 <= merge_x_min {
                                let part_x2 = merge_x_min.min(seg_x2_val);
                                new_segments.push((
                                    seg_x1,
                                    seg_y1,
                                    Some(part_x2 as u64),
                                    seg_y2,
                                    seg_border,
                                ));
                            }

                            // Part 2: Borders at x in (merge_x_min, right_edge_x) (inside)
                            // Clear the portion inside the merged cell's y-range,
                            // but KEEP the portions outside the merged cell's y-range
                            let inside_x_min = (merge_x_min + 1).max(seg_x1_i64);
                            let inside_x_max = (right_edge_x - 1).min(seg_x2_val);
                            if inside_x_min <= inside_x_max {
                                // There are x values inside the merged cell
                                // Output the y portions that are outside the merged cell
                                if (seg_y1 as i64) < merge_y_min {
                                    new_segments.push((
                                        inside_x_min as u64,
                                        seg_y1,
                                        Some(inside_x_max as u64),
                                        Some((merge_y_min - 1) as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_y2_val > merge_y_max {
                                    new_segments.push((
                                        inside_x_min as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(inside_x_max as u64),
                                        seg_y2,
                                        seg_border,
                                    ));
                                } else if seg_y2.is_none() && merge_y_max < UNBOUNDED {
                                    new_segments.push((
                                        inside_x_min as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(inside_x_max as u64),
                                        None,
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 3: Borders at x == right_edge_x (the right edge)
                            // OR if the segment includes the anchor's right border (which
                            // would be inside after +1 adjustment), render at the right edge
                            let anchor_right_x = merge_x_min + 1; // anchor's right after +1
                            let includes_anchor_right =
                                seg_x1_i64 <= anchor_right_x && seg_x2_val >= anchor_right_x;
                            let includes_edge =
                                seg_x1_i64 <= right_edge_x && seg_x2_val >= right_edge_x;

                            if includes_anchor_right || includes_edge {
                                // Add the edge border spanning the full height of merged cell
                                // Use anchor's border as the source of truth
                                if let Some(anchor_border) = anchor_border {
                                    new_segments.push((
                                        right_edge_x as u64,
                                        merge_y_min as u64,
                                        Some(right_edge_x as u64),
                                        Some(merge_y_max as u64),
                                        anchor_border,
                                    ));
                                } else {
                                    new_segments.push((
                                        right_edge_x as u64,
                                        merge_y_min as u64,
                                        Some(right_edge_x as u64),
                                        Some(merge_y_max as u64),
                                        seg_border,
                                    ));
                                }

                                // Also keep parts outside the merged cell's y range at edge x
                                if (seg_y1 as i64) < merge_y_min {
                                    new_segments.push((
                                        right_edge_x as u64,
                                        seg_y1,
                                        Some(right_edge_x as u64),
                                        Some((merge_y_min - 1) as u64),
                                        seg_border,
                                    ));
                                }
                                if seg_y2_val > merge_y_max {
                                    new_segments.push((
                                        right_edge_x as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(right_edge_x as u64),
                                        seg_y2,
                                        seg_border,
                                    ));
                                } else if seg_y2.is_none() && merge_y_max < UNBOUNDED {
                                    new_segments.push((
                                        right_edge_x as u64,
                                        (merge_y_max + 1) as u64,
                                        Some(right_edge_x as u64),
                                        None,
                                        seg_border,
                                    ));
                                }
                            }

                            // Part 4: Borders at x > right_edge_x (right of the merged cell)
                            if seg_x2_val > right_edge_x {
                                let part_x1 = (right_edge_x + 1).max(seg_x1_i64);
                                new_segments.push((
                                    part_x1 as u64,
                                    seg_y1,
                                    seg_x2,
                                    seg_y2,
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
        grid::sheet::borders::{
            BorderSelection, BorderStyle, JsBorderHorizontal, JsBorderVertical,
        },
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

        let vertical = sheet
            .borders
            .vertical_borders(None, Some(&sheet.merge_cells))
            .unwrap();
        assert_eq!(
            vertical,
            vec![
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 2,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                },
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 5,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                }
            ]
        );
    }

    #[test]
    fn test_merged_cells_borders_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set borders on the merged cell
        gc.set_borders(
            A1Selection::test_a1("B2:D3"),
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

        let vertical = sheet
            .borders
            .vertical_borders(None, Some(&sheet.merge_cells))
            .unwrap();
        assert_eq!(
            vertical,
            vec![
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 2,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                },
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 5,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                }
            ]
        );
    }

    /// Test that when setting borders on a merged cell selection, borders are
    /// only stored at the anchor cell, but rendered for the entire merged cell.
    #[test]
    fn test_merged_cells_borders_only_anchor_stored() {
        use crate::Pos;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set borders on the merged cell range (B2:D3)
        gc.set_borders(
            A1Selection::test_a1("B2:D3"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // Verify borders are ONLY stored at the anchor cell (B2)
        // Anchor cell (B2 = x:2, y:2) should have borders
        let anchor_borders = sheet.borders.get_style_cell(Pos { x: 2, y: 2 });
        assert!(
            anchor_borders.top.is_some(),
            "Anchor should have top border"
        );
        assert!(
            anchor_borders.bottom.is_some(),
            "Anchor should have bottom border"
        );
        assert!(
            anchor_borders.left.is_some(),
            "Anchor should have left border"
        );
        assert!(
            anchor_borders.right.is_some(),
            "Anchor should have right border"
        );

        // Non-anchor cells should NOT have borders stored
        // C2 (x:3, y:2) - inside merged cell
        let c2_borders = sheet.borders.get_style_cell(Pos { x: 3, y: 2 });
        assert!(c2_borders.top.is_none(), "C2 should not have top border");
        assert!(
            c2_borders.bottom.is_none(),
            "C2 should not have bottom border"
        );
        assert!(c2_borders.left.is_none(), "C2 should not have left border");
        assert!(
            c2_borders.right.is_none(),
            "C2 should not have right border"
        );

        // D3 (x:4, y:3) - inside merged cell
        let d3_borders = sheet.borders.get_style_cell(Pos { x: 4, y: 3 });
        assert!(d3_borders.top.is_none(), "D3 should not have top border");
        assert!(
            d3_borders.bottom.is_none(),
            "D3 should not have bottom border"
        );
        assert!(d3_borders.left.is_none(), "D3 should not have left border");
        assert!(
            d3_borders.right.is_none(),
            "D3 should not have right border"
        );

        // But when rendered with merge_cells, borders should still appear correctly
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

        let vertical = sheet
            .borders
            .vertical_borders(None, Some(&sheet.merge_cells))
            .unwrap();
        assert_eq!(
            vertical,
            vec![
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 2,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                },
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 5,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                }
            ]
        );
    }

    /// Test that when setting only the bottom border on a merged cell,
    /// it renders at the bottom edge of the entire merged cell.
    #[test]
    fn test_merged_cells_bottom_border_only() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set only the bottom border on the merged cell range
        gc.set_borders(
            A1Selection::test_a1("B2:D3"),
            BorderSelection::Bottom,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // The bottom border should render at y=4 (bottom of the merged cell)
        let horizontal = sheet
            .borders
            .horizontal_borders(None, Some(&sheet.merge_cells));

        assert_eq!(
            horizontal,
            Some(vec![JsBorderHorizontal {
                color: BorderStyle::default().color,
                line: BorderStyle::default().line,
                x: 2,
                y: 4,
                width: Some(3),
                unbounded: false,
            }])
        );
    }

    /// Test that when selecting just the anchor cell (B2) of a merged cell
    /// and setting the bottom border, it still renders at the bottom edge
    /// of the entire merged cell.
    #[test]
    fn test_merged_cells_bottom_border_anchor_only() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set only the bottom border on just the anchor cell (B2)
        gc.set_borders(
            A1Selection::test_a1("B2"),
            BorderSelection::Bottom,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // The bottom border should still render at y=4 (bottom of the merged cell)
        let horizontal = sheet
            .borders
            .horizontal_borders(None, Some(&sheet.merge_cells));

        assert_eq!(
            horizontal,
            Some(vec![JsBorderHorizontal {
                color: BorderStyle::default().color,
                line: BorderStyle::default().line,
                x: 2,
                y: 4,
                width: Some(3),
                unbounded: false,
            }])
        );
    }

    /// Test that when selecting just the anchor cell (B2) of a merged cell
    /// and setting the right border, it still renders at the right edge
    /// of the entire merged cell.
    #[test]
    fn test_merged_cells_right_border_anchor_only() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set only the right border on just the anchor cell (B2)
        gc.set_borders(
            A1Selection::test_a1("B2"),
            BorderSelection::Right,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // The right border should render at x=5 (right of column D which is column 4)
        let vertical = sheet
            .borders
            .vertical_borders(None, Some(&sheet.merge_cells));

        assert_eq!(
            vertical,
            Some(vec![JsBorderVertical {
                color: BorderStyle::default().color,
                line: BorderStyle::default().line,
                x: 5,
                y: 2,
                height: Some(2),
                unbounded: false,
            }])
        );
    }

    /// Test that when selecting just the anchor cell (B2) of a merged cell
    /// and setting the left border, it renders at the left edge
    /// of the merged cell (which is the same as the anchor's left edge).
    #[test]
    fn test_merged_cells_left_border_anchor_only() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set only the left border on just the anchor cell (B2)
        gc.set_borders(
            A1Selection::test_a1("B2"),
            BorderSelection::Left,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // The left border should render at x=2 (left of the merged cell)
        // spanning the full height of the merged cell
        let vertical = sheet
            .borders
            .vertical_borders(None, Some(&sheet.merge_cells));

        assert_eq!(
            vertical,
            Some(vec![JsBorderVertical {
                color: BorderStyle::default().color,
                line: BorderStyle::default().line,
                x: 2,
                y: 2,
                height: Some(2),
                unbounded: false,
            }])
        );
    }

    /// Test that when selecting just the anchor cell (B2) of a merged cell
    /// and setting the top border, it renders at the top edge
    /// of the merged cell.
    #[test]
    fn test_merged_cells_top_border_anchor_only() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set only the top border on just the anchor cell (B2)
        gc.set_borders(
            A1Selection::test_a1("B2"),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // The top border should render at y=2 (top of the merged cell)
        // spanning the full width of the merged cell
        let horizontal = sheet
            .borders
            .horizontal_borders(None, Some(&sheet.merge_cells));

        assert_eq!(
            horizontal,
            Some(vec![JsBorderHorizontal {
                color: BorderStyle::default().color,
                line: BorderStyle::default().line,
                x: 2,
                y: 2,
                width: Some(3),
                unbounded: false,
            }])
        );
    }

    /// Test that borders outside a merged cell are not affected by the merged cell.
    /// When setting borders on A1:E5 with a merged cell at B2:D3, the top borders
    /// at A3 and E3 (outside the merged cell) should still render.
    #[test]
    fn test_merged_cells_borders_outside_not_affected() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set all borders on A1:E5 (larger than the merged cell)
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
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

        // Check that we have a border at y=3 for column A (x=1)
        let has_a3_top = horizontal
            .iter()
            .any(|b| b.y == 3 && b.x == 1 && b.width == Some(1));
        assert!(
            has_a3_top,
            "Should have top border at A3 (y=3, x=1). Borders: {:?}",
            horizontal
        );

        // Check that we have a border at y=3 for column E (x=5)
        let has_e3_top = horizontal
            .iter()
            .any(|b| b.y == 3 && b.x == 5 && b.width == Some(1));
        assert!(
            has_e3_top,
            "Should have top border at E3 (y=3, x=5). Borders: {:?}",
            horizontal
        );

        // Also check vertical borders - left border at C1 (x=3) should still exist
        // above and below the merged cell
        let vertical = sheet
            .borders
            .vertical_borders(None, Some(&sheet.merge_cells))
            .unwrap();

        // Check that we have a left border at x=3 for row 1 (above merged cell)
        let has_c1_left = vertical.iter().any(|b| b.x == 3 && b.y == 1);
        assert!(
            has_c1_left,
            "Should have left border at C1 (x=3, y=1). Vertical borders: {:?}",
            vertical
        );

        // Check that we have a left border at x=3 for rows 4-5 (below merged cell)
        let has_c4_left = vertical.iter().any(|b| b.x == 3 && b.y == 4);
        assert!(
            has_c4_left,
            "Should have left border at C4 (x=3, y=4). Vertical borders: {:?}",
            vertical
        );
    }

    /// Test that when clicking on a non-anchor cell (D3) within a merged cell
    /// and setting borders, the borders are redirected to the anchor cell (B2)
    /// and render correctly for the entire merged cell.
    #[test]
    fn test_merged_cells_borders_non_anchor_click() {
        use crate::Pos;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells B2:D3 (3x2 merged cell)
        gc.merge_cells(A1Selection::test_a1("B2:D3"), None, false);

        // Set all borders by clicking on D3 (non-anchor cell inside the merge)
        // This simulates what happens when a user clicks on D3 in the UI
        gc.set_borders(
            A1Selection::test_a1("D3"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // Borders should be stored only at the anchor cell (B2)
        let anchor_borders = sheet.borders.get_style_cell(Pos { x: 2, y: 2 });
        assert!(
            anchor_borders.top.is_some(),
            "Anchor should have top border"
        );
        assert!(
            anchor_borders.bottom.is_some(),
            "Anchor should have bottom border"
        );
        assert!(
            anchor_borders.left.is_some(),
            "Anchor should have left border"
        );
        assert!(
            anchor_borders.right.is_some(),
            "Anchor should have right border"
        );

        // D3 (the clicked cell) should NOT have borders stored
        let d3_borders = sheet.borders.get_style_cell(Pos { x: 4, y: 3 });
        assert!(d3_borders.top.is_none(), "D3 should not have top border");
        assert!(
            d3_borders.bottom.is_none(),
            "D3 should not have bottom border"
        );
        assert!(d3_borders.left.is_none(), "D3 should not have left border");
        assert!(
            d3_borders.right.is_none(),
            "D3 should not have right border"
        );

        // When rendered, borders should appear correctly at all edges
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

        let vertical = sheet
            .borders
            .vertical_borders(None, Some(&sheet.merge_cells))
            .unwrap();
        assert_eq!(
            vertical,
            vec![
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 2,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                },
                JsBorderVertical {
                    color: BorderStyle::default().color,
                    line: BorderStyle::default().line,
                    x: 5,
                    y: 2,
                    height: Some(2),
                    unbounded: false,
                }
            ]
        );
    }
}
