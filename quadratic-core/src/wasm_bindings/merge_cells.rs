use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{
    Pos, Rect,
    compression::{SerializationFormat, deserialize},
    grid::sheet::merge_cells::MergeCells,
};

#[derive(Debug, Default, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct JsMergeCells {
    merge_cells: MergeCells,
}

impl From<&MergeCells> for JsMergeCells {
    fn from(merge_cells: &MergeCells) -> Self {
        Self {
            merge_cells: merge_cells.clone(),
        }
    }
}

#[wasm_bindgen]
impl JsMergeCells {
    #[wasm_bindgen(js_name = "createFromBytes")]
    pub fn create(merge_cells: Vec<u8>) -> Self {
        match deserialize::<MergeCells>(&SerializationFormat::Bincode, &merge_cells) {
            Ok(merge_cells) => Self { merge_cells },
            Err(e) => {
                dbgjs!(&format!("Error creating JsMergeCells: {e}"));
                Self::default()
            }
        }
    }

    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            merge_cells: MergeCells::default(),
        }
    }

    #[wasm_bindgen(js_name = "isMergeCells")]
    pub fn is_merge_cells(&self, x: i32, y: i32) -> bool {
        self.merge_cells.is_merge_cell(Pos {
            x: x as i64,
            y: y as i64,
        })
    }

    #[wasm_bindgen(js_name = "getMergeCells")]
    pub fn js_get_merge_cells(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<Rect> {
        self.merge_cells
            .get_merge_cells(Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64))
    }

    #[wasm_bindgen(js_name = "getMergeCellRect")]
    pub fn js_get_merge_cell_rect(&self, x: i32, y: i32) -> Option<Rect> {
        self.merge_cells.get_merge_cell_rect(Pos {
            x: x as i64,
            y: y as i64,
        })
    }
}

impl JsMergeCells {
    /// Get a reference to the internal MergeCells
    pub(crate) fn get_merge_cells(&self) -> &MergeCells {
        &self.merge_cells
    }
}
