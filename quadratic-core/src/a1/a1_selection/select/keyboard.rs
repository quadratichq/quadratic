use crate::{
    Pos, Rect,
    a1::{A1Context, A1Selection, CellRefRange, RefRangeBounds, select::helpers::expand_to_include_merge_cells},
    grid::{js_types::Direction, sheet::merge_cells::MergeCells},
};

impl A1Selection {
    /// Jumps the selection to the given col and row (found via jump_cursor)
    pub fn keyboard_jump_select_to(
        &mut self,
        col: i64,
        row: i64,
        direction: Direction,
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
                        self.keyboard_jump_select_to(col, row, direction, a1_context, merge_cells);
                    }
                }
                CellRefRange::Sheet { range } => {
                    keyboard_jump_select_sheet_range(
                        range,
                        self.cursor,
                        col,
                        row,
                        direction,
                        merge_cells,
                    );
                }
            }
        }
    }

    /// Extends or contracts selection from anchor point using keyboard (shift+arrow)
    ///
    /// The cursor position acts as the anchor (stays fixed during selection).
    ///
    /// # Arguments
    /// * `delta_x` - Horizontal movement (-1 left, +1 right)
    /// * `delta_y` - Vertical movement (-1 up, +1 down)
    /// * `a1_context` - A1 context for table lookups
    /// * `merge_cells` - Merged cells data
    pub fn keyboard_select_to(
        &mut self,
        delta_x: i64,
        delta_y: i64,
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
                        self.keyboard_select_to(delta_x, delta_y, a1_context, merge_cells);
                    }
                }
                CellRefRange::Sheet { range } => {
                    keyboard_select_sheet_range(range, self.cursor, delta_x, delta_y, merge_cells);
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
        }
        if !included {
            break;
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
                excluded = true;
            }
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
                excluded = true;
            }
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
                excluded = true;
            }
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
    merge_cells: &MergeCells,
) {
    let mut rect = range.to_rect_unbounded();

    // First, expand to include any merged cells that the current selection
    // overlaps with. This ensures that when starting from within a merged cell,
    // the entire merged cell is treated as the starting selection before
    // growing/shrinking. Without this, pressing Shift+Right from inside a merged
    // cell would require two keypresses to extend past the merged cell.
    expand_to_include_merge_cells(&mut rect, merge_cells);

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
}

