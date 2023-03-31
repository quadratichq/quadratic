#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(clippy::diverging_sub_expression, clippy::match_like_matches_macro)]

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
use formulas::{GridProxy, Value};
pub use position::Pos;

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
    log("[WASM/Rust] quadratic-core ready");
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct JsFormulaResult {
    pub cells_accessed: Vec<[i64; 2]>,
    pub success: bool,
    pub error_span: Option<[usize; 2]>,
    pub error_msg: Option<String>,
    pub output_value: Option<String>,
    pub array_output: Option<Vec<Vec<String>>>,
}

/// Evaluates a formula and returns a formula result.
#[wasm_bindgen]
pub async fn eval_formula(
    formula_string: &str,
    x: f64,
    y: f64,
    grid_accessor_fn: js_sys::Function,
) -> JsValue {
    let mut grid_proxy = JsGridProxy::new(grid_accessor_fn);
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
        Ok(formula_output) => {
            let mut output_value = None;
            let mut array_output = None;
            match formula_output.inner {
                Value::Array(a) => {
                    array_output = Some(
                        a.iter()
                            .map(|row| row.iter().map(|cell| cell.to_string()).collect())
                            .collect(),
                    );
                }
                non_array_value => output_value = Some(non_array_value.to_string()),
            };
            JsFormulaResult {
                cells_accessed,
                success: true,
                error_span: None,
                error_msg: None,
                output_value,
                array_output,
            }
        }
        Err(error) => JsFormulaResult {
            cells_accessed,
            success: false,
            error_span: error.span.map(|span| [span.start, span.end]),
            error_msg: Some(error.msg.to_string()),
            output_value: None,
            array_output: None,
        },
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct JsFormulaParseResult {
    pub parse_error_msg: Option<String>,
    pub parse_error_span: Option<formulas::Span>,

    pub cell_refs: Vec<JsCellRefSpan>,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
pub struct JsCellRefSpan {
    pub span: formulas::Span,
    pub cell_ref: formulas::RangeRef,
}
impl From<formulas::Spanned<formulas::RangeRef>> for JsCellRefSpan {
    fn from(value: formulas::Spanned<formulas::RangeRef>) -> Self {
        JsCellRefSpan {
            span: value.span,
            cell_ref: value.inner,
        }
    }
}

/// Parses a formula and returns a partial result.
///
/// Example output:
/// ```json
/// {
///   "parse_error_msg": "Bad argument count",
///   "parse_error_span": { "start": 12, "end": 46 },
///   "cell_refs": [
///     {
///       "span": { "start": 1, "end": 4 },
///       "cell_ref": {
///         "Cell": {
///           "x": { "Relative": 0 },
///           "y": { "Absolute": 1 }
///         }
///       }
///     },
///     {
///       "span": { "start": 15, "end": 25 },
///       "cell_ref": {
///         "CellRange": [
///           {
///             "x": { "Absolute": 0 },
///             "y": { "Relative": -2 }
///           },
///           {
///             "x": { "Absolute": 0 },
///             "y": { "Relative": 2 }
///           }
///         ]
///       }
///     }
///   ]
/// }
/// ```
///
/// `parse_error_msg` may be null, and `parse_error_span` may be null. Even if
/// `parse_error_span`, `parse_error_msg` may still be present.
#[wasm_bindgen]
pub async fn parse_formula(formula_string: &str, x: f64, y: f64) -> JsValue {
    let x = x as i64;
    let y = y as i64;
    let pos = Pos { x, y };

    let parse_error = formulas::parse_formula(formula_string, pos).err();

    let result = JsFormulaParseResult {
        parse_error_msg: parse_error.as_ref().map(|e| e.msg.to_string()),
        parse_error_span: parse_error.and_then(|e| e.span),

        cell_refs: formulas::find_cell_references(formula_string, pos)
            .into_iter()
            .map(|r| r.into())
            .collect(),
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[derive(Debug, Clone)]
struct JsGridProxy {
    grid_accessor_fn: js_sys::Function,
    cells_accessed: HashSet<Pos>,
}
impl JsGridProxy {
    fn new(grid_accessor_fn: js_sys::Function) -> Self {
        Self {
            grid_accessor_fn,
            cells_accessed: HashSet::new(),
        }
    }
}
#[async_trait(?Send)]
impl GridProxy for JsGridProxy {
    async fn get(&mut self, pos: Pos) -> Option<String> {
        let js_this = JsValue::UNDEFINED;

        self.cells_accessed.insert(pos);
        let cell_value_array = self
            .grid_accessor_fn
            .bind2(&js_this, &pos.x.into(), &pos.y.into()) // Upper-left corner
            .call2(&js_this, &pos.x.into(), &pos.y.into()) // Lower-right corner
            .map(js_sys::Promise::from)
            .map(wasm_bindgen_futures::JsFuture::from)
            .ok()?
            .await
            .ok()?;
        let cell_value = js_sys::Reflect::get(&cell_value_array, &0.into()).ok()?;
        let cell_string = js_sys::Reflect::get(&cell_value, &"value".into()).ok()?;
        cell_string.as_string()
    }
}

/// Returns a column's name from its number.
#[wasm_bindgen]
pub fn column_name(n: f64) -> String {
    util::column_name(n.floor() as i64)
}
/// Returns a column number from a name, or `null` if it is invalid or out of range.
#[wasm_bindgen]
pub fn column_from_name(s: &str) -> Option<f64> {
    Some(util::column_from_name(s)? as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Run this test with `--nocapture` to generate the example for the
    /// `parse_formula()` docs.
    #[test]
    fn example_parse_formula_output() {
        use crate::formulas::{CellRef, CellRefCoord, RangeRef, Span};

        let example_result = JsFormulaParseResult {
            parse_error_msg: Some("Bad argument count".to_string()),
            parse_error_span: Some(Span { start: 12, end: 46 }),
            cell_refs: vec![
                JsCellRefSpan {
                    span: Span { start: 1, end: 4 },
                    cell_ref: RangeRef::Cell(CellRef {
                        x: CellRefCoord::Relative(0),
                        y: CellRefCoord::Absolute(1),
                    }),
                },
                JsCellRefSpan {
                    span: Span { start: 15, end: 25 },
                    cell_ref: RangeRef::CellRange(
                        CellRef {
                            x: CellRefCoord::Absolute(0),
                            y: CellRefCoord::Relative(-2),
                        },
                        CellRef {
                            x: CellRefCoord::Absolute(0),
                            y: CellRefCoord::Relative(2),
                        },
                    ),
                },
            ],
        };

        println!("{}", serde_json::to_string_pretty(&example_result).unwrap());
    }
}
