#![warn(rust_2018_idioms, clippy::if_then_some_else_none)]

use async_trait::async_trait;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

#[macro_use]
pub mod util;
mod cell;
pub mod formulas;
mod position;

pub use cell::{Cell, CellTypes, JsCell};
use formulas::GridProxy;
pub use position::Pos;

pub const QUADRANT_SIZE: u64 = 16;

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    // - `catch` = catch JS exceptions and turn them into Rust `Err`
    #[wasm_bindgen(catch, js_name = "GetCellsDB", js_namespace = window)]
    async fn get_cells_db(p0_x: i64, p0_y: i64, p1_x: i64, p1_y: i64) -> Result<JsValue, JsValue>;
}

#[wasm_bindgen]
pub fn hello() {
    // say hello, when loaded successfully
    log("[WASM/Rust] quadratic-core ready")
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct JsFormulaResult {
    pub cells_accessed: Vec<[i64; 2]>,
    pub success: bool,
    pub error_span: Option<[usize; 2]>,
    pub error_msg: Option<String>,
    pub output_value: Option<String>,
}

#[wasm_bindgen]
pub async fn eval_formula(formula_string: &str, x: f64, y: f64) -> JsValue {
    let mut grid_proxy = JsGridProxy::default();
    let x = x as i64;
    let y = y as i64;
    let pos = Pos { x, y };

    let formula_result = match formulas::parse_formula(formula_string, pos) {
        Ok(formula) => formula.eval(&mut grid_proxy, pos).await,
        Err(e) => Err(e),
    };
    let cells_accessed = grid_proxy
        .cells_accessed
        .into_iter()
        .map(|pos| [pos.x, pos.y])
        .collect_vec();

    let result = match formula_result {
        Ok(formula_output) => JsFormulaResult {
            cells_accessed,
            success: true,
            error_span: None,
            error_msg: None,
            output_value: Some(formula_output.to_string()),
        },
        Err(error) => JsFormulaResult {
            cells_accessed,
            success: false,
            error_span: error.span.map(|span| [span.start, span.end]),
            error_msg: Some(error.msg.to_string()),
            output_value: None,
        },
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[derive(Debug, Default, Clone)]
struct JsGridProxy {
    pub cells_accessed: HashSet<Pos>,
}
#[async_trait(?Send)]
impl GridProxy for JsGridProxy {
    async fn get(&mut self, pos: Pos) -> Option<String> {
        self.cells_accessed.insert(pos);
        let cell_value_array = get_cells_db(pos.x, pos.y, pos.x, pos.y).await.ok()?;
        let cell_value = js_sys::Reflect::get(&cell_value_array, &0.into()).ok()?;
        let cell_string = js_sys::Reflect::get(&cell_value, &"value".into()).ok()?;
        cell_string.as_string()
    }
}
