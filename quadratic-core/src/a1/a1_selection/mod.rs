use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::a1::A1Context;
use crate::{Pos, grid::SheetId};

use super::CellRefRange;

mod create;
mod delete;
mod display;
mod exclude;
mod intersects;
mod mutate;
mod parse;
mod query;
mod select;
mod select_table;

/// Maximum number of columns that can be parsed in a column name.
pub const MAX_COLUMNS: i64 = 5000000;

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct A1Selection {
    /// Current sheet.
    ///
    /// Selections can only span a single sheet.
    #[cfg_attr(test, proptest(value = "SheetId::TEST"))]
    pub sheet_id: SheetId,
    /// Cursor position, which is moved using the arrow keys (while not holding
    /// shift).
    ///
    /// This always coincides with the start of the last range in `ranges`, but
    /// in the case of an infinite selection it contains information that cannot
    /// be inferred from `ranges`.
    pub cursor: Pos,
    /// Selected ranges (union).
    ///
    /// The cursor selection must always contain at least one range, and the
    /// last range can be manipulated using the arrow keys.
    ///
    /// The `start` of the last range is where the cursor outline is drawn, and
    /// can be moved by pressing arrow keys without holding the shift key.
    ///
    /// The `end` of the last range can be moved by pressing arrow keys while
    /// holding the shift key.
    pub ranges: Vec<CellRefRange>,
}

/// Selection state tracking for selection operations.
/// This is separate from A1Selection to avoid serialization and maintain compatibility.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SelectionState {
    /// The anchor point (starting position for the selection operation)
    /// - Keyboard+Shift: cursor position when shift is first pressed
    /// - MouseDrag: cursor position when drag starts
    /// - MouseShiftClick: current cursor position when shift-clicking
    /// - MouseCtrlClick: clicked position (for new range)
    pub anchor: Pos,
    /// The active/moving end of the selection (the end that extends with each action)
    /// - Keyboard+Shift: the opposite end from the cursor (the end that moves)
    /// - MouseDrag: the current mouse position
    /// - MouseShiftClick: the clicked position
    pub selection_end: Pos,
    /// Selection mode indicating the type of user action
    pub mode: SelectionMode,
}

/// Selection mode indicating the type of user action
#[derive(Debug, Clone, Copy, PartialEq, Eq, TS)]
pub enum SelectionMode {
    /// Keyboard selection with shift key - anchor is cursor when shift first pressed
    KeyboardShift,
    /// Mouse drag selection - anchor is cursor when drag starts
    MouseDrag,
    /// Mouse shift-click selection - anchor is current cursor, extending to clicked position
    MouseShiftClick,
    /// Mouse ctrl/cmd click selection - adds new range (append mode)
    MouseCtrlClick,
    /// Single cell selection (no extension)
    Single,
}

impl SelectionState {
    /// Creates a new SelectionState for keyboard+shift selection
    /// Anchor is the cursor position when shift is first pressed
    /// selection_end is the same as anchor initially (will be updated as selection extends)
    pub fn for_keyboard_shift(anchor: Pos) -> Self {
        Self {
            anchor,
            selection_end: anchor,
            mode: SelectionMode::KeyboardShift,
        }
    }

    /// Creates a new SelectionState for mouse drag operation
    /// Anchor is the cursor position when drag starts
    pub fn for_mouse_drag(anchor: Pos) -> Self {
        Self {
            anchor,
            selection_end: anchor,
            mode: SelectionMode::MouseDrag,
        }
    }

    /// Creates a new SelectionState for mouse shift-click
    /// Anchor is the current cursor position
    pub fn for_mouse_shift_click(anchor: Pos) -> Self {
        Self {
            anchor,
            selection_end: anchor,
            mode: SelectionMode::MouseShiftClick,
        }
    }

    /// Creates a new SelectionState for mouse ctrl/cmd click (append mode)
    /// Anchor is the clicked position (for new range)
    pub fn for_mouse_ctrl_click(anchor: Pos) -> Self {
        Self {
            anchor,
            selection_end: anchor,
            mode: SelectionMode::MouseCtrlClick,
        }
    }

    /// Creates a new SelectionState for single cell selection
    pub fn for_single(anchor: Pos) -> Self {
        Self {
            anchor,
            selection_end: anchor,
            mode: SelectionMode::Single,
        }
    }

