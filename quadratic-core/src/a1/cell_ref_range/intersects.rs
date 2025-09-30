use super::*;

impl CellRefRange {
    pub(crate) fn might_intersect_rect(&self, rect: Rect, a1_context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.might_intersect_rect(rect),
            Self::Table { range } => range.intersect_rect(rect, a1_context),
        }
    }

    pub(crate) fn might_contain_pos(&self, pos: Pos, a1_context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.might_contain_pos(pos),
            Self::Table { range } => range.contains(pos, a1_context),
        }
    }

    pub(crate) fn contains_pos(&self, pos: Pos, a1_context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.contains_pos(pos),
            Self::Table { range } => range.contains(pos, a1_context),
        }
    }

    /// Deletes the given range from the current range. Returns the remaining
    /// range or None if the current range is completely deleted.
    pub(crate) fn delete_range(
        &self,
        range_to_delete: &CellRefRange,
        a1_context: &A1Context,
    ) -> Vec<CellRefRange> {
        match self {
            Self::Sheet { range } => range.delete(range_to_delete, a1_context),
            Self::Table { range } => range.delete(range_to_delete, a1_context),
        }
    }
}
