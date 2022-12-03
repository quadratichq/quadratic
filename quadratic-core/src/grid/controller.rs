use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

use super::{Cell, Command, Grid, JsCell, Pos, Rect};
use crate::codestore::CodeStore;
use crate::dgraph::DGraphController;

#[derive(Debug)]
pub struct TransactionInProgress<'a> {
    controller: &'a mut GridController,
    reverse_commands: Vec<Command>,
    dirty: DirtyQuadrants,
}
impl TransactionInProgress<'_> {
    /// Returns the grid controller.
    pub fn controller(&self) -> &GridController {
        self.controller
    }
    /// Returns the underlying cell grid.
    pub fn cells(&self) -> &Grid {
        &self.controller.grid
    }
    /// Executes a command as part of the transaction.
    pub fn exec(&mut self, command: Command) -> Result<()> {
        let reverse = self.controller.exec_internal(command, &mut self.dirty)?;
        self.reverse_commands.push(reverse);
        Ok(())
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct Transaction {
    commands: Vec<Command>,
}

#[derive(Debug, Default, Clone)]
#[wasm_bindgen]
pub struct GridController {
    /// Underlying grid of cells.
    grid: Grid,
    graph: DGraphController,
    code_store: CodeStore,
    /// Stack of transactions that an undo command pops from. Each undo command
    /// takes one transaction from the top of the stack and executes all
    /// commands in it, in order.
    undo_stack: Vec<Transaction>,
    /// Stack of transactions that a redo command pops from. Each undo command
    /// takes one transaction from the top of the stack and executes all
    /// commands in it, in order.
    redo_stack: Vec<Transaction>,
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
    /// Undoes one action, if there is an action to be undone. Returns a list of
    /// dirty quadrants (XY pairs flattened) or `null` if nothing happened.
    #[wasm_bindgen(js_name = "undo")]
    pub fn js_undo(&mut self) -> JsValue {
        option_to_js_value(self.undo())
    }
    /// Redoes one action, if there is an action to be redone. Returns a list of
    /// dirty quadrants (XY pairs flattened) or `null` if nothing happened.
    #[wasm_bindgen(js_name = "redo")]
    pub fn js_redo(&mut self) -> JsValue {
        option_to_js_value(self.redo())
    }

    /// Clears the whole grid and then adds new cells to it. Also clears
    /// undo/redo history. Example input:
    ///
    /// ```js
    /// set_cells(JSON.stringify([
    ///     [{x: 5, y: -3}, {Int: 10}],
    ///     [{x: 5, y: 6}, {Text: "hello"}],
    /// ]));
    /// ```
    ///
    /// Returns a list of dirty quadrants as XY pairs.
    pub fn populate(&mut self, cells: &str) -> JsValue {
        let cell_list: Vec<(Pos, Cell)> =
            serde_json::from_str(cells).expect("expected list of cells");

        *self = Self::new();

        self.js_transact(|t| {
            for (pos, cell) in cell_list {
                t.exec(Command::SetCell(pos, cell))?;
            }
            Ok(())
        })
    }

    /// Sets a cell in the grid as a single transaction.
    ///
    /// Returns a list of dirty quadrants as XY pairs.
    #[wasm_bindgen(js_name = "setCell")]
    pub fn set_cell(&mut self, pos: Pos, text_contents: String) -> JsValue {
        self.js_transact(|t| t.exec(Command::SetCell(pos, Cell::Text(text_contents))))
    }

    /// Returns all information about a single cell in the grid. Returns
    /// `undefined` if the cell is empty.
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
                value: cell.string_value().to_string(),
                dependent_cells: None,
                python_code: None,
                python_output: None,
                array_cells: None,
                last_modified: None,
            })
            .unwrap()
        }
    }

    /// Returns the string contents of every cell.
    ///
    /// Output format is the same as `getCellStringsWithin()`.
    #[wasm_bindgen(js_name = "getCellStrings")]
    pub fn get_cell_strings(&self) -> JsValue {
        let bounds = self
            .grid
            .bounds()
            .unwrap_or(Rect::from_span(Pos::ORIGIN, Pos::ORIGIN));

        self.get_cell_strings_within(bounds.into())
    }
    /// Returns all information about every cell within `region`.
    ///
    /// All cells are concatenated into one long string, and each cell consists
    /// of an XY pair, an byte offset into that string, and a length of how many
    /// bytes to take from it. E.g.,
    ///
    /// ```json
    /// {
    ///     contents: "cell 1cell 2cell 3",
    ///     cell_data: [
    ///         -3, -12, 0,  6, // (-3, -12) contains "cell 1"
    ///         -3, -13, 6,  6, // (-3, -13) contains "cell 2"
    ///         -3, -15, 12, 6, // (-3, -12) contains "cell 3"
    ///     ]
    /// }
    /// ```
    #[wasm_bindgen(js_name = "getCellStringsWithin")]
    pub fn get_cell_strings_within(&self, region: JsRect) -> JsValue {
        let region = Rect::from(region);

        #[derive(Serialize, Debug, Default, Clone)]
        struct CellStrings {
            contents: String,
            cell_data: Vec<i64>,
        }
        let mut ret = CellStrings::default();

        for (&x, col) in self.grid.columns.range(region.x_range()) {
            for (y, cell) in col.cells_in_range(region.y_range()) {
                let string_start = ret.contents.len() as i64;
                ret.contents.push_str(&cell.string_value());
                let string_end = ret.contents.len() as i64;
                ret.cell_data.extend([x, y, string_start, string_end]);
            }
        }

        serde_wasm_bindgen::to_value(&ret).unwrap()
    }

    /// Returns the minimum bounding rectangle of the grid in cell coordinates,
    /// or `None` if it is empty.
    #[wasm_bindgen(js_name = "getCellBounds")]
    pub fn bounds(&self) -> Option<JsRect> {
        let ret = self.grid.bounds();
        Some(ret?.into())
    }

    /// Returns the minimum bounding rectangle of the grid in cell coordinates,
    /// considering only the cells within `region`, or `None` if the region is
    /// emptys.
    #[wasm_bindgen(js_name = "getCellBoundsWithin")]
    pub fn bounds_within(&self, region: JsRect) -> Option<JsRect> {
        let region = Rect::from(region);
        let ret = self.grid.bounds_within(region);
        Some(ret?.into())
    }
}
impl GridController {
    /// Executes a transaction and serializes the result for output to JS.
    fn js_transact(
        &mut self,
        f: impl FnOnce(&mut TransactionInProgress<'_>) -> Result<()>,
    ) -> JsValue {
        serde_wasm_bindgen::to_value(&self.transact(f))
            .expect("failed to serialize dirty quadrants")
    }

    /// Executes multiple commands as a **transaction**, which can be
    /// undone/redone as a single action.
    pub fn transact(
        &mut self,
        f: impl FnOnce(&mut TransactionInProgress<'_>) -> Result<()>,
    ) -> DirtyQuadrants {
        // Start the transaction.
        let mut t = TransactionInProgress {
            controller: self,
            reverse_commands: vec![],
            dirty: DirtyQuadrants::default(),
        };

        // Execute commands.
        let res = f(&mut t);

        // Reverse the order of the commands so that we can undo the whole
        // transaction by executing `reverse_commands` in order.
        t.reverse_commands.reverse();
        let reverse_transaction = Transaction {
            commands: t.reverse_commands,
        };
        let mut dirty_set = t.dirty;

        // Finish the transaction.
        match res {
            Ok(()) => {
                // Success! Push the reverse transaction to the undo stack.
                self.redo_stack.clear();
                self.undo_stack.push(reverse_transaction);
                dirty_set
            }
            Err(err) => {
                // There was an error, so roll back the transaction.
                for c in reverse_transaction.commands {
                    // I don't care if there was an error here when rolling
                    // back; we're about to panic out anyway.
                    let _ = self.exec_internal(c, &mut dirty_set);
                }
                panic!("error executing transaction: {err}")
            }
        }
    }

    /// Undoes one action, if there is an action to be undone. Returns a list of
    /// dirty quadrants or `None` if nothing happened.
    pub fn undo(&mut self) -> Option<DirtyQuadrants> {
        let transaction = self.undo_stack.pop()?;
        let mut reverse_commands = vec![];
        let mut dirty_set = DirtyQuadrants::default();
        for command in transaction.commands {
            reverse_commands.push(
                self.exec_internal(command, &mut dirty_set)
                    .expect("failed to undo command"),
            )
        }
        // Reverse the order of the commands so that we can redo the whole
        // transaction by executing `reverse_commands` in order.
        reverse_commands.reverse();

        self.redo_stack.push(Transaction {
            commands: reverse_commands,
        });
        Some(dirty_set)
    }
    /// Redoes one action, if there is an action to be redone. Returns a list of
    /// dirty quadrants or `None` if nothing happened.
    pub fn redo(&mut self) -> Option<DirtyQuadrants> {
        let transaction = self.redo_stack.pop()?;
        let mut reverse_commands = vec![];
        let mut dirty_set = DirtyQuadrants::default();

        for command in transaction.commands {
            reverse_commands.push(
                self.exec_internal(command, &mut dirty_set)
                    .expect("failed to redo command"),
            )
        }
        // Reverse the order of the commands so that we can undo the whole
        // transaction again by executing `reverse_commands` in order.
        reverse_commands.reverse();

        self.undo_stack.push(Transaction {
            commands: reverse_commands,
        });
        Some(dirty_set)
    }

    /// Returns a vector of cells that depend on `cell`.
    /// Does not return input `cell` as a dependent.
    pub fn get_dependent_cells(&self, cell: Pos) -> Vec<Pos> {
        self.graph.get_dependent_cells(cell)
    }

    /// Executes a command on the grid. Returns the reverse command.
    #[must_use = "save the reverse command to undo it later"]
    fn exec_internal(
        &mut self,
        command: Command,
        dirty_set: &mut DirtyQuadrants,
    ) -> Result<Command> {
        let reverse_command = match command {
            Command::SetCell(pos, contents) => {
                dirty_set.add_cell(pos);
                let old_value = self.grid.set_cell(pos, contents);
                Command::SetCell(pos, old_value)
            }
            Command::AddCellDependencies(p1, dependencies) => {
                self.graph.add_dependencies(p1, &dependencies).unwrap();
                Command::RemoveCellDependencies(p1, dependencies) // return reverse command
            }
            Command::RemoveCellDependencies(p1, dependencies) => {
                self.graph.remove_dependencies(p1, &dependencies);
                Command::AddCellDependencies(p1, dependencies) // return reverse command
            }
            Command::SetCellCode(p1, code_cell) => {
                let old_value = self.code_store.set_cell_code(p1, code_cell);
                Command::SetCellCode(p1, old_value)
            }
        };

        Ok(reverse_command)
    }

    pub fn get_grid(&self) -> &Grid {
        &self.grid
    }

    /// Returns whether the underlying [`Grid`] is valid.
    #[cfg(test)]
    pub fn is_valid(&self) -> bool {
        self.grid.is_valid()
    }
}

/// Rectangle type exported to JS.
#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[wasm_bindgen(js_name = "Rect")]
pub struct JsRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}
#[wasm_bindgen(js_class = "Rect")]
impl JsRect {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, w: f64, h: f64) -> Self {
        Self { x, y, w, h }
    }
}
impl From<Rect> for JsRect {
    fn from(rect: Rect) -> Self {
        JsRect {
            x: rect.x as _,
            y: rect.y as _,
            w: rect.w as _,
            h: rect.h as _,
        }
    }
}
impl From<JsRect> for Rect {
    fn from(rect: JsRect) -> Self {
        Rect {
            x: rect.x as _,
            y: rect.y as _,
            w: rect.w as _,
            h: rect.h as _,
        }
    }
}

/// Set of dirty quadrants.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct DirtyQuadrants(pub HashSet<(i64, i64)>);
impl Serialize for DirtyQuadrants {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeSeq;

        let mut seq = serializer.serialize_seq(Some(self.0.len() * 2))?;
        for (x, y) in &self.0 {
            seq.serialize_element(x)?;
            seq.serialize_element(y)?;
        }
        seq.end()
    }
}
impl DirtyQuadrants {
    fn add_cell(&mut self, pos: Pos) {
        self.0.insert(pos.quadrant());
    }
}

fn option_to_js_value(val: Option<impl Serialize>) -> JsValue {
    match val {
        Some(val) => serde_wasm_bindgen::to_value(&val).unwrap(),
        None => JsValue::NULL,
    }
}
