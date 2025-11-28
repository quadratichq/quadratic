//! RefRangeBounds selection methods, eg, selectRow, selectColumn, moveTo, etc.

use wasm_bindgen::prelude::*;

use crate::wasm_bindings::merge_cells::JsMergeCells;

use super::*;

#[wasm_bindgen]
impl JsSelection {
    /// Selects the entire sheet.
    #[wasm_bindgen(js_name = "selectAll")]
    pub fn select_all(&mut self, append: bool) {
        self.selection.select_all(append);
    }

    #[wasm_bindgen(js_name = "selectColumn")]
    pub fn select_column(
        &mut self,
        column: u32,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,
        top: u32,
        context: &JsA1Context,
    ) {
        self.selection.select_column(
            column as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            top as i64,
            context.get_context(),
        );
    }

    #[wasm_bindgen(js_name = "selectRow")]
    pub fn select_row(
        &mut self,
        row: u32,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,
        left: u32,
        context: &JsA1Context,
    ) {
        self.selection.select_row(
            row as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            left as i64,
            context.get_context(),
        );
    }

    #[wasm_bindgen(js_name = "selectRect")]
    pub fn select_rect(&mut self, left: u32, top: u32, right: u32, bottom: u32, append: bool) {
        self.selection
            .select_rect(left as i64, top as i64, right as i64, bottom as i64, append);
    }

    #[wasm_bindgen(js_name = "keyboardSelectTo")]
    pub fn keyboard_select_to(
        &mut self,
        x: i32,
        y: i32,
        context: &JsA1Context,
        merge_cells: &JsMergeCells,
    ) {
        self.selection.keyboard_select_to(
            x as i64,
            y as i64,
            context.get_context(),
            merge_cells.get_merge_cells(),
        );
    }

    #[wasm_bindgen(js_name = "keyboardJumpSelectTo")]
    pub fn keyboard_jump_select_to(
        &mut self,
        col: u32,
        row: u32,
        context: &JsA1Context,
        merge_cells: &JsMergeCells,
    ) {
        self.selection.keyboard_jump_select_to(
            col as i64,
            row as i64,
            context.get_context(),
            merge_cells.get_merge_cells(),
        );
    }

    #[wasm_bindgen(js_name = "selectTo")]
    pub fn select_to(
        &mut self,
        x: u32,
        y: u32,
        append: bool,
        context: &JsA1Context,
        merge_cells: &JsMergeCells,
    ) {
        self.selection.select_to(
            x as i64,
            y as i64,
            append,
            context.get_context(),
            merge_cells.get_merge_cells(),
        );
    }

    // /// Adjusts the selection for merged cells (for mouse drag operations).
    // /// This should be called after select_to to adjust the selection to include merged cells.
    // #[wasm_bindgen(js_name = "adjustSelectionForMergedCells")]
    // pub fn adjust_selection_for_merged_cells_drag(
    //     &mut self,
    //     x: u32,
    //     y: u32,
    //     context: &JsA1Context,
    //     merge_cells: &JsMergeCells,
    //     state: &JsSelectionState,
    // ) {
    //     let rust_state = state.get_state();

    //     // Adjust column/row to align with merged cell boundaries
    //     let (adjusted_column, adjusted_row, _adjusted_start) =
    //         crate::a1::adjust_selection_end_for_merged_cells(
    //             &self.selection,
    //             x as i64,
    //             y as i64,
    //             context.get_context(),
    //             Some(merge_cells.get_merge_cells()),
    //             &rust_state,
    //         );

    //     // If adjustment was needed, re-select with adjusted positions
    //     if adjusted_column != x as i64 || adjusted_row != y as i64 {
    //         let updated_state = self.selection.select_to(
    //             adjusted_column,
    //             adjusted_row,
    //             false,
    //             context.get_context(),
    //             Some(rust_state),
    //         );

