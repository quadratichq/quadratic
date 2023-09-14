#[cfg(test)]
#[macro_use]
mod tests;

mod ast;
mod cell_ref;
mod criteria;
mod ctx;
pub mod functions;
mod grid_proxy;
mod lexer;
pub mod lsp;
mod params;
mod parser;
mod wildcards;

use ast::AstNode;
pub use ast::Formula;
pub use cell_ref::*;
pub use criteria::Criterion;
pub use ctx::Ctx;
use functions::FormulaFnArgs;
pub use grid_proxy::GridProxy;
use params::{Param, ParamKind};
pub use parser::{find_cell_references, parse_formula};
use wildcards::wildcard_pattern_to_regex;

// /// Evaluates a formula and returns a formula result.
// pub async fn eval_formula<G: GridProxy>(
//     formula_string: &str,
//     x: f64,
//     y: f64,
//     grid_proxy: G,
// ) -> JsCodeResult {
//     use std::collections::HashSet;

//     use crate::{CellValue, Pos, Value};

//     struct CellAccessGridProxy<G> {
//         inner: G,
//         cells_accessed: HashSet<Pos>,
//     }
//     #[async_trait(?Send)]
//     impl<G: GridProxy> GridProxy for CellAccessGridProxy<G> {}

//     // Wrap the grid proxy in a new one that tracks cell access.
//     let mut grid_proxy = CellAccessGridProxy {
//         inner: grid_proxy,
//         cells_accessed: HashSet::new(),
//     };

//     let x = x as i64;
//     let y = y as i64;
//     let pos = Pos { x, y };

//     let formula_result = match parse_formula(formula_string, pos) {
//         Ok(formula) => formula.eval(&mut grid_proxy, pos).await,
//         Err(e) => Err(e),
//     };
//     let cells_accessed = grid_proxy
//         .get(pos)
//         .cells_accessed
//         .into_iter()
//         .map(|pos| [pos.x, pos.y])
//         .collect_vec();

//     match formula_result {
//         Ok(formula_output) => {
//             let mut output_value = None;
//             let mut array_output = None;
//             match formula_output {
//                 Value::Array(a) => {
//                     array_output = Some(
//                         a.rows()
//                             .map(|row| row.iter().map(|cell| cell.to_string()).collect())
//                             .collect(),
//                     );
//                 }
//                 Value::Single(non_array_value) => output_value = Some(non_array_value.to_string()),
//             };
//             JsCodeResult {
//                 cells_accessed,
//                 success: true,
//                 error_span: None,
//                 error_msg: None,
//                 output_value,
//                 array_output,
//             }
//         }
//         Err(error) => JsCodeResult {
//             cells_accessed,
//             success: false,
//             error_span: error.span.map(|span| [span.start, span.end]),
//             error_msg: Some(error.msg.to_string()),
//             output_value: None,
//             array_output: None,
//         },
//     }
// }
