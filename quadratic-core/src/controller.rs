use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{
    grid::{CellRef, CellValue, Grid, SheetId},
    Rect,
};

pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,
}
impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new())
    }
    pub fn load(file: JsValue) -> Result<Self, JsValue> {
        let grid =
            Grid::from_legacy(&serde_wasm_bindgen::from_value(file)?).map_err(|e| e.to_string())?;
        Ok(Self::from_grid(grid))
    }
    fn from_file(grid: Grid) -> Self {
        GridController {
            grid,
            undo_stack: vec![],
            redo_stack: vec![],
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Transaction {
    SetCell { pos: CellRef, value: CellValue },
}
