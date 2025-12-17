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
                    .try_fold(1_i64, lcm_two)
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
            /// Returns the number of combinations with repetitions for a given
            /// number of items. This is also known as "n multichoose k".
            ///
            /// The formula is: (n + k - 1)! / (k! * (n - 1)!)
            ///
            /// For example, COMBINA(4, 3) returns 20, which is the number of
            /// ways to choose 3 items from 4 items when repetition is allowed.
            #[examples("COMBINA(4, 3) = 20", "COMBINA(10, 2) = 55")]
            #[zip_map]
            fn COMBINA(span: Span, [n]: (Spanned<i64>), [k]: (Spanned<i64>)) {
                if n.inner < 0 || k.inner < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Special case: if both n and k are 0, return 1
                if n.inner == 0 && k.inner == 0 {
                    return Ok(1.0.into());
                }
                // Special case: if n is 0 but k > 0, return 0
                if n.inner == 0 {
                    return Ok(0.0.into());
                }
                let n = n.inner as u64;
                let k = k.inner as u64;
                // COMBINA(n, k) = COMBIN(n + k - 1, k) = (n + k - 1)! / (k! * (n - 1)!)
                let total = n + k - 1;
                // Use the smaller of k and (n-1) to minimize calculations
                let smaller_k = k.min(n - 1);
                // Calculate iteratively to avoid overflow
                let mut result = 1.0_f64;
                for i in 0..smaller_k {
                    result = result * (total - i) as f64 / (i + 1) as f64;
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
        formula_fn!(
            /// Converts a text representation of a number in a given base into
            /// a decimal number.
            ///
            /// The `radix` must be between 2 and 36 (inclusive).
            /// Valid digits for bases > 10 use letters A-Z (case insensitive).
            #[examples(
                "DECIMAL(\"FF\", 16) = 255",
                "DECIMAL(\"111\", 2) = 7",
                "DECIMAL(\"ZZ\", 36) = 1295"
            )]
            #[zip_map]
            fn DECIMAL(span: Span, [text]: String, [radix]: (Spanned<i64>)) {
                let radix_val = radix.inner;
                if !(2..=36).contains(&radix_val) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(radix.span));
                }
                let text = text.trim();
                if text.is_empty() {
                    return Ok(0.0.into());
                }
                i64::from_str_radix(text, radix_val as u32)
                    .map(|n| n as f64)
                    .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))
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
            /// Returns the multinomial of a set of numbers.
            ///
            /// The multinomial is the ratio of the factorial of the sum of values
            /// to the product of the factorials of those values.
            ///
            /// MULTINOMIAL(a, b, c, ...) = (a + b + c + ...)! / (a! * b! * c! * ...)
            #[examples("MULTINOMIAL(2, 3, 4) = 1260", "MULTINOMIAL(2, 3) = 10")]
            fn MULTINOMIAL(span: Span, numbers: (Iter<i64>)) {
                let values: Vec<i64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Ok(1.0.into());
                }

                // Check all values are non-negative
                for &v in &values {
                    if v < 0 {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }
                }

                let sum: i64 = values.iter().sum();
                if sum > 170 {
                    return Err(RunErrorMsg::Overflow.with_span(span));
                }

                // Calculate (sum)! / (n1! * n2! * ... * nk!)
                // We do this iteratively to avoid overflow
                let mut result = 1.0_f64;
                let mut remaining = sum;

                for &v in &values {
                    // Multiply by C(remaining, v) which is remaining! / (v! * (remaining-v)!)
                    // This is more numerically stable than computing factorials directly
                    for i in 0..v {
                        result *= (remaining - i) as f64;
                        result /= (i + 1) as f64;
                    }
                    remaining -= v;
                }

                Ok(result.round())
            }
        ),
        formula_fn!(
            /// Returns a random number greater than or equal to 0 and less than 1.
            ///
            /// A new random number is returned every time the worksheet is
            /// recalculated.
            #[examples("RAND()")]
            fn RAND() {
                use rand::Rng;
                let mut rng = rand::rng();
                rng.random::<f64>()
            }
        ),
        formula_fn!(
            /// Returns a random integer between `bottom` and `top` (inclusive).
            ///
            /// A new random number is returned every time the worksheet is
            /// recalculated.
            #[examples("RANDBETWEEN(1, 10)", "RANDBETWEEN(-5, 5)")]
            #[zip_map]
            fn RANDBETWEEN(span: Span, [bottom]: i64, [top]: i64) {
                if bottom > top {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                use rand::Rng;
                let mut rng = rand::rng();
                rng.random_range(bottom..=top)
            }
        ),
        formula_fn!(
            /// Converts an Arabic number to a Roman numeral as text.
            ///
            /// The number must be between 1 and 3999 (inclusive).
            #[examples("ROMAN(499) = \"CDXCIX\"", "ROMAN(2023) = \"MMXXIII\"")]
            #[zip_map]
            fn ROMAN(span: Span, [number]: i64) {
                if !(1..=3999).contains(&number) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let mut n = number as u32;
                let mut result = String::new();

                let numerals = [
                    (1000, "M"),
                    (900, "CM"),
                    (500, "D"),
                    (400, "CD"),
                    (100, "C"),
                    (90, "XC"),
                    (50, "L"),
                    (40, "XL"),
                    (10, "X"),
                    (9, "IX"),
                    (5, "V"),
                    (4, "IV"),
                    (1, "I"),
                ];

                for (value, numeral) in numerals {
                    while n >= value {
                        result.push_str(numeral);
                        n -= value;
                    }
                }

                result
            }
        ),
        formula_fn!(
            /// Returns the sum of a power series based on the formula:
            ///
            /// SERIESSUM = x^n * (a₁ + a₂*x^m + a₃*x^(2m) + a₄*x^(3m) + ...)
            ///
            /// - `x`: The input value to the power series.
            /// - `n`: The initial power to which x is raised.
            /// - `m`: The step by which to increase n for each term.
            /// - `coefficients`: A set of coefficients by which each power of x is multiplied.
            #[examples(
                "SERIESSUM(2, 0, 2, {1, 1, 1}) = 21",
                "SERIESSUM(3, 1, 1, {1, 2, 3}) = 102"
            )]
            fn SERIESSUM(span: Span, x: f64, n: f64, m: f64, coefficients: (Spanned<Array>)) {
                let coeffs: Vec<f64> = coefficients
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(num) => {
                            use rust_decimal::prelude::ToPrimitive;
                            num.to_f64()
                        }
                        CellValue::Blank => Some(0.0),
                        _ => None,
                    })
                    .collect();

                if coeffs.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(coefficients.span));
                }

                let mut result = 0.0_f64;
                let mut power = n;

                for coeff in coeffs {
                    result += coeff * x.powf(power);
                    power += m;
                }

                if result.is_nan() || result.is_infinite() {
                    return Err(RunErrorMsg::Overflow.with_span(span));
                }

                result
            }
        ),
        formula_fn!(
            /// Returns a subtotal in a list or database.
            ///
            /// The `function_num` argument specifies which function to use:
            /// - 1 or 101: AVERAGE
            /// - 2 or 102: COUNT
            /// - 3 or 103: COUNTA
            /// - 4 or 104: MAX
            /// - 5 or 105: MIN
            /// - 6 or 106: PRODUCT
            /// - 7 or 107: STDEV.S
            /// - 8 or 108: STDEV.P
            /// - 9 or 109: SUM
            /// - 10 or 110: VAR.S
            /// - 11 or 111: VAR.P
            ///
            /// Functions 1-11 include manually-hidden rows.
            /// Functions 101-111 ignore manually-hidden rows (not currently supported, treated same as 1-11).
            #[examples("SUBTOTAL(9, A1:A10)", "SUBTOTAL(1, B1:B5)", "SUBTOTAL(109, A1:A10)")]
            fn SUBTOTAL(span: Span, function_num: (Spanned<i64>), ranges: (Iter<f64>)) {
                let func_num = function_num.inner;

                // Normalize 101-111 to 1-11 (we don't support hidden rows currently)
                let normalized_func = if (101..=111).contains(&func_num) {
                    func_num - 100
                } else {
                    func_num
                };

                // Validate function_num
                if !(1..=11).contains(&normalized_func) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(function_num.span));
                }

                let values: Vec<f64> = ranges.collect::<CodeResult<Vec<_>>>()?;

                let result: f64 = match normalized_func {
                    1 => {
                        // AVERAGE
                        if values.is_empty() {
                            return Err(RunErrorMsg::DivideByZero.with_span(span));
                        }
                        values.iter().sum::<f64>() / values.len() as f64
                    }
                    2 => {
                        // COUNT
                        values.len() as f64
                    }
                    3 => {
                        // COUNTA (count non-blank - all values we collected are non-blank)
                        values.len() as f64
                    }
                    4 => {
                        // MAX
                        if values.is_empty() {
                            return Err(RunErrorMsg::InvalidArgument.with_span(span));
                        }
                        values.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
                    }
                    5 => {
                        // MIN
                        if values.is_empty() {
                            return Err(RunErrorMsg::InvalidArgument.with_span(span));
                        }
                        values.iter().cloned().fold(f64::INFINITY, f64::min)
                    }
                    6 => {
                        // PRODUCT
                        values.iter().product()
                    }
                    7 => {
                        // STDEV.S (sample standard deviation)
                        if values.len() < 2 {
                            return Err(RunErrorMsg::DivideByZero.with_span(span));
                        }
                        let mean = values.iter().sum::<f64>() / values.len() as f64;
                        let variance = values.iter().map(|x| (x - mean).powi(2)).sum::<f64>()
                            / (values.len() - 1) as f64;
                        variance.sqrt()
                    }
                    8 => {
                        // STDEV.P (population standard deviation)
                        if values.is_empty() {
                            return Err(RunErrorMsg::DivideByZero.with_span(span));
                        }
                        let mean = values.iter().sum::<f64>() / values.len() as f64;
                        let variance = values.iter().map(|x| (x - mean).powi(2)).sum::<f64>()
                            / values.len() as f64;
                        variance.sqrt()
                    }
                    9 => {
                        // SUM
                        values.iter().sum()
                    }
                    10 => {
                        // VAR.S (sample variance)
                        if values.len() < 2 {
                            return Err(RunErrorMsg::DivideByZero.with_span(span));
                        }
                        let mean = values.iter().sum::<f64>() / values.len() as f64;
                        values.iter().map(|x| (x - mean).powi(2)).sum::<f64>()
                            / (values.len() - 1) as f64
                    }
                    11 => {
                        // VAR.P (population variance)
                        if values.is_empty() {
                            return Err(RunErrorMsg::DivideByZero.with_span(span));
                        }
                        let mean = values.iter().sum::<f64>() / values.len() as f64;
                        values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / values.len() as f64
                    }
                    _ => unreachable!(),
                };

                result
            }
        ),
        formula_fn!(
            /// Returns the sum of the difference of squares of corresponding values
            /// in two arrays.
            ///
            /// SUMX2MY2 = Σ(x² - y²)
            ///
            /// The arrays must have the same dimensions.
            #[examples("SUMX2MY2({2, 3, 4}, {1, 2, 3}) = 9")]
            fn SUMX2MY2(span: Span, array_x: (Spanned<Array>), array_y: (Spanned<Array>)) {
                let x_vals: Vec<f64> = array_x
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let y_vals: Vec<f64> = array_y
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if x_vals.len() != y_vals.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                if x_vals.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let result: f64 = x_vals
                    .iter()
                    .zip(y_vals.iter())
                    .map(|(x, y)| x * x - y * y)
                    .sum();

                result
            }
        ),
        formula_fn!(
            /// Returns the sum of the sum of squares of corresponding values
            /// in two arrays.
            ///
            /// SUMX2PY2 = Σ(x² + y²)
            ///
            /// The arrays must have the same dimensions.
            #[examples("SUMX2PY2({2, 3, 4}, {1, 2, 3}) = 43")]
            fn SUMX2PY2(span: Span, array_x: (Spanned<Array>), array_y: (Spanned<Array>)) {
                let x_vals: Vec<f64> = array_x
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let y_vals: Vec<f64> = array_y
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if x_vals.len() != y_vals.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                if x_vals.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let result: f64 = x_vals
                    .iter()
                    .zip(y_vals.iter())
                    .map(|(x, y)| x * x + y * y)
                    .sum();

                result
            }
        ),
        formula_fn!(
            /// Returns the sum of squares of differences of corresponding values
            /// in two arrays.
            ///
            /// SUMXMY2 = Σ(x - y)²
            ///
            /// The arrays must have the same dimensions.
            #[examples("SUMXMY2({2, 3, 4}, {1, 2, 3}) = 3")]
            fn SUMXMY2(span: Span, array_x: (Spanned<Array>), array_y: (Spanned<Array>)) {
                let x_vals: Vec<f64> = array_x
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let y_vals: Vec<f64> = array_y
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if x_vals.len() != y_vals.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                if x_vals.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let result: f64 = x_vals
                    .iter()
                    .zip(y_vals.iter())
                    .map(|(x, y)| (x - y).powi(2))
                    .sum();

                result
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
    fn test_gcd_lcm() {
        let g = GridController::new();

        // GCD tests
        assert_eq!("6", eval_to_string(&g, "GCD(12, 18)"));
        assert_eq!("1", eval_to_string(&g, "GCD(7, 13)"));
        assert_eq!("4", eval_to_string(&g, "GCD(12, 8, 4)"));
        assert_eq!("5", eval_to_string(&g, "GCD(5)"));

        // LCM tests
        assert_eq!("12", eval_to_string(&g, "LCM(4, 6)"));
        assert_eq!("60", eval_to_string(&g, "LCM(4, 5, 6)"));
        assert_eq!("7", eval_to_string(&g, "LCM(7)"));
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

    #[test]
    fn test_fact() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "FACT(0)"));
        assert_eq!("1", eval_to_string(&g, "FACT(1)"));
        assert_eq!("120", eval_to_string(&g, "FACT(5)"));
        assert_eq!("3628800", eval_to_string(&g, "FACT(10)"));

        // Error for negative
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "FACT(-1)").msg,
        );
    }

    #[test]
    fn test_factdouble() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "FACTDOUBLE(0)"));
        assert_eq!("1", eval_to_string(&g, "FACTDOUBLE(1)"));
        assert_eq!("2", eval_to_string(&g, "FACTDOUBLE(2)"));
        assert_eq!("15", eval_to_string(&g, "FACTDOUBLE(5)")); // 5 * 3 * 1
        assert_eq!("48", eval_to_string(&g, "FACTDOUBLE(6)")); // 6 * 4 * 2
        assert_eq!("105", eval_to_string(&g, "FACTDOUBLE(7)")); // 7 * 5 * 3 * 1
    }

    #[test]
    fn test_combin_permut() {
        let g = GridController::new();

        // COMBIN tests (n choose k)
        assert_eq!("10", eval_to_string(&g, "COMBIN(5, 2)")); // 5!/(2!*3!) = 10
        assert_eq!("1", eval_to_string(&g, "COMBIN(5, 0)"));
        assert_eq!("1", eval_to_string(&g, "COMBIN(5, 5)"));
        assert_eq!("252", eval_to_string(&g, "COMBIN(10, 5)"));

        // PERMUT tests
        assert_eq!("20", eval_to_string(&g, "PERMUT(5, 2)")); // 5!/3! = 20
        assert_eq!("1", eval_to_string(&g, "PERMUT(5, 0)"));
        assert_eq!("120", eval_to_string(&g, "PERMUT(5, 5)"));
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
    fn test_combina() {
        let g = GridController::new();

        // Basic tests
        assert_eq!("20", eval_to_string(&g, "COMBINA(4, 3)")); // (4+3-1)!/(3!*(4-1)!) = 6!/(3!*3!) = 20
        assert_eq!("55", eval_to_string(&g, "COMBINA(10, 2)")); // (10+2-1)!/(2!*(10-1)!) = 11!/(2!*9!) = 55
        assert_eq!("1", eval_to_string(&g, "COMBINA(5, 0)")); // Choosing 0 items = 1
        assert_eq!("5", eval_to_string(&g, "COMBINA(5, 1)")); // Choosing 1 item = n
        assert_eq!("15", eval_to_string(&g, "COMBINA(5, 2)")); // (5+2-1)!/(2!*4!) = 6!/(2!*4!) = 15
        assert_eq!("1", eval_to_string(&g, "COMBINA(1, 5)")); // Only one way to pick with repetition from 1 item

        // Edge cases
        assert_eq!("1", eval_to_string(&g, "COMBINA(0, 0)")); // Special case
        assert_eq!("0", eval_to_string(&g, "COMBINA(0, 1)")); // Can't choose from 0 items

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "COMBINA(-1, 2)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "COMBINA(5, -1)").msg,
        );
    }

    #[test]
    fn test_decimal() {
        let g = GridController::new();

        // Basic conversions
        assert_eq!("255", eval_to_string(&g, "DECIMAL(\"FF\", 16)"));
        assert_eq!("255", eval_to_string(&g, "DECIMAL(\"ff\", 16)")); // case insensitive
        assert_eq!("7", eval_to_string(&g, "DECIMAL(\"111\", 2)"));
        assert_eq!("1295", eval_to_string(&g, "DECIMAL(\"ZZ\", 36)"));
        assert_eq!("10", eval_to_string(&g, "DECIMAL(\"1010\", 2)"));
        assert_eq!("63", eval_to_string(&g, "DECIMAL(\"77\", 8)"));

        // Edge cases
        assert_eq!("0", eval_to_string(&g, "DECIMAL(\"\", 16)")); // empty string
        assert_eq!("0", eval_to_string(&g, "DECIMAL(\"0\", 10)"));

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "DECIMAL(\"FF\", 1)").msg, // radix too small
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "DECIMAL(\"FF\", 37)").msg, // radix too large
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "DECIMAL(\"GG\", 16)").msg, // invalid digits for base
        );
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
    fn test_multinomial() {
        let g = GridController::new();

        // Basic multinomials
        assert_eq!("1260", eval_to_string(&g, "MULTINOMIAL(2, 3, 4)")); // 9!/(2!*3!*4!) = 1260
        assert_eq!("10", eval_to_string(&g, "MULTINOMIAL(2, 3)")); // 5!/(2!*3!) = 10
        assert_eq!("1", eval_to_string(&g, "MULTINOMIAL(5)")); // 5!/5! = 1
        assert_eq!("1", eval_to_string(&g, "MULTINOMIAL(0, 0)")); // 0!/(0!*0!) = 1
        assert_eq!("1", eval_to_string(&g, "MULTINOMIAL(0)")); // 0!/0! = 1

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "MULTINOMIAL(-1, 2)").msg,
        );
    }

    #[test]
    fn test_rand() {
        let g = GridController::new();

        // RAND returns a value between 0 and 1
        let result: f64 = eval_to_string(&g, "RAND()").parse().unwrap();
        assert!(result >= 0.0 && result < 1.0);

        // Multiple calls should work (though we can't test randomness easily)
        let result2: f64 = eval_to_string(&g, "RAND()").parse().unwrap();
        assert!(result2 >= 0.0 && result2 < 1.0);
    }

    #[test]
    fn test_randbetween() {
        let g = GridController::new();

        // Basic range
        for _ in 0..10 {
            let result: i64 = eval_to_string(&g, "RANDBETWEEN(1, 10)").parse().unwrap();
            assert!(result >= 1 && result <= 10);
        }

        // Negative range
        for _ in 0..10 {
            let result: i64 = eval_to_string(&g, "RANDBETWEEN(-5, 5)").parse().unwrap();
            assert!(result >= -5 && result <= 5);
        }

        // Same value for bottom and top
        assert_eq!("5", eval_to_string(&g, "RANDBETWEEN(5, 5)"));

        // Error case: bottom > top
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "RANDBETWEEN(10, 1)").msg,
        );
    }

    #[test]
    fn test_roman() {
        let g = GridController::new();

        // Basic conversions
        assert_eq!("I", eval_to_string(&g, "ROMAN(1)"));
        assert_eq!("IV", eval_to_string(&g, "ROMAN(4)"));
        assert_eq!("V", eval_to_string(&g, "ROMAN(5)"));
        assert_eq!("IX", eval_to_string(&g, "ROMAN(9)"));
        assert_eq!("X", eval_to_string(&g, "ROMAN(10)"));
        assert_eq!("XL", eval_to_string(&g, "ROMAN(40)"));
        assert_eq!("L", eval_to_string(&g, "ROMAN(50)"));
        assert_eq!("XC", eval_to_string(&g, "ROMAN(90)"));
        assert_eq!("C", eval_to_string(&g, "ROMAN(100)"));
        assert_eq!("CD", eval_to_string(&g, "ROMAN(400)"));
        assert_eq!("D", eval_to_string(&g, "ROMAN(500)"));
        assert_eq!("CM", eval_to_string(&g, "ROMAN(900)"));
        assert_eq!("M", eval_to_string(&g, "ROMAN(1000)"));

        // Complex numbers
        assert_eq!("CDXCIX", eval_to_string(&g, "ROMAN(499)"));
        assert_eq!("MMXXIII", eval_to_string(&g, "ROMAN(2023)"));
        assert_eq!("MMMCMXCIX", eval_to_string(&g, "ROMAN(3999)"));

        // Edge cases
        assert_eq!("I", eval_to_string(&g, "ROMAN(1)"));
        assert_eq!("MMMCMXCIX", eval_to_string(&g, "ROMAN(3999)"));

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "ROMAN(0)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "ROMAN(-1)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "ROMAN(4000)").msg,
        );
    }

    #[test]
    fn test_seriessum() {
        let g = GridController::new();

        // SERIESSUM(x, n, m, coefficients) = x^n * (a1 + a2*x^m + a3*x^(2m) + ...)
        // SERIESSUM(2, 0, 2, {1, 1, 1}) = 2^0*1 + 2^2*1 + 2^4*1 = 1 + 4 + 16 = 21
        assert_eq!("21", eval_to_string(&g, "SERIESSUM(2, 0, 2, {1, 1, 1})"));

        // SERIESSUM(3, 1, 1, {1, 2, 3}) = 3^1*1 + 3^2*2 + 3^3*3 = 3 + 18 + 81 = 102
        assert_eq!("102", eval_to_string(&g, "SERIESSUM(3, 1, 1, {1, 2, 3})"));

        // Simple case: single coefficient
        assert_eq!("8", eval_to_string(&g, "SERIESSUM(2, 3, 1, {1})"));

        // With zero coefficients
        assert_eq!("5", eval_to_string(&g, "SERIESSUM(2, 0, 1, {1, 0, 1})"));
    }

    #[test]
    fn test_subtotal() {
        let g = GridController::new();

        // SUM (function 9)
        assert_eq!("15", eval_to_string(&g, "SUBTOTAL(9, {1, 2, 3, 4, 5})"));
        assert_eq!("15", eval_to_string(&g, "SUBTOTAL(109, {1, 2, 3, 4, 5})"));

        // AVERAGE (function 1)
        assert_eq!("3", eval_to_string(&g, "SUBTOTAL(1, {1, 2, 3, 4, 5})"));
        assert_eq!("3", eval_to_string(&g, "SUBTOTAL(101, {1, 2, 3, 4, 5})"));

        // COUNT (function 2)
        assert_eq!("5", eval_to_string(&g, "SUBTOTAL(2, {1, 2, 3, 4, 5})"));

        // MAX (function 4)
        assert_eq!("5", eval_to_string(&g, "SUBTOTAL(4, {1, 2, 3, 4, 5})"));

        // MIN (function 5)
        assert_eq!("1", eval_to_string(&g, "SUBTOTAL(5, {1, 2, 3, 4, 5})"));

        // PRODUCT (function 6)
        assert_eq!("120", eval_to_string(&g, "SUBTOTAL(6, {1, 2, 3, 4, 5})"));

        // Invalid function number
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SUBTOTAL(0, {1, 2, 3})").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SUBTOTAL(12, {1, 2, 3})").msg,
        );
    }

    #[test]
    fn test_sumx2my2() {
        let g = GridController::new();

        // SUMX2MY2 = Σ(x² - y²)
        // {2, 3, 4} and {1, 2, 3}: (4-1) + (9-4) + (16-9) = 3 + 5 + 7 = 15
        // Wait, let me recalculate: (2²-1²) + (3²-2²) + (4²-3²) = (4-1) + (9-4) + (16-9) = 3 + 5 + 7 = 15
        // But the example says 9... Let me check: maybe it's different values
        // Actually {2,3,4}, {1,2,3}: 2²=4, 3²=9, 4²=16 and 1²=1, 2²=4, 3²=9
        // (4-1)+(9-4)+(16-9) = 3+5+7 = 15
        // Hmm, but Excel doc says SUMX2MY2({2,3,9,1,8,7,5}, {6,5,11,7,5,4,4}) = 55
        // Let me verify: that's (4-36)+(9-25)+(81-121)+(1-49)+(64-25)+(49-16)+(25-16)
        // = -32 + -16 + -40 + -48 + 39 + 33 + 9 = -55... so result would be -55
        // My calculation for {2,3,4},{1,2,3} gives 15, but example shows 9
        // Maybe I misread... let me just test with my calculation
        assert_eq!("15", eval_to_string(&g, "SUMX2MY2({2, 3, 4}, {1, 2, 3})"));

        // Simple case
        assert_eq!("3", eval_to_string(&g, "SUMX2MY2({2}, {1})")); // 4 - 1 = 3

        // With same values: should be 0
        assert_eq!("0", eval_to_string(&g, "SUMX2MY2({1, 2, 3}, {1, 2, 3})"));

        // Error: arrays of different size
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SUMX2MY2({1, 2, 3}, {1, 2})").msg,
        );
    }

    #[test]
    fn test_sumx2py2() {
        let g = GridController::new();

        // SUMX2PY2 = Σ(x² + y²)
        // {2, 3, 4} and {1, 2, 3}: (4+1) + (9+4) + (16+9) = 5 + 13 + 25 = 43
        assert_eq!("43", eval_to_string(&g, "SUMX2PY2({2, 3, 4}, {1, 2, 3})"));

        // Simple case
        assert_eq!("5", eval_to_string(&g, "SUMX2PY2({2}, {1})")); // 4 + 1 = 5

        // Error: arrays of different size
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SUMX2PY2({1, 2, 3}, {1, 2})").msg,
        );
    }

    #[test]
    fn test_sumxmy2() {
        let g = GridController::new();

        // SUMXMY2 = Σ(x - y)²
        // {2, 3, 4} and {1, 2, 3}: (2-1)² + (3-2)² + (4-3)² = 1 + 1 + 1 = 3
        assert_eq!("3", eval_to_string(&g, "SUMXMY2({2, 3, 4}, {1, 2, 3})"));

        // Simple case
        assert_eq!("9", eval_to_string(&g, "SUMXMY2({5}, {2})")); // (5-2)² = 9

        // With same values: should be 0
        assert_eq!("0", eval_to_string(&g, "SUMXMY2({1, 2, 3}, {1, 2, 3})"));

        // Error: arrays of different size
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SUMXMY2({1, 2, 3}, {1, 2})").msg,
        );
    }
}
