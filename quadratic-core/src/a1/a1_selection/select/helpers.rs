use super::super::{A1Selection, CellRefRange};
use crate::Pos;
use crate::a1::A1Context;

impl A1Selection {
    /// Helper to reposition cursor after removing a range, ensuring it stays within valid selections
    pub(crate) fn reposition_cursor_after_removal(
        &mut self,
        removed_pos: i64,
        fallback_pos: i64,
        a1_context: &A1Context,
        is_column: bool,
    ) {
        if self.contains_pos(self.cursor, a1_context) {
            return;
        }

        let try_positions = [
            (removed_pos + 1, fallback_pos),
            (removed_pos - 1, fallback_pos),
            (removed_pos + 1, fallback_pos), // default fallback
        ];

        for (primary, secondary) in try_positions {
            let test_pos = if is_column {
                Pos {
                    x: primary,
                    y: secondary,
                }
            } else {
                Pos {
                    x: secondary,
                    y: primary,
                }
            };
            if self.contains_pos(test_pos, a1_context) {
                self.cursor = test_pos;
                return;
            }
        }

        // If no valid position found, use fallback
        if is_column {
            self.cursor.x = fallback_pos;
        } else {
            self.cursor.y = fallback_pos;
        }
    }

    pub(crate) fn ensure_non_empty_ranges(
        &mut self,
        _removed_pos: i64,
        fallback_pos: i64,
        is_column: bool,
    ) {
        if self.ranges.is_empty() {
            if is_column {
                self.cursor.x = fallback_pos;
            } else {
                self.cursor.y = fallback_pos;
            }
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        }
    }
}

// /// Gets current selection end and bounds information
// pub(super) fn get_current_selection_info(
//     selection: &A1Selection,
//     a1_context: &A1Context,
// ) -> (Option<(i64, i64)>, Option<(i64, i64, i64, i64)>) {
//     if let Some(last_range) = selection.ranges.last() {
//         match last_range {
//             CellRefRange::Sheet { range } => {
//                 if range.is_finite() {
//                     let end = Some((range.end.col(), range.end.row()));
//                     let bounds = Some((
//                         range.start.col(),
//                         range.start.row(),
//                         range.end.col(),
//                         range.end.row(),
//                     ));
//                     (end, bounds)
//                 } else {
//                     (None, None)
//                 }
//             }
//             CellRefRange::Table { range } => {
//                 if let Some(rect) = range.to_largest_rect(a1_context) {
//                     let end = Some((rect.max.x, rect.max.y));
//                     let bounds = Some((rect.min.x, rect.min.y, rect.max.x, rect.max.y));
//                     (end, bounds)
//                 } else {
//                     (None, None)
//                 }
//             }
//         }
//     } else {
//         (None, None)
//     }
// }

// /// Determines if we're shrinking or expanding in each axis
// pub(super) fn determine_shrink_behavior(
//     _selection: &A1Selection,
//     start_x: i64,
//     start_y: i64,
//     new_x: i64,
//     new_y: i64,
//     current_selection_end: Option<(i64, i64)>,
// ) -> (bool, bool) {
//     if let Some((current_end_x, current_end_y)) = current_selection_end {
//         let delta_x = new_x - start_x;
//         let delta_y = new_y - start_y;
//         let current_delta_x = current_end_x - start_x;
//         let current_delta_y = current_end_y - start_y;

//         // Check if we're shrinking in X direction
//         let shrinking_x = delta_x != 0
//             && ((delta_x > 0 && current_delta_x > 0 && new_x < current_end_x)
//                 || (delta_x < 0 && current_delta_x < 0 && new_x > current_end_x)
//                 || (delta_x > 0 && current_delta_x < 0)
//                 || (delta_x < 0 && current_delta_x > 0));

//         // Check if we're shrinking in Y direction
//         let shrinking_y = delta_y != 0
//             && ((delta_y > 0 && current_delta_y > 0 && new_y < current_end_y)
//                 || (delta_y < 0 && current_delta_y < 0 && new_y > current_end_y)
//                 || (delta_y > 0 && current_delta_y < 0)
//                 || (delta_y < 0 && current_delta_y > 0));

//         (shrinking_x, shrinking_y)
//     } else {
//         (false, false)
//     }
// }

// /// Calculates the final adjusted positions based on the selection rectangle
// pub(super) fn calculate_adjusted_positions(
//     _selection: &A1Selection,
//     selection_rect: Rect,
//     start_x: i64,
//     start_y: i64,
//     new_x: i64,
//     new_y: i64,
// ) -> (i64, i64, Option<(i64, i64)>) {
//     let targets_right = new_x >= start_x;
//     let targets_down = new_y >= start_y;

//     let adjusted_end_x = if targets_right {
//         selection_rect.max.x
//     } else {
//         selection_rect.min.x
//     };

//     let adjusted_end_y = if targets_down {
//         selection_rect.max.y
//     } else {
//         selection_rect.min.y
//     };

//     let adjusted_start_x = if targets_right {
//         selection_rect.min.x
//     } else {
//         selection_rect.max.x
//     };

//     let adjusted_start_y = if targets_down {
//         selection_rect.min.y
//     } else {
//         selection_rect.max.y
//     };

//     let adjusted_start = if adjusted_start_x != start_x || adjusted_start_y != start_y {
//         Some((adjusted_start_x, adjusted_start_y))
//     } else {
//         None
//     };

//     (adjusted_end_x, adjusted_end_y, adjusted_start)
// }

// /// Calculates a forward selection range (anchor at start, extending to new position)
// /// Returns (start_x, start_y, end_x, end_y)
// pub(super) fn calculate_forward_range(
//     anchor: Pos,
//     col: i64,
//     row: i64,
//     _current_start: Option<Pos>,
//     _current_end: Option<Pos>,
// ) -> (i64, i64, i64, i64) {
//     // With anchor-based selection, always calculate range from anchor to new position
//     // The anchor is fixed, so we don't need to preserve perpendicular axis bounds
//     // This allows proper shrinking and expanding in all directions
//     (
//         anchor.x.min(col),
//         anchor.y.min(row),
//         anchor.x.max(col),
//         anchor.y.max(row),
//     )
// }

// /// Calculates a reverse selection range (anchor at end, extending toward/away from anchor)
// /// Returns (start_x, start_y, end_x, end_y)
// pub(super) fn calculate_reverse_range(
//     anchor: Pos,
//     col: i64,
//     row: i64,
//     _current_start: Pos,
//     _current_end: Pos,
// ) -> (i64, i64, i64, i64) {
//     // With anchor-based selection, always calculate range from anchor to new position
//     // The anchor is fixed, so calculation is the same as forward
//     // This allows proper shrinking and expanding in all directions
//     (
//         anchor.x.min(col),
//         anchor.y.min(row),
//         anchor.x.max(col),
//         anchor.y.max(row),
//     )
// }
