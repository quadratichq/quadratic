use serde::{Deserialize, Serialize};

use crate::{formulas, Pos, Span, Spanned};

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct FormulaParseResult {
    pub parse_error_msg: Option<String>,
    pub parse_error_span: Option<Span>,

    pub cell_refs: Vec<CellRefSpan>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellRefSpan {
    pub span: Span,
    pub cell_ref: formulas::RangeRef,
}
impl From<Spanned<formulas::RangeRef>> for CellRefSpan {
    fn from(value: Spanned<formulas::RangeRef>) -> Self {
        CellRefSpan {
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
pub fn parse_formula(formula_string: &str, pos: Pos) -> FormulaParseResult {
    let parse_error = formulas::parse_formula(formula_string, pos).err();

    let result = FormulaParseResult {
        parse_error_msg: parse_error.as_ref().map(|e| e.msg.to_string()),
        parse_error_span: parse_error.and_then(|e| e.span),

        // todo: cell_refs are returning Relative positions that are actually Absolute
        cell_refs: formulas::find_cell_references(formula_string, pos)
            .into_iter()
            .map(|r| r.into())
            .collect(),
    };
    result
}

#[cfg(test)]
mod tests {
    use crate::controller::formula::{parse_formula, CellRefSpan, FormulaParseResult};
    use crate::formulas::{CellRef, CellRefCoord, RangeRef};
    use crate::Span;

    /// Run this test with `--nocapture` to generate the example for the
    /// `parse_formula()` docs.
    #[test]
    fn example_parse_formula_output() {
        let example_result = FormulaParseResult {
            parse_error_msg: Some("Bad argument count".to_string()),
            parse_error_span: Some(Span { start: 12, end: 46 }),
            cell_refs: vec![
                CellRefSpan {
                    span: Span { start: 1, end: 4 },
                    cell_ref: RangeRef::from(CellRef {
                        sheet: None,
                        x: CellRefCoord::Relative(0),
                        y: CellRefCoord::Absolute(1),
                    }),
                },
                CellRefSpan {
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

    #[test]
    fn text_parse_formula_output() {
        let result = parse_formula("'Sheet 2'!A0", crate::Pos::ORIGIN);
        assert_eq!(result.parse_error_msg, None);
        assert_eq!(result.parse_error_span, None);
        assert_eq!(result.cell_refs.len(), 1);
        // `cell_refs` output is tested elsewhere
    }
}
