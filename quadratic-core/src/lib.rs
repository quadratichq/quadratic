#![warn(rust_2018_idioms, clippy::if_then_some_else_none)]

use wasm_bindgen::prelude::*;

pub mod formulas;
pub mod grid;

#[cfg(test)]
mod tests;

pub use grid::*;

pub const QUADRANT_SIZE: u64 = 16;

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn hello() {
    // say hello, when loaded successfully
    log("[WASM/Rust] quadratic-core ready")
}

#[test]
fn test_ser() {
    let mut grid = Grid::new();
    for i in 0..36 {
        let x = i % 6;
        let y = i / 6;
        if (x / 3 + y / 2) % 2 == 1 {
            grid.set_cell(Pos { x, y }, Cell::Int(100 + 10 * y + x));
        }
    }
    println!("{:?}", grid);
    dbg!(&grid);
    println!();
    println!();
    println!();
    for y in 0..6 {
        for x in 0..6 {
            print!("{:?},", grid.get_cell(Pos { x, y }));
        }
        println!();
    }
    panic!()
}
