use super::*;

#[wasm_bindgen]
impl Rect {
    /// Constructs a rectangle spanning two positions
    #[wasm_bindgen(constructor)]
    pub fn js_new_span(pos1: Pos, pos2: Pos) -> Rect {
        Self::new_span(pos1, pos2)
    }

    /// Constructs a new rectangle containing only a single cell.
    #[wasm_bindgen(js_name = "newSinglePos")]
    pub fn js_single_pos(pos: Pos) -> Rect {
        Self::single_pos(pos)
    }
    /// Extends the rectangle enough to include a cell.
    #[wasm_bindgen(js_name = "extendTo")]
    pub fn js_extend_to(&mut self, pos: Pos) {
        self.extend_to(pos);
    }

    /// Returns whether a position is contained within the rectangle.
    #[wasm_bindgen(js_name = "contains")]
    pub fn js_contains(&self, pos: Pos) -> bool {
        self.contains(pos)
    }
}