    //         // Convert SelectionMode to u8 for WASM
    //         let mode_u8 = match updated_state.mode {
    //             crate::a1::SelectionMode::KeyboardShift => 0,
    //             crate::a1::SelectionMode::MouseDrag => 1,
    //             crate::a1::SelectionMode::MouseShiftClick => 2,
    //             crate::a1::SelectionMode::MouseCtrlClick => 3,
    //             crate::a1::SelectionMode::Single => 4,
    //         };
    //         JsSelectionState::new(
    //             updated_state.anchor.x,
    //             updated_state.anchor.y,
    //             updated_state.selection_end.x,
    //             updated_state.selection_end.y,
    //             mode_u8,
    //         )
    //     } else {
    //         // No adjustment needed, return current state
    //         *state
    //     }
    // }

    // #[wasm_bindgen(js_name = "selectInDirection")]
    // pub fn select_in_direction(
    //     &mut self,
    //     direction: Direction,
    //     context: &JsA1Context,
    //     merge_cells: &JsMergeCells,
    //     data_tables_cache: &SheetDataTablesCache,
    // ) {
    //     use crate::SheetPos;
    //     use crate::input::move_cursor::move_cursor;

    //     // Get current selection bounds and cursor
    //     let cursor_pos = self.selection.cursor;

    //     // Save old selection bounds to determine if we're growing or shrinking
    //     let old_selection =
    //         if let Some(crate::a1::CellRefRange::Sheet { range }) = self.selection.ranges.last() {
    //             if range.is_finite() {
    //                 Some((
    //                     range.start.col(),
    //                     range.start.row(),
    //                     range.end.col(),
    //                     range.end.row(),
    //                 ))
    //             } else {
    //                 None
    //             }
    //         } else {
    //             None
    //         };

    //     // Determine which end to move from based on the direction
    //     // This ensures we expand the correct edge instead of shrinking from the opposite edge
    //     let (move_from_x, move_from_y) =
    //         if let Some(crate::a1::CellRefRange::Sheet { range }) = self.selection.ranges.last() {
    //             if range.is_finite() {
    //                 let range_start_x = range.start.col();
    //                 let range_start_y = range.start.row();
    //                 let range_end_x = range.end.col();
    //                 let range_end_y = range.end.row();

    //                 // Move from the edge in the direction we're moving
    //                 let x = match direction {
    //                     crate::grid::js_types::Direction::Left => range_start_x, // Left edge
    //                     crate::grid::js_types::Direction::Right => range_end_x,  // Right edge
    //                     _ => cursor_pos.x, // Vertical movement: use cursor x
    //                 };

    //                 let y = match direction {
    //                     crate::grid::js_types::Direction::Up => range_start_y, // Top edge
    //                     crate::grid::js_types::Direction::Down => range_end_y, // Bottom edge
    //                     _ => cursor_pos.y, // Horizontal movement: use cursor y
    //                 };

    //                 (x, y)
    //             } else {
    //                 (cursor_pos.x, cursor_pos.y)
    //             }
    //         } else {
    //             (cursor_pos.x, cursor_pos.y)
    //         };

    //     // Try moving from the determined position
    //     // Don't pass merge_cells to move_cursor - we'll handle merged cells after updating the selection
    //     let move_from_pos = SheetPos {
    //         x: move_from_x,
    //         y: move_from_y,
    //         sheet_id: self.selection.sheet_id,
    //     };

    //     let mut new_pos = move_cursor(
    //         move_from_pos,
    //         direction,
    //         data_tables_cache,
    //         context.get_context(),
    //         None, // Don't jump over merged cells in move_cursor - we'll handle it after selection update
    //     );

    //     // Check if movement is blocked (sheet boundary)
    //     let movement_blocked = new_pos.x == move_from_x && new_pos.y == move_from_y;
    //     let at_boundary = match direction {
    //         Direction::Left => move_from_x == 1,
    //         Direction::Up => move_from_y == 1,
    //         Direction::Right | Direction::Down => false,
    //     };

    //     // If movement is blocked (not at boundary), try pivoting
    //     if movement_blocked && !at_boundary {
    //         // Try pivoting from cursor position
    //         let cursor_sheet_pos = SheetPos {
    //             x: cursor_pos.x,
    //             y: cursor_pos.y,
    //             sheet_id: self.selection.sheet_id,
    //         };
    //         let pivot_new_pos = move_cursor(
    //             cursor_sheet_pos,
    //             direction,
    //             data_tables_cache,
    //             context.get_context(),
    //             None,
    //         );

