use crate::Pos;
use crate::a1::{CellRefRangeEnd, RefRangeBounds};

use super::helpers::{calculate_forward_range, calculate_reverse_range};

/// Normalizes a selection range based on the anchor point and new position
/// Returns the updated cursor position
pub(super) fn normalize_selection(
    range: &mut RefRangeBounds,
    column: i64,
    row: i64,
    original_cursor: Pos,
    adjusted_start_opt: Option<(i64, i64)>,
    state: &mut super::super::SelectionState,
) -> Pos {
    // If start was adjusted, update the range start as well
    if let Some((start_x, start_y)) = adjusted_start_opt {
        // Determine forward vs reverse based on anchor position relative to range
        // Reverse: anchor is at range.end, cursor at range.start
        let use_reverse = !state.is_drag() && range.is_finite() && {
            let range_start = (range.start.col(), range.start.row());
            let range_end = (range.end.col(), range.end.row());
            let anchor_pos = (state.anchor.x, state.anchor.y);
            let cursor_pos = (original_cursor.x, original_cursor.y);
            // Reverse if cursor is at start and anchor is at end
            cursor_pos == range_start && anchor_pos == range_end
        };

        if use_reverse {
            // Reverse keyboard selection: cursor is at range.end (anchor)
            // Use the actual current range start/end to determine reversing axes
            let current_start = Pos {
                x: range.start.col(),
                y: range.start.row(),
            };
            let current_end = Pos {
                x: range.end.col(),
                y: range.end.row(),
            };
            // Calculate reverse range - this determines which axis is reversing
            let (calc_start_x, calc_start_y, calc_end_x, calc_end_y) =
                calculate_reverse_range(original_cursor, column, row, current_start, current_end);
            // Apply adjusted start if provided (from merged cell handling)
            let final_start_x = start_x.min(calc_start_x);
            let final_start_y = start_y.min(calc_start_y);
            let final_end_x = calc_end_x;
            let final_end_y = calc_end_y;

            range.start = CellRefRangeEnd::new_relative_xy(final_start_x, final_start_y);
            range.end = CellRefRangeEnd::new_relative_xy(final_end_x, final_end_y);

            // Return original cursor position (anchor)
            original_cursor
        } else {
            // Forward selection or drag - normal normalization
            // For drag: don't preserve perpendicular bounds, just use anchor to new position
            // For keyboard: preserve perpendicular bounds when moving in one axis
            let (current_start_opt, current_end_opt) = if !state.is_drag() && range.is_finite() {
                // Keyboard selection: pass current bounds for perpendicular axis preservation
                let current_start = Pos {
                    x: range.start.col(),
                    y: range.start.row(),
                };
                let current_end = Pos {
                    x: range.end.col(),
                    y: range.end.row(),
                };
                (Some(current_start), Some(current_end))
            } else {
                // Drag or unbounded: don't pass current bounds, just use anchor to new
                (None, None)
            };
            let (min_x, min_y, max_x, max_y) = calculate_forward_range(
                original_cursor,
                column,
                row,
                current_start_opt,
                current_end_opt,
            );

            range.start = CellRefRangeEnd::new_relative_xy(min_x, min_y);
            range.end = CellRefRangeEnd::new_relative_xy(max_x, max_y);

            // For both keyboard and drag selection, cursor stays at anchor (the fixed point)
            original_cursor
        }
    } else {
        // No start adjustment - just set the end coordinate
        // We still need to normalize the range to ensure start <= end
        // For keyboard selection, use cursor position as the anchor point
        // to preserve the original selection start during reverse selection
        let anchor_x = original_cursor.x;
        let anchor_y = original_cursor.y;

        // Determine forward vs reverse based on anchor position relative to range
        // Reverse: anchor is at range.end, cursor at range.start
        let use_reverse = !state.is_drag() && range.is_finite() && {
            let range_start = (range.start.col(), range.start.row());
            let range_end = (range.end.col(), range.end.row());
            let anchor_pos = (state.anchor.x, state.anchor.y);
            let cursor_pos = (original_cursor.x, original_cursor.y);
            // Reverse if cursor is at start and anchor is at end
            cursor_pos == range_start && anchor_pos == range_end
        };

        if use_reverse {
            // Reverse keyboard selection: cursor is at range.end (anchor)
            let current_start = Pos {
                x: range.start.col(),
                y: range.start.row(),
            };
            let current_end = Pos {
                x: range.end.col(),
                y: range.end.row(),
            };
            let (final_start_x, final_start_y, final_end_x, final_end_y) = calculate_reverse_range(
                Pos {
                    x: anchor_x,
                    y: anchor_y,
                },
                column,
                row,
                current_start,
                current_end,
            );

            range.start = CellRefRangeEnd::new_relative_xy(final_start_x, final_start_y);
            range.end = CellRefRangeEnd::new_relative_xy(final_end_x, final_end_y);

            // Return original cursor position (anchor)
            original_cursor
        } else {
            // Forward selection or drag - normal normalization
            // For drag: don't preserve perpendicular bounds, just use anchor to new position
            // For keyboard: preserve perpendicular bounds when moving in one axis
            let (current_start_opt, current_end_opt) = if !state.is_drag() && range.is_finite() {
                // Keyboard selection: pass current bounds for perpendicular axis preservation
                let current_start = Pos {
                    x: range.start.col(),
                    y: range.start.row(),
                };
                let current_end = Pos {
                    x: range.end.col(),
                    y: range.end.row(),
                };
                (Some(current_start), Some(current_end))
            } else {
                // Drag or unbounded: don't pass current bounds, just use anchor to new
                (None, None)
            };
            let (min_x, min_y, max_x, max_y) = calculate_forward_range(
                Pos {
                    x: anchor_x,
                    y: anchor_y,
                },
                column,
                row,
                current_start_opt,
                current_end_opt,
            );

            range.start = CellRefRangeEnd::new_relative_xy(min_x, min_y);
            range.end = CellRefRangeEnd::new_relative_xy(max_x, max_y);

            // For both keyboard and drag selection, cursor stays at anchor (the fixed point)
            original_cursor
        }
    }
}
