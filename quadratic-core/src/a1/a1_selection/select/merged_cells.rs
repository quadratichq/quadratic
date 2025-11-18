// use std::collections::HashSet;

// use crate::a1::{A1Context, A1Selection};
// use crate::grid::sheet::merge_cells::MergeCells;
// use crate::{Pos, Rect};

// use super::helpers::*;

// /// Adjusts selection end position to align with merged cell boundaries when selection includes merged cells
// /// Returns (adjusted_end_x, adjusted_end_y, optional_adjusted_start)
// pub(crate) fn adjust_selection_end_for_merged_cells(
//     selection: &A1Selection,
//     new_x: i64,
//     new_y: i64,
//     a1_context: &A1Context,
//     merge_cells: Option<&MergeCells>,
// ) -> (i64, i64, Option<(i64, i64)>) {
// //     let Some(merge_cells) = merge_cells else {
// //         return (new_x, new_y, None);
// //     };

// //     let (start_x, start_y) = get_selection_start_position(selection, a1_context, state);

// //     // Early return if current selection doesn't contain merged cells, new position isn't in a merged cell,
// //     // and the potential selection (from start to new position) doesn't overlap with any merged cells
// //     if !selection.contains_merged_cells(a1_context, Some(merge_cells)) {
// //         // Check if the new position is in a merged cell - if so, we still need to adjust
// //         if merge_cells
// //             .get_merge_cell_rect(Pos { x: new_x, y: new_y })
// //             .is_none()
// //         {
// //             // Check if the potential selection overlaps with any merged cells
// //             // Expand the search area to catch merged cells that extend beyond the potential selection
// //             let potential_selection = Rect::new(
// //                 start_x.min(new_x),
// //                 start_y.min(new_y),
// //                 start_x.max(new_x),
// //                 start_y.max(new_y),
// //             );
// //             let search_rect = Rect::new(
// //                 potential_selection.min.x - 100,
// //                 potential_selection.min.y - 100,
// //                 potential_selection.max.x + 100,
// //                 potential_selection.max.y + 100,
// //             );
// //             let overlapping_merged_cells = merge_cells.get_merge_cells(search_rect);
// //             // Check if any of the found merged cells actually overlap with the potential selection
// //             let has_overlap = overlapping_merged_cells
// //                 .iter()
// //                 .any(|merge_rect| merge_rect.intersects(potential_selection));
// //             if !has_overlap {
// //                 return (new_x, new_y, None);
// //             }
// //         }
// //     }
// //     let (current_selection_end, current_bounds) = get_current_selection_info(selection, a1_context);

// //     // Use SelectionState to determine the correct reference point for shrink calculations
// //     // For reverse selection (keyboard only), use cursor (anchor); for forward/drag, use start position
// //     // Determine if reverse: anchor at range.end, cursor at range.start
// //     let is_reverse = !state.is_drag() && {
// //         if let Some(super::super::CellRefRange::Sheet { range }) = selection.ranges.last() {
// //             if range.is_finite() {
// //                 let range_start = (range.start.col(), range.start.row());
// //                 let range_end = (range.end.col(), range.end.row());
// //                 let anchor_pos = (state.anchor.x, state.anchor.y);
// //                 let cursor_pos = (selection.cursor.x, selection.cursor.y);
// //                 cursor_pos == range_start && anchor_pos == range_end
// //             } else {
// //                 false
// //             }
// //         } else {
// //             false
// //         }
// //     };

// //     let (shrink_ref_x, shrink_ref_y) = if !state.is_drag() {
// //         if is_reverse {
// //             // Reverse keyboard selection - use cursor position (anchor) for shrink reference
// //             (selection.cursor.x, selection.cursor.y)
// //         } else {
// //             // Forward keyboard selection - use start position
// //             (start_x, start_y)
// //         }
// //     } else {
// //         // Drag selection - always use start position
// //         (start_x, start_y)
// //     };

// //     let mut selection_rect = create_initial_selection_rect(
// //         selection,
// //         start_x,
// //         start_y,
// //         new_x,
// //         new_y,
// //         current_bounds,
// //         state,
// //     );

