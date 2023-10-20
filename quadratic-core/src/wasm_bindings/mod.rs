use serde::{Deserialize, Serialize};
use ts_rs::TS;
use wasm_bindgen::prelude::*;

pub mod controller;
pub mod js;
pub mod lsp;
pub mod pos;
pub mod rect;

use crate::controller::GridController;
use crate::grid::*;
use crate::*;

#[wasm_bindgen(typescript_custom_section)]
const TYPESCRIPT_IMPORT: &str = r#"
import * as types from './types';
"#;

#[wasm_bindgen]
pub fn hello() {
    // say hello, when loaded successfully
    js::log("[WASM/Rust] quadratic-core ready");
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

#[derive(Serialize, Deserialize, Debug, Default, Clone, TS)]
pub struct JsCodeResult {
    pub cells_accessed: Vec<[i64; 2]>,
    pub formatted_code: Option<String>,
    pub success: bool,
    pub error_span: Option<[u32; 2]>,
    pub error_msg: Option<String>,
    pub input_python_std_out: Option<String>,
    pub output_value: Option<String>,
    pub array_output: Option<Vec<Vec<String>>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
pub struct JsComputeResult {
    pub complete: bool,
    pub rect: Option<Rect>,
    pub sheet_id: Option<String>,
    pub line_number: Option<i64>,
    pub result: Option<JsCodeResult>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, TS)]
pub struct JsFormulaParseResult {
    pub parse_error_msg: Option<String>,
    pub parse_error_span: Option<Span>,

    pub cell_refs: Vec<JsCellRefSpan>,
}
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
pub struct JsCellRefSpan {
    pub span: Span,
    pub cell_ref: formulas::RangeRef,
}
impl From<Spanned<formulas::RangeRef>> for JsCellRefSpan {
    fn from(value: Spanned<formulas::RangeRef>) -> Self {
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
    // fn new(grid_accessor_fn: js_sys::Function) -> Self {
    //     Self {
    //         grid_accessor_fn,
    //         cells_accessed: HashSet::new(),
    //     }
    // }

    async fn get_cell_jsvalue(&mut self, pos: Pos) -> Result<JsValue, JsValue> {
        // Record that we accessed this cell.
        self.cells_accessed.insert(pos);

        let grid_accessor_fn = self.grid_accessor_fn.clone();
        let x: JsValue = pos.x.into();
        let y: JsValue = pos.y.into();
        // Access a rectangle of one cell, ranging from (x, y) to (x, y).
        Ok(jsexpr!(grid_accessor_fn(x, y, x, y).await[0].value))
    }
}
#[async_trait(?Send)]
impl GridProxy for JsGridProxy {
    async fn get(&mut self, pos: Pos) -> CellValue {
        let jsvalue = match self.get_cell_jsvalue(pos).await {
            Ok(v) => v,
            Err(_) => return CellValue::Blank,
        };

        let string = match jsvalue.as_string() {
            Some(s) => s,
            None => return CellValue::Blank,
        };

        if let Ok(n) = BigDecimal::from_str_radix(&string, 10) {
            CellValue::Number(n)
        } else if string.is_empty() {
            CellValue::Blank
        } else {
            CellValue::Text(string)
        }
    }
}

#[cfg(test)]
mod tests {
    /// Run this test with `--nocapture` to generate the example for the
    /// `parse_formula()` docs.
    #[test]
    fn example_parse_formula_output() {
        use crate::formulas::{CellRef, CellRefCoord, RangeRef};
        use crate::wasm_bindings::*;
        use crate::Span;

        let example_result = JsFormulaParseResult {
            parse_error_msg: Some("Bad argument count".to_string()),
            parse_error_span: Some(Span { start: 12, end: 46 }),
            cell_refs: vec![
                JsCellRefSpan {
                    span: Span { start: 1, end: 4 },
                    cell_ref: RangeRef::from(CellRef {
                        sheet: None,
                        x: CellRefCoord::Relative(0),
                        y: CellRefCoord::Absolute(1),
                    }),
                },
                JsCellRefSpan {
                    span: Span { start: 15, end: 25 },
                    cell_ref: RangeRef::CellRange {
                        start: CellRef {
                            sheet: None,
                            x: CellRefCoord::Absolute(0),
                            y: CellRefCoord::Relative(-2),
                        },
                        end: CellRef {
                            sheet: None,
                            x: CellRefCoord::Absolute(0),
                            y: CellRefCoord::Relative(2),
                        },
                    },
                },
            ],
        };

        println!("{}", serde_json::to_string_pretty(&example_result).unwrap());
    }
}
