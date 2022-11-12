use anyhow::Result;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::{Command, Grid};

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[wasm_bindgen]
pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Command>,
    redo_stack: Vec<Command>,
}
impl PartialEq for GridController {
    fn eq(&self, other: &Self) -> bool {
        self.grid == other.grid
    }
}
#[wasm_bindgen]
impl GridController {
    /// Constructs a new empty grid.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns whether there is an action that can be undone.
    #[wasm_bindgen(js_name = "hasUndo")]
    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    /// Returns whether there is an action that can be redone.
    #[wasm_bindgen(js_name = "hasRedo")]
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    /// Undoes one action, if there is an action to be undone. Returns whether
    /// an action was undone.
    pub fn undo(&mut self) -> bool {
        let Some(command) = self.undo_stack.pop() else { return false };
        let reverse_command = self.exec_internal(command).unwrap();
        self.redo_stack.push(reverse_command);
        true
    }
    /// Redoes one action, if there is an action to be redone. Returns whether
    /// an action was redone.
    pub fn redo(&mut self) -> bool {
        let Some(command) = self.redo_stack.pop() else { return false };
        let reverse_command = self.exec_internal(command).unwrap();
        self.undo_stack.push(reverse_command);
        true
    }

    /// Sets a list of cells on the grid. Example input:
    ///
    /// ```js
    /// set_cells([
    ///     [{x: 5, y: -3}, {Int: 10}],
    ///     [{x: 5, y: 6}, {Text: "hello"}],
    /// ]);
    /// ```
    #[wasm_bindgen(js_name = "setCells")]
    pub fn set_cells(&mut self, cells: JsValue) {
        self.execute(Command::SetCells(
            serde_wasm_bindgen::from_value(cells).expect("bad cell list"),
        ));
    }
}
impl GridController {
    /// Executes a command on the grid, managing the undo and redo stacks
    /// appropriately.
    pub fn execute(&mut self, command: Command) {
        self.redo_stack.clear();
        let reverse_command = self
            .exec_internal(command)
            .expect("error executing command");
        self.undo_stack.push(reverse_command);
    }

    /// Executes a command on the grid and returns the reverse command.
    fn exec_internal(&mut self, command: Command) -> Result<Command> {
        match command {
            Command::SetCells(cells) => {
                let mut old_values = cells
                    .into_iter()
                    .map(|(pos, contents)| (pos, self.grid.set_cell(pos, contents)))
                    .collect_vec();
                // In case there are duplicates, make sure to set them in the
                // reverse order. For example, suppose a cell initially contains
                // the value "A", then we run a command that sets it to "B" and
                // then "C" and then "D". The reverse command should set the
                // cell to "C" and then "B" and then finally "A".
                old_values.reverse();
                Ok(Command::SetCells(old_values))
            }
        }
    }

    /// Returns whether the underlying [`Grid`] is valid.
    #[cfg(test)]
    pub fn is_valid(&self) -> bool {
        self.grid.is_valid()
    }
}
