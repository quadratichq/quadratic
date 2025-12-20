//! Basic math functions: SUM, PRODUCT, ABS, SQRT, POWER, LOG, etc.

use rust_decimal::prelude::*;

use crate::number::sum;

use super::*;

pub(super) fn get_functions() -> Vec<FormulaFunction> {
    vec![
        // Basic operators
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
            /// ones that meet those criteria. If `sum_range` is given, then
            /// values in `sum_range` are added instead wherever the
            /// corresponding value in `eval_range` meets the criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "SUMIF(A1:A10, \"2\")",
                "SUMIF(A1:A10, \">0\")",
                "SUMIF(B1:A10, \"<>INVALID\", A1:B10)"
            )]
            #[zip_map]
            fn SUMIF(
                eval_range: (Spanned<Array>),
                [criteria]: (Spanned<CellValue>),
                sum_range: (Option<Spanned<Array>>),
            ) {
                let criteria = Criterion::try_from(*criteria)?;
                let numbers =
                    criteria.iter_matching_coerced::<Decimal>(eval_range, sum_range.as_ref())?;
                let result = numbers.collect::<CodeResult<Vec<Decimal>>>()?;
                Ok(sum(result))
            }
        ),
        formula_fn!(
            /// Adds values from `numbers_range` wherever the criteria are met
            /// at the corresponding value in each `eval_range`.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "SUMIFS(A1:A10, \"<>INVALID\", B1:B10)",
                "SUMIFS(A1:A10, \"<>INVALID\", B1:B10, \"<=0\", C1:C10)"
            )]
            fn SUMIFS(
                ctx: Ctx,
                sum_range: (Spanned<Array>),
                eval_range1: (Spanned<Array>),
                criteria1: (Spanned<Value>),
                more_eval_ranges_and_criteria: FormulaFnArgs,
            ) {
                ctx.zip_map_eval_ranges_and_criteria_from_args(
                    eval_range1,
                    criteria1,
                    more_eval_ranges_and_criteria,
                    |_ctx, eval_ranges_and_criteria| {
                        let numbers = Criterion::iter_matching_multi_coerced::<Decimal>(
                            &eval_ranges_and_criteria,
                            &sum_range,
                        )?;
                        let result = numbers.collect::<CodeResult<Vec<Decimal>>>()?;
                        Ok(sum(result).into())
                    },
                )?
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
        // Other operators
        formula_fn!(
            /// Returns the remainder after dividing `number` by `divisor`. The
            /// result always has the same sign as `divisor`.
            ///
            /// Note that `INT(n / d) * d + MOD(n, d)` always equals `n` (up to
            /// floating-point precision).
            #[examples("MOD(3.9, 3)", "MOD(-2.1, 3)")]
            #[zip_map]
            fn MOD(span: Span, [number]: f64, [divisor]: f64) {
                number - util::checked_div(span, number, divisor)?.floor() * divisor
            }
        ),
        formula_fn!(
            /// Returns the result of raising `base` to the power of `exponent`.
            #[examples("POWER(2, 32)", "POWER(1.1, 7)")]
            #[zip_map]
            fn POWER([base]: f64, [exponent]: f64) {
                base.powf(exponent)
            }
        ),
        formula_fn!(
            /// Returns the result of raising [Euler's number] _e_ to the power
            /// of `exponent`.
            ///
            /// [Euler's number]:
            ///     https://en.wikipedia.org/wiki/E_(mathematical_constant)
            #[examples("EXP(1), EXP(2/3), EXP(C9)")]
            #[zip_map]
            fn EXP([exponent]: f64) {
                exponent.exp()
            }
        ),
        formula_fn!(
            /// Returns the [logarithm] of `number` to the base `base`. If
            /// `base` is omitted, it is assumed to be 10, the base of the
            /// [common logarithm].
            ///
            /// [logarithm]: https://en.wikipedia.org/wiki/Logarithm
            /// [common logarithm]:
            ///     https://en.wikipedia.org/wiki/Common_logarithm
            #[examples("LOG(100)", "LOG(144, 12)", "LOG(144, 10)")]
            #[zip_map]
            fn LOG(span: Span, [number]: f64, [base]: (Option<f64>)) {
                let base = base.unwrap_or(10.0);
                if base > 0.0 {
                    number.log(base)
                } else {
                    return Err(RunErrorMsg::NaN.with_span(span));
                }
            }
        ),
        formula_fn!(
            /// Returns the [base-10 logarithm] of `number`.
            ///
            /// [base-10 logarithm]:
            ///     https://en.wikipedia.org/wiki/Common_logarithm
            #[examples("LOG10(100)")]
            #[zip_map]
            fn LOG10([number]: f64) {
                number.log10()
            }
        ),
        formula_fn!(
            /// Returns the [natural logarithm] of `number`.
            ///
            /// [natural logarithm]:
            ///     https://en.wikipedia.org/wiki/Natural_logarithm
            #[examples("LN(50)")]
            #[zip_map]
            fn LN([number]: f64) {
                number.ln()
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
        // Additional math functions
        formula_fn!(
            /// Returns the sign of a number: 1 if positive, -1 if negative, 0 if zero.
            #[examples("SIGN(-5) = -1", "SIGN(5) = 1", "SIGN(0) = 0")]
            #[zip_map]
            fn SIGN([number]: f64) {
                if number > 0.0 {
                    1
                } else if number < 0.0 {
                    -1
                } else {
                    0
                }
            }
        ),
        formula_fn!(
            /// Returns the integer portion of a division.
            /// Truncates the result to an integer.
            #[examples("QUOTIENT(10, 3) = 3", "QUOTIENT(-10, 3) = -3")]
            #[zip_map]
            fn QUOTIENT(span: Span, [numerator]: f64, [denominator]: f64) {
                if denominator == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                (numerator / denominator).trunc() as i64
            }
        ),
        formula_fn!(
            /// Returns the sum of squares of the arguments.
            #[examples("SUMSQ(3, 4) = 25", "SUMSQ(1, 2, 3) = 14")]
            fn SUMSQ(numbers: (Iter<f64>)) {
                numbers.try_fold(0.0, |acc, x| {
                    let val = x?;
                    Ok(acc + val * val)
                })
            }
        ),
        formula_fn!(
            /// Returns the square root of a number multiplied by π.
            #[examples("SQRTPI(1) = 1.7724538509...", "SQRTPI(2)")]
            #[zip_map]
            fn SQRTPI(span: Span, [number]: f64) {
                if number < 0.0 {
                    return Err(RunErrorMsg::NaN.with_span(span));
                }
                (number * std::f64::consts::PI).sqrt()
            }
        ),
        formula_fn!(
            /// Converts a Roman numeral to an Arabic numeral.
            ///
            /// Recognizes Roman numerals I, V, X, L, C, D, and M (case-insensitive).
            #[examples("ARABIC(\"XIV\") = 14", "ARABIC(\"MCMXCIV\") = 1994")]
            #[zip_map]
            fn ARABIC(span: Span, [text]: String) {
                roman_to_arabic(&text)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Calculates the percentage of a value relative to a total.
            ///
            /// Returns (value / total) * 100, which represents what percentage
            /// the value is of the total.
            ///
            /// Note: This function returns a decimal (e.g., 0.25 for 25%), not
            /// a percentage value (25). To display as a percentage, format the
            /// cell as a percentage.
            #[examples(
                "PERCENTOF(25, 100) = 0.25",
                "PERCENTOF(50, 200) = 0.25",
                "PERCENTOF(A1, SUM(A1:A10))"
            )]
            #[zip_map]
            fn PERCENTOF(span: Span, [value]: f64, [total]: f64) {
                if total == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                value / total
            }
        ),
    ]
}

