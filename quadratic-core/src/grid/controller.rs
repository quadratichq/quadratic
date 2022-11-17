use anyhow::Result;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
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

    /// Sets a list of cells on the grid and returns a list of dirty quadrants
    /// (XY pairs flattened). Example input:
    ///
    /// ```js
    /// set_cells(JSON.stringify([
    ///     [{x: 5, y: -3}, {Int: 10}],
    ///     [{x: 5, y: 6}, {Text: "hello"}],
    /// ]));
    /// ```
    #[wasm_bindgen(js_name = "setCells")]
    pub fn set_cells(&mut self, cells: &str) -> JsValue {
        let dirty_set = self.execute(Command::SetCells(
            serde_json::from_str(cells).expect("bad cell list"),
        ));
        serde_wasm_bindgen::to_value(&dirty_set).unwrap()
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

    /// Empties the grid. **This does not affect undo/redo.**
    pub fn empty(&mut self) {
        self.grid = Grid::new();
    }
}
impl GridController {
    /// Undoes one action, if there is an action to be undone. Returns a list of
    /// dirty quadrants or `None` if nothing happened.
    pub fn undo(&mut self) -> Option<DirtyQuadrants> {
        let command = self.undo_stack.pop()?;
        let (reverse_command, dirty_set) = self.exec_internal(command).unwrap();
        self.redo_stack.push(reverse_command);
        Some(dirty_set)
    }
    /// Redoes one action, if there is an action to be redone. Returns a list of
    /// dirty quadrants or `None` if nothing happened.
    pub fn redo(&mut self) -> Option<DirtyQuadrants> {
        let command = self.redo_stack.pop()?;
        let (reverse_command, dirty_set) = self.exec_internal(command).unwrap();
        self.undo_stack.push(reverse_command);
        Some(dirty_set)
    }

    /// Executes a command on the grid, managing the undo and redo stacks
    /// appropriately. Returns a set of dirty quadrants.
    pub fn execute(&mut self, command: Command) -> DirtyQuadrants {
        self.redo_stack.clear();
        let (reverse_command, dirty_set) = self
            .exec_internal(command)
            .expect("error executing command");
        self.undo_stack.push(reverse_command);
        dirty_set
    }

    /// Executes a command on the grid. Returns the reverse command and a set of
    /// dirty quadrants.
    fn exec_internal(&mut self, command: Command) -> Result<(Command, DirtyQuadrants)> {
        let mut dirty_set = DirtyQuadrants::default();

        let reverse_command = match command {
            Command::SetCells(cells) => {
                let mut old_values = cells
                    .into_iter()
                    .map(|(pos, contents)| {
                        dirty_set.add_cell(pos);
                        (pos, self.grid.set_cell(pos, contents))
                    })
                    .collect_vec();
                // In case there are duplicates, make sure to set them in the
                // reverse order. For example, suppose a cell initially contains
                // the value "A", then we run a command that sets it to "B" and
                // then "C" and then "D". The reverse command should set the
                // cell to "C" and then "B" and then finally "A".
                old_values.reverse();

                Command::SetCells(old_values)
            }
        };

        Ok((reverse_command, dirty_set))
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
