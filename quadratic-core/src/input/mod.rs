use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

pub mod cache;
mod jump;
mod move_cursor;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}
