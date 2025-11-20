use crate::{
    Pos, Rect,
    a1::{A1Context, A1Selection, CellRefRange, CellRefRangeEnd},
    grid::sheet::merge_cells::MergeCells,
};

impl A1Selection {
    /// Extends or contracts selection from anchor point using keyboard (shift+arrow)
    ///
    /// The cursor position acts as the anchor (stays fixed during selection).
    /// The end_pos tracks the current selection end and moves with each arrow press.
    ///
    /// # Arguments
    /// * `delta_x` - Horizontal movement (-1 left, +1 right)
    /// * `delta_y` - Vertical movement (-1 up, +1 down)
    /// * `end_pos` - Current selection end position (mutable, updated during movement)
    /// * `a1_context` - A1 context for table lookups
    /// * `merge_cells` - Merged cells data
    pub fn keyboard_select_to(
        &mut self,
        delta_x: i64,
        delta_y: i64,
        end_pos: &mut Pos,
        a1_context: &A1Context,
        merge_cells: &MergeCells,
    ) {
        // If selection is empty, initialize with cursor as anchor
        if self.ranges.is_empty() {
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        }

        if let Some(last) = self.ranges.last_mut() {
            match last {
                CellRefRange::Table { range } => {
                    // Convert table to sheet range for keyboard selection
                    if let Some(range_converted) = range
                        .clone()
                        .convert_to_ref_range_bounds(false, a1_context, false, false)
                    {
                        *last = CellRefRange::Sheet {
                            range: range_converted,
                        };
                        // Recursively handle as sheet range
                        self.keyboard_select_to(delta_x, delta_y, end_pos, a1_context, merge_cells);
                    }
                }
                CellRefRange::Sheet { range } => {
                    keyboard_select_sheet_range(
                        range,
                        self.cursor,
                        delta_x,
                        delta_y,
                        end_pos,
                        merge_cells,
                    );
                }
            }
        }
    }
}

/// Core keyboard selection logic for sheet ranges
fn keyboard_select_sheet_range(
    range: &mut crate::a1::RefRangeBounds,
    anchor: Pos,
    delta_x: i64,
    delta_y: i64,
    end_pos: &mut Pos,
    merge_cells: &MergeCells,
) {
    // Check if end_pos is currently inside a merged cell
    if let Some(merged_rect) = merge_cells.get_merge_cell_rect(*end_pos) {
        // Exit the merged cell in the direction of movement
        *end_pos = exit_merged_cell(merged_rect, *end_pos, delta_x, delta_y);
    } else {
        // Calculate target position by applying delta
        let mut target_pos = Pos::new((end_pos.x + delta_x).max(1), (end_pos.y + delta_y).max(1));

        // If end_pos is aligned with merged cells in the selection, skip past
        // them in the direction of movement
        let current_rect = range.to_rect_unbounded();
        let merged_cells_in_selection = merge_cells.get_merge_cells(current_rect);

        // Track the furthest skip to avoid checking the same merged cell multiple times
        let mut furthest_skip_x = target_pos.x;
        let mut furthest_skip_y = target_pos.y;

        for merged_rect in &merged_cells_in_selection {
            // Check if end_pos is outside the merged cell but aligned with it
            let is_outside_horizontally =
                end_pos.x < merged_rect.min.x || end_pos.x > merged_rect.max.x;
            let is_outside_vertically =
                end_pos.y < merged_rect.min.y || end_pos.y > merged_rect.max.y;

            // If moving vertically and horizontally aligned with merged cell
            if delta_y != 0 && !is_outside_vertically && is_outside_horizontally {
                if delta_y > 0 && target_pos.y <= merged_rect.max.y {
                    // Moving down and target is within merged cell's y-range: skip past it
                    furthest_skip_y = furthest_skip_y.max(merged_rect.max.y + 1);
                } else if delta_y < 0 && target_pos.y >= merged_rect.min.y {
                    // Moving up and target is within merged cell's y-range: skip past it
                    furthest_skip_y = furthest_skip_y.min(merged_rect.min.y - 1);
                }
            }

            // If moving horizontally and vertically aligned with merged cell
            if delta_x != 0 && !is_outside_horizontally && is_outside_vertically {
                if delta_x > 0 && target_pos.x <= merged_rect.max.x {
                    // Moving right and target is within merged cell's x-range: skip past it
                    furthest_skip_x = furthest_skip_x.max(merged_rect.max.x + 1);
                } else if delta_x < 0 && target_pos.x >= merged_rect.min.x {
                    // Moving left and target is within merged cell's x-range: skip past it
                    furthest_skip_x = furthest_skip_x.min(merged_rect.min.x - 1);
                }
            }
        }

        target_pos.x = furthest_skip_x;
        target_pos.y = furthest_skip_y;

        // Check if target is inside a merged cell
        if let Some(merged_rect) = merge_cells.get_merge_cell_rect(target_pos) {
            // Determine if we're growing (moving away from anchor) or shrinking (moving toward anchor)
            let is_growing = is_growing_from_anchor(anchor, *end_pos, delta_x, delta_y);

            if is_growing {
                // Growing: keep end_pos at target (inside merged cell)
                *end_pos = target_pos;
            } else {
                // Shrinking: skip over merged cell, exit on opposite side
                *end_pos = exit_merged_cell(merged_rect, target_pos, delta_x, delta_y);
            }
        } else {
            // Normal case: target is not in a merged cell
            *end_pos = target_pos;
        }
    }

    // Update range based on anchor and end_pos, including all partial merged cells
    // Start with anchor:end_pos range
    range.start = CellRefRangeEnd::new_relative_xy(anchor.x, anchor.y);
    range.end = CellRefRangeEnd::new_relative_xy(end_pos.x, end_pos.y);

    // Recursively expand to include any partially overlapping merged cells
    expand_for_partial_merged_cells(range, anchor, merge_cells);
}

