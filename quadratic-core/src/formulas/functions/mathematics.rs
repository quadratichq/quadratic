use rust_decimal::prelude::*;

use crate::number::{round, round_down, round_up, sum, truncate};

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Mathematics functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
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
        // Rounding
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
            /// Returns the greatest common divisor of two or more integers.
            #[examples("GCD(12, 18) = 6", "GCD(24, 36, 48) = 12")]
            fn GCD(numbers: (Iter<i64>)) {
                fn gcd_two(mut a: i64, mut b: i64) -> i64 {
                    a = a.abs();
                    b = b.abs();
                    while b != 0 {
                        let t = b;
                        b = a % b;
                        a = t;
                    }
                    a
                }
                let values: Vec<i64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Ok(0.into());
                }
                let result = values.into_iter().fold(0, gcd_two);
                Ok(CellValue::from(result))
            }
        ),
        formula_fn!(
            /// Returns the least common multiple of two or more integers.
            #[examples("LCM(4, 6) = 12", "LCM(3, 5, 7) = 105")]
            fn LCM(span: Span, numbers: (Iter<i64>)) {
                fn gcd_two(mut a: i64, mut b: i64) -> i64 {
                    a = a.abs();
                    b = b.abs();
                    while b != 0 {
                        let t = b;
                        b = a % b;
                        a = t;
                    }
                    a
                }
                fn lcm_two(a: i64, b: i64) -> Option<i64> {
                    if a == 0 || b == 0 {
                        return Some(0);
                    }
                    let g = gcd_two(a, b);
                    (a / g).checked_mul(b.abs())
                }
                let values: Vec<i64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Ok(0.into());
                }
                let result = values
                    .into_iter()
                    .try_fold(1_i64, |acc, x| lcm_two(acc, x))
                    .ok_or_else(|| RunErrorMsg::Overflow.with_span(span))?;
                Ok(CellValue::from(result))
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
        formula_fn!(
            /// Returns the factorial of a number.
            /// The number must be non-negative.
            #[examples("FACT(5) = 120", "FACT(0) = 1")]
            #[zip_map]
            fn FACT(span: Span, [number]: (Spanned<i64>)) {
                if number.inner < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(number.span));
                }
                let n = number.inner as u64;
                if n > 170 {
                    return Err(RunErrorMsg::Overflow.with_span(span));
                }
                let result: f64 = (1..=n).map(|i| i as f64).product();
                result
            }
        ),
        formula_fn!(
            /// Returns the double factorial of a number.
            /// For even n: n!! = n * (n-2) * (n-4) * ... * 4 * 2
            /// For odd n: n!! = n * (n-2) * (n-4) * ... * 3 * 1
            #[examples("FACTDOUBLE(6) = 48", "FACTDOUBLE(7) = 105")]
            #[zip_map]
            fn FACTDOUBLE(span: Span, [number]: (Spanned<i64>)) {
                if number.inner < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(number.span));
                }
                let n = number.inner as u64;
                if n > 300 {
                    return Err(RunErrorMsg::Overflow.with_span(span));
                }
                let mut result = 1.0_f64;
                let mut i = n;
                while i > 1 {
                    result *= i as f64;
                    i -= 2;
                }
                result
            }
        ),
        formula_fn!(
            /// Returns the number of combinations of n items taken k at a time.
            /// Also known as "n choose k" or the binomial coefficient.
            #[examples("COMBIN(5, 2) = 10", "COMBIN(10, 3) = 120")]
            #[zip_map]
            fn COMBIN(span: Span, [n]: (Spanned<i64>), [k]: (Spanned<i64>)) {
                if n.inner < 0 || k.inner < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if k.inner > n.inner {
                    return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                }
                let n = n.inner as u64;
                let k = k.inner as u64;
                // Use the smaller k to minimize calculations
                let k = k.min(n - k);
                // Calculate n! / (k! * (n-k)!) iteratively to avoid overflow
                let mut result = 1.0_f64;
                for i in 0..k {
                    result = result * (n - i) as f64 / (i + 1) as f64;
                }
                result.round()
            }
        ),
        formula_fn!(
            /// Returns the number of permutations of n items taken k at a time.
            #[examples("PERMUT(5, 2) = 20", "PERMUT(10, 3) = 720")]
            #[zip_map]
            fn PERMUT(span: Span, [n]: (Spanned<i64>), [k]: (Spanned<i64>)) {
                if n.inner < 0 || k.inner < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if k.inner > n.inner {
                    return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                }
                let n = n.inner as u64;
                let k = k.inner as u64;
                // Calculate n! / (n-k)! = n * (n-1) * ... * (n-k+1)
                let mut result = 1.0_f64;
                for i in 0..k {
                    result *= (n - i) as f64;
                }
                result.round()
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
    ]
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
}
