use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

mod has_content;
pub mod jump;
mod move_cursor;
mod traverse;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}
