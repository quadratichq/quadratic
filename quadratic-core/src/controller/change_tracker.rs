//! Tracks changes to the grid since the user joined the file.

use crate::controller::{GridController, operations::ai_operation::AIOperation};

#[derive(Default, Debug, Clone, PartialEq)]
pub struct ChangeTracker {
    changes: Vec<AIOperation>,
}

impl GridController {
    pub fn add_changes(&mut self, changes: Vec<AIOperation>) {
        self.changes.extend(changes);
    }
}
