use super::*;

#[wasm_bindgen]
impl Pos {
    #[wasm_bindgen(constructor)]
    pub fn js_new(x: f64, y: f64) -> Self {
        Self {
            x: x as i64,
            y: y as i64,
        }
    }
}
