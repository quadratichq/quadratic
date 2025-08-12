//! Used for referencing a pos in a data table.

use crate::Pos;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct TablePos {
    pub parent_pos: Pos,
    pub sub_table_pos: Pos,
}

impl TablePos {
    pub fn new(parent_pos: Pos, sub_table_pos: Pos) -> Self {
        Self {
            parent_pos,
            sub_table_pos,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_pos() {
        let parent_pos = pos![A1];
        let sub_table_pos = Pos { x: 0, y: 0 };
        let table_pos = TablePos::new(parent_pos, sub_table_pos);

        assert_eq!(table_pos.parent_pos, parent_pos);
        assert_eq!(table_pos.sub_table_pos, sub_table_pos);
    }
}
