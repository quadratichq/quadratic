//! Allow manipulation of A1Selection via JS rust calls.

use std::str::FromStr;

use ts_rs::TS;
use wasm_bindgen::prelude::*;

use crate::{
    grid::{SheetId, TableMap},
    Pos, Rect, SheetRect,
};

use super::{A1Selection, SheetNameIdMap};

pub mod create;
pub mod query;
pub mod ref_range_bounds_select;
pub mod table_ref_select;

#[derive(Debug, Clone, TS)]
#[wasm_bindgen]
pub struct JsCoordinate {
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
pub struct JsSelection {
    selection: A1Selection,
    sheet_id: SheetId,
    table_map: TableMap,
}

impl JsSelection {
    pub fn table_map(&self) -> &TableMap {
        &self.table_map
    }
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
    pub fn exclude_cells(&mut self, x0: u32, y0: u32, x1: u32, y1: u32) {
        self.selection.exclude_cells(
            Pos::new(x0 as i64, y0 as i64),
            Some(Pos::new(x1 as i64, y1 as i64)),
            &self.table_map,
        );
    }
}