/// Determines if movement is growing away from anchor or shrinking toward it
fn is_growing_from_anchor(anchor: Pos, end_pos: Pos, delta_x: i64, delta_y: i64) -> bool {
    // Calculate current distance from anchor
    let current_dx = end_pos.x - anchor.x;
    let current_dy = end_pos.y - anchor.y;

    // Calculate new position and its distance from anchor
    let new_x = end_pos.x + delta_x;
    let new_y = end_pos.y + delta_y;
    let new_dx = new_x - anchor.x;
    let new_dy = new_y - anchor.y;

    // Growing if absolute distance increases or we cross anchor (change sign)
    if delta_x != 0 {
        let growing = new_dx.abs() > current_dx.abs()
            || (current_dx != 0 && new_dx != 0 && current_dx.signum() != new_dx.signum());
        return growing;
    }

    if delta_y != 0 {
        let growing = new_dy.abs() > current_dy.abs()
            || (current_dy != 0 && new_dy != 0 && current_dy.signum() != new_dy.signum());
        return growing;
    }

    false
}

/// Exits a merged cell in the direction of movement
/// Returns the position one cell past the merged cell edge
fn exit_merged_cell(merged_rect: Rect, _current_pos: Pos, delta_x: i64, delta_y: i64) -> Pos {
    if delta_x > 0 {
        // Moving right: exit to right edge + 1, preserve y within merged cell bounds
        Pos::new(merged_rect.max.x + 1, _current_pos.y)
    } else if delta_x < 0 {
        // Moving left: exit to left edge - 1, preserve y within merged cell bounds
        Pos::new(merged_rect.min.x - 1, _current_pos.y)
    } else if delta_y > 0 {
        // Moving down: exit to bottom edge + 1, preserve x within merged cell bounds
        Pos::new(_current_pos.x, merged_rect.max.y + 1)
    } else if delta_y < 0 {
        // Moving up: exit to top edge - 1, preserve x within merged cell bounds
        Pos::new(_current_pos.x, merged_rect.min.y - 1)
    } else {
        // No movement
        _current_pos
    }
}

