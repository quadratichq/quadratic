use std::collections::HashMap;
use std::fmt;

use crate::Pos;

#[derive(Default, Clone, Debug)]
pub struct CodeStore {
    pub code: HashMap<Pos, String>,
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

    pub fn set_code(&mut self, pos: Pos, code: String) -> Option<String> {
        // sets code at pos and returns the old code or null if there was no code at pos
        self.code.insert(pos, code)
    }
}