    /// Legacy method: Creates a new SelectionState by analyzing the current A1Selection
    /// This is used when we need to continue an existing selection but don't know the action type
    /// Defaults to KeyboardShift for backward compatibility
    pub fn from_selection(selection: &A1Selection, _a1_context: &A1Context) -> Self {
        // Infer anchor and selection_end from the last range
        // For keyboard+shift selection, the cursor IS the anchor (the fixed point that doesn't move)
        // The opposite end is what moves to extend the selection
        let (anchor, selection_end) =
            if let Some(CellRefRange::Sheet { range }) = selection.ranges.last() {
                if range.is_finite() {
                    let range_start = Pos {
                        x: range.start.col(),
                        y: range.start.row(),
                    };
                    let range_end = Pos {
                        x: range.end.col(),
                        y: range.end.row(),
                    };
                    let cursor_pos = selection.cursor;

                    // For keyboard+shift, cursor is at the anchor (the fixed point)
                    // The opposite end is the selection_end (the moving point)
                    // The range is normalized (start=top-left, end=bottom-right)
                    // but cursor could be at any corner, so we need to find the opposite corner

                    if cursor_pos == range_start {
                        // Cursor at top-left (range.start) -> selection_end is bottom-right (range.end)
                        (range_start, range_end)
                    } else if cursor_pos == range_end {
                        // Cursor at bottom-right (range.end) -> selection_end is top-left (range.start)
                        (range_end, range_start)
                    } else {
                        // Cursor is at a different corner (bottom-left or top-right)
                        // Find the opposite corner from the cursor using the range bounds
                        let opposite_x = if cursor_pos.x == range_start.x {
                            range_end.x
                        } else {
                            range_start.x
                        };
                        let opposite_y = if cursor_pos.y == range_start.y {
                            range_end.y
                        } else {
                            range_start.y
                        };
                        let opposite_corner = Pos {
                            x: opposite_x,
                            y: opposite_y,
                        };
                        (cursor_pos, opposite_corner)
                    }
                } else {
                    // For unbounded ranges, use cursor as both anchor and selection_end
                    (selection.cursor, selection.cursor)
                }
            } else {
                // No range, use cursor as both anchor and selection_end
                (selection.cursor, selection.cursor)
            };

        Self {
            anchor,
            selection_end,
            mode: SelectionMode::KeyboardShift, // Default to keyboard shift for backward compatibility
        }
    }

    /// Gets the active end position (the moving end of the selection)
    /// Simply returns the tracked selection_end
    pub fn get_active_end(&self, _selection: &A1Selection, _a1_context: &A1Context) -> Pos {
        self.selection_end
    }

    /// Checks if this is a drag operation
    pub fn is_drag(&self) -> bool {
        matches!(self.mode, SelectionMode::MouseDrag)
    }

    /// Checks if this is a keyboard operation
    pub fn is_keyboard(&self) -> bool {
        matches!(self.mode, SelectionMode::KeyboardShift)
    }
}

impl A1Selection {
    /// Expands the selection to include anchor cells for any merged cells.
    /// This ensures that formatting operations are applied to the anchor cells
    /// where the data actually lives, while preserving the original selection
    /// for navigation purposes.
    pub fn expand_to_include_merge_anchors(
        &self,
        merge_cells: &crate::grid::sheet::merge_cells::MergeCells,
    ) -> Self {
        use crate::Pos;
        use std::collections::HashSet;

        let mut expanded_selection = self.clone();
        let mut anchors_to_add = HashSet::new();

        // Check cursor position
        if let Some(anchor) = merge_cells.get_anchor(self.cursor) {
            if anchor != self.cursor {
                anchors_to_add.insert(anchor);
            }
        }

        // Check all positions in ranges
        for range in &self.ranges {
            match range {
                CellRefRange::Sheet { range } => {
                    if range.is_finite() {
                        if let Some(rect) = range.to_rect() {
                            // Check all positions in the range for merged cells
                            for x in rect.min.x..=rect.max.x {
                                for y in rect.min.y..=rect.max.y {
                                    let pos = Pos { x, y };
                                    if let Some(anchor) = merge_cells.get_anchor(pos) {
                                        // Add anchor if it's not already in the range
                                        if !rect.contains(anchor) {
                                            anchors_to_add.insert(anchor);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                CellRefRange::Table { .. } => {
                    // Tables are handled separately in format_ops
                }
            }
        }

        // Add anchor positions to the selection as individual cell ranges
        for anchor in anchors_to_add {
            use crate::a1::{CellRefCoord, CellRefRangeEnd, RefRangeBounds};

            let anchor_range = CellRefRange::Sheet {
                range: RefRangeBounds {
                    start: CellRefRangeEnd {
                        col: CellRefCoord {
                            coord: anchor.x,
                            is_absolute: true,
                        },
                        row: CellRefCoord {
                            coord: anchor.y,
                            is_absolute: true,
                        },
                    },
                    end: CellRefRangeEnd {
                        col: CellRefCoord {
                            coord: anchor.x,
                            is_absolute: true,
                        },
                        row: CellRefCoord {
                            coord: anchor.y,
                            is_absolute: true,
                        },
                    },
                },
            };
            expanded_selection.ranges.push(anchor_range);
        }

        expanded_selection
    }
}
