use super::*;

impl CellRefRange {
    pub fn might_intersect_rect(&self, rect: Rect, context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.might_intersect_rect(rect),
            Self::Table { range } => range.intersect_rect(rect, context),
        }
    }

    pub fn might_contain_pos(&self, pos: Pos, context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.might_contain_pos(pos),
            Self::Table { range } => range.contains_pos(pos, context),
        }
    }

    pub fn contains_pos(&self, pos: Pos, context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.contains_pos(pos),
            Self::Table { range } => range.contains_pos(pos, context),
        }
    }
}
