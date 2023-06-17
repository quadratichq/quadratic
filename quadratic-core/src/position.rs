use serde::{Deserialize, Serialize};
use std::fmt;
use wasm_bindgen::prelude::*;

/// Cell position {x, y}.
#[derive(
    Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash, Ord, PartialOrd,
)]
#[wasm_bindgen]
pub struct Pos {
    /// Column
    pub x: i64,
    /// Row
    pub y: i64,
    pub sheet: str,
}
#[wasm_bindgen]
impl Pos {
    #[wasm_bindgen(constructor)]
    pub fn new(x: i64, y: i64, sheet: str) -> Self {
        Self { x, y, sheet }
    }
}
impl Pos {
    pub const ORIGIN: Self = Self { x: 0, y: 0, sheet: "" };

    /// Returns which quadrant the cell position is in.
    pub fn quadrant(self) -> (i64, i64) {
        (
            self.x.div_euclid(crate::QUADRANT_SIZE as _),
            self.y.div_euclid(crate::QUADRANT_SIZE as _),
        )
    }

    pub fn copy(&self) -> Pos {
        *self
    }
}

impl fmt::Display for Pos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {}, {})", self.x, self.y, self.sheet)
    }
}
