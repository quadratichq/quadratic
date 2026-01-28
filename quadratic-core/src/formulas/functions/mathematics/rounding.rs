//! Rounding functions: CEILING, FLOOR, ROUND, TRUNC, etc.

use rust_decimal::prelude::*;

use crate::number::{round, round_down, round_up, truncate};

use super::*;

pub(super) fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Rounds a number up to the next multiple of `increment`. If
            /// `number` and `increment` are both negative, rounds the number
            /// down away from zero. Returns an error if `number` is positive
            /// but `significance` is negative. Returns `0` if `increment` is
            /// `0`.
            #[examples("CEILING(6.5, 2)")]
            #[zip_map]
            fn CEILING([number]: f64, [increment]: (Spanned<f64>)) {
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
        formula_fn!(
            /// Rounds a number up or away from zero to the next multiple of
            /// `increment`. If `increment` is omitted, it is assumed to be `1`.
            /// The sign of `increment` is ignored.
            ///
            /// If `negative_mode` is positive or zero, then `number` is rounded
            /// up, toward positive infinity. If `negative_mode` is negative,
            /// then `number` is rounded away from zero. These are equivalent
            /// when `number` is positive, so in this case `negative_mode` has
            /// no effect.
            ///
            /// If `increment` is zero, returns zero.
            #[name = "CEILING.MATH"]
            #[examples(
                "CEILING.MATH(6.5)",
                "CEILING.MATH(6.5, 2)",
                "CEILING.MATH(-12, 5)",
                "CEILING.MATH(-12, 5, -1)"
            )]
            #[zip_map]
            fn CEILING_MATH(
                [number]: f64,
                [increment]: (Option<f64>),
                [negative_mode]: (Option<f64>),
            ) {
                let increment = increment.unwrap_or(1.0).abs();

                if increment == 0.0 {
                    0.0
                } else if negative_mode.unwrap_or(1.0) < 0.0 && number < 0.0 {
                    (number / increment).floor() * increment
                } else {
                    (number / increment).ceil() * increment
                }
            }
        ),
        formula_fn!(
            /// Rounds a number down or toward zero to the next multiple of
            /// `increment`. If `increment` is omitted, it is assumed to be `1`.
            /// The sign of `increment` is ignored.
            ///
            /// If `negative_mode` is positive or zero, then `number` is rounded
            /// down, toward negative infinity. If `negative_mode` is negative,
            /// then `number` is rounded toward zero. These are equivalent when
            /// `number` is positive, so in this case `negative_mode` has no
            /// effect.
            ///
            /// If `increment` is zero, returns zero.
            #[name = "FLOOR.MATH"]
            #[examples(
                "FLOOR.MATH(6.5)",
                "FLOOR.MATH(6.5, 2)",
                "FLOOR.MATH(-12, 5)",
                "FLOOR.MATH(-12, 5, -1)"
            )]
            #[zip_map]
            fn FLOOR_MATH(
                [number]: f64,
                [increment]: (Option<f64>),
                [negative_mode]: (Option<f64>),
            ) {
                let increment = increment.unwrap_or(1.0).abs();
                if increment == 0.0 {
                    0.0
                } else if negative_mode.unwrap_or(1.0) < 0.0 && number < 0.0 {
                    (number / increment).ceil() * increment
                } else {
                    (number / increment).floor() * increment
                }
            }
        ),
        formula_fn!(
            /// Rounds a number up to the nearest multiple of `increment`,
            /// regardless of the sign of `number`. If `increment` is omitted,
            /// it is assumed to be `1`. The sign of `increment` is ignored.
            ///
            /// Unlike `CEILING.MATH`, this function always rounds toward
            /// positive infinity, even for negative numbers.
            ///
            /// If `increment` is zero, returns zero.
            #[name = "CEILING.PRECISE"]
            #[examples(
                "CEILING.PRECISE(6.5)",
                "CEILING.PRECISE(6.5, 2)",
                "CEILING.PRECISE(-12, 5)",
                "CEILING.PRECISE(-4.1)"
            )]
            #[zip_map]
            fn CEILING_PRECISE([number]: f64, [increment]: (Option<f64>)) {
                let increment = increment.unwrap_or(1.0).abs();

                if increment == 0.0 {
                    0.0
                } else {
                    (number / increment).ceil() * increment
                }
            }
        ),
        formula_fn!(
            /// Rounds a number down to the nearest multiple of `increment`,
            /// regardless of the sign of `number`. If `increment` is omitted,
            /// it is assumed to be `1`. The sign of `increment` is ignored.
            ///
            /// Unlike `FLOOR.MATH`, this function always rounds toward
            /// negative infinity, even for negative numbers.
            ///
            /// If `increment` is zero, returns zero.
            #[name = "FLOOR.PRECISE"]
            #[examples(
                "FLOOR.PRECISE(6.5)",
                "FLOOR.PRECISE(6.5, 2)",
                "FLOOR.PRECISE(-12, 5)",
                "FLOOR.PRECISE(-4.1)"
            )]
            #[zip_map]
            fn FLOOR_PRECISE([number]: f64, [increment]: (Option<f64>)) {
                let increment = increment.unwrap_or(1.0).abs();

                if increment == 0.0 {
                    0.0
                } else {
                    (number / increment).floor() * increment
                }
            }
        ),
        formula_fn!(
            /// Rounds a number up to the nearest multiple of `increment`,
            /// regardless of the sign of `number`. If `increment` is omitted,
            /// it is assumed to be `1`. The sign of `increment` is ignored.
            ///
            /// This is an alias for `CEILING.PRECISE`.
            ///
            /// If `increment` is zero, returns zero.
            #[name = "ISO.CEILING"]
            #[examples(
                "ISO.CEILING(6.5)",
                "ISO.CEILING(6.5, 2)",
                "ISO.CEILING(-12, 5)",
                "ISO.CEILING(-4.1)"
            )]
            #[zip_map]
            fn ISO_CEILING([number]: f64, [increment]: (Option<f64>)) {
                let increment = increment.unwrap_or(1.0).abs();

                if increment == 0.0 {
                    0.0
                } else {
                    (number / increment).ceil() * increment
                }
            }
        ),
        formula_fn!(
            /// Rounds a number down to the next integer. Always rounds toward
            /// negative infinity.
            #[examples("INT(3.9)", "INT(-2.1)")]
            #[zip_map]
            fn INT([number]: f64) {
                number.floor()
            }
        ),
        formula_fn!(
            /// Rounds a number to the specified number of digits after the
            /// decimal point.
            ///
            /// - If `digits` is 0 or omitted, then the number is rounded to the
            ///   nearest integer.
            /// - If `digits > 0`, then the number is rounded to a digit after
            ///   the decimal point. For example, `ROUND(x, 2)` rounds `x` to
            ///   the nearest multiple of 0.01.
            /// - If `digits < 0`, then the number is rounded to a digit before
            ///   the decimal point. For example, `ROUND(x, -2)` rounds `x` to
            ///   the nearest multiple of 100.
            ///
            /// Ties are broken by rounding away from zero. For example,
            /// `ROUND(50, -2)` rounds to `100`.
            #[examples("ROUND(6.553, 2)")]
            #[zip_map]
            fn ROUND([number]: Decimal, [digits]: (Option<i64>)) {
                round(number, digits.unwrap_or(0))
            }
        ),
        formula_fn!(
            /// Rounds a number **away from zero** to the specified number of
            /// digits after the decimal point.
            ///
            /// - If `digits` is 0 or omitted, then the number is rounded to an
            ///   integer.
            /// - If `digits > 0`, then the number is rounded to a digit after
            ///   the decimal point. For example, `ROUNDUP(x, 2)` rounds `x` to
            ///   a multiple of 0.01.
            /// - If `digits < 0`, then the number is rounded to a digit before
            ///   the decimal point. For example, `ROUNDUP(x, -2)` rounds `x` to
            ///   a multiple of 100.
            #[examples("ROUNDUP(6.553, 2)")]
            #[zip_map]
            fn ROUNDUP([number]: Decimal, [digits]: (Option<i64>)) {
                round_up(number, digits.unwrap_or(0))
            }
        ),
        formula_fn!(
            /// Rounds a number **toward zero** to the specified number of
            /// digits after the decimal point. This is exactly the same as
            /// `TRUNC()`.
            ///
            /// - If `digits` is 0 or omitted, then the number is rounded to an
            ///   integer.
            /// - If `digits > 0`, then the number is rounded to a digit after
            ///   the decimal point. For example, `ROUNDDOWN(x, 2)` rounds `x`
            ///   to a multiple of 0.01.
            /// - If `digits < 0`, then the number is rounded to a digit before
            ///   the decimal point. For example, `ROUNDDOWN(x, -2)` rounds `x`
            ///   to a multiple of 100.
            #[examples("ROUNDDOWN(6.553, 2)")]
            #[zip_map]
            fn ROUNDDOWN([number]: Decimal, [digits]: (Option<i64>)) {
                round_down(number, digits.unwrap_or(0))
            }
        ),
        formula_fn!(
            /// Rounds a number **toward zero** to the specified number of
            /// digits after the decimal point. This is exactly the same as
            /// `ROUNDDOWN()`.
            ///
            /// - If `digits` is 0 or omitted, then the number is rounded to an
            ///   integer.
            /// - If `digits > 0`, then the number is rounded to a digit after
            ///   the decimal point. For example, `TRUNC(x, 2)` rounds `x` to a
            ///   multiple of 0.01.
            /// - If `digits < 0`, then the number is rounded to a digit before
            ///   the decimal point. For example, `TRUNC(x, -2)` rounds `x` to a
            ///   multiple of 100.
            #[examples("TRUNC(6.553, 2)")]
            #[zip_map]
            fn TRUNC([number]: Decimal, [digits]: (Option<i64>)) {
                truncate(number, digits.unwrap_or(0))
            }
        ),
        formula_fn!(
            /// Rounds a number to the nearest multiple of `significance`.
            ///
            /// Both the number and significance must have the same sign, or
            /// the significance must be zero.
            #[examples("MROUND(10, 3) = 9", "MROUND(1.3, 0.2) = 1.4", "MROUND(-10, -3) = -9")]
            #[zip_map]
            fn MROUND(span: Span, [number]: f64, [significance]: f64) {
                if significance == 0.0 {
                    return Ok(0.0.into());
                }
                // Check that number and significance have the same sign
                if (number > 0.0 && significance < 0.0) || (number < 0.0 && significance > 0.0) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                (number / significance).round() * significance
            }
        ),
        formula_fn!(
            /// Rounds a number up to the nearest odd integer.
            /// If the number is already odd, it is unchanged (unless negative).
            #[examples("ODD(1.5) = 3", "ODD(2) = 3", "ODD(-1.5) = -3")]
            #[zip_map]
            fn ODD([number]: f64) {
                if number == 0.0 {
                    1_i64
                } else {
                    let sign = if number > 0.0 { 1.0 } else { -1.0 };
                    let abs_num = number.abs();
                    let ceil = abs_num.ceil() as i64;
                    let result = if ceil % 2 == 0 { ceil + 1 } else { ceil };
                    (sign * result as f64) as i64
                }
            }
        ),
        formula_fn!(
            /// Rounds a number up to the nearest even integer.
            /// Rounds away from zero.
            #[examples("EVEN(1.5) = 2", "EVEN(3) = 4", "EVEN(-1.5) = -2")]
            #[zip_map]
            fn EVEN([number]: f64) {
                if number == 0.0 {
                    0_i64
                } else {
                    let sign = if number > 0.0 { 1.0 } else { -1.0 };
                    let abs_num = number.abs();
                    let ceil = abs_num.ceil() as i64;
                    let result = if ceil % 2 == 0 { ceil } else { ceil + 1 };
                    (sign * result as f64) as i64
                }
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_ceiling() {
        let g = GridController::new();
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
            let formula = format!("CEILING({n}, {increment})");
            match expected {
                Ok(ok) => assert_eq!(ok, eval_to_string(&g, &formula)),
                Err(err) => assert_eq!(err, eval_to_err(&g, &formula).msg),
            }
        }
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "CEILING".into(),
                arg_name: "increment".into(),
            },
            eval_to_err(&g, "CEILING(3.5)").msg,
        );
    }

    #[test]
    fn test_floor() {
        let g = GridController::new();
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
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "FLOOR".into(),
                arg_name: "increment".into(),
            },
            eval_to_err(&g, "FLOOR(3.5)").msg,
        );
    }

    #[test]
    fn test_floor_math_and_ceiling_math() {
        let g = GridController::new();
        let test_inputs = &[3.5, 2.5, 0.0, -2.5, -3.5];
        #[allow(clippy::type_complexity)]
        let test_cases: &[([i64; 5], fn(f64) -> String)] = &[
            ([4, 3, 0, -2, -3], |n| format!("CEILING.MATH({n})")),
            ([4, 3, 0, -3, -4], |n| format!("CEILING.MATH({n},, -1)")),
            ([4, 4, 0, -2, -2], |n| format!("CEILING.MATH({n}, 2)")),
            ([4, 4, 0, -2, -2], |n| format!("CEILING.MATH({n}, -2)")),
            ([4, 4, 0, -4, -4], |n| format!("CEILING.MATH({n}, 2, -1)")),
            ([4, 4, 0, -4, -4], |n| format!("CEILING.MATH({n}, -2, -1)")),
            ([0, 0, 0, 0, 0], |n| format!("CEILING.MATH({n}, 0)")),
            ([3, 2, 0, -3, -4], |n| format!("FLOOR.MATH({n})")),
            ([3, 2, 0, -2, -3], |n| format!("FLOOR.MATH({n},, -1)")),
            ([2, 2, 0, -4, -4], |n| format!("FLOOR.MATH({n}, 2)")),
            ([2, 2, 0, -4, -4], |n| format!("FLOOR.MATH({n}, -2)")),
            ([2, 2, 0, -2, -2], |n| format!("FLOOR.MATH({n}, 2, -1)")),
            ([2, 2, 0, -2, -2], |n| format!("FLOOR.MATH({n}, -2, -1)")),
            ([0, 0, 0, 0, 0], |n| format!("FLOOR.MATH({n}, 0)")),
        ];
        for (expected_results, formula_gen_fn) in test_cases {
            assert_eq!(
                expected_results.map(|n| n.to_string()),
                test_inputs.map(|n| eval_to_string(&g, &formula_gen_fn(n)))
            );
        }
    }

    #[test]
    fn test_int() {
        let g = GridController::new();
        assert_eq!(
            "{-3, -2, -1, 0, 0, 1, 2}",
            eval_to_string(&g, "INT({-2.9, -1.1, -0.1, 0, 0.1, 1.1, 2.9})")
        );
    }

    #[test]
    fn test_rounding() {
        let test_values = [
            -2025.0, -10.0, -5.0, -0.8, -0.5, -0.3, 0.0, 0.3, 0.5, 0.8, 5.0, 10.0, 2025.0,
        ];
        let g = GridController::new();

        // Test `ROUND()`
        #[rustfmt::skip]
        let test_cases = [
            (-2, [-2000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2000.0]),
            (-1, [-2030.0, -10.0, -10.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 10.0, 10.0, 2030.0]),
            (0, [-2025.0, -10.0, -5.0, -1.0, -1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 5.0, 10.0, 2025.0]),
            (1, [-2025.0, -10.0, -5.0, -0.8, -0.5, -0.3, 0.0, 0.3, 0.5, 0.8, 5.0, 10.0, 2025.0]),
            (2, [-2025.0, -10.0, -5.0, -0.8, -0.5, -0.3, 0.0, 0.3, 0.5, 0.8, 5.0, 10.0, 2025.0]),
        ];
        for (digits, expected_results) in test_cases {
            for (input, expected_output) in std::iter::zip(test_values, expected_results) {
                assert_f64_eval(&g, expected_output, &format!("ROUND({input}, {digits})"));
            }
        }

        // Test `ROUNDUP()`
        #[rustfmt::skip]
        let test_cases = [
            (-2, [-2100.0, -100.0, -100.0, -100.0, -100.0, -100.0, 0.0, 100.0, 100.0, 100.0, 100.0, 100.0, 2100.0]),
            (-1, [-2030.0, -10.0, -10.0, -10.0, -10.0, -10.0, 0.0, 10.0, 10.0, 10.0, 10.0, 10.0, 2030.0]),
            (0, [-2025.0, -10.0, -5.0, -1.0, -1.0, -1.0, 0.0, 1.0, 1.0, 1.0, 5.0, 10.0, 2025.0]),
            (1, [-2025.0, -10.0, -5.0, -0.8, -0.5, -0.3, 0.0, 0.3, 0.5, 0.8, 5.0, 10.0, 2025.0]),
            (2, [-2025.0, -10.0, -5.0, -0.8, -0.5, -0.3, 0.0, 0.3, 0.5, 0.8, 5.0, 10.0, 2025.0]),
        ];
        for (digits, expected_results) in test_cases {
            for (input, expected_output) in std::iter::zip(test_values, expected_results) {
                assert_f64_eval(&g, expected_output, &format!("ROUNDUP({input}, {digits})"));
            }
        }

        // Test `ROUNDDOWN()` and `TRUNC()` (same semantics)
        #[rustfmt::skip]
        let test_cases = [
            (-2, [-2000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2000.0]),
            (-1, [-2020.0, -10.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 10.0, 2020.0]),
            (0, [-2025.0, -10.0, -5.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 5.0, 10.0, 2025.0]),
            (1, [-2025.0, -10.0, -5.0, -0.8, -0.5, -0.3, 0.0, 0.3, 0.5, 0.8, 5.0, 10.0, 2025.0]),
            (2, [-2025.0, -10.0, -5.0, -0.8, -0.5, -0.3, 0.0, 0.3, 0.5, 0.8, 5.0, 10.0, 2025.0]),
        ];
        for (digits, expected_results) in test_cases {
            for (input, expected_output) in std::iter::zip(test_values, expected_results) {
                assert_f64_eval(
                    &g,
                    expected_output,
                    &format!("ROUNDDOWN({input}, {digits})"),
                );
                assert_f64_eval(&g, expected_output, &format!("TRUNC({input}, {digits})"));
            }
        }

        // Test string printing
        assert_eq!("44999.55", eval_to_string(&g, "ROUND(44999.553294, 2)"));
        assert_eq!("44999.55", eval_to_string(&g, "TRUNC(44999.553294, 2)"));
        assert_eq!("44999.55", eval_to_string(&g, "ROUNDDOWN(44999.553294, 2)"));
        assert_eq!("44999.56", eval_to_string(&g, "ROUNDUP(44999.553294, 2)"));
    }

    #[test]
    fn test_ceiling_precise() {
        let g = GridController::new();

        // Basic rounding up
        assert_eq!("7", eval_to_string(&g, "CEILING.PRECISE(6.5)"));
        assert_eq!("8", eval_to_string(&g, "CEILING.PRECISE(6.5, 2)"));
        assert_eq!("-10", eval_to_string(&g, "CEILING.PRECISE(-12, 5)"));
        assert_eq!("-4", eval_to_string(&g, "CEILING.PRECISE(-4.1)"));

        // With negative increment (sign is ignored)
        assert_eq!("8", eval_to_string(&g, "CEILING.PRECISE(6.5, -2)"));
        assert_eq!("-10", eval_to_string(&g, "CEILING.PRECISE(-12, -5)"));

        // Zero cases
        assert_eq!("0", eval_to_string(&g, "CEILING.PRECISE(0)"));
        assert_eq!("0", eval_to_string(&g, "CEILING.PRECISE(6.5, 0)"));

        // Exact multiples
        assert_eq!("6", eval_to_string(&g, "CEILING.PRECISE(6, 2)"));
        assert_eq!("-6", eval_to_string(&g, "CEILING.PRECISE(-6, 2)"));
    }

    #[test]
    fn test_floor_precise() {
        let g = GridController::new();

        // Basic rounding down
        assert_eq!("6", eval_to_string(&g, "FLOOR.PRECISE(6.5)"));
        assert_eq!("6", eval_to_string(&g, "FLOOR.PRECISE(6.5, 2)"));
        assert_eq!("-15", eval_to_string(&g, "FLOOR.PRECISE(-12, 5)"));
        assert_eq!("-5", eval_to_string(&g, "FLOOR.PRECISE(-4.1)"));

        // With negative increment (sign is ignored)
        assert_eq!("6", eval_to_string(&g, "FLOOR.PRECISE(6.5, -2)"));
        assert_eq!("-15", eval_to_string(&g, "FLOOR.PRECISE(-12, -5)"));

        // Zero cases
        assert_eq!("0", eval_to_string(&g, "FLOOR.PRECISE(0)"));
        assert_eq!("0", eval_to_string(&g, "FLOOR.PRECISE(6.5, 0)"));

        // Exact multiples
        assert_eq!("6", eval_to_string(&g, "FLOOR.PRECISE(6, 2)"));
        assert_eq!("-6", eval_to_string(&g, "FLOOR.PRECISE(-6, 2)"));
    }

    #[test]
    fn test_iso_ceiling() {
        let g = GridController::new();

        // ISO.CEILING is an alias for CEILING.PRECISE
        assert_eq!("7", eval_to_string(&g, "ISO.CEILING(6.5)"));
        assert_eq!("8", eval_to_string(&g, "ISO.CEILING(6.5, 2)"));
        assert_eq!("-10", eval_to_string(&g, "ISO.CEILING(-12, 5)"));
        assert_eq!("-4", eval_to_string(&g, "ISO.CEILING(-4.1)"));
    }

    #[test]
    fn test_mround() {
        let g = GridController::new();

        // Basic rounding
        assert_eq!("9", eval_to_string(&g, "MROUND(10, 3)"));
        assert_eq!("1.4", eval_to_string(&g, "MROUND(1.3, 0.2)"));
        assert_eq!("-9", eval_to_string(&g, "MROUND(-10, -3)"));
        assert_eq!("6", eval_to_string(&g, "MROUND(5.5, 3)"));
        assert_eq!("1.5", eval_to_string(&g, "MROUND(1.4, 0.5)"));

        // Zero significance returns 0
        assert_eq!("0", eval_to_string(&g, "MROUND(10, 0)"));

        // Error case: different signs
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "MROUND(10, -3)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "MROUND(-10, 3)").msg,
        );
    }

    #[test]
    fn test_odd_even() {
        let g = GridController::new();

        // ODD tests
        assert_eq!("3", eval_to_string(&g, "ODD(1.5)"));
        assert_eq!("3", eval_to_string(&g, "ODD(2)"));
        assert_eq!("-3", eval_to_string(&g, "ODD(-1.5)"));
        assert_eq!("1", eval_to_string(&g, "ODD(0)"));
        assert_eq!("1", eval_to_string(&g, "ODD(1)"));
        assert_eq!("5", eval_to_string(&g, "ODD(4)"));

        // EVEN tests
        assert_eq!("2", eval_to_string(&g, "EVEN(1.5)"));
        assert_eq!("4", eval_to_string(&g, "EVEN(3)"));
        assert_eq!("-2", eval_to_string(&g, "EVEN(-1.5)"));
        assert_eq!("0", eval_to_string(&g, "EVEN(0)"));
        assert_eq!("2", eval_to_string(&g, "EVEN(1)"));
        assert_eq!("4", eval_to_string(&g, "EVEN(4)"));
    }
}
