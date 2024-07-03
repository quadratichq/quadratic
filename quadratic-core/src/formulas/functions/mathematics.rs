use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Mathematics functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Adds all values.
            /// Returns `0` if given no values.
            #[examples("SUM(B2:C6, 15, E1)")]
            fn SUM(numbers: (Iter<f64>)) {
                numbers.sum::<CodeResult<f64>>()
            }
        ),
        formula_fn!(
            /// Evaluates each value based on some criteria, and then adds the
            /// ones that meet those criteria. If `range_to_sum` is given, then
            /// values in `range_to_sum` are added instead wherever the
            /// corresponding value in `range_to_evaluate` meets the criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "SUMIF(A1:A10, \"2\")",
                "SUMIF(A1:A10, \">0\")",
                "SUMIF(A1:A10, \"<>INVALID\", B1:B10)"
            )]
            #[zip_map]
            fn SUMIF(
                eval_range: (Spanned<Array>),
                [criteria]: (Spanned<CellValue>),
                numbers_range: (Option<Spanned<Array>>),
            ) {
                let criteria = Criterion::try_from(*criteria)?;
                let numbers =
                    criteria.iter_matching_coerced::<f64>(eval_range, numbers_range.as_ref())?;
                numbers.sum::<CodeResult<f64>>()
            }
        ),
        formula_fn!(
            /// Multiplies all values.
            /// Returns `1` if given no values.
            #[examples("PRODUCT(B2:C6, 0.002, E1)")]
            fn PRODUCT(numbers: (Iter<f64>)) {
                numbers.product::<CodeResult<f64>>()
            }
        ),
        formula_fn!(
            /// Returns the absolute value of a number.
            #[examples("ABS(-4)")]
            #[zip_map]
            fn ABS([number]: f64) {
                number.abs()
            }
        ),
        formula_fn!(
            /// Returns the square root of a number.
            #[examples("SQRT(2)")]
            #[zip_map]
            fn SQRT([number]: f64) {
                number.sqrt()
            }
        ),
        formula_fn!(
            /// Rounds a number up to the next multiple of `increment`. If
            /// `number` and `increment` are both negative, rounds the number
            /// down away from zero. Returns an error if `number` is positive
            /// but `significance` is negative. Returns `0` if `increment` is
            /// `0`.
            #[examples("CEIL(6.5, 2)")]
            #[zip_map]
            fn CEIL([number]: f64, [increment]: (Spanned<f64>)) {
                let Spanned {
                    span: increment_span,
                    inner: increment,
                } = increment;

                if number > 0.0 && increment < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(increment_span));
                }

                // Yes, I know this condition is inconsistent with `FLOOR`. It's
                // necessary for Excel compatibility.
                if increment == 0.0 {
                    0.0
                } else {
                    util::checked_div(increment_span, number, increment)?.ceil() * increment
                }
            }
        ),
        formula_fn!(
            /// Rounds a number down to the next multiple of `increment`. If
            /// `number` and `increment` are both negative, rounds the number up
            /// toward zero. Returns an error if `number` is positive but
            /// `significance` is negative, or if `increment` is `0` but
            /// `number` is nonzero. Returns `0` if `increment` is `0` _and_
            /// `number` is `0`.
            #[examples("FLOOR(6.5, 2)")]
            #[zip_map]
            fn FLOOR([number]: f64, [increment]: (Spanned<f64>)) {
                let Spanned {
                    span: increment_span,
                    inner: increment,
                } = increment;

                if number > 0.0 && increment < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(increment_span));
                }

                // Yes, I know this condition is inconsistent with `CEILING`. It's
                // necessary for Excel compatibility.
                if increment == 0.0 && number == 0.0 {
                    0.0
                } else {
                    util::checked_div(increment_span, number, increment)?.floor() * increment
                }
            }
        ),
        // Constants
        formula_fn!(
            /// Returns π, the circle constant.
            #[examples("PI()")]
            fn PI() {
                std::f64::consts::PI
            }
        ),
        formula_fn!(
            /// Returns τ, the circle constant equal to 2π.
            #[examples("TAU()")]
            fn TAU() {
                std::f64::consts::TAU
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{formulas::tests::*, Pos};

    #[test]
    fn test_sum() {
        let g = Grid::new();
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::Expected {
                expected: "number".into(),
                got: Some("text".into()),
            },
            eval_to_err(&g, "SUM(\"abc\")").msg,
        );
        assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "SUM(1/0)").msg);
        assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "SUM({1/0})").msg);
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "SUM".into(),
                arg_name: "numbers".into()
            },
            parse_formula("SUM()", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!("12", eval_to_string(&g, "SUM(12)"));
        assert_eq!("27", eval_to_string(&g, "SUM(0..5, 12)"));
        assert_eq!("27", eval_to_string(&g, "SUM(0..5, {\"\", \"abc\"}, 12)"));
        assert_eq!("27", eval_to_string(&g, "SUM(0..5, {\"\"}, {\"abc\"}, 12)"));
        assert_eq!("0", eval_to_string(&g, "SUM({\"\", \"abc\"})"));
        assert_eq!("12", eval_to_string(&g, "SUM({\"\", \"abc\", 12})"));

        let mut g = Grid::new();
        let sheet = &mut g.sheets_mut()[0];
        let _ = sheet.set_cell_value(pos![A6], "text");
        let _ = sheet.set_cell_value(pos![A7], "text");
        // One bad cell reference on its own doesn't cause an error because it's
        // a 1x1 array.
        assert_eq!("12", eval_to_string(&g, "SUM(12, A6)"));
        // But doing an operation on it converts it to a single value, which
        // does cause an error.
        assert_eq!(
            RunErrorMsg::Expected {
                expected: "number".into(),
                got: Some("text".into())
            },
            eval_to_err(&g, "SUM(12, A6&A7)").msg,
        );
    }

    #[test]
    fn test_sumif() {
        let g = Grid::new();
        assert_eq!("15", eval_to_string(&g, "SUMIF(0..10, \"<=5\")"));
        assert_eq!("63", eval_to_string(&g, "SUMIF(0..10, \"<=5\", 2^0..10)"));
        // Test with an array of conditions.
        assert_eq!(
            "{63, 16; 1984, 1}",
            eval_to_string(&g, "SUMIF(0..10, {\"<=5\", 4; \">5\", 0}, 2^0..10)"),
        );
    }

    #[test]
    fn test_product() {
        let g = Grid::new();
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "PRODUCT".into(),
                arg_name: "numbers".into()
            },
            parse_formula("PRODUCT()", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!("12", eval_to_string(&g, "PRODUCT(12)"));
        assert_eq!("1440", eval_to_string(&g, "PRODUCT(1..5, 12)"));
        assert_eq!(
            "1440",
            eval_to_string(&g, "PRODUCT(1..5, {\"_\", \"abc\"}, 12)"),
        );
        assert_eq!(
            "1440",
            eval_to_string(&g, "PRODUCT(1..5, {\"_\"}, {\"abc\"}, 12)"),
        );
        assert_eq!("1", eval_to_string(&g, "PRODUCT({\"_\", \"abc\"})"));
        assert_eq!("12", eval_to_string(&g, "PRODUCT({\"_\", \"abc\", 12})"));
        assert_eq!(
            "1440",
            eval_to_string(&g, "PRODUCT(1..5, {\"_\", \"abc\"}, 12)"),
        );
        assert_eq!(
            "0",
            eval_to_string(&g, "PRODUCT(0..5, {\"_\", \"abc\"}, 12)"),
        );
    }

    #[test]
    fn test_abs() {
        let g = Grid::new();
        assert_eq!("10", eval_to_string(&g, "ABS(-10)"));
        assert_eq!("10", eval_to_string(&g, "ABS(10)"));
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "ABS".into(),
                arg_name: "number".into(),
            },
            parse_formula("ABS()", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "ABS".into(),
                max_arg_count: 1,
            },
            parse_formula("ABS(16, 17)", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_sqrt() {
        let g = Grid::new();
        crate::util::assert_f64_approx_eq(3.0_f64.sqrt(), &eval_to_string(&g, "SQRT(3)"));
        assert_eq!("4", eval_to_string(&g, "SQRT(16)"));
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "SQRT".into(),
                arg_name: "number".into(),
            },
            parse_formula("SQRT()", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "SQRT".into(),
                max_arg_count: 1,
            },
            parse_formula("SQRT(16, 17)", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_ceil() {
        let g = Grid::new();
        let test_cases = [
            ("3.5", "2", Ok("4")),
            ("2.5", "2", Ok("4")),
            ("0.0", "2", Ok("0")),
            ("-2.5", "2", Ok("-2")),
            ("-3.5", "2", Ok("-2")),
            ("3.5", "0", Ok("0")),
            ("2.5", "0", Ok("0")),
            ("0.0", "0", Ok("0")),
            ("-2.5", "0", Ok("0")),
            ("-3.5", "0", Ok("0")),
            ("3.5", "-2", Err(RunErrorMsg::InvalidArgument)),
            ("2.5", "-2", Err(RunErrorMsg::InvalidArgument)),
            ("0.0", "-2", Ok("0")),
            ("-2.5", "-2", Ok("-4")),
            ("-3.5", "-2", Ok("-4")),
        ];
        for (n, increment, expected) in test_cases {
            let formula = format!("CEIL({n}, {increment})");
            match expected {
                Ok(ok) => assert_eq!(ok, eval_to_string(&g, &formula)),
                Err(err) => assert_eq!(err, eval_to_err(&g, &formula).msg),
            }
        }
    }

    #[test]
    fn test_floor() {
        let g = Grid::new();
        let test_cases = [
            ("3.5", "2", Ok("2")),
            ("2.5", "2", Ok("2")),
            ("0.0", "2", Ok("0")),
            ("-2.5", "2", Ok("-4")),
            ("-3.5", "2", Ok("-4")),
            ("3.5", "0", Err(RunErrorMsg::DivideByZero)),
            ("2.5", "0", Err(RunErrorMsg::DivideByZero)),
            ("0.0", "0", Ok("0")),
            ("-2.5", "0", Err(RunErrorMsg::DivideByZero)),
            ("-3.5", "0", Err(RunErrorMsg::DivideByZero)),
            ("3.5", "-2", Err(RunErrorMsg::InvalidArgument)),
            ("2.5", "-2", Err(RunErrorMsg::InvalidArgument)),
            ("0.0", "-2", Ok("0")),
            ("-2.5", "-2", Ok("-2")),
            ("-3.5", "-2", Ok("-2")),
        ];
        for (n, increment, expected) in test_cases {
            let formula = format!("FLOOR({n}, {increment})");
            match expected {
                Ok(ok) => assert_eq!(ok, eval_to_string(&g, &formula)),
                Err(err) => assert_eq!(err, eval_to_err(&g, &formula).msg),
            }
        }
    }

    #[test]
    fn test_pi() {
        let g = Grid::new();
        assert!(eval_to_string(&g, "PI()").starts_with("3.14159"));
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "PI".into(),
                max_arg_count: 0,
            },
            parse_formula("PI(16)", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_tau() {
        let g = Grid::new();
        assert!(eval_to_string(&g, "TAU()").starts_with("6.283"));
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheets()[0].id));
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "TAU".into(),
                max_arg_count: 0,
            },
            parse_formula("TAU(16)", Pos::ORIGIN)
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }
}
