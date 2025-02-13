use serde::{Deserialize, Serialize};

use crate::{
    a1::{A1Context, SheetCellRefRange},
    formulas, SheetPos, Span, Spanned,
};

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct FormulaParseResult {
    pub parse_error_msg: Option<String>,
    pub parse_error_span: Option<Span>,

    pub cell_refs: Vec<CellRefSpan>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CellRefSpan {
    pub span: Span,
    pub cell_ref: SheetCellRefRange,
}
impl From<Spanned<SheetCellRefRange>> for CellRefSpan {
    fn from(value: Spanned<SheetCellRefRange>) -> Self {
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
///   "parse_error_span": {
///     "start": 12,
///     "end": 46
///   },
///   "cell_refs": [
///     {
///       "span": {
///         "start": 1,
///         "end": 4
///       },
///       "cell_ref": {
///         "sheet_id": {
///           "id": "9c04969a-d4b1-489b-87d7-d37f48cce57c"
///         },
///         "cells": {
///           "range": {
///             "start": {
///               "col": {
///                 "coord": 1,
///                 "is_absolute": false
///               },
///               "row": {
///                 "coord": 2,
///                 "is_absolute": true
///               }
///             },
///             "end": {
///               "col": {
///                 "coord": 1,
///                 "is_absolute": false
///               },
///               "row": {
///                 "coord": 2,
///                 "is_absolute": true
///               }
///             }
///           }
///         }
///       }
///     },
///     {
///       "span": {
///         "start": 15,
///         "end": 25
///       },
///       "cell_ref": {
///         "sheet_id": {
///           "id": "9c04969a-d4b1-489b-87d7-d37f48cce57c"
///         },
///         "cells": {
///           "range": {
///             "start": {
///               "col": {
///                 "coord": 1,
///                 "is_absolute": true
///               },
///               "row": {
///                 "coord": 3,
///                 "is_absolute": false
///               }
///             },
///             "end": {
///               "col": {
///                 "coord": 1,
///                 "is_absolute": true
///               },
///               "row": {
///                 "coord": 7,
///                 "is_absolute": false
///               }
///             }
///           }
///         }
///       }
///     }
///   ]
/// }
/// ```
///
/// `parse_error_msg` may be null, and `parse_error_span` may be null. Even if
/// `parse_error_span`, `parse_error_msg` may still be present.
pub fn parse_formula(formula_string: &str, ctx: &A1Context, pos: SheetPos) -> FormulaParseResult {
    let parse_error: Option<crate::RunError> =
        formulas::parse_formula(formula_string, ctx, pos).err();

    let result = FormulaParseResult {
        parse_error_msg: parse_error.as_ref().map(|e| e.msg.to_string()),
        parse_error_span: parse_error.and_then(|e| e.span),

        // todo: cell_refs are returning Relative positions that are actually Absolute
        cell_refs: formulas::find_cell_references(formula_string, ctx, pos)
            .into_iter()
            .map(|r| r.into())
            .collect(),
    };
    result
}

#[cfg(test)]
mod tests {
    use super::{parse_formula, CellRefSpan, FormulaParseResult};
    use crate::a1::{CellRefCoord, CellRefRange, SheetCellRefRange};
    use crate::grid::{Grid, Sheet, SheetId};
    use crate::{Pos, Span};
    use serial_test::parallel;

    fn parse(grid: &Grid, s: &str) -> FormulaParseResult {
        println!("Parsing {s}");
        let pos = Pos::ORIGIN.to_sheet_pos(grid.sheets()[0].id);
        parse_formula(s, &grid.a1_context(), pos)
    }

    /// Run this test with `--nocapture` to generate the example for the
    /// `parse_formula()` docs.
    #[test]
    #[parallel]
    fn example_parse_formula_output() {
        let sheet_id = SheetId::new();
        let example_result = FormulaParseResult {
            parse_error_msg: Some("Bad argument count".to_string()),
            parse_error_span: Some(Span { start: 12, end: 46 }),
            cell_refs: vec![
                CellRefSpan {
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
                CellRefSpan {
                    span: Span { start: 15, end: 25 },
                    cell_ref: SheetCellRefRange {
                        sheet_id,
                        cells: CellRefRange::new_sheet_ref(
                            CellRefCoord::new_abs(3),
                            CellRefCoord::new_rel(4),
                            CellRefCoord::new_abs(3),
                            CellRefCoord::new_rel(2),
                        ),
                    },
                },
            ],
        };

        println!("{}", serde_json::to_string_pretty(&example_result).unwrap());
    }

    #[test]
    #[parallel]
    fn test_parse_formula_output() {
        let mut g = Grid::new();
        g.add_sheet(Some(Sheet::new(
            SheetId::new(),
            "Sheet2".to_string(),
            String::new(),
        )));
        let result = parse(&g, "'Sheet2'!A1");
        assert_eq!(result.parse_error_msg, None);
        assert_eq!(result.parse_error_span, None);
        assert_eq!(result.cell_refs.len(), 1);
        // `cell_refs` output is tested elsewhere
    }

    #[test]
    #[parallel]
    fn test_parse_formula_case_insensitive() {
        let g = Grid::new();
        assert_eq!(parse(&g, "A1:A2"), parse(&g, "a1:a2"));
        assert_eq!(parse(&g, "A1:AA2"), parse(&g, "a1:aa2"));
    }

    #[test]
    #[parallel]
    fn test_parse_formula_column() {
        let g = Grid::new();
        let sheet_id = g.sheets()[0].id;
        let cell_refs = parse(&g, "SUM(A1:A)").cell_refs;

        assert_eq!(
            cell_refs,
            vec![CellRefSpan {
                span: Span { start: 4, end: 8 },
                cell_ref: SheetCellRefRange {
                    sheet_id,
                    cells: CellRefRange::new_sheet_ref(
                        CellRefCoord::new_rel(1),
                        CellRefCoord::new_rel(1),
                        CellRefCoord::new_rel(1),
                        CellRefCoord::UNBOUNDED,
                    ),
                },
            }]
        );
    }

    #[test]
    #[parallel]
    fn test_parse_formula_row() {
        let g = Grid::new();
        let sheet_id = g.sheets()[0].id;
        let cell_refs = parse(&g, "SUM(2:3)").cell_refs;

        assert_eq!(
            cell_refs,
            vec![CellRefSpan {
                span: Span { start: 4, end: 7 },
                cell_ref: SheetCellRefRange {
                    sheet_id,
                    cells: CellRefRange::new_sheet_ref(
                        CellRefCoord::START,
                        CellRefCoord::new_rel(2),
                        CellRefCoord::UNBOUNDED,
                        CellRefCoord::new_rel(3),
                    )
                }
            }]
        );
    }
}