/// Recursively expands selection to fully include any partially overlapping merged cells
fn expand_for_partial_merged_cells(
    range: &mut crate::a1::RefRangeBounds,
    anchor: Pos,
    merge_cells: &MergeCells,
) {
    const MAX_ITERATIONS: usize = 100; // Prevent infinite loops
    let mut iterations = 0;

    loop {
        iterations += 1;
        if iterations > MAX_ITERATIONS {
            // Safety: prevent infinite loops
            break;
        }

        let current_rect = range.to_rect_unbounded();
        let intersecting = merge_cells.get_merge_cells(current_rect);

        let mut needs_expansion = false;
        let mut union_rect = current_rect;
        let mut merged_cells_bounds = Rect::new(i64::MAX, i64::MAX, i64::MIN, i64::MIN);

        for merged_rect in &intersecting {
            // If merged cell is not fully contained, we need to expand
            if !current_rect.contains_rect(merged_rect) {
                // Track the bounds of all merged cells
                if needs_expansion {
                    merged_cells_bounds = Rect::new(
                        merged_cells_bounds.min.x.min(merged_rect.min.x),
                        merged_cells_bounds.min.y.min(merged_rect.min.y),
                        merged_cells_bounds.max.x.max(merged_rect.max.x),
                        merged_cells_bounds.max.y.max(merged_rect.max.y),
                    );
                } else {
                    merged_cells_bounds = *merged_rect;
                }

                // Union with this merged cell
                union_rect = Rect::new(
                    union_rect.min.x.min(merged_rect.min.x),
                    union_rect.min.y.min(merged_rect.min.y),
                    union_rect.max.x.max(merged_rect.max.x),
                    union_rect.max.y.max(merged_rect.max.y),
                );
                needs_expansion = true;
            }
        }

        if needs_expansion {
            // When merged cells are involved, expand to include them
            let end_pos = Pos::new(range.end.col(), range.end.row());

            // The final selection should span from anchor to the union
            let start_x = anchor.x.min(union_rect.min.x);
            let start_y = anchor.y.min(union_rect.min.y);
            let end_x = anchor.x.max(union_rect.max.x);
            let end_y = anchor.y.max(union_rect.max.y);

            // Clamp to not go beyond the actual merged cell extents when end_pos is outside them
            let clamped_start_y = if end_pos.y < merged_cells_bounds.min.y {
                // end_pos is above merged cells, clamp to merged cell top
                start_y.max(merged_cells_bounds.min.y)
            } else {
                start_y
            };
            let clamped_start_x = if end_pos.x < merged_cells_bounds.min.x {
                // end_pos is left of merged cells, clamp to merged cell left
                start_x.max(merged_cells_bounds.min.x)
            } else {
                start_x
            };

            range.start = CellRefRangeEnd::new_relative_xy(clamped_start_x, clamped_start_y);
            range.end = CellRefRangeEnd::new_relative_xy(end_x, end_y);
        } else {
            // No expansion needed, we're done
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Rect;

    #[test]
    fn test_keyboard_select_clockwise() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start at D5
        let mut selection = A1Selection::test_a1("D5");
        let mut end = Pos::test_a1("D5");

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &mut end, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    end,
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        // Clockwise movement: right, down, left, up
        assert_move(1, 0, "D5:E5", "E5");
        assert_move(1, 0, "D5:F5", "F5");
        assert_move(1, 0, "D5:G5", "G5");
        assert_move(0, 1, "D5:G6", "G6");
        assert_move(0, 1, "D5:G7", "G7");
        assert_move(0, 1, "D5:G8", "G8");
        assert_move(-1, 0, "D5:F8", "F8");
        assert_move(-1, 0, "D5:E8", "E8");
        assert_move(-1, 0, "D5:D8", "D8");
        assert_move(-1, 0, "D5:C8", "C8");
        assert_move(0, -1, "D5:C7", "C7");
        assert_move(0, -1, "D5:C6", "C6");
        assert_move(0, -1, "D5:C5", "C5");
        assert_move(0, -1, "D5:C4", "C4");
        assert_move(1, 0, "D5:D4", "D4");
        assert_move(1, 0, "D5:E4", "E4");
    }

    #[test]
    fn test_keyboard_select_with_merged_cell_growing() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E10"));

        // Start at B7, merged cell at C5:E10
        let mut selection = A1Selection::test_a1("B7");
        let mut end = Pos::test_a1("B7");

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &mut end, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    end,
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        // Move right: target C7 (inside merged cell C5:E10)
        // Selection expands to B5:E10, end_pos stays at C7
        assert_move(1, 0, "B5:E10", "C7");

        // Move right again: end_pos is inside merged cell, so exit to F7
        assert_move(1, 0, "B5:F10", "F7");

        // Move down: normal movement
        assert_move(0, 1, "B5:F11", "F11");
    }

    #[test]
    fn test_keyboard_select_with_merged_cell_shrinking() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E10"));

        // Start at D12, anchor at D12
        let mut selection = A1Selection::test_a1("D12");
        let mut end = Pos::test_a1("D12");

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &mut end, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    end,
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        // Move up: D12 -> D11
        assert_move(0, -1, "D12:D11", "D11");

        // Move up: target D10 (inside merged cell C5:E10)
        // Selection expands to C5:E12 (includes full merged cell to avoid partial inclusion)
        assert_move(0, -1, "C5:E12", "D10");

        // Move up again: end_pos is inside merged cell, exit to D4
        // Selection stays C5:E12 since it still includes the merged cell
        assert_move(0, -1, "C5:E12", "D4");
    }

    #[test]
    fn test_exit_merged_cell() {
        let merged_rect = Rect::test_a1("C5:E10");
        let pos = Pos::test_a1("D7");

        // Exit right
        assert_eq!(exit_merged_cell(merged_rect, pos, 1, 0), Pos::test_a1("F7"));

        // Exit left
        assert_eq!(
            exit_merged_cell(merged_rect, pos, -1, 0),
            Pos::test_a1("B7")
        );

        // Exit down
        assert_eq!(
            exit_merged_cell(merged_rect, pos, 0, 1),
            Pos::test_a1("D11")
        );

        // Exit up
        assert_eq!(
            exit_merged_cell(merged_rect, pos, 0, -1),
            Pos::test_a1("D4")
        );
    }

    #[test]
    fn test_is_growing_from_anchor() {
        let anchor = Pos::test_a1("D5");

        // Starting at anchor, moving right: growing
        assert!(is_growing_from_anchor(anchor, anchor, 1, 0));

        // At E5, moving right: growing
        assert!(is_growing_from_anchor(anchor, Pos::test_a1("E5"), 1, 0));

        // At E5, moving left: shrinking
        assert!(!is_growing_from_anchor(anchor, Pos::test_a1("E5"), -1, 0));

        // At C5 (left of anchor), moving left: growing
        assert!(is_growing_from_anchor(anchor, Pos::test_a1("C5"), -1, 0));

        // At C5, moving right: shrinking
        assert!(!is_growing_from_anchor(anchor, Pos::test_a1("C5"), 1, 0));
    }
}