    //         // If we successfully moved from cursor/anchor, pivot the selection
    //         if pivot_new_pos.x != cursor_pos.x || pivot_new_pos.y != cursor_pos.y {
    //             new_pos = pivot_new_pos;
    //             // Get the opposite corner to maintain selection extent during pivot
    //             if let Some(crate::a1::CellRefRange::Sheet { range }) = self.selection.ranges.last()
    //             {
    //                 if range.is_finite() {
    //                     let range_start_x = range.start.col();
    //                     let range_start_y = range.start.row();
    //                     let range_end_x = range.end.col();
    //                     let range_end_y = range.end.row();

    //                     let opposite_x = if cursor_pos.x == range_start_x {
    //                         range_end_x
    //                     } else {
    //                         range_start_x
    //                     };
    //                     let opposite_y = if cursor_pos.y == range_start_y {
    //                         range_end_y
    //                     } else {
    //                         range_start_y
    //                     };

    //                     // Move cursor to new position
    //                     self.selection.move_to(new_pos.x, new_pos.y, false);

    //                     // // Select to opposite corner to maintain extent
    //                     // let state =
    //                     //     Some(crate::a1::SelectionState::for_keyboard_shift(crate::Pos {
    //                     //         x: new_pos.x,
    //                     //         y: new_pos.y,
    //                     //     }));
    //                     // let _ = self.selection.select_to(
    //                     //     opposite_x,
    //                     //     opposite_y,
    //                     //     false,
    //                     //     context.get_context(),
    //                     //     state,
    //                     // );

    //                     // Adjust selection for merged cells after update
    //                     // self.adjust_selection_for_merged_cells(
    //                     //     direction,
    //                     //     old_selection,
    //                     //     context,
    //                     //     merge_cells,
    //                     // );
    //                     return;
    //                 }
    //             }
    //         }
    //         // If at boundary or still blocked, movement is not possible
    //         return;
    //     }

    //     // Check if we're moving into a merged cell - if so, we may need to adjust
    //     // This will be handled after the selection update

    //     // Normal case: select to the new position
    //     // To maintain selection extent, we need to find the opposite corner and select to it
    //     if let Some(crate::a1::CellRefRange::Sheet { range }) = self.selection.ranges.last() {
    //         if range.is_finite() {
    //             let range_start_x = range.start.col();
    //             let range_start_y = range.start.row();
    //             let range_end_x = range.end.col();
    //             let range_end_y = range.end.row();

    //             // Find the opposite corner from the cursor
    //             let opposite_x = if cursor_pos.x == range_start_x {
    //                 range_end_x
    //             } else {
    //                 range_start_x
    //             };
    //             let opposite_y = if cursor_pos.y == range_start_y {
    //                 range_end_y
    //             } else {
    //                 range_start_y
    //             };

    //             // Move cursor to new position
    //             self.selection.move_to(new_pos.x, new_pos.y, false);

    //             // Select from new position to opposite corner to maintain extent
    //             // let state = Some(crate::a1::SelectionState::for_keyboard_shift(crate::Pos {
    //             //     x: new_pos.x,
    //             //     y: new_pos.y,
    //             // }));
    //             // let _ = self.selection.select_to(
    //             //     opposite_x,
    //             //     opposite_y,
    //             //     false,
    //             //     context.get_context(),
    //             //     state,
    //             // );

    //             // // Adjust selection for merged cells after update
    //             // self.adjust_selection_for_merged_cells(
    //             //     direction,
    //             //     old_selection,
    //             //     context,
    //             //     merge_cells,
    //             // );
    //             return;
    //         }
    //     }

    //     // // Fallback for unbounded ranges or no range
    //     // let _ = self
    //     //     .selection
    //     //     .select_to(new_pos.x, new_pos.y, false, context.get_context(), None);

    //     // Adjust selection for merged cells after update
    //     self.adjust_selection_for_merged_cells(direction, old_selection, context, merge_cells);
    // }

