use serde::{Deserialize, Serialize};
use std::fmt;
use wasm_bindgen::prelude::*;

/// Cell position {x, y}.
#[derive(
    Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Ord, PartialOrd,
)]
#[wasm_bindgen]
pub struct Pos {
    /// Column
    pub x: i64,
    /// Row
    pub y: i64,
}
#[wasm_bindgen]
impl Pos {
    #[wasm_bindgen(constructor)]
    pub fn new(x: i64, y: i64) -> Self {
        Self { x, y }
    }
}
impl Pos {
    pub const ORIGIN: Self = Self { x: 0, y: 0 };

    /// Returns which quadrant the cell position is in.
    pub fn quadrant(self) -> (i64, i64) {
        (
            self.x.div_euclid(crate::QUADRANT_SIZE as _),
            self.y.div_euclid(crate::QUADRANT_SIZE as _),
        )
    }

    /// Returns an A1-style reference to the cell position.
    pub fn a1_string(self) -> String {
        crate::util::column_name(self.x) + &self.y.to_string()
    }
}

impl fmt::Display for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}
