use anyhow::Result;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::{Cell, Command, Grid, JsCell, Pos, Rect};

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
    /// set_cells(JSON.stringify([
    ///     [{x: 5, y: -3}, {Int: 10}],
    ///     [{x: 5, y: 6}, {Text: "hello"}],
    /// ]));
    /// ```
    #[wasm_bindgen(js_name = "setCells")]
    pub fn set_cells(&mut self, cells: &str) {
        self.execute(Command::SetCells(
            serde_json::from_str(cells).expect("bad cell list"),
        ));
    }

    /// Clears the whole grid and then adds new cells to it.
    pub fn populate(&mut self, cells: &str) {
        self.empty();
        let cell_list: Vec<JsCell> = serde_json::from_str(cells).expect("expected list of cells");
        for cell in cell_list {
            self.grid.set_cell(
                Pos {
                    x: cell.x,
                    y: cell.y,
                },
                Cell::Text(cell.value),
            );
        }
    }

    /// Returns all information about a single cell in the grid.
    pub fn get(&self, x: f64, y: f64) -> JsValue {
        let cell = self.grid.get_cell(Pos {
            x: x as i64,
            y: y as i64,
        });
        if cell.is_empty() {
            JsValue::UNDEFINED
        } else {
            serde_wasm_bindgen::to_value(&JsCell {
                x: x as i64,
                y: y as i64,
                value: cell.string_value(),
                dependent_cells: None,
                python_code: None,
                python_output: None,
                array_cells: None,
                last_modified: None,
            })
            .unwrap()
        }
    }
    /// returns all information about every cell in the grid.
    pub fn get_all(&self) -> JsValue {
        serde_wasm_bindgen::to_value(
            &self
                .grid
                .columns
                .iter()
                .flat_map(|(&x, col)| {
                    col.blocks.iter().flat_map(move |(&y, block)| {
                        (0..block.len() as i64)
                            .map(move |offset| self.get_internal(Pos { x, y: y + offset }))
                    })
                })
                .collect_vec(),
        )
        .unwrap()
    }
    fn get_internal(&self, pos: Pos) -> Option<JsCell> {
        let cell = self.grid.get_cell(pos);
        if cell.is_empty() {
            None
        } else {
            Some(JsCell {
                x: pos.x,
                y: pos.y,
                value: cell.string_value(),
                dependent_cells: None,
                python_code: None,
                python_output: None,
                array_cells: None,
                last_modified: None,
            })
        }
    }

    /// Returns the minimum bounding rectangle of the grid in cell coordinates.
    #[wasm_bindgen(js_name = "getCellRect")]
    pub fn cell_rect(&self) -> Rect {
        let min_x = *self.grid.columns.keys().next().unwrap_or(&-1000);
        let max_x = *self.grid.columns.keys().last().unwrap_or(&1000);

        let min_y = self
            .grid
            .columns
            .iter()
            .filter_map(|(_, col)| col.min_y())
            .min()
            .unwrap_or(-1000);
        let max_y = self
            .grid
            .columns
            .iter()
            .filter_map(|(_, col)| col.max_y())
            .max()
            .unwrap_or(1000);

        Rect {
            x: min_x,
            y: min_y,
            w: max_x.saturating_sub(min_x).try_into().unwrap_or(0),
            h: max_y.saturating_sub(min_y).try_into().unwrap_or(0),
        }
    }

    pub fn test(&self) -> JsValue {
        todo!()
    }

    /// Empties the grid.
    pub fn empty(&mut self) {
        self.grid = Grid::new();
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

// #[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
// #[wasm_bindgen]
// pub struct TestStruct {
//     // pub a: String,
//     // pub contents: Vec<String>,
//     pub formatting: Vec<Formatting>,
// }

// #[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
// #[wasm_bindgen]
// pub struct Formatting {
//     color1: String,
//     color2: String,
// }