    // /// Adjusts the selection to handle partial merged cells.
    // /// If the selection is growing and overlaps with merged cells, contracts to the merged cell's boundary.
    // /// If the selection is shrinking and partially overlaps, also adjusts appropriately.
    // fn adjust_selection_for_merged_cells(
    //     &mut self,
    //     direction: Direction,
    //     old_selection: Option<(i64, i64, i64, i64)>,
    //     context: &JsA1Context,
    //     merge_cells: &JsMergeCells,
    // ) {
    //     use crate::Rect;

    //     // Get current selection
    //     let Some(crate::a1::CellRefRange::Sheet { range }) = self.selection.ranges.last() else {
    //         return;
    //     };

    //     if !range.is_finite() {
    //         return;
    //     }

    //     let current_start_x = range.start.col();
    //     let current_start_y = range.start.row();
    //     let current_end_x = range.end.col();
    //     let current_end_y = range.end.row();

    //     let selection_rect = Rect::new(
    //         current_start_x,
    //         current_start_y,
    //         current_end_x,
    //         current_end_y,
    //     );

    //     let merged_rects = merge_cells
    //         .get_merge_cells()
    //         .get_merge_cells(selection_rect);

    //     if merged_rects.is_empty() {
    //         return;
    //     }

    //     // Check if all merged cells are fully contained within the selection
    //     // If they are, no adjustment is needed
    //     let all_fully_contained = merged_rects
    //         .iter()
    //         .all(|merge_rect| selection_rect.contains_rect(merge_rect));

    //     if all_fully_contained {
    //         return; // All merged cells are fully contained, no adjustment needed
    //     }

    //     // Determine if we're growing or shrinking by comparing with old selection
    //     let is_growing =
    //         if let Some((old_start_x, old_start_y, old_end_x, old_end_y)) = old_selection {
    //             match direction {
    //                 crate::grid::js_types::Direction::Left => current_start_x < old_start_x,
    //                 crate::grid::js_types::Direction::Right => current_end_x > old_end_x,
    //                 crate::grid::js_types::Direction::Up => current_start_y < old_start_y,
    //                 crate::grid::js_types::Direction::Down => current_end_y > old_end_y,
    //             }
    //         } else {
    //             true // Assume growing if no old selection
    //         };

    //     // Find the relevant merged cell boundary based on direction
    //     // Handle two cases:
    //     // 1. If we're before/after the boundary and growing, contract to the boundary
    //     // 2. If we're exactly at the boundary and growing, jump over the merged cell
    //     let (target_x, target_y) = match direction {
    //         crate::grid::js_types::Direction::Left => {
    //             if let Some(leftmost_merge) = merged_rects.iter().min_by_key(|r| r.min.x) {
    //                 if is_growing {
    //                     if current_start_x < leftmost_merge.min.x {
    //                         // Before boundary: contract to boundary
    //                         (leftmost_merge.min.x, current_start_y)
    //                     } else if current_start_x == leftmost_merge.min.x {
    //                         // At boundary: jump over
    //                         (leftmost_merge.min.x - 1, current_start_y)
    //                     } else {
    //                         return; // Already past, no adjustment needed
    //                     }
    //                 } else {
    //                     return; // Shrinking, no adjustment needed
    //                 }
    //             } else {
    //                 return;
    //             }
    //         }
    //         crate::grid::js_types::Direction::Right => {
    //             if let Some(rightmost_merge) = merged_rects.iter().max_by_key(|r| r.max.x) {
    //                 if is_growing {
    //                     if current_end_x > rightmost_merge.max.x {
    //                         // After boundary: contract to boundary
    //                         (rightmost_merge.max.x, current_end_y)
    //                     } else if current_end_x == rightmost_merge.max.x {
    //                         // At boundary: jump over
    //                         (rightmost_merge.max.x + 1, current_end_y)
    //                     } else {
    //                         return; // Already before, no adjustment needed
    //                     }
    //                 } else {
    //                     return; // Shrinking, no adjustment needed
    //                 }
    //             } else {
    //                 return;
    //             }
    //         }
    //         crate::grid::js_types::Direction::Up => {
    //             if let Some(topmost_merge) = merged_rects.iter().min_by_key(|r| r.min.y) {
    //                 if is_growing {
    //                     if current_start_y < topmost_merge.min.y {
    //                         // Above boundary: contract to boundary
    //                         (current_start_x, topmost_merge.min.y)
    //                     } else if current_start_y == topmost_merge.min.y {
    //                         // At boundary: jump over
    //                         (current_start_x, topmost_merge.min.y - 1)
    //                     } else {
    //                         return; // Already below, no adjustment needed
    //                     }
    //                 } else {
    //                     return; // Shrinking, no adjustment needed
    //                 }
    //             } else {
    //                 return;
    //             }
    //         }
    //         crate::grid::js_types::Direction::Down => {
    //             if let Some(bottommost_merge) = merged_rects.iter().max_by_key(|r| r.max.y) {
    //                 if is_growing {
    //                     if current_end_y > bottommost_merge.max.y {
    //                         // Below boundary: contract to boundary
    //                         (current_end_x, bottommost_merge.max.y)
    //                     } else if current_end_y == bottommost_merge.max.y {
    //                         // At boundary: jump over
    //                         (current_end_x, bottommost_merge.max.y + 1)
    //                     } else {
    //                         return; // Already above, no adjustment needed
    //                     }
    //                 } else {
    //                     return; // Shrinking, no adjustment needed
    //                 }
    //             } else {
    //                 return;
    //             }
    //         }
    //     };

