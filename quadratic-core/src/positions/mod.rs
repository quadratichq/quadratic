use serde::{Deserialize, Serialize};

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

mod multi_pos;
mod multi_sheet_pos;
mod pos;
mod sheet_pos;
mod table_pos;

pub use multi_pos::*;
pub use multi_sheet_pos::*;
pub use pos::*;
pub use sheet_pos::*;
pub use table_pos::*;

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), wasm_bindgen)]
pub struct ScreenRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}
