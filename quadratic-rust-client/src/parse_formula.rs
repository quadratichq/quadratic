use quadratic_core::{
    formulas::{self, RangeRef},
    Pos, Span, Spanned,
};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct JsFormulaParseResult {
    pub parse_error_msg: Option<String>,
    pub parse_error_span: Option<Span>,

    pub cell_refs: Vec<JsCellRefSpan>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
#[wasm_bindgen(js_name = "parseFormula")]
pub fn parse_formula(formula_string: &str, x: f64, y: f64) -> String {
    let x = x as i64;
    let y = y as i64;
    let pos = Pos { x, y };

    let parse_error = formulas::parse_formula(formula_string, pos).err();

    let result = JsFormulaParseResult {
        parse_error_msg: parse_error.as_ref().map(|e| e.msg.to_string()),
        parse_error_span: parse_error.and_then(|e| e.span),
        cell_refs: formulas::find_cell_references(formula_string, pos)
            .into_iter()
            .map(|mut spanned| {
                if let RangeRef::CellRange { mut start, mut end } = spanned.inner {
                    start.replace_unbounded(0);
                    end.replace_unbounded(-1);
                    spanned.inner = RangeRef::CellRange { start, end };
                }
                spanned.into()
            })
            .collect(),
    };

    serde_json::to_string(&result).unwrap()
}

#[wasm_bindgen(js_name = "checkFormula")]
pub fn check_formula(formula_string: &str, x: i32, y: i32) -> bool {
    formulas::parse_and_check_formula(formula_string, x as i64, y as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core::{
        formulas::{CellRef, CellRefCoord, RangeRef},
        Span,
    };

    /// Run this test with `--nocapture` to generate the example for the
    /// `parse_formula()` docs.
    #[test]
    fn example_parse_formula_output() {
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