    //     // Adjust the selection to the target position
    //     let cursor_pos = self.selection.cursor;
    //     let opposite_x = if cursor_pos.x == current_start_x {
    //         current_end_x
    //     } else {
    //         current_start_x
    //     };
    //     let opposite_y = if cursor_pos.y == current_start_y {
    //         current_end_y
    //     } else {
    //         current_start_y
    //     };

    //     // Move cursor to target position
    //     self.selection.move_to(target_x, target_y, false);

    //     // // Select from target position to opposite corner
    //     // let state = Some(crate::a1::SelectionState::for_keyboard_shift(crate::Pos {
    //     //     x: target_x,
    //     //     y: target_y,
    //     // }));
    //     // let _ =
    //     //     self.selection
    //     //         .select_to(opposite_x, opposite_y, false, context.get_context(), state);

    //     // If we jumped over, we might need to adjust again (recursively, but limit depth)
    //     // Actually, let's not recurse - the next arrow press will handle further adjustments
    // }

    #[wasm_bindgen(js_name = "moveTo")]
    pub fn move_to(&mut self, x: u32, y: u32, append: bool) {
        self.selection.move_to(x as i64, y as i64, append);
    }

    #[wasm_bindgen(js_name = "setColumnsSelected")]
    pub fn set_columns_selected(&mut self, context: &JsA1Context) {
        self.selection.set_columns_selected(context.get_context());
    }

    #[wasm_bindgen(js_name = "setRowsSelected")]
    pub fn set_rows_selected(&mut self, context: &JsA1Context) {
        self.selection.set_rows_selected(context.get_context());
    }

    #[wasm_bindgen(js_name = "selectTable")]
    pub fn select_table(
        &mut self,
        table_name: &str,
        col: Option<String>,
        screen_col_left: i32,
        shift_key: bool,
        ctrl_key: bool,
        context: &JsA1Context,
    ) {
        self.selection.select_table(
            table_name,
            col,
            context.get_context(),
            screen_col_left as i64,
            shift_key,
            ctrl_key,
        );
    }

