use serde::{Deserialize, Serialize};

use super::{Cell, Pos};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Command {
    /// Sets a single cell in the grid.
    SetCell(Pos, Cell),
}
