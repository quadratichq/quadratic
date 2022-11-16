use serde::{Deserialize, Serialize};

use super::{Cell, Pos};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Command {
    /// Sets a list of cells on the grid.
    ///
    /// If a cell is listed multiple times, only the last value is used.
    SetCells(Vec<(Pos, Cell)>),
}
