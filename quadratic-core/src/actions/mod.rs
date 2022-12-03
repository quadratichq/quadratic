use serde::{Deserialize, Serialize};

use super::Pos;
use crate::grid::{Cell, Command, GridController};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum UserActions {
    RunCell(Pos),
    SetCellValue(Pos, String),
    // SetCodeValue(Pos, CodeCell),
    // PasteCells(Pos),
    // CopyCells(Rect), // Does not add anything to the undo stack...
    // CutCells(Rect),
    // SetFormatting(Rect, Formatting),
    // MoveRow(i32, i32),
    // MoveColumn(i32, i32),
    // MoveCells(Rect, Pos),
    // InsertRow(i32),
    // InsertColumn(i32),
}

#[derive(Debug, Default, Clone)]
pub struct UserGridController {
    controller: GridController,
}

impl UserGridController {
    pub fn new() -> Self {
        Self {
            controller: GridController::new(),
        }
    }

    fn exec_action(&mut self, command: UserActions) {
        match command {
            // Recomputes all dependent cells in a single transaction
            UserActions::RunCell(pos) => {
                self.controller.transact(|t| {
                    let dependent_cells = t.grid().get_graph().get_dependent_cells(pos);
                    for _cell in dependent_cells {
                        // recompute _cell
                        // call Command::SetCell(_cell, result)
                    }

                    Ok(())
                });
            }
            // Sets Cell Value and recomputes all dependent cells in a single transaction
            UserActions::SetCellValue(pos, value) => {
                self.controller.transact(|t| {
                    t.exec(Command::SetCell(pos, Cell::Text(value)))?;

                    let dependent_cells = t.grid().get_graph().get_dependent_cells(pos);
                    for _cell in dependent_cells {
                        // recompute _cell
                        // call Command::SetCell(_cell, result)
                    }

                    Ok(())
                });
            }
        };
    }
}

#[test]
fn test_actions() {
    let mut grid = UserGridController::new();

    grid.exec_action(UserActions::SetCellValue(
        Pos { x: 0, y: 0 },
        "10".to_string(),
    ));
}
