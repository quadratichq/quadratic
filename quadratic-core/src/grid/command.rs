use serde::{Deserialize, Serialize};

use super::{Cell, Pos};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Command {
    /// Sets a single cell in the grid.
    SetCell(Pos, Cell),
    AddCellDependencies(Pos, Vec<Pos>),
    // NOTE: We may be able to accomplish the same thing by changing AddCellDependencies to
    // SetCellDependencies which would return the previous dependencies, delete them from the graph,
    // and then set only the new ones.
    RemoveCellDependencies(Pos, Vec<Pos>),
}
