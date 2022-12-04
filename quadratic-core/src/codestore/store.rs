use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::Pos;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
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
/// Stores the code for a grid.
pub struct CodeStore {
    pub code: HashMap<Pos, CodeCell>,
}

impl CodeStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_cell_code(&mut self, pos: Pos, code_cell: Option<CodeCell>) -> Option<CodeCell> {
        // sets code at pos and returns the old code or None if there was no code at pos

        if let Some(code_cell) = code_cell {
            self.code.insert(pos, code_cell)
        } else {
            self.code.remove(&pos)
        }
    }
}
