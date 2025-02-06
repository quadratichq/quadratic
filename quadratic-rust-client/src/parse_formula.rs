use std::str::FromStr;

use quadratic_core::{
    a1::{A1Context, CellRefRange, SheetCellRefRange},
    formulas,
    grid::SheetId,
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
    pub cell_ref: SheetCellRefRange,
}
impl From<Spanned<SheetCellRefRange>> for JsCellRefSpan {
    fn from(value: Spanned<SheetCellRefRange>) -> Self {
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
pub fn parse_formula(formula_string: &str, ctx: &str, sheet_id: &str, x: f64, y: f64) -> String {
    let ctx = serde_json::from_str::<A1Context>(ctx).expect("invalid A1Context");
    let sheet_id = SheetId::from_str(sheet_id).expect("invalid SheetId");

    let x = x as i64;
    let y = y as i64;
    let code_cell_pos = Pos { x, y }.to_sheet_pos(sheet_id);

    let parse_error = formulas::parse_formula(formula_string, &ctx, code_cell_pos).err();

    let result = JsFormulaParseResult {
        parse_error_msg: parse_error.as_ref().map(|e| e.msg.to_string()),
        parse_error_span: parse_error.and_then(|e| e.span),
        cell_refs: formulas::find_cell_references(formula_string, &ctx, code_cell_pos)
            .into_iter()
            .map(|spanned| spanned.into())
            .collect(),
    };

    serde_json::to_string(&result).unwrap()
}

#[wasm_bindgen(js_name = "checkFormula")]
pub fn check_formula(formula_string: &str, ctx: &str, sheet_id: &str, x: i32, y: i32) -> bool {
    let ctx = serde_json::from_str::<A1Context>(ctx).expect("invalid A1Context");
    let sheet_id = SheetId::from_str(sheet_id).expect("invalid SheetId");
    let pos = Pos {
        x: x as i64,
        y: y as i64,
    }
    .to_sheet_pos(sheet_id);
    formulas::parse_and_check_formula(formula_string, &ctx, pos)
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core::{
        a1::{CellRefCoord, SheetCellRefRange},
        Span,
    };

    /// Run this test with `--nocapture` to generate the example for the
    /// `parse_formula()` docs.
    #[test]
    fn example_parse_formula_output() {
        let sheet_id = SheetId::new();
        let example_result = JsFormulaParseResult {
            parse_error_msg: Some("Bad argument count".to_string()),
            parse_error_span: Some(Span { start: 12, end: 46 }),
            cell_refs: vec![
                JsCellRefSpan {
                    span: Span { start: 1, end: 4 },
                    cell_ref: SheetCellRefRange {
                        sheet_id,
                        cells: CellRefRange::new_sheet_ref(
                            CellRefCoord::new_rel(1),
                            CellRefCoord::new_abs(2),
                            CellRefCoord::new_rel(1),
                            CellRefCoord::new_abs(2),
                        ),
                    },
                },
                JsCellRefSpan {
                    span: Span { start: 15, end: 25 },
                    cell_ref: SheetCellRefRange {
                        sheet_id,
                        cells: CellRefRange::new_sheet_ref(
                            CellRefCoord::new_abs(1),
                            CellRefCoord::new_rel(3),
                            CellRefCoord::new_abs(1),
                            CellRefCoord::new_rel(7),
                        ),
                    },
                },
            ],
        };

        println!("{}", serde_json::to_string_pretty(&example_result).unwrap());
    }
}
