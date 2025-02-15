use serde::{Deserialize, Serialize};
use ts_rs::TS;

mod jump;
mod move_cursor;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}
