use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

use crate::Pos;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CodeType {
    Formula,
    Python,
    SQL,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeCell {
    pub code_type: CodeType,
    pub code: String,
}

#[derive(Default, Clone, Debug)]
pub struct CodeStore {
    pub code: HashMap<Pos, CodeCell>,
}

impl fmt::Display for CodeStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "CodeStore {{ code: {:?} }}", self.code)
    }
}

/// Stores the code for a grid.
impl CodeStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_cell_code(
        &mut self,
        pos: Pos,
        code_cell_or_none: Option<CodeCell>,
    ) -> Option<CodeCell> {
        // sets code at pos and returns the old code or None if there was no code at pos
        if code_cell_or_none.is_some() {
            self.code.insert(pos, code_cell_or_none.unwrap())
        } else {
            self.code.remove(&pos)
        }
    }
}