fn keyboard_jump_select_sheet_range(
    range: &mut RefRangeBounds,
    anchor: Pos,
    col: i64,
    row: i64,
    direction: Direction,
    merge_cells: &MergeCells,
) {
    let mut rect = range.to_rect_unbounded();

    // Get the selection end (opposite corner from anchor)
    let selection_end = Pos {
        x: if anchor.x == rect.min.x {
            rect.max.x
        } else {
            rect.min.x
        },
        y: if anchor.y == rect.min.y {
            rect.max.y
        } else {
            rect.min.y
        },
    };

    // Apply fallback logic when jump lands on anchor position
    // This handles cases where the content-based jump would result in no selection change
    let (col, row) = match direction {
        Direction::Up => {
            // If jump landed on anchor row, fall back to row 1
            if row == anchor.y {
                (col, 1)
            } else {
                (col, row)
            }
        }
        Direction::Down => {
            // If jump landed on anchor row, fall back to one row past selection end
            if row == anchor.y {
                (col, selection_end.y + 1)
            } else {
                (col, row)
            }
        }
        Direction::Left => {
            // If jump landed on anchor column, fall back to column 1
            if col == anchor.x {
                (1, row)
            } else {
                (col, row)
            }
        }
        Direction::Right => {
            // If jump landed on anchor column, fall back to one column past selection end
            if col == anchor.x {
                (selection_end.x + 1, row)
            } else {
                (col, row)
            }
        }
    };

    let is_horizontal = matches!(direction, Direction::Left | Direction::Right);
    let is_vertical = matches!(direction, Direction::Up | Direction::Down);

    // Update x range based on jump target relative to anchor
    if anchor.x > col {
        // Jumping left of anchor: extend left
        rect.min.x = col;
        rect.max.x = anchor.x;
    } else if anchor.x < col {
        // Jumping right of anchor: extend right
        rect.max.x = col;
        rect.min.x = anchor.x;
    } else if is_horizontal {
        // Jumping horizontally but landed on anchor column: shrink to anchor column
        rect.min.x = anchor.x;
        rect.max.x = anchor.x;
    }
    // else: moving vertically (anchor.x == col), preserve existing x range

    // Update y range based on jump target relative to anchor
    if anchor.y > row {
        // Jumping above anchor: extend up
        rect.min.y = row;
        rect.max.y = anchor.y;
    } else if anchor.y < row {
        // Jumping below anchor: extend down
        rect.max.y = row;
        rect.min.y = anchor.y;
    } else if is_vertical {
        // Jumping vertically but landed on anchor row: shrink to anchor row
        rect.min.y = anchor.y;
        rect.max.y = anchor.y;
    }
    // else: moving horizontally (anchor.y == row), preserve existing y range

    // Expand selection to include any partially overlapping merged cells
    super::helpers::expand_to_include_merge_cells(&mut rect, merge_cells);

    *range = RefRangeBounds::new_relative_rect(rect);
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

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    selection.last_selection_end(&context),
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
        // When moving left past anchor, range gets normalized (C5:D8 instead of D5:C8)
        // End position is at the maximum coordinates (D8)
        assert_move(-1, 0, "C5:D8", "D8");
        assert_move(0, -1, "C5:D7", "D7");
        assert_move(0, -1, "C5:D6", "D6");
        assert_move(0, -1, "C5:D5", "D5");
        assert_move(0, -1, "C4:D5", "D5");
        // When moving right from C4, the range gets normalized to D4:D5
        assert_move(1, 0, "D4:D5", "D5");
        assert_move(1, 0, "D4:E5", "E5");
    }

    #[test]
    fn test_keyboard_select_with_merged_cell_growing() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E10"));

        // Start at B7, merged cell at C5:E10
        let mut selection = A1Selection::test_a1("B7");

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    selection.last_selection_end(&context),
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        // Move right: target C7 (inside merged cell C5:E10)
        // Selection expands to B5:E10, end_pos stays at C7 (inside merged cell)
        assert_move(1, 0, "B5:E10", "E10");

        // Move right again: end_pos is inside merged cell, so exit to F7
        // But end position is at the end of the merged cell range
        assert_move(1, 0, "B5:F10", "F10");

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

        let mut assert_move =
            |delta_x: i64, delta_y: i64, expected_selection: &str, expected_end: &str| {
                selection.keyboard_select_to(delta_x, delta_y, &context, &merge_cells);
                assert_eq!(
                    selection.test_to_string(),
                    expected_selection,
                    "Selection should be at {}",
                    expected_selection
                );
                assert_eq!(
                    selection.last_selection_end(&context),
                    Pos::test_a1(expected_end),
                    "End should be at {}",
                    expected_end
                );
            };

        // Move up: D12 -> D11 (range gets normalized)
        // End position is at the maximum coordinate (D12)
        assert_move(0, -1, "D11:D12", "D12");

        // Move up: target D10 (inside merged cell C5:E10)
        // Selection expands to include the full merged cell C5:E10, resulting in C5:E12
        // End position is at the end of the merged cell range
        assert_move(0, -1, "C5:E12", "E12");

        // Move up again: continue growing up from C5 to C4
        // Since anchor D12 is at the bottom edge, we continue to grow upward
        assert_move(0, -1, "C4:E12", "E12");
    }

    #[test]
    fn test_keyboard_select_empty_selection() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start with empty selection (no ranges)
        let mut selection = A1Selection {
            sheet_id: crate::grid::SheetId::TEST,
            cursor: Pos::test_a1("B3"),
            ranges: vec![],
        };

        // First keyboard select should initialize the selection
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B3:C3");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("C3"));
    }

    #[test]
    fn test_keyboard_select_boundary_left_edge() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start at A5 (leftmost column)
        let mut selection = A1Selection::test_a1("A5");

        // Try to move left - should stop at column 1
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        // Selection should remain at A5 since we're already at the left edge
        assert_eq!(selection.test_to_string(), "A5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("A5"));

        // Move right first to create a selection
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A5:B5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("B5"));

        // Now move left - should shrink back to A5
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("A5"));
    }

    #[test]
    fn test_keyboard_select_boundary_top_edge() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start at B1 (topmost row)
        let mut selection = A1Selection::test_a1("B1");

        // Try to move up - should stop at row 1
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        // Selection should remain at B1 since we're already at the top edge
        assert_eq!(selection.test_to_string(), "B1");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("B1"));

        // Move down first to create a selection
        selection.keyboard_select_to(0, 1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B1:B2");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("B2"));

        // Now move up - should shrink back to B1
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B1");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("B1"));
    }

    #[test]
    fn test_keyboard_select_all_directions() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        let mut selection = A1Selection::test_a1("D5");

        // Right
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D5:E5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E5"));

        // Down
        selection.keyboard_select_to(0, 1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D5:E6");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E6"));

        // Left
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D5:D6");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D6"));

        // Up
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D5"));
    }

    #[test]
    fn test_keyboard_select_grow_right_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("E5:G7"));

        // Start at C5, anchor at C5
        let mut selection = A1Selection::test_a1("C5");

        // Move right to D5
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "C5:D5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D5"));

        // Move right to E5 (enters merged cell E5:G7)
        // Selection should expand to include full merged cell
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "C5:G7");
        // End position is at the end of the merged cell range
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("G7"));
    }

    /// Tests that pressing Shift+Right from inside a merged cell extends
    /// the selection past the merged cell in a single keypress.
    #[test]
    fn test_keyboard_select_from_inside_merged_cell_right() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B2:D4"));

        // Start at B2 (anchor of merged cell B2:D4)
        let mut selection = A1Selection::test_a1("B2");

        // Move right - should first expand to full merged cell, then extend right
        // So the result should be B2:E4 (not just B2:D4)
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2:E4");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E4"));

        // Move right again
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2:F4");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("F4"));
    }

    /// Tests that pressing Shift+Left from inside a merged cell extends
    /// the selection past the merged cell in a single keypress.
    #[test]
    fn test_keyboard_select_from_inside_merged_cell_left() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4"));

        // Start at E4 (bottom-right of merged cell C2:E4)
        let mut selection = A1Selection::test_a1("E4");
        selection.cursor = Pos::test_a1("E4");

        // Move left - should first expand to full merged cell, then extend left
        // So the result should be B2:E4 (not just C2:E4)
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2:E4");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E4"));
    }

    /// Tests that pressing Shift+Down from inside a merged cell extends
    /// the selection past the merged cell in a single keypress.
    #[test]
    fn test_keyboard_select_from_inside_merged_cell_down() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B2:D4"));

        // Start at B2 (anchor of merged cell B2:D4)
        let mut selection = A1Selection::test_a1("B2");

        // Move down - should first expand to full merged cell, then extend down
        // So the result should be B2:D5 (not just B2:D4)
        selection.keyboard_select_to(0, 1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2:D5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D5"));
    }

    /// Tests that pressing Shift+Up from inside a merged cell extends
    /// the selection past the merged cell in a single keypress.
    #[test]
    fn test_keyboard_select_from_inside_merged_cell_up() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5"));

        // Start at D5 (bottom-right of merged cell B3:D5)
        let mut selection = A1Selection::test_a1("D5");
        selection.cursor = Pos::test_a1("D5");

        // Move up - should first expand to full merged cell, then extend up
        // So the result should be B2:D5 (not just B3:D5)
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2:D5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D5"));
    }

    #[test]
    fn test_keyboard_select_grow_left_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B5:D7"));

        // Start at F5, anchor at F5
        let mut selection = A1Selection::test_a1("F5");

        // Move left to E5
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "E5:F5");
        // End position is at the maximum coordinate (F5, the anchor)
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("F5"));

        // Move left to D5 (enters merged cell B5:D7)
        // Selection should expand to include full merged cell
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B5:F7");
        // End position is at the maximum coordinate (F7)
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("F7"));
    }

    #[test]
    fn test_keyboard_select_grow_down_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C6:E8"));

        // Start at C4, anchor at C4
        let mut selection = A1Selection::test_a1("C4");

        // Move down to C5
        selection.keyboard_select_to(0, 1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "C4:C5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("C5"));

        // Move down to C6 (enters merged cell C6:E8)
        // Selection should expand to include full merged cell
        selection.keyboard_select_to(0, 1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "C4:E8");
        // End position is at the end of the merged cell range
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E8"));
    }

    #[test]
    fn test_keyboard_select_grow_up_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C4:E6"));

        // Start at C8, anchor at C8
        let mut selection = A1Selection::test_a1("C8");

        // Move up to C7
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "C7:C8");
        // End position is at the maximum coordinate (C8)
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("C8"));

        // Move up to C6 (enters merged cell C4:E6)
        // Selection should expand to include full merged cell (horizontally too)
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "C4:E8");
        // End position is at the end of the merged cell range
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E8"));
    }

    #[test]
    fn test_keyboard_select_shrink_left_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E7"));

        // Start with selection B5:F7 that includes merged cell
        let mut selection = A1Selection::test_a1("B5:F7");

        // Anchor is at B5, end is at F7
        // Move left to E7 - should shrink but still include merged cell
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        // Since anchor is at left edge (B5), moving left shrinks from right
        // But merged cell C5:E7 must remain fully included
        assert_eq!(selection.test_to_string(), "B5:E7");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E7"));
    }

    #[test]
    fn test_keyboard_select_shrink_right_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E7"));

        // Start with selection B5:F7 that includes merged cell
        // Anchor is at F7 (right edge)
        let mut selection = A1Selection::test_a1("B5:F7");
        selection.cursor = Pos::test_a1("F7"); // Set anchor to right edge

        // Move right to C5 - should shrink but still include merged cell
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        // Since anchor is at right edge (F7), moving right shrinks from left
        // But merged cell C5:E7 must remain fully included
        assert_eq!(selection.test_to_string(), "C5:F7");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("F7"));
    }

    #[test]
    fn test_keyboard_select_shrink_up_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E7"));

        // Start with selection C4:E8 that includes merged cell
        // Anchor is at C8 (bottom edge)
        let mut selection = A1Selection::test_a1("C4:E8");
        selection.cursor = Pos::test_a1("C8"); // Set anchor to bottom edge

        // Move up to C5 - should shrink but still include merged cell
        selection.keyboard_select_to(0, 1, &context, &merge_cells);
        // Since anchor is at bottom edge (C8), moving up shrinks from top
        // But merged cell C5:E7 must remain fully included
        assert_eq!(selection.test_to_string(), "C5:E8");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E8"));
    }

    #[test]
    fn test_keyboard_select_shrink_down_with_merged_cell() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:E7"));

        // Start with selection C4:E8 that includes merged cell
        // Anchor is at C4 (top edge)
        let mut selection = A1Selection::test_a1("C4:E8");

        // Move down to C5 - should shrink but still include merged cell
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        // Since anchor is at top edge (C4), moving down shrinks from bottom
        // But merged cell C5:E7 must remain fully included
        assert_eq!(selection.test_to_string(), "C4:E7");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E7"));
    }

    #[test]
    fn test_keyboard_select_multiple_merged_cells() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5"));
        merge_cells.merge_cells(Rect::test_a1("F3:H5"));

        // Start at A3, move right through both merged cells
        let mut selection = A1Selection::test_a1("A3");

        // Move right to B3 (enters first merged cell)
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A3:D5");
        // End position is at the end of the merged cell range
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D5"));

        // Move right to E3 (exits first merged cell, between merged cells)
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A3:E5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E5"));

        // Move right to F3 (enters second merged cell)
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A3:H5");
        // End position is at the end of the merged cell range
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("H5"));
    }

    #[test]
    fn test_keyboard_select_anchor_at_corner() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start with selection B2:D4, anchor at top-left (B2)
        let mut selection = A1Selection::test_a1("B2:D4");

        // Move right - should grow right (anchor aligned with left edge)
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2:E4");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E4"));

        // Move down - should grow down (anchor aligned with top edge)
        selection.keyboard_select_to(0, 1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2:E5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E5"));
    }

    #[test]
    fn test_keyboard_select_anchor_at_bottom_right() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start with selection B2:D4, anchor at bottom-right (D4)
        let mut selection = A1Selection::test_a1("B2:D4");
        selection.cursor = Pos::test_a1("D4"); // Set anchor to bottom-right

        // Move left - should grow left (anchor aligned with right edge)
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A2:D4");

        // End position is at the anchor (D4) since it's the maximum coordinate
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D4"));

        // Move up - should grow up (anchor aligned with bottom edge)
        selection.keyboard_select_to(0, -1, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1:D4");

        // End position is still at the anchor (D4)
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D4"));
    }

    #[test]
    fn test_keyboard_select_reverse_direction() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start at D5, move right to create D5:F5
        let mut selection = A1Selection::test_a1("D5");
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D5:F5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("F5"));

        // Now move left - should shrink from right
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D5:E5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("E5"));

        // Move left again - should shrink to single cell
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D5");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("D5"));
    }

    #[test]
    fn test_keyboard_select_large_range() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start at A1, create large selection
        let mut selection = A1Selection::test_a1("A1");

        // Move right 10 columns
        for _ in 0..10 {
            selection.keyboard_select_to(1, 0, &context, &merge_cells);
        }
        assert_eq!(selection.test_to_string(), "A1:K1");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("K1"));

        // Move down 10 rows
        for _ in 0..10 {
            selection.keyboard_select_to(0, 1, &context, &merge_cells);
        }
        assert_eq!(selection.test_to_string(), "A1:K11");
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("K11"));
    }

    #[test]
    fn test_keyboard_select_with_merged_cell_partial_overlap() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C5:F8"));

        // Start at B6, move right to D6
        // D6 is inside merged cell C5:F8, so selection should expand
        let mut selection = A1Selection::test_a1("B6");

        selection.keyboard_select_to(1, 0, &context, &merge_cells);
        // When moving right to C6, it enters merged cell C5:F8, so selection expands
        assert_eq!(selection.test_to_string(), "B5:F8");
        // End position is at the end of the merged cell range
        assert_eq!(selection.last_selection_end(&context), Pos::test_a1("F8"));
    }

    #[test]
    fn test_keyboard_jump_select_preserves_perpendicular_range() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start at C5, jump-select left to A5, then jump-select up to row 1
        // This simulates: at C5, cmd+shift+left to A5:C5, then cmd+shift+up to A1:C5
        let mut selection = A1Selection::test_a1("C5");

        // Jump select left to A5 (should create A5:C5)
        selection.keyboard_jump_select_to(1, 5, Direction::Left, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A5:C5");
        assert_eq!(selection.cursor, Pos::test_a1("C5")); // cursor stays at C5

        // Jump select up to row 1 (should create A1:C5, preserving A-C columns)
        selection.keyboard_jump_select_to(3, 1, Direction::Up, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1:C5");
        assert_eq!(selection.cursor, Pos::test_a1("C5")); // cursor stays at C5

        // Test the reverse: start wide horizontally, then extend vertically the other way
        let mut selection = A1Selection::test_a1("C5");
        selection.keyboard_jump_select_to(1, 5, Direction::Left, &context, &merge_cells); // A5:C5
        selection.keyboard_jump_select_to(3, 10, Direction::Down, &context, &merge_cells); // Should be A5:C10
        assert_eq!(selection.test_to_string(), "A5:C10");

        // Test preserving y range when jumping horizontally
        let mut selection = A1Selection::test_a1("C5");
        selection.keyboard_jump_select_to(3, 1, Direction::Up, &context, &merge_cells); // C1:C5
        assert_eq!(selection.test_to_string(), "C1:C5");

        // Now jump select right (should preserve 1-5 row range)
        selection.keyboard_jump_select_to(10, 5, Direction::Right, &context, &merge_cells); // Should be C1:J5
        assert_eq!(selection.test_to_string(), "C1:J5");
    }

    /// Tests cmd+shift+arrow selection behavior with content at C4 and C5.
    ///
    /// Scenario:
    /// 1. Content on C4 and C5
    /// 2. Select C4:C5 (cursor at C4)
    /// 3. cmd+shift+left should give A4:C5
    /// 4. cmd+shift+up should give A1:C4 (preserving columns A-C, but Y resets to anchor row 4)
    /// 5. From A4:C5, cmd+shift+right should give C4:D5
    /// 6. cmd+shift+left should return to A4:C5
    #[test]
    fn test_keyboard_jump_select_from_multi_row_selection() {
        let context = A1Context::default();
        let merge_cells = MergeCells::default();

        // Start with C4:C5 selection (cursor at C4)
        let mut selection = A1Selection::test_a1("C4:C5");
        assert_eq!(selection.cursor, Pos::test_a1("C4"));

        // cmd+shift+left: jump to column A
        // The frontend calculates jump target from selectionEnd (C5), jumping left lands at A5
        // So we call keyboard_jump_select_to(1, 5)
        selection.keyboard_jump_select_to(1, 5, Direction::Left, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:C5");

        // cmd+shift+up: jump to row 1
        // The frontend would normally jump from selectionEnd (C5) and find C4 (content boundary).
        // Since that equals the cursor, frontend falls back to row 1.
        // So we call keyboard_jump_select_to(3, 1)
        // This preserves columns A-C but sets Y range from row 1 to anchor row 4
        selection.keyboard_jump_select_to(3, 1, Direction::Up, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1:C4"); // Preserves A-C columns, Y resets to anchor

        // Now test the right+left sequence from A4:C5
        let mut selection = A1Selection::test_a1("C4:C5");
        selection.keyboard_jump_select_to(1, 5, Direction::Left, &context, &merge_cells); // A4:C5
        assert_eq!(selection.test_to_string(), "A4:C5");

        // cmd+shift+right: jump to column D
        // The frontend calculates jump target from selectionEnd (C5), jumping right lands at D5
        // So we call keyboard_jump_select_to(4, 5)
        selection.keyboard_jump_select_to(4, 5, Direction::Right, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "C4:D5"); // Shrinks to cursor column C through D

        // cmd+shift+left: jump back to column A
        // The frontend calculates jump target from selectionEnd (D5), jumping left lands at A5
        // So we call keyboard_jump_select_to(1, 5)
        selection.keyboard_jump_select_to(1, 5, Direction::Left, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:C5"); // Should expand back to A through C
    }

    /// Tests that cmd+shift+arrow expands selection to include merged cells.
    ///
    /// Scenario: Merged cell at D4:F7, start at A4, cmd+shift+right to D4
    /// should expand to include the full merge cell, resulting in A4:F7.
    #[test]
    fn test_keyboard_jump_select_expands_to_merge_cells() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create merged cell D4:F7
        merge_cells.merge_cells(Rect::test_a1("D4:F7"));

        // Start at A4
        let mut selection = A1Selection::test_a1("A4");
        assert_eq!(selection.cursor, Pos::test_a1("A4"));

        // cmd+shift+right: jump to column D (where merge cell starts)
        // The jump lands at D4, which is part of merged cell D4:F7
        // Selection should expand to include the full merge cell
        selection.keyboard_jump_select_to(4, 4, Direction::Right, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:F7"); // Expands to include full merge cell

        // Test jumping into merge cell from above
        let mut selection = A1Selection::test_a1("D1");
        // cmd+shift+down: jump to row 4 (top of merge cell)
        selection.keyboard_jump_select_to(4, 4, Direction::Down, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "D1:F7"); // Expands to include full merge cell

        // Test jumping past merge cell
        let mut selection = A1Selection::test_a1("A4");
        // cmd+shift+right: jump to column H (past the merge cell)
        selection.keyboard_jump_select_to(8, 4, Direction::Right, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:H7"); // Expands to include merge cell in path
    }

    /// Tests shrinking selection back through merged cells.
    ///
    /// Scenario: Merged cell at D4:F7, start at A4, extend right past merge cell,
    /// then shrink back with cmd+shift+left.
    #[test]
    fn test_keyboard_jump_select_shrink_through_merge_cells() {
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();
        // Create merged cell D4:F7
        merge_cells.merge_cells(Rect::test_a1("D4:F7"));

        // Start at A4
        let mut selection = A1Selection::test_a1("A4");

        // cmd+shift+right twice: first to merge cell, then past it
        selection.keyboard_jump_select_to(4, 4, Direction::Right, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:F7"); // Includes merge cell

        selection.keyboard_jump_select_to(7, 7, Direction::Right, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:G7"); // Past merge cell

        // cmd+shift+left: should shrink back to merge cell boundary
        selection.keyboard_jump_select_to(6, 7, Direction::Left, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:F7"); // Back to merge cell edge

        // cmd+shift+left again: should shrink to anchor column
        selection.keyboard_jump_select_to(1, 7, Direction::Left, &context, &merge_cells);
        assert_eq!(selection.test_to_string(), "A4:A7"); // Shrink to anchor column
    }
}