// //     let (shrinking_x, shrinking_y) = determine_shrink_behavior(
// //         selection,
// //         shrink_ref_x,
// //         shrink_ref_y,
// //         new_x,
// //         new_y,
// //         current_selection_end,
// //     );

// //     // Convert current_selection_end to Pos for use in adjust_rect_for_merged_cells
// //     let current_selection_end_pos =
// //         current_selection_end
// //             .map(|(x, y)| Pos { x, y })
// //             .unwrap_or(Pos {
// //                 x: start_x,
// //                 y: start_y,
// //             });

// //     adjust_rect_for_merged_cells(
// //         selection,
// //         &mut selection_rect,
// //         start_x,
// //         start_y,
// //         new_x,
// //         new_y,
// //         shrinking_x,
// //         shrinking_y,
// //         merge_cells,
// //         state,
// //         current_selection_end_pos,
// //     );

// //     // Use SelectionState to determine the correct reference point for direction calculation
// //     // For reverse selection (keyboard only), use cursor (anchor); for forward/drag, use start position
// //     let (dir_ref_x, dir_ref_y) = if !state.is_drag() {
// //         if is_reverse {
// //             // Reverse keyboard selection - use cursor position (anchor) for direction
// //             (selection.cursor.x, selection.cursor.y)
// //         } else {
// //             // Forward keyboard selection - use start position for direction
// //             (start_x, start_y)
// //         }
// //     } else {
// //         // Drag selection - always use start position for direction
// //         (start_x, start_y)
// //     };

// //     calculate_adjusted_positions(
// //         selection,
// //         selection_rect,
// //         dir_ref_x,
// //         dir_ref_y,
// //         new_x,
// //         new_y,
// //     )
// // }

// // pub(super) fn adjust_rect_for_merged_cells(
// //     _selection: &A1Selection,
// //     selection_rect: &mut Rect,
// //     start_x: i64,
// //     start_y: i64,
// //     new_x: i64,
// //     new_y: i64,
// //     _shrinking_x: bool,
// //     _shrinking_y: bool,
// //     merge_cells: &MergeCells,
// //     _state: &super::super::SelectionState,
// //     _current_selection_end: crate::Pos,
// // ) {
// //     // Build the "potential" selection rect from start to end
// //     // This represents what the selection WOULD be if we didn't have current bounds
// //     // We need this to find merged cells that the selection overlaps, even if we're shrinking
// //     let potential_selection = Rect::new(
// //         start_x.min(new_x),
// //         start_y.min(new_y),
// //         start_x.max(new_x),
// //         start_y.max(new_y),
// //     );

// //     // Build search rect that includes potential selection, current selection, start, and end positions
// //     // We need to expand the search rect to catch merged cells that extend beyond the potential selection
// //     // This is important because merged cells that overlap with the selection might extend beyond it
// //     let search_rect = Rect::new(
// //         potential_selection
// //             .min
// //             .x
// //             .min(selection_rect.min.x)
// //             .min(start_x)
// //             .min(new_x)
// //             - 100,
// //         potential_selection
// //             .min
// //             .y
// //             .min(selection_rect.min.y)
// //             .min(start_y)
// //             .min(new_y)
// //             - 100,
// //         potential_selection
// //             .max
// //             .x
// //             .max(selection_rect.max.x)
// //             .max(start_x)
// //             .max(new_x)
// //             + 100,
// //         potential_selection
// //             .max
// //             .y
// //             .max(selection_rect.max.y)
// //             .max(start_y)
// //             .max(new_y)
// //             + 100,
// //     );

// //     // Find all merged cells that overlap with potential selection or contain the end position
// //     // Use nondefault_rects_in_rect_combined to get complete merged cell rects
// //     let mut merged_cells_to_include = HashSet::<Rect>::new();

