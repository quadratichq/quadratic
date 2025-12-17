use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Logic functions",
    docs: Some(include_str!("logic_docs.md")),
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns `TRUE`.
            #[include_args_in_completion(false)]
            #[examples("TRUE()")]
            fn TRUE() {
                true
            }
        ),
        formula_fn!(
            /// Returns `FALSE`.
            #[include_args_in_completion(false)]
            #[examples("FALSE()")]
            fn FALSE() {
                false
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if `a` is falsey and `FALSE` if `a` is truthy.
            #[examples("NOT(A113)")]
            #[zip_map]
            fn NOT([boolean]: bool) {
                !boolean
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if all values are truthy and `FALSE` if any value
            /// is falsey.
            ///
            /// Returns `TRUE` if given no values.
            #[examples("AND(A1:C1)", "AND(A1, B12)")]
            fn AND(booleans: (Iter<bool>)) {
                // TODO: short-circuit
                booleans.try_fold(true, |a, b| Ok(a & b?))
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if any value is truthy and `FALSE` if all values
            /// are falsey.
            ///
            /// Returns `FALSE` if given no values.
            #[examples("OR(A1:C1)", "OR(A1, B12)")]
            fn OR(booleans: (Iter<bool>)) {
                // TODO: short-circuit
                booleans.try_fold(false, |a, b| Ok(a | b?))
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if an odd number of values are truthy and `FALSE`
            /// if an even number of values are truthy.
            ///
            /// Returns `FALSE` if given no values.
            #[examples("XOR(A1:C1)", "XOR(A1, B12)")]
            fn XOR(booleans: (Iter<bool>)) {
                booleans.try_fold(false, |a, b| Ok(a ^ b?))
            }
        ),
        formula_fn!(
            /// Returns `t` if `condition` is truthy and `f` if `condition` is
            /// falsey.
            #[examples(
                "IF(A2<0, \"A2 is negative\", \"A2 is nonnegative\")",
                "IF(A2<0, \"A2 is negative\", IF(A2>0, \"A2 is positive\", \"A2 is zero\"))"
            )]
            #[zip_map]
            fn IF([condition]: bool, [t]: CellValue, [f]: CellValue) {
                if condition { t } else { f }.clone()
            }
        ),
        formula_fn!(
            /// Returns `fallback` if there was an error computing `value`;
            /// otherwise returns `value`.
            #[examples(
                "IFERROR(1/A6, \"error: division by zero!\")",
                "IFERROR(A7, \"Something went wrong\")"
            )]
            #[zip_map]
            fn IFERROR([value]: CellValue, [fallback]: CellValue) {
                // This is slightly inconsistent with Excel; Excel does a weird
                // sort of zip-map here that doesn't require `value` and
                // `fallback` to have the same size, and also has special
                // handling if `value` is size=1 along an axis. This is
                // something we could try to fix later, but it's probably not
                // worth it.
                value
                    .clone()
                    .into_non_error_value()
                    .unwrap_or_else(|_| fallback.clone())
            }
        ),
        formula_fn!(
            /// Returns `fallback` if there was a "no match" error computing
            /// `value`; otherwise returns `value`.
            #[examples(
                "IFNA(XLOOKUP(4.5, A1:A10, B1:B10), \"error: no match!\")",
                "IFNA(XLOOKUP(C5, \"error: no match!\"))"
            )]
            #[zip_map]
            fn IFNA([value]: CellValue, [fallback]: CellValue) {
                // See `IFERROR` implementation for Excel compat details.
                match value {
                    CellValue::Error(e) if matches!(e.msg, RunErrorMsg::NoMatch) => {
                        fallback.clone()
                    }
                    other => other.clone(),
                }
            }
        ),
        // Information functions
        formula_fn!(
            /// Returns TRUE if value is blank.
            #[examples("ISBLANK(A1)", "ISBLANK(\"\") = FALSE")]
            #[zip_map]
            fn ISBLANK([value]: CellValue) {
                value.is_blank()
            }
        ),
        formula_fn!(
            /// Returns TRUE if value is a number.
            #[examples("ISNUMBER(123) = TRUE", "ISNUMBER(\"abc\") = FALSE")]
            #[zip_map]
            fn ISNUMBER([value]: CellValue) {
                matches!(value, CellValue::Number(_))
            }
        ),
        formula_fn!(
            /// Returns TRUE if value is text.
            #[examples("ISTEXT(\"abc\") = TRUE", "ISTEXT(123) = FALSE")]
            #[zip_map]
            fn ISTEXT([value]: CellValue) {
                matches!(value, CellValue::Text(_))
            }
        ),
        formula_fn!(
            /// Returns TRUE if value is an error.
            #[examples("ISERROR(1/0) = TRUE", "ISERROR(123) = FALSE")]
            #[zip_map]
            fn ISERROR([value]: CellValue) {
                matches!(value, CellValue::Error(_))
            }
        ),
        formula_fn!(
            /// Returns TRUE if value is a logical value (TRUE or FALSE).
            #[examples("ISLOGICAL(TRUE) = TRUE", "ISLOGICAL(1) = FALSE")]
            #[zip_map]
            fn ISLOGICAL([value]: CellValue) {
                matches!(value, CellValue::Logical(_))
            }
        ),
        formula_fn!(
            /// Returns TRUE if value is an even number.
            #[examples("ISEVEN(4) = TRUE", "ISEVEN(3) = FALSE")]
            #[zip_map]
            fn ISEVEN([value]: f64) {
                (value.round() as i64) % 2 == 0
            }
        ),
        formula_fn!(
            /// Returns TRUE if value is an odd number.
            #[examples("ISODD(3) = TRUE", "ISODD(4) = FALSE")]
            #[zip_map]
            fn ISODD([value]: f64) {
                (value.round() as i64) % 2 != 0
            }
        ),
        formula_fn!(
            /// Returns TRUE if value is a #N/A error.
            #[examples("ISNA(VLOOKUP(\"x\", A1:B10, 2)) = TRUE")]
            #[zip_map]
            fn ISNA([value]: CellValue) {
                matches!(&value, CellValue::Error(e) if matches!(e.msg, RunErrorMsg::NoMatch))
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_if() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];
        g.set_cell_value(pos![sheet_id!1,2], "q".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!2,2], "w".to_string(), None, false);

        let s = "IF(A2='q', 'yep', 'nope')";
        assert_eq!("yep", eval_to_string(&g, s));
        let s = "IF(B2='q', 'yep', 'nope')";
        assert_eq!("nope", eval_to_string(&g, s));

        // Test short-circuiting
        eval_to_err(&g, "1/0");
        assert_eq!("ok", eval_to_string(&g, "IF(TRUE,\"ok\",1/0)"));
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "VLOOKUP(\"nope\",F1:G1,2,0)").msg
        );
        assert_eq!(
            "ok",
            eval_to_string(&g, "IF(FALSE,VLOOKUP(\"nope\",F1:G1,2,0),\"ok\")")
        );
        // Test error passthrough
        assert_eq!(
            RunErrorMsg::DivideByZero,
            eval_to_err(&g, "IF(FALSE,\"ok\",1/0)").msg,
        );
    }

    #[test]
    fn test_formula_iferror() {
        let mut g = GridController::new();

        assert_eq!("ok", eval_to_string(&g, "IFERROR(\"ok\", 42)"));
        assert_eq!("ok", eval_to_string(&g, "IFERROR(\"ok\", 0/0)"));
        eval_to_err(&g, "0/0");
        assert_eq!("42", eval_to_string(&g, "IFERROR(0/0, 42)"));
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "VLOOKUP(\"nope\",F1:G1,2,0)").msg
        );
        assert_eq!(
            "ok",
            eval_to_string(&g, "IFERROR(VLOOKUP(\"nope\",F1:G1,2,0),\"ok\")")
        );
        assert_eq!(
            RunErrorMsg::DivideByZero,
            eval_to_err(&g, "IFERROR(0/0, 0/0)").msg,
        );

        assert_eq!(
            "complex!",
            eval_to_string(&g, "IFERROR(SQRT(-1), \"complex!\")"),
        );

        let sheet_id = g.sheet_ids()[0];

        g.set_cell_value(pos![sheet_id!A6], "happy".into(), None, false);
        assert_eq!("happy", eval_to_string(&g, "IFERROR(A6, 42)"));
        assert_eq!("happy", eval_to_string(&g, "IFERROR(A6, 0/0)"));

        g.sheet_mut(sheet_id).set_value(
            pos![A6],
            CellValue::Error(Box::new(RunErrorMsg::NaN.without_span())),
        );
        assert_eq!("42", eval_to_string(&g, "IFERROR(A6, 42)"));
        assert_eq!(
            RunErrorMsg::DivideByZero,
            eval_to_err(&g, "IFERROR(A6, 0/0)").msg,
        );
    }

    #[test]
    fn test_formula_ifna() {
        let mut g = GridController::new();

        assert_eq!("ok", eval_to_string(&g, "IFNA(\"ok\", 42)"));
        assert_eq!("ok", eval_to_string(&g, "IFNA(\"ok\", 0/0)"));
        assert_eq!(
            RunErrorMsg::DivideByZero,
            eval_to_err(&g, "IFNA(0/0, \"oops\")").msg,
        );
        assert_eq!(
            RunErrorMsg::NaN,
            eval_to_err(&g, "IFNA(SQRT(-1), \"oops\")").msg,
        );

        let div_by_zero_error = eval(&g, "0/0").into_cell_value().unwrap();
        let sheet_id = g.sheet_ids()[0];
        g.set_cell_value(pos![sheet_id!A1], 10.to_string(), None, false);
        g.set_cell_value(pos![sheet_id!A2], 20.to_string(), None, false);
        g.set_cell_value(pos![sheet_id!A3], 30.to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B1], "first".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B2], "second".to_string(), None, false);
        g.sheet_mut(sheet_id).set_value(pos![B3], div_by_zero_error);

        for (lookup_value, expected) in [
            (10, "first"),
            (15, "no match"),
            (20, "second"),
            (25, "no match"),
        ] {
            let formula = format!("IFNA(XLOOKUP({lookup_value}, A1:A3, B1:B3), \"no match\")");
            assert_eq!(expected, eval_to_string(&g, &formula));
        }
        assert_eq!(
            RunErrorMsg::DivideByZero,
            eval_to_err(&g, "IFNA(XLOOKUP(30, A1:A3, B1:B3), \"no match\")",).msg,
        );
    }

    #[test]
    fn test_formula_isblank() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Empty cell is blank
        assert_eq!("TRUE", eval_to_string(&g, "ISBLANK(A1)"));

        // Cell with value is not blank
        g.set_cell_value(pos![sheet_id!A1], "hello".to_string(), None, false);
        assert_eq!("FALSE", eval_to_string(&g, "ISBLANK(A1)"));

        // Literal values
        assert_eq!("FALSE", eval_to_string(&g, "ISBLANK(\"\")"));
        assert_eq!("FALSE", eval_to_string(&g, "ISBLANK(0)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISBLANK(FALSE)"));
    }

    #[test]
    fn test_formula_isnumber() {
        let g = GridController::new();

        assert_eq!("TRUE", eval_to_string(&g, "ISNUMBER(123)"));
        assert_eq!("TRUE", eval_to_string(&g, "ISNUMBER(3.14)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISNUMBER(\"123\")"));
        assert_eq!("FALSE", eval_to_string(&g, "ISNUMBER(TRUE)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISNUMBER(A1)"));
    }

    #[test]
    fn test_formula_istext() {
        let g = GridController::new();

        assert_eq!("TRUE", eval_to_string(&g, "ISTEXT(\"hello\")"));
        assert_eq!("TRUE", eval_to_string(&g, "ISTEXT(\"\")"));
        assert_eq!("FALSE", eval_to_string(&g, "ISTEXT(123)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISTEXT(TRUE)"));
    }

    #[test]
    fn test_formula_iserror() {
        let g = GridController::new();

        assert_eq!("TRUE", eval_to_string(&g, "ISERROR(1/0)"));
        assert_eq!("TRUE", eval_to_string(&g, "ISERROR(SQRT(-1))"));
        assert_eq!("FALSE", eval_to_string(&g, "ISERROR(123)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISERROR(\"hello\")"));
    }

    #[test]
    fn test_formula_islogical() {
        let g = GridController::new();

        assert_eq!("TRUE", eval_to_string(&g, "ISLOGICAL(TRUE)"));
        assert_eq!("TRUE", eval_to_string(&g, "ISLOGICAL(FALSE)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISLOGICAL(1)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISLOGICAL(\"TRUE\")"));
    }

    #[test]
    fn test_formula_iseven_isodd() {
        let g = GridController::new();

        // ISEVEN
        assert_eq!("TRUE", eval_to_string(&g, "ISEVEN(2)"));
        assert_eq!("TRUE", eval_to_string(&g, "ISEVEN(0)"));
        assert_eq!("TRUE", eval_to_string(&g, "ISEVEN(-4)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISEVEN(3)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISEVEN(-1)"));

        // ISODD
        assert_eq!("TRUE", eval_to_string(&g, "ISODD(3)"));
        assert_eq!("TRUE", eval_to_string(&g, "ISODD(-5)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISODD(2)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISODD(0)"));
    }

    #[test]
    fn test_formula_isna() {
        let g = GridController::new();

        // Other errors should return false
        assert_eq!("FALSE", eval_to_string(&g, "ISNA(1/0)"));

        // Non-errors should return false
        assert_eq!("FALSE", eval_to_string(&g, "ISNA(123)"));
        assert_eq!("FALSE", eval_to_string(&g, "ISNA(\"hello\")"));
    }
}
