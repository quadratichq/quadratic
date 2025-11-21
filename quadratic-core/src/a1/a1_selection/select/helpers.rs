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
