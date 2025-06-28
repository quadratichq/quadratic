use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    Pos, Span, Spanned,
    a1::{A1Context, SheetCellRefRange},
    grid::{JsCellsAccessed, SheetId},
};

use super::parse_formula;

#[derive(Serialize, Deserialize, Debug, Default, Clone, TS)]
pub struct JsFormulaParseResult {
    pub parse_error_msg: Option<String>,
    pub parse_error_span: Option<Span>,

    pub cells_accessed: Vec<JsCellsAccessed>,
    pub spans: Vec<Span>,
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
pub fn parse_formula_results(
    formula_string: &str,
    ctx: &A1Context,
    sheet_id: SheetId,
    x: i32,
    y: i32,
) -> JsFormulaParseResult {
    let x = x as i64;
    let y = y as i64;
    let code_cell_pos = Pos { x, y }.to_sheet_pos(sheet_id);

    let parse_error = parse_formula(formula_string, ctx, code_cell_pos).err();

    let parse_result = super::find_cell_references(formula_string, ctx, code_cell_pos);
    let spans = parse_result.iter().map(|spanned| spanned.span).collect();
    let cells_accessed = parse_result
        .into_iter()
        .filter_map(|spanned| spanned.inner.ok().map(|r| r.into()))
        .collect();

    JsFormulaParseResult {
        parse_error_msg: parse_error.as_ref().map(|e| e.msg.to_string()),
        parse_error_span: parse_error.and_then(|e| e.span),
        cells_accessed,
        spans,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        Rect, Span,
        a1::{CellRefCoord, CellRefRange},
    };

    /// Run this test with `--nocapture` to generate the example for the
    /// `parse_formula()` docs.
    #[test]
    fn example_parse_formula_output() {
        let sheet_id = SheetId::new();
        let example_result = JsFormulaParseResult {
            parse_error_msg: Some("Bad argument count".to_string()),
            parse_error_span: Some(Span { start: 12, end: 46 }),
            cells_accessed: vec![
                JsCellsAccessed {
                    sheet_id: sheet_id.to_string(),
                    ranges: vec![CellRefRange::new_sheet_ref(
                        CellRefCoord::new_rel(1),
                        CellRefCoord::new_rel(2),
                        CellRefCoord::new_rel(1),
                        CellRefCoord::new_rel(2),
                    )],
                },
                JsCellsAccessed {
                    sheet_id: sheet_id.to_string(),
                    ranges: vec![CellRefRange::new_sheet_ref(
                        CellRefCoord::new_rel(1),
                        CellRefCoord::new_rel(3),
                        CellRefCoord::new_rel(1),
                        CellRefCoord::new_rel(7),
                    )],
                },
            ],
            spans: vec![Span { start: 1, end: 4 }, Span { start: 15, end: 25 }],
        };

        println!("{}", serde_json::to_string_pretty(&example_result).unwrap());
    }

    #[test]
    fn test_parse_formula_table() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B10"))]);
        let sheet_id = SheetId::TEST;

        let result = parse_formula_results("Table1", &context, sheet_id, 1, 1);

        println!("{result:?}");

        // result.cells_accessed should include the TableRef
    }
}