/// Converts a Roman numeral string to its Arabic (integer) value.
fn roman_to_arabic(s: &str) -> Option<i64> {
    let s = s.trim().to_uppercase();
    if s.is_empty() {
        return Some(0);
    }

    let roman_value = |c: char| -> Option<i64> {
        match c {
            'I' => Some(1),
            'V' => Some(5),
            'X' => Some(10),
            'L' => Some(50),
            'C' => Some(100),
            'D' => Some(500),
            'M' => Some(1000),
            _ => None,
        }
    };

    let chars: Vec<char> = s.chars().collect();
    let mut total: i64 = 0;
    let mut prev_value: i64 = 0;

    for c in chars.iter().rev() {
        let value = roman_value(*c)?;
        if value < prev_value {
            total -= value;
        } else {
            total += value;
        }
        prev_value = value;
    }

    Some(total)
}

#[cfg(test)]
mod tests {
    use proptest::proptest;

    use crate::{Pos, a1::A1Context, controller::GridController, formulas::tests::*};

    #[test]
    fn test_sum() {
        let g = GridController::new();
        let parse_ctx = A1Context::test(&[], &[]);
        let pos = g.grid().origin_in_first_sheet();
        let mut eval_ctx = Ctx::new(&g, pos);
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
            parse_formula("SUM()", &parse_ctx, pos)
                .unwrap()
                .eval(&mut eval_ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!("12", eval_to_string(&g, "SUM(12)"));
        assert_eq!("27", eval_to_string(&g, "SUM(0..5, 12)"));
        assert_eq!("27", eval_to_string(&g, "SUM(0..5, {\"\", \"abc\"}, 12)"));
        assert_eq!("27", eval_to_string(&g, "SUM(0..5, {\"\"}, {\"abc\"}, 12)"));
        assert_eq!("0", eval_to_string(&g, "SUM({\"\", \"abc\"})"));
        assert_eq!("12", eval_to_string(&g, "SUM({\"\", \"abc\", 12})"));
        assert_eq!(
            "55",
            eval_to_string(&g, "SUM(({1,2;3,4}, {5}, {6}), {7; 8}, {9, 10})"),
        );

        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];
        g.set_cell_value(pos![sheet_id!A6], "text".into(), None, false);
        g.set_cell_value(pos![sheet_id!A7], "text".into(), None, false);
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
    fn test_sum_with_tuples() {
        let g = GridController::new();
        assert_eq!("10", eval_to_string(&g, "SUM(({1, 2}, {3, 4}))"));
        assert_eq!("21", eval_to_string(&g, "SUM(({1, 2}, {3; 4}, {5, 6}))"));

        // Test nested tuples
        assert_eq!("21", eval_to_string(&g, "SUM((({1, 2}, {3; 4}), {5, 6}))"));
        assert_eq!("21", eval_to_string(&g, "SUM(({1, 2}, ({3; 4}, {5, 6})))"));
    }

    #[test]
    fn test_sumif() {
        let g = GridController::new();
        assert_eq!("15", eval_to_string(&g, "SUMIF(0..10, \"<=5\")"));
        assert_eq!("63", eval_to_string(&g, "SUMIF(0..10, \"<=5\", 2^0..10)"));
        // Test with an array of conditions.
        assert_eq!(
            "{63, 16; 1984, 1}",
            eval_to_string(&g, "SUMIF(0..10, {\"<=5\", 4; \">5\", 0}, 2^0..10)"),
        );
    }

    #[test]
    fn test_sumifs() {
        let g = GridController::new();
        assert_eq!("15", eval_to_string(&g, "SUMIFS(0..10, 0..10, \"<=5\")"));
        assert_eq!("63", eval_to_string(&g, "SUMIFS(2^0..10, 0..10, \"<=5\")"));
        // Testing with multiple conditions.
        assert_eq!(
            "21",
            eval_to_string(&g, "SUMIFS(2^0..10, 0..10, \"<=5\", MOD(0..10, 2), 0)"),
        );
        // Test with an array of conditions.
        assert_eq!(
            "{3, 2; 52, 0}", // tested in Excel
            eval_to_string(&g, "SUMIFS(0..10, 2^0..10, {\"<=5\", 4; \">5\", 0})"),
        );
        // Test missing arguments
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "SUMIFS".into(),
                arg_name: "criteria1".into(),
            },
            eval_to_err(&g, "SUMIFS(0..10, 0..10)").msg,
        );
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "SUMIFS".into(),
                arg_name: "criteria2".into(),
            },
            eval_to_err(&g, "SUMIFS(0..10, 0..10, \"<=5\", 0..10)").msg,
        );
        // Test mismatched range
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::try_from((1_i64, 12_i64)).unwrap(),
                got: ArraySize::try_from((1_i64, 11_i64)).unwrap(),
            },
            eval_to_err(&g, "SUMIFS(0..10, 0..11, \"<=5\")").msg,
        );
    }

    #[test]
    fn test_product() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let parse_ctx = A1Context::test(&[], &[]);
        let mut eval_ctx = Ctx::new(&g, pos);
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "PRODUCT".into(),
                arg_name: "numbers".into()
            },
            parse_formula("PRODUCT()", &parse_ctx, pos)
                .unwrap()
                .eval(&mut eval_ctx)
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
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        assert_eq!("10", eval_to_string(&g, "ABS(-10)"));
        assert_eq!("10", eval_to_string(&g, "ABS(10)"));
        let parse_ctx = A1Context::test(&[], &[]);
        let mut eval_ctx = Ctx::new(&g, pos);
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "ABS".into(),
                arg_name: "number".into(),
            },
            parse_formula("ABS()", &parse_ctx, pos)
                .unwrap()
                .eval(&mut eval_ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "ABS".into(),
                max_arg_count: 1,
            },
            parse_formula("ABS(16, 17)", &parse_ctx, pos)
                .unwrap()
                .eval(&mut eval_ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_sqrt() {
        let g = GridController::new();
        crate::util::assert_f64_approx_eq(
            3.0_f64.sqrt(),
            eval_to_string(&g, "SQRT(3)").parse::<f64>().unwrap(),
            "Testing SQRT(3)",
        );
        assert_eq!("4", eval_to_string(&g, "SQRT(16)"));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "SQRT".into(),
                arg_name: "number".into(),
            },
            eval_to_err(&g, "SQRT()").msg,
        );
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "SQRT".into(),
                max_arg_count: 1,
            },
            eval_to_err(&g, "SQRT(16, 17)").msg,
        );
        assert_eq!(RunErrorMsg::NaN, eval_to_err(&g, "SQRT(-1)").msg);
    }

    #[test]
    fn test_mod() {
        let g = GridController::new();
        assert_eq!("-0.5", eval_to_string(&g, "MOD(1.5, -1)"));
        assert_eq!("{0; 1; 0; 1; 0; 1}", eval_to_string(&g, "MOD(0..5, 2)"));
        // Test division by zero
        assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "MOD(1, 0)").msg);
    }

    proptest! {
        #[test]
        fn proptest_int_mod_invariant(n in -100.0..100.0_f64, d in -100.0..100.0_f64) {
            let g = GridController::new();
            crate::util::assert_f64_approx_eq(
                n,
                eval_to_string(&g, &format!("INT({n} / {d}) * {d} + MOD({n}, {d})")).parse::<f64>().unwrap(),
                &format!("Testing INT/MOD invariant with n={n}, d={d}")
            );
        }
    }

    proptest! {
        #[test]
        fn test_pow_log_invariant(n in -10.0..10.0_f64) {
            let g = GridController::new();

            for s in [
                format!("LN(EXP({n}))"),
                format!("LOG10(10^{n})"),
                format!("LOG10(POWER(10,{n}))"),
                format!("LOG(POWER(10,{n}))"),
                format!("LOG(POWER(2,{n}),2)"),
                format!("LOG(POWER(1.1,{n}),1.1)"),
            ] {
                let should_equal_n = eval(&g, &s).coerce_nonblank::<f64>().unwrap();
                assert!((should_equal_n - n).abs() < 0.01);
            }
        }
    }

    #[test]
    fn test_pow_0_0() {
        // See https://en.wikipedia.org/wiki/Zero_to_the_power_of_zero

        // This is compatible with Google Sheets, but not Excel
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "POWER(0,0)"));
        assert_eq!("1", eval_to_string(&g, "0^0"));
    }

    #[test]
    fn test_log_errors() {
        let g = GridController::new();
        let e = RunErrorMsg::NaN;
        for n in ["0", "-0.1", "-2"] {
            assert_eq!(e, eval_to_err(&g, &format!("LN({n})")).msg);
            assert_eq!(e, eval_to_err(&g, &format!("LOG({n})")).msg);
            assert_eq!(e, eval_to_err(&g, &format!("LOG({n},2)")).msg);

            // test negative base
            assert_eq!(e, eval_to_err(&g, &format!("LOG(1,{n})")).msg);
            assert_eq!(e, eval_to_err(&g, &format!("LOG({n},{n})")).msg);
        }
    }

    #[test]
    fn test_negative_pow() {
        let g = GridController::new();
        let e = RunErrorMsg::NaN;

        assert_eq!("1", eval_to_string(&g, "POWER(-2, 0)"));
        assert_eq!("1", eval_to_string(&g, "(-2)^0"));
        assert_eq!("-2", eval_to_string(&g, "POWER(-2, 1)"));
        assert_eq!("-2", eval_to_string(&g, "(-2)^1"));
        assert_eq!("-8", eval_to_string(&g, "POWER(-2, 3)"));
        assert_eq!("-8", eval_to_string(&g, "(-2)^3"));
        assert_eq!("16", eval_to_string(&g, "POWER(-2, 4)"));
        assert_eq!("16", eval_to_string(&g, "(-2)^4"));

        assert_eq!(e, eval_to_err(&g, "POWER(-2, 1.5)").msg);
        assert_eq!(e, eval_to_err(&g, "(-2)^1.5").msg);
    }

    #[test]
    fn test_pi() {
        let g = GridController::new();
        assert!(eval_to_string(&g, "PI()").starts_with("3.14159"));
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "PI".into(),
                max_arg_count: 0,
            },
            simple_parse_formula("PI(16)")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_tau() {
        let g = GridController::new();
        assert!(eval_to_string(&g, "TAU()").starts_with("6.283"));
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::TooManyArguments {
                func_name: "TAU".into(),
                max_arg_count: 0,
            },
            simple_parse_formula("TAU(16)")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_sign() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "SIGN(42)"));
        assert_eq!("-1", eval_to_string(&g, "SIGN(-42)"));
        assert_eq!("0", eval_to_string(&g, "SIGN(0)"));
        assert_eq!("1", eval_to_string(&g, "SIGN(0.001)"));
        assert_eq!("-1", eval_to_string(&g, "SIGN(-0.001)"));
    }

    #[test]
    fn test_quotient() {
        let g = GridController::new();
        assert_eq!("2", eval_to_string(&g, "QUOTIENT(7, 3)"));
        assert_eq!("-2", eval_to_string(&g, "QUOTIENT(-7, 3)"));
        assert_eq!("-2", eval_to_string(&g, "QUOTIENT(7, -3)"));
        assert_eq!("2", eval_to_string(&g, "QUOTIENT(-7, -3)"));
    }

    #[test]
    fn test_sumsq() {
        let g = GridController::new();
        assert_eq!("25", eval_to_string(&g, "SUMSQ(3, 4)")); // 9 + 16
        assert_eq!("14", eval_to_string(&g, "SUMSQ(1, 2, 3)")); // 1 + 4 + 9
        assert_eq!("100", eval_to_string(&g, "SUMSQ(10)"));
    }

    #[test]
    fn test_sqrtpi() {
        let g = GridController::new();
        // SQRTPI(1) = sqrt(π) ≈ 1.7724538509
        let result = eval_to_string(&g, "SQRTPI(1)");
        assert!(result.starts_with("1.77"));

        // SQRTPI(2) = sqrt(2π) ≈ 2.5066282746
        let result = eval_to_string(&g, "SQRTPI(2)");
        assert!(result.starts_with("2.50"));
    }

    #[test]
    fn test_arabic() {
        let g = GridController::new();
        assert_eq!("14", eval_to_string(&g, "ARABIC(\"XIV\")"));
        assert_eq!("1994", eval_to_string(&g, "ARABIC(\"MCMXCIV\")"));
        assert_eq!("9", eval_to_string(&g, "ARABIC(\"IX\")"));
        assert_eq!("4", eval_to_string(&g, "ARABIC(\"IV\")"));
        assert_eq!("1000", eval_to_string(&g, "ARABIC(\"M\")"));
        assert_eq!("0", eval_to_string(&g, "ARABIC(\"\")"));
        // Case insensitive
        assert_eq!("14", eval_to_string(&g, "ARABIC(\"xiv\")"));

        // Invalid Roman numeral
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "ARABIC(\"ABC\")").msg,
        );
    }

    #[test]
    fn test_base() {
        let g = GridController::new();
        assert_eq!("FF", eval_to_string(&g, "BASE(255, 16)"));
        assert_eq!("1111", eval_to_string(&g, "BASE(15, 2)"));
        assert_eq!("00001111", eval_to_string(&g, "BASE(15, 2, 8)"));
        assert_eq!("10", eval_to_string(&g, "BASE(2, 2)"));
        assert_eq!("0", eval_to_string(&g, "BASE(0, 16)"));
        assert_eq!("Z", eval_to_string(&g, "BASE(35, 36)"));

        // Invalid radix
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "BASE(10, 1)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "BASE(10, 37)").msg,
        );

        // Negative number
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "BASE(-1, 16)").msg,
        );
    }
}
