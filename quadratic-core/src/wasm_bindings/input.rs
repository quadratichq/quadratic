use wasm_bindgen::prelude::*;

use crate::{Pos, input::Direction};

/// Returns the SheetPos after a jump (ctrl/cmd + arrow key)
#[wasm_bindgen]
pub fn jump_cursor(col: i32, row: i32, direction: Direction) -> Pos {
    match direction {
        Direction::Up => self.jump_up(current),
        Direction::Down => self.jump_down(current),
        Direction::Left => self.jump_left(current),
        Direction::Right => self.jump_right(current),
    }
}
