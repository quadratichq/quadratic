use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{
    grid::{CellRef, CellValue, File, SheetId},
    Rect,
};

pub struct FileController {
    file: File,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,
}
impl FileController {
    pub fn new() -> Self {
        Self::from_file(File::new())
    }
    pub fn load(file: JsValue) -> Result<Self, JsValue> {
        let file =
            File::from_legacy(&serde_wasm_bindgen::from_value(file)?).map_err(|e| e.to_string())?;
        Ok(Self::from_file(file))
    }
    fn from_file(file: File) -> Self {
        FileController {
            file,
            undo_stack: vec![],
            redo_stack: vec![],
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Transaction {
    SetCell { pos: CellRef, value: CellValue },
}
