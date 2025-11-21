use crate::{
    Pos, Rect,
    a1::{A1Context, A1Selection, CellRefRange, RefRangeBounds},
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

fn is_anchor_aligned_with_left_rect_edge(
    anchor: Pos,
    selection: Rect,
    merge_cells: &MergeCells,
) -> bool {
    if anchor.x == selection.min.x {
        return true;
    }

    // check for any merged cells that are aligned with the left edge of the rect.
    let merged_cells = merge_cells.get_merge_cells(Rect::new(
        anchor.x,
        selection.min.y,
        anchor.x,
        selection.max.y,
    ));

    // check the left-most edge of the merged cells
    if let Some(edge) = merged_cells.iter().map(|cell| cell.min.x).min() {
        return edge == selection.min.x;
    }

    false
}

fn is_anchor_aligned_with_right_rect_edge(
    anchor: Pos,
    selection: Rect,
    merge_cells: &MergeCells,
) -> bool {
    if anchor.x == selection.max.x {
        return true;
    }

    // check for any merged cells that are aligned with the right edge of the rect.
    let merged_cells = merge_cells.get_merge_cells(Rect::new(
        anchor.x,
        selection.min.y,
        anchor.x,
        selection.max.y,
    ));

    // check the right-most edge of the merged cells
    if let Some(edge) = merged_cells.iter().map(|cell| cell.max.x).max() {
        return edge == selection.max.x;
    }

    false
}

fn is_anchor_aligned_with_top_rect_edge(
    anchor: Pos,
    selection: Rect,
    merge_cells: &MergeCells,
) -> bool {
    if anchor.y == selection.min.y {
        return true;
    }

    // check for any merged cells that are aligned with the left edge of the rect.
    let merged_cells = merge_cells.get_merge_cells(Rect::new(
        selection.min.x,
        anchor.y,
        selection.max.x,
        anchor.y,
    ));

    // check the top-most edge of the merged cells
    if let Some(edge) = merged_cells.iter().map(|cell| cell.min.y).min() {
        return edge == selection.min.y;
    }

    false
}

fn is_anchor_aligned_with_bottom_rect_edge(
    anchor: Pos,
    selection: Rect,
    merge_cells: &MergeCells,
) -> bool {
    if anchor.y == selection.max.y {
        return true;
    }

    // check for any merged cells that are aligned with the right edge of the rect.
    let merged_cells = merge_cells.get_merge_cells(Rect::new(
        selection.min.x,
        anchor.y,
        selection.max.x,
        anchor.y,
    ));

    // check the bottom-most edge of the merged cells
    if let Some(edge) = merged_cells.iter().map(|cell| cell.max.y).max() {
        return edge == selection.max.y;
    }

    false
}

fn grow_right(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.max.x += 1;

    // check if we have any partial merged cells and expand to include them
    loop {
        let mut included = false;
        let merged_cells = merge_cells.get_merge_cells(*rect);
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.union_in_place(merged_cell_rect);
                included = true;
            }
        }
        if !included {
            break;
        }
    }
}

fn grow_left(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.min.x -= 1;

    // we're at the boundary; nothing more to do
    if rect.min.x < 1 {
        rect.min.x = 1;
        return;
    }

    // check if we have any partial merged cells and expand to include them
    loop {
        let mut included = false;
        let merged_cells = merge_cells.get_merge_cells(*rect);
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.union_in_place(merged_cell_rect);
                included = true;
            }
        }
        if !included {
            break;
        }
    }
}

fn grow_down(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.max.y += 1;

    // check if we have any partial merged cells and expand to include them
    loop {
        let mut included = false;
        let merged_cells = merge_cells.get_merge_cells(*rect);
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.union_in_place(merged_cell_rect);
                included = true;
            }
        }
        if !included {
            break;
        }
    }
}

fn grow_up(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.min.y -= 1;

    // we're at the boundary; nothing more to do
    if rect.min.y < 1 {
        rect.min.y = 1;
        return;
    }

    // check if we have any partial merged cells and expand to include them
    loop {
        let mut included = false;
        let merged_cells = merge_cells.get_merge_cells(*rect);
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.union_in_place(merged_cell_rect);
                included = true;
            }
            if !included {
                break;
            }
        }
    }
}

fn shrink_left(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.min.x += 1;

    // need to loop through until we don't exclude any more cells
    loop {
        let merged_cells = merge_cells.get_merge_cells(*rect);
        let mut excluded = false;
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.min.x = merged_cell_rect.max.x + 1;
            }
            excluded = true;
        }
        if !excluded {
            break;
        }
    }
}

fn shrink_right(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.max.x -= 1;

    // need to loop through until we don't exclude any more cells
    loop {
        let merged_cells = merge_cells.get_merge_cells(*rect);
        let mut excluded = false;
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.max.x = merged_cell_rect.min.x - 1;
                excluded = true;
            }
        }
        if !excluded {
            break;
        }
    }
}

fn shrink_up(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.min.y += 1;

    // need to loop through until we don't exclude any more cells
    loop {
        let merged_cells = merge_cells.get_merge_cells(*rect);
        let mut excluded = false;
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.min.y = merged_cell_rect.max.y + 1;
            }
            excluded = true;
        }
        if !excluded {
            break;
        }
    }
}

fn shrink_down(rect: &mut Rect, merge_cells: &MergeCells) {
    rect.max.y -= 1;

    // need to loop through until we don't exclude any more cells
    loop {
        let merged_cells = merge_cells.get_merge_cells(*rect);
        let mut excluded = false;
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.max.y = merged_cell_rect.min.y - 1;
            }
            excluded = true;
        }
        if !excluded {
            break;
        }
    }
}

/// Core keyboard selection logic for sheet ranges
fn keyboard_select_sheet_range(
    range: &mut RefRangeBounds,
    anchor: Pos,
    delta_x: i64,
    delta_y: i64,
    _end_pos: &mut Pos,
    merge_cells: &MergeCells,
) {
    let mut rect = range.to_rect_unbounded();
    if delta_x > 0 {
        if is_anchor_aligned_with_left_rect_edge(anchor, rect, merge_cells) {
            grow_right(&mut rect, merge_cells);
        } else {
            shrink_left(&mut rect, merge_cells);
        }
    } else if delta_x < 0 {
        if is_anchor_aligned_with_right_rect_edge(anchor, rect, merge_cells) {
            grow_left(&mut rect, merge_cells);
        } else {
            shrink_right(&mut rect, merge_cells);
        }
    } else if delta_y > 0 {
        if is_anchor_aligned_with_top_rect_edge(anchor, rect, merge_cells) {
            grow_down(&mut rect, merge_cells);
        } else {
            shrink_up(&mut rect, merge_cells);
        }
    } else if delta_y < 0 {
        if is_anchor_aligned_with_bottom_rect_edge(anchor, rect, merge_cells) {
            grow_up(&mut rect, merge_cells);
        } else {
            shrink_down(&mut rect, merge_cells);
        }
    }

    *range = RefRangeBounds::new_relative_rect(rect);
    dbgjs!(&rect);
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
}
