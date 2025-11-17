use ts_rs::TS;

use crate::{
    Pos,
    a1::{A1Context, A1Selection, CellRefRange},
};

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
