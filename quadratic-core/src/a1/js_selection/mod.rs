//! Wrapper around A1Selection for use in JS rust calls.

use std::str::FromStr;

use ts_rs::TS;
use wasm_bindgen::prelude::*;

use crate::{
    a1::A1Context,
    grid::{DataTable, Sheet, SheetId},
    Pos, Rect, SheetRect,
};

use super::A1Selection;

pub mod create;
pub mod query;
pub mod select;
pub mod validate_name;

#[derive(Debug, Clone, TS)]
#[wasm_bindgen]
pub struct JsCoordinate {
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
pub struct JsSelection {
    selection: A1Selection,
}

impl From<Pos> for JsCoordinate {
    fn from(pos: Pos) -> Self {
        JsCoordinate {
            x: pos.x as u32,
            y: pos.y as u32,
        }
    }
}

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(js_name = "excludeCells")]
    pub fn exclude_cells(&mut self, x0: u32, y0: u32, x1: u32, y1: u32, context: String) {
        let Ok(context) = serde_json::from_str(&context) else {
            dbgjs!("Unable to unwrap context in exclude_cells");
            return;
        };
        self.selection.exclude_cells(
            Pos::new(x0 as i64, y0 as i64),
            Some(Pos::new(x1 as i64, y1 as i64)),
            &context,
        );
    }
}