    #[wasm_bindgen(js_name = "checkForTableRef")]
    pub fn check_for_table_ref(&mut self, sheet_id: String, context: &JsA1Context) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            for range in self.selection.ranges.iter_mut() {
                if let Some(new_range) = range.check_for_table_ref(sheet_id, context.get_context())
                {
                    *range = new_range;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;
    use crate::a1::A1Context;
    use crate::grid::sheet::merge_cells::MergeCells;

    #[test]
    fn test_select_in_direction_left_with_merged_cell() {
        // Test the exact scenario from the user:
        // Merge cell B3:E3, selection B2:E4, press shift+left, should expand to A2:E4
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();

        // Merge B3:E3 (columns 2-5, row 3)
        merge_cells.merge_cells(Rect::test_a1("B3:E3"));

        // Start at B2, then extend to E4 to create B2:E4 with cursor at B2
        let mut selection = crate::a1::A1Selection::test_a1("B2");
        // let state1 = Some(crate::a1::SelectionState::for_keyboard_shift(crate::Pos {
        //     x: 2,
        //     y: 2,
        // }));
        // // Adjust for merged cells first, then select
        // let (adjusted_x, adjusted_y, _) = selection.adjust_selection_end_for_merged_cells(
        //     5,
        //     4,
        //     &context,
        //     Some(&merge_cells),
        //     state1.as_ref().unwrap(),
        // );
        // let _ = selection.select_to(adjusted_x, adjusted_y, false, &context, state1);

        // Verify initial selection is B2:E4
        let sel_string = selection.test_to_string();
        println!("Initial selection: {:?}", sel_string);
        assert_eq!(sel_string, "B2:E4");

        let cursor = selection.cursor;
        println!("Cursor: ({}, {})", cursor.x, cursor.y);
        assert_eq!(cursor.x, 2, "Cursor should be at B2");
        assert_eq!(cursor.y, 2);

        // Now simulate what the actual selectInDirection function does:
        // selectInDirection determines which edge to move from based on direction
        use crate::grid::sheet::data_tables::cache::SheetDataTablesCache;
        use crate::input::move_cursor::move_cursor;
        use crate::{SheetPos, grid::SheetId};

        let data_tables_cache = SheetDataTablesCache::default();

        // For direction Left, selectInDirection moves from the left edge (B2)
        let range = if let Some(crate::a1::CellRefRange::Sheet { range }) = selection.ranges.last()
        {
            range
        } else {
            panic!("Expected a sheet range");
        };

        let move_from_x = range.start.col(); // Left edge = B (column 2)
        let move_from_y = cursor.y; // Same row as cursor = row 2

        let move_from_pos = SheetPos {
            x: move_from_x,
            y: move_from_y,
            sheet_id: SheetId::new(),
        };

        let new_pos = move_cursor(
            move_from_pos,
            crate::grid::js_types::Direction::Left,
            &data_tables_cache,
            &context,
            Some(&merge_cells),
        );

        println!(
            "Move from ({}, {}) to ({}, {})",
            move_from_x, move_from_y, new_pos.x, new_pos.y
        );
        assert_eq!(new_pos.x, 1, "Should move from B2 to A2");
        assert_eq!(new_pos.y, 2, "Y coordinate should remain at row 2");

        // Movement succeeded - now maintain selection extent by finding opposite corner
        let range_start_x = range.start.col();
        let range_start_y = range.start.row();
        let range_end_x = range.end.col();
        let range_end_y = range.end.row();

        let opposite_x = if cursor.x == range_start_x {
            range_end_x
        } else {
            range_start_x
        };
        let opposite_y = if cursor.y == range_start_y {
            range_end_y
        } else {
            range_start_y
        };

        println!(
            "Opposite corner from cursor: ({}, {})",
            opposite_x, opposite_y
        );

        // Move cursor to new position
        selection.move_to(new_pos.x, new_pos.y, false);

        // // Select from new position to opposite corner
        // let state = Some(crate::a1::SelectionState::for_keyboard_shift(crate::Pos {
        //     x: new_pos.x,
        //     y: new_pos.y,
        // }));
        // // Adjust for merged cells first, then select
        // let (adjusted_x, adjusted_y, _) = selection.adjust_selection_end_for_merged_cells(
        //     opposite_x,
        //     opposite_y,
        //     &context,
        //     Some(&merge_cells),
        //     state.as_ref().unwrap(),
        // );
        // let _ = selection.select_to(adjusted_x, adjusted_y, false, &context, state);

        // Verify the selection expanded to A2:E4
        let sel_string = selection.test_to_string();
        println!("Selection after shift+left: {:?}", sel_string);

        // This should be A2:E4, not blocked at B2:E4
        assert_eq!(sel_string, "A2:E4", "Selection should expand left to A2:E4");
    }
}