// //     // Get all merged cells in the search area
// //     for merge_rect in merge_cells.get_merge_cells(search_rect) {
// //         // Check if this merged cell overlaps with the potential selection
// //         // For drag: only check potential_selection (start to new position)
// //         // For keyboard: check both potential and current selection
// //         let overlaps_potential = merge_rect.intersects(potential_selection);
// //         let _overlaps_current = merge_rect.intersects(*selection_rect);

// //         // Include merged cells that overlap with potential selection
// //         // RULE: If selection contains ANY cell of a merged cell, include the ENTIRE merged cell
// //         // This applies to both expanding and shrinking, both keyboard and drag
// //         let should_include = overlaps_potential;

// //         if should_include {
// //             merged_cells_to_include.insert(merge_rect);
// //         }
// //     }

// //     // Also check if end position is within a merged cell
// //     // RULE: If selection contains ANY cell of a merged cell, include the ENTIRE merged cell
// //     if let Some(end_merge_rect) = merge_cells.get_merge_cell_rect(crate::Pos { x: new_x, y: new_y })
// //     {
// //         // Always include the merged cell at the end position if it overlaps with potential selection
// //         if end_merge_rect.intersects(potential_selection) {
// //             merged_cells_to_include.insert(end_merge_rect);
// //         }
// //     }

// //     // Expand selection to fully include all overlapping merged cells
// //     // When dragging, check overlap with potential_selection to ensure we include merged cells
// //     // even if current selection_rect has been shrunk
// //     // Iterate until no more changes (in case expansion reveals new overlapping merged cells)
// //     loop {
// //         let mut changed = false;

// //         for merge_rect in &merged_cells_to_include {
// //             // Check overlap with potential selection
// //             let overlaps_potential = merge_rect.intersects(potential_selection);

// //             // Expand to include merged cells that overlap with potential selection
// //             // RULE: If selection contains ANY cell of a merged cell, include the ENTIRE merged cell
// //             // This applies to both expanding and shrinking, both keyboard and drag

// //             if overlaps_potential {
// //                 // Expand to fully include this merged cell
// //                 if selection_rect.min.x > merge_rect.min.x {
// //                     selection_rect.min.x = merge_rect.min.x;
// //                     changed = true;
// //                 }
// //                 if selection_rect.min.y > merge_rect.min.y {
// //                     selection_rect.min.y = merge_rect.min.y;
// //                     changed = true;
// //                 }
// //                 if selection_rect.max.x < merge_rect.max.x {
// //                     selection_rect.max.x = merge_rect.max.x;
// //                     changed = true;
// //                 }
// //                 if selection_rect.max.y < merge_rect.max.y {
// //                     selection_rect.max.y = merge_rect.max.y;
// //                     changed = true;
// //                 }
// //             }
// //         }

// //         // If we expanded, check for newly overlapping merged cells
// //         // After expanding, we need to check ALL merged cells that overlap with the
// //         // current expanded selection_rect, not just those in a search area.
// //         // This ensures that when we expand to include a merged cell, we catch any
// //         // other merged cells that now overlap with the expanded selection.
// //         if changed {
// //             // Check for merged cells that overlap with the current expanded selection_rect
// //             // Expand the search area slightly to catch edge cases
// //             let expanded_search = Rect::new(
// //                 selection_rect.min.x.min(start_x).min(new_x) - 1,
// //                 selection_rect.min.y.min(start_y).min(new_y) - 1,
// //                 selection_rect.max.x.max(start_x).max(new_x) + 1,
// //                 selection_rect.max.y.max(start_y).max(new_y) + 1,
// //             );

// //             // Get all merged cells in the expanded search area
// //             let newly_found_merged_cells = merge_cells.get_merge_cells(expanded_search);

// //             // Check each newly found merged cell to see if it overlaps
// //             // RULE: If selection contains ANY cell of a merged cell, include the ENTIRE merged cell
// //             for merge_rect in newly_found_merged_cells {
// //                 let overlaps = merge_rect.intersects(*selection_rect)
// //                     || merge_rect.intersects(potential_selection);

// //                 if overlaps {
// //                     merged_cells_to_include.insert(merge_rect);
// //                 }
// //             }
// //         } else {
// //             break;
// //         }
// //     }
// }
