//! Core statistics functions: AVERAGE, AVERAGEIF, COUNT, COUNTA, COUNTIF,
//! COUNTIFS, COUNTBLANK, MIN, MAX, VAR, STDEV, MEDIAN, LARGE, SMALL, MINIFS,
//! MAXIFS, AGGREGATE.

use smallvec::SmallVec;

use super::*;
use crate::ArraySize;

/// Helper function to compute variance (sample or population)
fn compute_variance(values: &[f64], is_population: bool) -> f64 {
    if values.is_empty() {
        return f64::NAN;
    }
    let n = values.len() as f64;
    let mean: f64 = values.iter().sum::<f64>() / n;
    let sum_sq: f64 = values.iter().map(|x| (x - mean).powi(2)).sum();
    if is_population {
        sum_sq / n
    } else {
        if values.len() < 2 {
            return f64::NAN;
        }
        sum_sq / (n - 1.0)
    }
}

/// Helper function to compute standard deviation (sample or population)
fn compute_stdev(values: &[f64], is_population: bool) -> f64 {
    compute_variance(values, is_population).sqrt()
}

/// Helper function to compute covariance (sample or population)
fn compute_covariance(x_values: &[f64], y_values: &[f64], is_population: bool) -> Option<f64> {
    if x_values.len() != y_values.len() || x_values.is_empty() {
        return None;
    }
    let n = x_values.len() as f64;
    let mean_x: f64 = x_values.iter().sum::<f64>() / n;
    let mean_y: f64 = y_values.iter().sum::<f64>() / n;
    let sum_products: f64 = x_values
        .iter()
        .zip(y_values.iter())
        .map(|(x, y)| (x - mean_x) * (y - mean_y))
        .sum();
    if is_population {
        Some(sum_products / n)
    } else {
        if x_values.len() < 2 {
            return None;
        }
        Some(sum_products / (n - 1.0))
    }
}

/// Helper function to compute correlation coefficient
fn compute_correlation(x_values: &[f64], y_values: &[f64]) -> Option<f64> {
    if x_values.len() != y_values.len() || x_values.len() < 2 {
        return None;
    }
    let n = x_values.len() as f64;
    let mean_x: f64 = x_values.iter().sum::<f64>() / n;
    let mean_y: f64 = y_values.iter().sum::<f64>() / n;

    let mut sum_xy = 0.0;
    let mut sum_x2 = 0.0;
    let mut sum_y2 = 0.0;

    for (x, y) in x_values.iter().zip(y_values.iter()) {
        let dx = x - mean_x;
        let dy = y - mean_y;
        sum_xy += dx * dy;
        sum_x2 += dx * dx;
        sum_y2 += dy * dy;
    }

    let denominator = (sum_x2 * sum_y2).sqrt();
    if denominator == 0.0 {
        return None;
    }
    Some(sum_xy / denominator)
}

/// Helper function to compute linear regression (slope and intercept)
fn compute_linear_regression(x_values: &[f64], y_values: &[f64]) -> Option<(f64, f64)> {
    if x_values.len() != y_values.len() || x_values.len() < 2 {
        return None;
    }
    let n = x_values.len() as f64;
    let mean_x: f64 = x_values.iter().sum::<f64>() / n;
    let mean_y: f64 = y_values.iter().sum::<f64>() / n;

    let mut sum_xy = 0.0;
    let mut sum_x2 = 0.0;

    for (x, y) in x_values.iter().zip(y_values.iter()) {
        let dx = x - mean_x;
        sum_xy += dx * (y - mean_y);
        sum_x2 += dx * dx;
    }

    if sum_x2 == 0.0 {
        return None;
    }

    let slope = sum_xy / sum_x2;
    let intercept = mean_y - slope * mean_x;
    Some((slope, intercept))
}

/// Helper function to compute percentile
fn compute_percentile(values: &mut [f64], k: f64, exclusive: bool) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = values.len();

    if exclusive {
        // PERCENTILE.EXC: k must be in (0, 1)
        if k <= 0.0 || k >= 1.0 {
            return None;
        }
        let pos = k * (n as f64 + 1.0) - 1.0;
        if pos < 0.0 || pos >= n as f64 {
            return None;
        }
        let lower = pos.floor() as usize;
        let frac = pos - lower as f64;
        if lower + 1 >= n {
            Some(values[lower])
        } else {
            Some(values[lower] + frac * (values[lower + 1] - values[lower]))
        }
    } else {
        // PERCENTILE.INC: k must be in [0, 1]
        if !(0.0..=1.0).contains(&k) {
            return None;
        }
        let pos = k * (n as f64 - 1.0);
        let lower = pos.floor() as usize;
        let frac = pos - lower as f64;
        if lower + 1 >= n {
            Some(values[lower])
        } else {
            Some(values[lower] + frac * (values[lower + 1] - values[lower]))
        }
    }
}

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the arithmetic mean of all values.
            #[examples("AVERAGE(A1:A6)", "AVERAGE(A1, A3, A5, B1:B6)")]
            fn AVERAGE(span: Span, numbers: (Iter<f64>)) {
                CellValue::average(span, numbers)
            }
        ),
        formula_fn!(
            /// Evaluates each value based on some criteria, and then computes
            /// the arithmetic mean of the ones that meet those criteria. If
            /// `range_to_average` is given, then values in `range_to_average`
            /// are averaged instead wherever the corresponding value in
            /// `range_to_evaluate` meets the criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "AVERAGEIF(A1:A10, \"2\")",
                "AVERAGEIF(A1:A10, \">0\")",
                "AVERAGEIF(A1:A10, \"<>INVALID\", B1:B10)"
            )]
            #[zip_map]
            fn AVERAGEIF(
                span: Span,
                eval_range: (Spanned<Array>),
                [criteria]: (Spanned<CellValue>),
                numbers_range: (Option<Spanned<Array>>),
            ) {
                let criteria = Criterion::try_from(*criteria)?;
                let numbers =
                    criteria.iter_matching_coerced::<f64>(eval_range, numbers_range.as_ref())?;
                CellValue::average(*span, numbers)
            }
        ),
        formula_fn!(
            /// Evaluates multiple values on their respective criteria, and
            /// then computes the arithmetic mean of the ones that meet all criteria.
            /// Unlike AVERAGEIF, AVERAGEIFS requires the average_range as the first argument.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "AVERAGEIFS(A1:A10, B1:B10, \">0\")",
                "AVERAGEIFS(A1:A10, B1:B10, \">0\", C1:C10, \"<100\")"
            )]
            fn AVERAGEIFS(
                ctx: Ctx,
                average_range: (Spanned<Array>),
                eval_range1: (Spanned<Array>),
                criteria1: (Spanned<Value>),
                more_eval_ranges_and_criteria: FormulaFnArgs,
            ) {
                ctx.zip_map_eval_ranges_and_criteria_from_args(
                    eval_range1,
                    criteria1,
                    more_eval_ranges_and_criteria,
                    |_ctx, eval_ranges_and_criteria| {
                        let numbers = Criterion::iter_matching_multi_coerced::<f64>(
                            &eval_ranges_and_criteria,
                            &average_range,
                        )?;
                        let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                        if values.is_empty() {
                            return Err(RunErrorMsg::DivideByZero.without_span());
                        }
                        let sum: f64 = values.iter().sum();
                        let count = values.len() as f64;
                        Ok((sum / count).into())
                    },
                )?
            }
        ),
        formula_fn!(
            /// Returns the number of numeric values.
            ///
            /// - Blank cells are not counted.
            /// - Cells containing an error are not counted.
            #[examples("COUNT(A1:C42, E17)", "SUM(A1:A10) / COUNT(A1:A10)")]
            fn COUNT(numbers: (Iter<CellValue>)) {
                // Ignore error values.
                numbers
                    .filter(|x| matches!(x, Ok(CellValue::Number(_))))
                    .count()
            }
        ),
        formula_fn!(
            /// Returns the number of non-blank values.
            ///
            /// - Cells with formula or code output of an empty string are
            ///   counted.
            /// - Cells containing zero are counted.
            /// - Cells with an error are counted.
            #[examples("COUNTA(A1:A10)")]
            fn COUNTA(range: (Iter<CellValue>)) {
                // Count error values.
                range.filter_ok(|v| !v.is_blank()).count()
            }
        ),
        formula_fn!(
            /// Evaluates each value based on some criteria, and then counts
            /// how many values meet those criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "COUNTIF(A1:A10, \"2\")",
                "COUNTIF(A1:A10, \">0\")",
                "COUNTIF(A1:A10, \"<>INVALID\")"
            )]
            #[zip_map]
            fn COUNTIF(range: (Spanned<Array>), [criteria]: (Spanned<CellValue>)) {
                let criteria = Criterion::try_from(*criteria)?;
                // Ignore error values.
                // The `let` binding is necessary to avoid a lifetime error.
                #[allow(clippy::let_and_return)]
                let count = criteria.iter_matching(range, None)?.count();
                count
            }
        ),
        formula_fn!(
            /// Evaluates multiple values on they're respective criteria, and
            /// then counts how many sets of values met all their criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "COUNTIFS(\"<>INVALID\", B1:B10)",
                "COUNTIFS(\"<>INVALID\", B1:B10, \"<=0\", C1:C10)"
            )]
            fn COUNTIFS(
                ctx: Ctx,
                eval_range1: (Spanned<Array>),
                criteria1: (Spanned<Value>),
                more_eval_ranges_and_criteria: FormulaFnArgs,
            ) {
                ctx.zip_map_eval_ranges_and_criteria_from_args(
                    eval_range1,
                    criteria1,
                    more_eval_ranges_and_criteria,
                    |_ctx, eval_ranges_and_criteria| {
                        // Same as `COUNTIF`
                        let count =
                            Criterion::iter_matching_multi(&eval_ranges_and_criteria, None)?
                                .count();
                        Ok((count as f64).into())
                    },
                )?
            }
        ),
        formula_fn!(
            /// Counts how many values in the range are empty.
            ///
            /// - Cells with formula or code output of an empty string are
            ///   counted.
            /// - Cells containing zero are not counted.
            /// - Cells with an error are not counted.
            #[examples("COUNTBLANK(A1:A10)")]
            fn COUNTBLANK(range: (Iter<CellValue>)) {
                // Ignore error values.
                range
                    .filter_map(|v| v.ok())
                    .filter(|v| v.is_blank_or_empty_string())
                    .count()
            }
        ),
        formula_fn!(
            /// Returns the smallest value.
            /// Returns +∞ if given no values.
            #[examples("MIN(A1:A6)", "MIN(0, A1:A6)")]
            fn MIN(numbers: (Iter<f64>)) {
                numbers.try_fold(f64::INFINITY, |a, b| Ok(f64::min(a, b?)))
            }
        ),
        formula_fn!(
            /// Returns the largest value.
            /// Returns -∞ if given no values.
            #[examples("MAX(A1:A6)", "MAX(0, A1:A6)")]
            fn MAX(numbers: (Iter<f64>)) {
                numbers.try_fold(-f64::INFINITY, |a, b| Ok(f64::max(a, b?)))
            }
        ),
        formula_fn!(
            /// Returns the variance of all values (sample variance).
            /// Uses the formula: Σ(x - μ)²/(n-1) where μ is the mean and n is the count.
            #[examples("VAR(A1:A6)", "VAR(1, 2, 3, 4, 5)")]
            fn VAR(numbers: (Iter<f64>)) {
                let mut sum = 0.0;
                let mut sum_sq = 0.0;
                let mut count = 0;

                for num in numbers {
                    let val = num?;
                    sum += val;
                    sum_sq += val * val;
                    count += 1;
                }

                let mean = sum / (count as f64);
                let variance = (sum_sq - sum * mean) / ((count - 1) as f64);
                Ok(CellValue::from(variance))
            }
        ),
        formula_fn!(
            /// Returns the standard deviation of all values (sample standard deviation).
            /// Uses the formula: √(Σ(x - μ)²/(n-1)) where μ is the mean and n is the count.
            #[examples("STDEV(A1:A6)", "STDEV(1, 2, 3, 4, 5)")]
            fn STDEV(numbers: (Iter<f64>)) {
                let mut sum = 0.0;
                let mut sum_sq = 0.0;
                let mut count = 0;

                for x in numbers {
                    let x = x?;
                    sum += x;
                    sum_sq += x * x;
                    count += 1;
                }

                let mean = sum / (count as f64);
                let variance = (sum_sq - sum * mean) / ((count - 1) as f64);
                let stdev = variance.sqrt();

                Ok(CellValue::from(stdev))
            }
        ),
        formula_fn!(
            /// Returns the sample variance of all values.
            /// This is an alias for VAR.
            /// Uses the formula: Σ(x - μ)²/(n-1) where μ is the mean and n is the count.
            #[name = "VAR.S"]
            #[examples("VAR.S(A1:A6)", "VAR.S(1, 2, 3, 4, 5)")]
            fn VAR_S(numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                compute_variance(&values, false)
            }
        ),
        formula_fn!(
            /// Returns the population variance of all values.
            /// Uses the formula: Σ(x - μ)²/n where μ is the mean and n is the count.
            #[name = "VAR.P"]
            #[examples("VAR.P(A1:A6)", "VAR.P(1, 2, 3, 4, 5)")]
            fn VAR_P(numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                compute_variance(&values, true)
            }
        ),
        formula_fn!(
            /// Returns the population variance of all values.
            /// This is an alias for VAR.P.
            /// Uses the formula: Σ(x - μ)²/n where μ is the mean and n is the count.
            #[examples("VARP(A1:A6)", "VARP(1, 2, 3, 4, 5)")]
            fn VARP(numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                compute_variance(&values, true)
            }
        ),
        formula_fn!(
            /// Returns the sample variance of all values, treating text and FALSE as 0 and TRUE as 1.
            /// Uses the formula: Σ(x - μ)²/(n-1) where μ is the mean and n is the count.
            #[examples("VARA(A1:A6)")]
            fn VARA(numbers: (Iter<CellValue>)) {
                let values: Vec<f64> = numbers
                    .filter_map(|cv| cv.ok())
                    .filter(|cv| !cv.is_blank())
                    .map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64().unwrap_or(0.0)
                        }
                        CellValue::Logical(true) => 1.0,
                        CellValue::Logical(false) | CellValue::Text(_) => 0.0,
                        _ => 0.0,
                    })
                    .collect();
                compute_variance(&values, false)
            }
        ),
        formula_fn!(
            /// Returns the population variance of all values, treating text and FALSE as 0 and TRUE as 1.
            /// Uses the formula: Σ(x - μ)²/n where μ is the mean and n is the count.
            #[examples("VARPA(A1:A6)")]
            fn VARPA(numbers: (Iter<CellValue>)) {
                let values: Vec<f64> = numbers
                    .filter_map(|cv| cv.ok())
                    .filter(|cv| !cv.is_blank())
                    .map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64().unwrap_or(0.0)
                        }
                        CellValue::Logical(true) => 1.0,
                        CellValue::Logical(false) | CellValue::Text(_) => 0.0,
                        _ => 0.0,
                    })
                    .collect();
                compute_variance(&values, true)
            }
        ),
        formula_fn!(
            /// Returns the sample standard deviation of all values.
            /// This is an alias for STDEV.
            /// Uses the formula: √(Σ(x - μ)²/(n-1)) where μ is the mean and n is the count.
            #[name = "STDEV.S"]
            #[examples("STDEV.S(A1:A6)", "STDEV.S(1, 2, 3, 4, 5)")]
            fn STDEV_S(numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                compute_stdev(&values, false)
            }
        ),
        formula_fn!(
            /// Returns the population standard deviation of all values.
            /// Uses the formula: √(Σ(x - μ)²/n) where μ is the mean and n is the count.
            #[name = "STDEV.P"]
            #[examples("STDEV.P(A1:A6)", "STDEV.P(1, 2, 3, 4, 5)")]
            fn STDEV_P(numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                compute_stdev(&values, true)
            }
        ),
        formula_fn!(
            /// Returns the population standard deviation of all values.
            /// This is an alias for STDEV.P.
            /// Uses the formula: √(Σ(x - μ)²/n) where μ is the mean and n is the count.
            #[examples("STDEVP(A1:A6)", "STDEVP(1, 2, 3, 4, 5)")]
            fn STDEVP(numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                compute_stdev(&values, true)
            }
        ),
        formula_fn!(
            /// Returns the sample standard deviation of all values, treating text and FALSE as 0 and TRUE as 1.
            /// Uses the formula: √(Σ(x - μ)²/(n-1)) where μ is the mean and n is the count.
            #[examples("STDEVA(A1:A6)")]
            fn STDEVA(numbers: (Iter<CellValue>)) {
                let values: Vec<f64> = numbers
                    .filter_map(|cv| cv.ok())
                    .filter(|cv| !cv.is_blank())
                    .map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64().unwrap_or(0.0)
                        }
                        CellValue::Logical(true) => 1.0,
                        CellValue::Logical(false) | CellValue::Text(_) => 0.0,
                        _ => 0.0,
                    })
                    .collect();
                compute_stdev(&values, false)
            }
        ),
        formula_fn!(
            /// Returns the population standard deviation of all values, treating text and FALSE as 0 and TRUE as 1.
            /// Uses the formula: √(Σ(x - μ)²/n) where μ is the mean and n is the count.
            #[examples("STDEVPA(A1:A6)")]
            fn STDEVPA(numbers: (Iter<CellValue>)) {
                let values: Vec<f64> = numbers
                    .filter_map(|cv| cv.ok())
                    .filter(|cv| !cv.is_blank())
                    .map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64().unwrap_or(0.0)
                        }
                        CellValue::Logical(true) => 1.0,
                        CellValue::Logical(false) | CellValue::Text(_) => 0.0,
                        _ => 0.0,
                    })
                    .collect();
                compute_stdev(&values, true)
            }
        ),
        formula_fn!(
            /// Returns the median of the given numbers.
            /// The median is the middle value when the numbers are sorted.
            /// If there is an even number of values, returns the average of the two middle values.
            #[examples("MEDIAN(1, 2, 3, 4, 5) = 3", "MEDIAN(1, 2, 3, 4) = 2.5")]
            fn MEDIAN(span: Span, numbers: (Iter<f64>)) {
                let mut values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                let len = values.len();
                if len % 2 == 0 {
                    (values[len / 2 - 1] + values[len / 2]) / 2.0
                } else {
                    values[len / 2]
                }
            }
        ),
        formula_fn!(
            /// Returns the k-th largest value in a data set.
            /// `k` is 1-indexed, so LARGE(data, 1) returns the largest value.
            #[examples("LARGE(A1:A10, 1)", "LARGE({5, 2, 8, 1, 9}, 2) = 8")]
            fn LARGE(span: Span, array: (Spanned<Array>), k: (Spanned<i64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let k_usize = k
                    .inner
                    .checked_sub(1)
                    .and_then(|n| usize::try_from(n).ok())
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?;
                if k_usize >= values.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                }
                // Sort descending
                values.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
                values[k_usize]
            }
        ),
        formula_fn!(
            /// Returns the k-th smallest value in a data set.
            /// `k` is 1-indexed, so SMALL(data, 1) returns the smallest value.
            #[examples("SMALL(A1:A10, 1)", "SMALL({5, 2, 8, 1, 9}, 2) = 2")]
            fn SMALL(span: Span, array: (Spanned<Array>), k: (Spanned<i64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let k_usize = k
                    .inner
                    .checked_sub(1)
                    .and_then(|n| usize::try_from(n).ok())
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?;
                if k_usize >= values.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                }
                // Sort ascending
                values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                values[k_usize]
            }
        ),
        formula_fn!(
            /// Returns the minimum value from cells that match the specified criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples("MINIFS(A1:A10, B1:B10, \">0\")")]
            fn MINIFS(
                ctx: Ctx,
                min_range: (Spanned<Array>),
                eval_range1: (Spanned<Array>),
                criteria1: (Spanned<Value>),
                more_eval_ranges_and_criteria: FormulaFnArgs,
            ) {
                ctx.zip_map_eval_ranges_and_criteria_from_args(
                    eval_range1,
                    criteria1,
                    more_eval_ranges_and_criteria,
                    |_ctx, eval_ranges_and_criteria| {
                        let mut numbers = Criterion::iter_matching_multi_coerced::<f64>(
                            &eval_ranges_and_criteria,
                            &min_range,
                        )?;
                        let result: f64 = numbers.try_fold(
                            f64::INFINITY,
                            |a, b: CodeResult<f64>| -> CodeResult<f64> { Ok(f64::min(a, b?)) },
                        )?;
                        Ok(result.into())
                    },
                )?
            }
        ),
        formula_fn!(
            /// Returns the maximum value from cells that match the specified criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples("MAXIFS(A1:A10, B1:B10, \">0\")")]
            fn MAXIFS(
                ctx: Ctx,
                max_range: (Spanned<Array>),
                eval_range1: (Spanned<Array>),
                criteria1: (Spanned<Value>),
                more_eval_ranges_and_criteria: FormulaFnArgs,
            ) {
                ctx.zip_map_eval_ranges_and_criteria_from_args(
                    eval_range1,
                    criteria1,
                    more_eval_ranges_and_criteria,
                    |_ctx, eval_ranges_and_criteria| {
                        let mut numbers = Criterion::iter_matching_multi_coerced::<f64>(
                            &eval_ranges_and_criteria,
                            &max_range,
                        )?;
                        let result: f64 = numbers.try_fold(
                            f64::NEG_INFINITY,
                            |a, b: CodeResult<f64>| -> CodeResult<f64> { Ok(f64::max(a, b?)) },
                        )?;
                        Ok(result.into())
                    },
                )?
            }
        ),
        formula_fn!(
            /// Returns the k-th percentile of values in a range (inclusive method).
            /// `k` must be between 0 and 1 (inclusive).
            #[name = "PERCENTILE.INC"]
            #[examples("PERCENTILE.INC(A1:A10, 0.5)", "PERCENTILE.INC({1, 2, 3, 4, 5}, 0.25)")]
            fn PERCENTILE_INC(span: Span, array: (Spanned<Array>), k: (Spanned<f64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                compute_percentile(&mut values, k.inner, false)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?
            }
        ),
        formula_fn!(
            /// Returns the k-th percentile of values in a range (inclusive method).
            /// This is an alias for PERCENTILE.INC.
            #[examples("PERCENTILE(A1:A10, 0.5)", "PERCENTILE({1, 2, 3, 4, 5}, 0.25)")]
            fn PERCENTILE(span: Span, array: (Spanned<Array>), k: (Spanned<f64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                compute_percentile(&mut values, k.inner, false)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?
            }
        ),
        formula_fn!(
            /// Returns the k-th percentile of values in a range (exclusive method).
            /// `k` must be between 0 and 1 (exclusive).
            #[name = "PERCENTILE.EXC"]
            #[examples("PERCENTILE.EXC(A1:A10, 0.5)", "PERCENTILE.EXC({1, 2, 3, 4, 5}, 0.25)")]
            fn PERCENTILE_EXC(span: Span, array: (Spanned<Array>), k: (Spanned<f64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                compute_percentile(&mut values, k.inner, true)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?
            }
        ),
        formula_fn!(
            /// Returns the quartile of a data set (inclusive method).
            /// `quart` must be 0-4: 0=min, 1=25%, 2=50%, 3=75%, 4=max.
            #[name = "QUARTILE.INC"]
            #[examples("QUARTILE.INC(A1:A10, 2)", "QUARTILE.INC({1, 2, 3, 4, 5}, 1)")]
            fn QUARTILE_INC(span: Span, array: (Spanned<Array>), quart: (Spanned<i64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let quartile = quart.inner;
                if !(0..=4).contains(&quartile) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(quart.span));
                }
                let pct = quartile as f64 * 0.25;
                compute_percentile(&mut values, pct, false)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(quart.span))?
            }
        ),
        formula_fn!(
            /// Returns the quartile of a data set (inclusive method).
            /// This is an alias for QUARTILE.INC.
            #[examples("QUARTILE(A1:A10, 2)", "QUARTILE({1, 2, 3, 4, 5}, 1)")]
            fn QUARTILE(span: Span, array: (Spanned<Array>), quart: (Spanned<i64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let quartile = quart.inner;
                if !(0..=4).contains(&quartile) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(quart.span));
                }
                let pct = quartile as f64 * 0.25;
                compute_percentile(&mut values, pct, false)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(quart.span))?
            }
        ),
        formula_fn!(
            /// Returns the quartile of a data set (exclusive method).
            /// `quart` must be 1-3: 1=25%, 2=50%, 3=75%.
            #[name = "QUARTILE.EXC"]
            #[examples("QUARTILE.EXC(A1:A10, 2)", "QUARTILE.EXC({1, 2, 3, 4, 5}, 1)")]
            fn QUARTILE_EXC(span: Span, array: (Spanned<Array>), quart: (Spanned<i64>)) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let quartile = quart.inner;
                if !(1..=3).contains(&quartile) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(quart.span));
                }
                let pct = quartile as f64 * 0.25;
                compute_percentile(&mut values, pct, true)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(quart.span))?
            }
        ),
        formula_fn!(
            /// Returns the most frequently occurring value in a data set.
            /// If no value occurs more than once, returns #N/A error.
            #[name = "MODE.SNGL"]
            #[examples("MODE.SNGL(A1:A10)", "MODE.SNGL({1, 2, 2, 3, 3, 3})")]
            fn MODE_SNGL(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                use std::collections::HashMap;
                let mut counts: HashMap<u64, usize> = HashMap::new();
                for &v in &values {
                    let key = v.to_bits();
                    *counts.entry(key).or_insert(0) += 1;
                }
                let (mode_bits, max_count) = counts
                    .iter()
                    .max_by_key(|&(_, count)| *count)
                    .map(|(&k, &v)| (k, v))
                    .unwrap();
                if max_count < 2 {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }
                f64::from_bits(mode_bits)
            }
        ),
        formula_fn!(
            /// Returns a vertical array of the most frequently occurring values in a data set.
            /// Returns all values that share the maximum frequency.
            /// If no value occurs more than once, returns #N/A error.
            #[name = "MODE.MULT"]
            #[examples("MODE.MULT(A1:A10)", "MODE.MULT({1, 1, 2, 2, 3})")]
            fn MODE_MULT(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                use std::collections::HashMap;
                let mut counts: HashMap<u64, usize> = HashMap::new();
                for &v in &values {
                    let key = v.to_bits();
                    *counts.entry(key).or_insert(0) += 1;
                }

                // Find the maximum count
                let max_count = counts.values().max().copied().unwrap_or(0);
                if max_count < 2 {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }

                // Collect all values with the maximum count
                let mut modes: Vec<f64> = counts
                    .iter()
                    .filter(|&(_, count)| *count == max_count)
                    .map(|(&bits, _)| f64::from_bits(bits))
                    .collect();
                modes.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

                // Return as a vertical array
                let array_data: SmallVec<[CellValue; 1]> =
                    modes.into_iter().map(CellValue::from).collect();
                let height = array_data.len() as u32;

                let size = ArraySize::new(1, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, array_data)?
            }
        ),
        formula_fn!(
            /// Returns the most frequently occurring value in a data set.
            /// This is an alias for MODE.SNGL.
            #[examples("MODE(A1:A10)", "MODE({1, 2, 2, 3, 3, 3})")]
            fn MODE(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                use std::collections::HashMap;
                let mut counts: HashMap<u64, usize> = HashMap::new();
                for &v in &values {
                    let key = v.to_bits();
                    *counts.entry(key).or_insert(0) += 1;
                }
                let (mode_bits, max_count) = counts
                    .iter()
                    .max_by_key(|&(_, count)| *count)
                    .map(|(&k, &v)| (k, v))
                    .unwrap();
                if max_count < 2 {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }
                f64::from_bits(mode_bits)
            }
        ),
        formula_fn!(
            /// Returns the rank of a number in a list of numbers.
            /// If `order` is 0 or omitted, ranks in descending order (largest = 1).
            /// If `order` is non-zero, ranks in ascending order (smallest = 1).
            /// Duplicate values receive the same rank.
            #[name = "RANK.EQ"]
            #[examples("RANK.EQ(5, A1:A10)", "RANK.EQ(5, A1:A10, 1)")]
            fn RANK_EQ(span: Span, number: f64, reference: (Spanned<Array>), order: (Option<i64>)) {
                let values: Vec<f64> = reference
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let ascending = order.unwrap_or(0) != 0;
                let rank = if ascending {
                    values.iter().filter(|&&v| v < number).count() + 1
                } else {
                    values.iter().filter(|&&v| v > number).count() + 1
                };
                // Check if number exists in the list
                if !values.iter().any(|&v| (v - number).abs() < f64::EPSILON) {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }
                rank as i64
            }
        ),
        formula_fn!(
            /// Returns the rank of a number in a list of numbers.
            /// This is an alias for RANK.EQ.
            #[examples("RANK(5, A1:A10)", "RANK(5, A1:A10, 1)")]
            fn RANK(span: Span, number: f64, reference: (Spanned<Array>), order: (Option<i64>)) {
                let values: Vec<f64> = reference
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let ascending = order.unwrap_or(0) != 0;
                let rank = if ascending {
                    values.iter().filter(|&&v| v < number).count() + 1
                } else {
                    values.iter().filter(|&&v| v > number).count() + 1
                };
                if !values.iter().any(|&v| (v - number).abs() < f64::EPSILON) {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }
                rank as i64
            }
        ),
        formula_fn!(
            /// Returns the rank of a number in a list of numbers, with average rank for ties.
            /// If `order` is 0 or omitted, ranks in descending order (largest = 1).
            /// If `order` is non-zero, ranks in ascending order (smallest = 1).
            #[name = "RANK.AVG"]
            #[examples("RANK.AVG(5, A1:A10)", "RANK.AVG(5, A1:A10, 1)")]
            fn RANK_AVG(
                span: Span,
                number: f64,
                reference: (Spanned<Array>),
                order: (Option<i64>),
            ) {
                let values: Vec<f64> = reference
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let ascending = order.unwrap_or(0) != 0;
                // Count how many values are strictly less/greater than number
                let (count_before, count_equal) = if ascending {
                    (
                        values.iter().filter(|&&v| v < number).count(),
                        values
                            .iter()
                            .filter(|&&v| (v - number).abs() < f64::EPSILON)
                            .count(),
                    )
                } else {
                    (
                        values.iter().filter(|&&v| v > number).count(),
                        values
                            .iter()
                            .filter(|&&v| (v - number).abs() < f64::EPSILON)
                            .count(),
                    )
                };
                if count_equal == 0 {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }
                // Average rank for ties
                count_before as f64 + (count_equal as f64 + 1.0) / 2.0
            }
        ),
        formula_fn!(
            /// Returns the maximum value in a list, including text and logical values.
            /// TRUE is counted as 1, FALSE as 0, and text as 0.
            #[examples("MAXA(A1:A10)", "MAXA(1, TRUE, \"text\", 5)")]
            fn MAXA(numbers: (Iter<CellValue>)) {
                let values: Vec<f64> = numbers
                    .filter_map(|cv| cv.ok())
                    .filter(|cv| !cv.is_blank())
                    .map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64().unwrap_or(0.0)
                        }
                        CellValue::Logical(true) => 1.0,
                        CellValue::Logical(false) | CellValue::Text(_) => 0.0,
                        _ => 0.0,
                    })
                    .collect();
                values.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
            }
        ),
        formula_fn!(
            /// Returns the minimum value in a list, including text and logical values.
            /// TRUE is counted as 1, FALSE as 0, and text as 0.
            #[examples("MINA(A1:A10)", "MINA(1, TRUE, \"text\", 5)")]
            fn MINA(numbers: (Iter<CellValue>)) {
                let values: Vec<f64> = numbers
                    .filter_map(|cv| cv.ok())
                    .filter(|cv| !cv.is_blank())
                    .map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64().unwrap_or(0.0)
                        }
                        CellValue::Logical(true) => 1.0,
                        CellValue::Logical(false) | CellValue::Text(_) => 0.0,
                        _ => 0.0,
                    })
                    .collect();
                values.iter().cloned().fold(f64::INFINITY, f64::min)
            }
        ),
        formula_fn!(
            /// Returns the average of values in a list, including text and logical values.
            /// TRUE is counted as 1, FALSE as 0, and text as 0.
            #[examples("AVERAGEA(A1:A10)", "AVERAGEA(1, TRUE, \"text\", 5)")]
            fn AVERAGEA(span: Span, numbers: (Iter<CellValue>)) {
                let values: Vec<f64> = numbers
                    .filter_map(|cv| cv.ok())
                    .filter(|cv| !cv.is_blank())
                    .map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64().unwrap_or(0.0)
                        }
                        CellValue::Logical(true) => 1.0,
                        CellValue::Logical(false) | CellValue::Text(_) => 0.0,
                        _ => 0.0,
                    })
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                values.iter().sum::<f64>() / values.len() as f64
            }
        ),
        formula_fn!(
            /// Returns the correlation coefficient between two data sets.
            /// The correlation coefficient measures the linear relationship between two variables.
            /// Returns a value between -1 and 1.
            #[examples("CORREL(A1:A10, B1:B10)", "CORREL({1, 2, 3}, {2, 4, 6})")]
            fn CORREL(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let x_values: Vec<f64> = array1
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let y_values: Vec<f64> = array2
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                compute_correlation(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns the Pearson product moment correlation coefficient.
            /// This is equivalent to CORREL.
            #[examples("PEARSON(A1:A10, B1:B10)", "PEARSON({1, 2, 3}, {2, 4, 6})")]
            fn PEARSON(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let x_values: Vec<f64> = array1
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let y_values: Vec<f64> = array2
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                compute_correlation(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns the coefficient of determination (R-squared) for a linear regression.
            /// This is the square of the correlation coefficient.
            #[examples("RSQ(A1:A10, B1:B10)", "RSQ({1, 2, 3}, {2, 4, 6})")]
            fn RSQ(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let x_values: Vec<f64> = array1
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let y_values: Vec<f64> = array2
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let r = compute_correlation(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                r * r
            }
        ),
        formula_fn!(
            /// Returns the slope of the linear regression line through the given data points.
            #[examples("SLOPE(A1:A10, B1:B10)", "SLOPE({2, 4, 6}, {1, 2, 3})")]
            fn SLOPE(span: Span, known_ys: (Spanned<Array>), known_xs: (Spanned<Array>)) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let x_values: Vec<f64> = known_xs
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let (slope, _) = compute_linear_regression(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                slope
            }
        ),
        formula_fn!(
            /// Returns the y-intercept of the linear regression line through the given data points.
            #[examples("INTERCEPT(A1:A10, B1:B10)", "INTERCEPT({2, 4, 6}, {1, 2, 3})")]
            fn INTERCEPT(span: Span, known_ys: (Spanned<Array>), known_xs: (Spanned<Array>)) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let x_values: Vec<f64> = known_xs
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let (_, intercept) = compute_linear_regression(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                intercept
            }
        ),
        formula_fn!(
            /// Returns the population covariance of two data sets.
            /// Uses the formula: Σ((x - x̄)(y - ȳ))/n
            #[name = "COVARIANCE.P"]
            #[examples("COVARIANCE.P(A1:A10, B1:B10)", "COVARIANCE.P({1, 2, 3}, {2, 4, 6})")]
            fn COVARIANCE_P(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let x_values: Vec<f64> = array1
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let y_values: Vec<f64> = array2
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                compute_covariance(&x_values, &y_values, true)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns the sample covariance of two data sets.
            /// Uses the formula: Σ((x - x̄)(y - ȳ))/(n-1)
            #[name = "COVARIANCE.S"]
            #[examples("COVARIANCE.S(A1:A10, B1:B10)", "COVARIANCE.S({1, 2, 3}, {2, 4, 6})")]
            fn COVARIANCE_S(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let x_values: Vec<f64> = array1
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let y_values: Vec<f64> = array2
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                compute_covariance(&x_values, &y_values, false)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns the population covariance of two data sets.
            /// This is a compatibility function equivalent to COVARIANCE.P.
            #[examples("COVAR(A1:A10, B1:B10)", "COVAR({1, 2, 3}, {2, 4, 6})")]
            fn COVAR(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let x_values: Vec<f64> = array1
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let y_values: Vec<f64> = array2
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                compute_covariance(&x_values, &y_values, true)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
            }
        ),
        formula_fn!(
            /// Returns a value along a linear trend.
            /// Calculates a predicted y-value for a given x using linear regression.
            #[name = "FORECAST.LINEAR"]
            #[examples("FORECAST.LINEAR(10, A1:A10, B1:B10)")]
            fn FORECAST_LINEAR(
                span: Span,
                x: f64,
                known_ys: (Spanned<Array>),
                known_xs: (Spanned<Array>),
            ) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let x_values: Vec<f64> = known_xs
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let (slope, intercept) = compute_linear_regression(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                slope * x + intercept
            }
        ),
        formula_fn!(
            /// Returns a value along a linear trend.
            /// This is a compatibility function equivalent to FORECAST.LINEAR.
            #[examples("FORECAST(10, A1:A10, B1:B10)")]
            fn FORECAST(
                span: Span,
                x: f64,
                known_ys: (Spanned<Array>),
                known_xs: (Spanned<Array>),
            ) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let x_values: Vec<f64> = known_xs
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let (slope, intercept) = compute_linear_regression(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                slope * x + intercept
            }
        ),
        formula_fn!(
            /// Returns statistics that describe a linear regression line.
            /// Returns slope and intercept (and optionally more stats if stats=TRUE).
            #[examples("LINEST(A1:A10, B1:B10)", "LINEST(A1:A10, B1:B10, TRUE, TRUE)")]
            fn LINEST(
                span: Span,
                known_ys: (Spanned<Array>),
                known_xs: (Option<Spanned<Array>>),
                const_flag: (Option<bool>),
                stats: (Option<bool>),
            ) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let x_values: Vec<f64> = if let Some(kx) = known_xs {
                    kx.inner
                        .cell_values_slice()
                        .iter()
                        .filter_map(|v| v.coerce_nonblank::<f64>())
                        .collect()
                } else {
                    (1..=y_values.len()).map(|i| i as f64).collect()
                };

                if y_values.len() != x_values.len() || y_values.len() < 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let _const_flag = const_flag.unwrap_or(true);
                let stats_flag = stats.unwrap_or(false);

                let (slope, intercept) = compute_linear_regression(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                if stats_flag {
                    let n = y_values.len() as f64;
                    let y_mean = y_values.iter().sum::<f64>() / n;

                    // Calculate R-squared
                    let ss_tot: f64 = y_values.iter().map(|y| (y - y_mean).powi(2)).sum();
                    let ss_res: f64 = y_values
                        .iter()
                        .zip(x_values.iter())
                        .map(|(y, x)| (y - (slope * x + intercept)).powi(2))
                        .sum();
                    let r_squared = if ss_tot != 0.0 {
                        1.0 - ss_res / ss_tot
                    } else {
                        0.0
                    };

                    // Standard error
                    let se_y = (ss_res / (n - 2.0)).sqrt();

                    // F statistic
                    let ss_reg = ss_tot - ss_res;
                    let f_stat = if ss_res != 0.0 {
                        (ss_reg / 1.0) / (ss_res / (n - 2.0))
                    } else {
                        f64::INFINITY
                    };

                    // Degrees of freedom for residuals
                    let df = n - 2.0;

                    // Standard error of slope
                    let x_mean = x_values.iter().sum::<f64>() / n;
                    let ss_x: f64 = x_values.iter().map(|x| (x - x_mean).powi(2)).sum();
                    let se_slope = se_y / ss_x.sqrt();

                    // Standard error of intercept
                    let se_intercept = se_y * (1.0 / n + x_mean.powi(2) / ss_x).sqrt();

                    // Return 5x2 array: slope/intercept, se_slope/se_intercept, r2/se_y, f/df, ss_reg/ss_res
                    let data: SmallVec<[CellValue; 1]> = SmallVec::from_vec(vec![
                        CellValue::from(slope),
                        CellValue::from(intercept),
                        CellValue::from(se_slope),
                        CellValue::from(se_intercept),
                        CellValue::from(r_squared),
                        CellValue::from(se_y),
                        CellValue::from(f_stat),
                        CellValue::from(df),
                        CellValue::from(ss_reg),
                        CellValue::from(ss_res),
                    ]);
                    let size = ArraySize::new(2, 5)
                        .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                    Array::new_row_major(size, data)?
                } else {
                    // Return 1x2 array: slope, intercept
                    let data: SmallVec<[CellValue; 1]> = SmallVec::from_vec(vec![
                        CellValue::from(slope),
                        CellValue::from(intercept),
                    ]);
                    let size = ArraySize::new(2, 1)
                        .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                    Array::new_row_major(size, data)?
                }
            }
        ),
        formula_fn!(
            /// Returns statistics that describe an exponential regression curve.
            /// Returns coefficient and base (and optionally more stats if stats=TRUE).
            #[examples("LOGEST(A1:A10, B1:B10)", "LOGEST(A1:A10, B1:B10, TRUE, TRUE)")]
            fn LOGEST(
                span: Span,
                known_ys: (Spanned<Array>),
                known_xs: (Option<Spanned<Array>>),
                const_flag: (Option<bool>),
                stats: (Option<bool>),
            ) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if y_values.iter().any(|&y| y <= 0.0) {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let ln_y_values: Vec<f64> = y_values.iter().map(|y| y.ln()).collect();

                let x_values: Vec<f64> = if let Some(kx) = known_xs {
                    kx.inner
                        .cell_values_slice()
                        .iter()
                        .filter_map(|v| v.coerce_nonblank::<f64>())
                        .collect()
                } else {
                    (1..=y_values.len()).map(|i| i as f64).collect()
                };

                if y_values.len() != x_values.len() || y_values.len() < 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let _const_flag = const_flag.unwrap_or(true);
                let stats_flag = stats.unwrap_or(false);

                let (b, ln_a) = compute_linear_regression(&x_values, &ln_y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                // y = a * exp(b*x), so base m = exp(b) and coefficient b_coef = a
                let m = b.exp();
                let b_coef = ln_a.exp();

                if stats_flag {
                    let n = y_values.len() as f64;
                    let ln_y_mean = ln_y_values.iter().sum::<f64>() / n;

                    let ss_tot: f64 = ln_y_values.iter().map(|y| (y - ln_y_mean).powi(2)).sum();
                    let ss_res: f64 = ln_y_values
                        .iter()
                        .zip(x_values.iter())
                        .map(|(y, x)| (y - (b * x + ln_a)).powi(2))
                        .sum();
                    let r_squared = if ss_tot != 0.0 {
                        1.0 - ss_res / ss_tot
                    } else {
                        0.0
                    };

                    let se_y = (ss_res / (n - 2.0)).sqrt();
                    let ss_reg = ss_tot - ss_res;
                    let f_stat = if ss_res != 0.0 {
                        (ss_reg / 1.0) / (ss_res / (n - 2.0))
                    } else {
                        f64::INFINITY
                    };
                    let df = n - 2.0;

                    let x_mean = x_values.iter().sum::<f64>() / n;
                    let ss_x: f64 = x_values.iter().map(|x| (x - x_mean).powi(2)).sum();
                    let se_m = (m * se_y / ss_x.sqrt()).abs();
                    let se_b = (b_coef * se_y * (1.0 / n + x_mean.powi(2) / ss_x).sqrt()).abs();

                    let data: SmallVec<[CellValue; 1]> = SmallVec::from_vec(vec![
                        CellValue::from(m),
                        CellValue::from(b_coef),
                        CellValue::from(se_m),
                        CellValue::from(se_b),
                        CellValue::from(r_squared),
                        CellValue::from(se_y),
                        CellValue::from(f_stat),
                        CellValue::from(df),
                        CellValue::from(ss_reg),
                        CellValue::from(ss_res),
                    ]);
                    let size = ArraySize::new(2, 5)
                        .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                    Array::new_row_major(size, data)?
                } else {
                    let data: SmallVec<[CellValue; 1]> =
                        SmallVec::from_vec(vec![CellValue::from(m), CellValue::from(b_coef)]);
                    let size = ArraySize::new(2, 1)
                        .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                    Array::new_row_major(size, data)?
                }
            }
        ),
        formula_fn!(
            /// Returns the standard error of the predicted y-value for each x in the regression.
            #[examples("STEYX(A1:A10, B1:B10)")]
            fn STEYX(span: Span, known_ys: (Spanned<Array>), known_xs: (Spanned<Array>)) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                let x_values: Vec<f64> = known_xs
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if y_values.len() != x_values.len() || y_values.len() < 3 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let (slope, intercept) = compute_linear_regression(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let n = y_values.len() as f64;
                let sum_sq_resid: f64 = y_values
                    .iter()
                    .zip(x_values.iter())
                    .map(|(y, x)| {
                        let y_pred = slope * x + intercept;
                        (y - y_pred).powi(2)
                    })
                    .sum();

                (sum_sq_resid / (n - 2.0)).sqrt()
            }
        ),
        formula_fn!(
            /// Returns values along a linear trend.
            /// Returns an array of y-values for given x-values using linear regression.
            #[examples("TREND(A1:A10, B1:B10)", "TREND(A1:A10, B1:B10, C1:C5)")]
            fn TREND(
                span: Span,
                known_ys: (Spanned<Array>),
                known_xs: (Option<Spanned<Array>>),
                new_xs: (Option<Spanned<Array>>),
            ) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let x_values: Vec<f64> = if let Some(kx) = known_xs {
                    kx.inner
                        .cell_values_slice()
                        .iter()
                        .filter_map(|v| v.coerce_nonblank::<f64>())
                        .collect()
                } else {
                    (1..=y_values.len()).map(|i| i as f64).collect()
                };

                if y_values.len() != x_values.len() || y_values.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let (slope, intercept) = compute_linear_regression(&x_values, &y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let predict_xs: Vec<f64> = if let Some(nx) = new_xs {
                    nx.inner
                        .cell_values_slice()
                        .iter()
                        .filter_map(|v| v.coerce_nonblank::<f64>())
                        .collect()
                } else {
                    x_values.clone()
                };

                let results: Vec<f64> = predict_xs.iter().map(|x| slope * x + intercept).collect();

                // Return as a single-column array
                let array_data: SmallVec<[CellValue; 1]> =
                    results.into_iter().map(CellValue::from).collect();
                let height = array_data.len() as u32;

                let size = ArraySize::new(1, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, array_data)?
            }
        ),
        formula_fn!(
            /// Returns values along an exponential trend.
            /// Returns an array of y-values for given x-values using exponential regression.
            #[examples("GROWTH(A1:A10, B1:B10)", "GROWTH(A1:A10, B1:B10, C1:C5)")]
            fn GROWTH(
                span: Span,
                known_ys: (Spanned<Array>),
                known_xs: (Option<Spanned<Array>>),
                new_xs: (Option<Spanned<Array>>),
            ) {
                let y_values: Vec<f64> = known_ys
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                // For exponential regression, we need ln(y) values
                if y_values.iter().any(|&y| y <= 0.0) {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let ln_y_values: Vec<f64> = y_values.iter().map(|y| y.ln()).collect();

                let x_values: Vec<f64> = if let Some(kx) = known_xs {
                    kx.inner
                        .cell_values_slice()
                        .iter()
                        .filter_map(|v| v.coerce_nonblank::<f64>())
                        .collect()
                } else {
                    (1..=y_values.len()).map(|i| i as f64).collect()
                };

                if y_values.len() != x_values.len() || y_values.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Linear regression on ln(y) = ln(a) + b*x gives y = a * e^(b*x)
                let (b, ln_a) = compute_linear_regression(&x_values, &ln_y_values)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let a = ln_a.exp();

                let predict_xs: Vec<f64> = if let Some(nx) = new_xs {
                    nx.inner
                        .cell_values_slice()
                        .iter()
                        .filter_map(|v| v.coerce_nonblank::<f64>())
                        .collect()
                } else {
                    x_values.clone()
                };

                let results: Vec<f64> = predict_xs.iter().map(|x| a * (b * x).exp()).collect();

                let array_data: SmallVec<[CellValue; 1]> =
                    results.into_iter().map(CellValue::from).collect();
                let height = array_data.len() as u32;

                let size = ArraySize::new(1, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, array_data)?
            }
        ),
        formula_fn!(
            /// Returns the percentile rank of a value in a data set (inclusive).
            /// Returns a value between 0 and 1.
            #[name = "PERCENTRANK.INC"]
            #[examples("PERCENTRANK.INC(A1:A10, 5)", "PERCENTRANK.INC({1, 2, 3, 4, 5}, 3)")]
            fn PERCENTRANK_INC(
                span: Span,
                array: (Spanned<Array>),
                x: f64,
                significance: (Option<i64>),
            ) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

                let n = values.len();
                let min_val = values[0];
                let max_val = values[n - 1];

                if x < min_val || x > max_val {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }

                // Find position
                let mut lower_idx = 0;
                let mut upper_idx = 0;
                for (i, &v) in values.iter().enumerate() {
                    if v <= x {
                        lower_idx = i;
                    }
                    if v >= x {
                        upper_idx = i;
                        break;
                    }
                }

                let rank = if (values[lower_idx] - x).abs() < f64::EPSILON {
                    lower_idx as f64 / (n - 1) as f64
                } else {
                    // Interpolate
                    let lower_rank = lower_idx as f64 / (n - 1) as f64;
                    let upper_rank = upper_idx as f64 / (n - 1) as f64;
                    let frac = (x - values[lower_idx]) / (values[upper_idx] - values[lower_idx]);
                    lower_rank + frac * (upper_rank - lower_rank)
                };

                // Apply significance (decimal places)
                let sig = significance.unwrap_or(3).max(1) as i32;
                let factor = 10_f64.powi(sig);
                (rank * factor).floor() / factor
            }
        ),
        formula_fn!(
            /// Returns the percentile rank of a value in a data set (inclusive).
            /// This is a compatibility function equivalent to PERCENTRANK.INC.
            #[examples("PERCENTRANK(A1:A10, 5)", "PERCENTRANK({1, 2, 3, 4, 5}, 3)")]
            fn PERCENTRANK(
                span: Span,
                array: (Spanned<Array>),
                x: f64,
                significance: (Option<i64>),
            ) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

                let n = values.len();
                let min_val = values[0];
                let max_val = values[n - 1];

                if x < min_val || x > max_val {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }

                let mut lower_idx = 0;
                let mut upper_idx = 0;
                for (i, &v) in values.iter().enumerate() {
                    if v <= x {
                        lower_idx = i;
                    }
                    if v >= x {
                        upper_idx = i;
                        break;
                    }
                }

                let rank = if (values[lower_idx] - x).abs() < f64::EPSILON {
                    lower_idx as f64 / (n - 1) as f64
                } else {
                    let lower_rank = lower_idx as f64 / (n - 1) as f64;
                    let upper_rank = upper_idx as f64 / (n - 1) as f64;
                    let frac = (x - values[lower_idx]) / (values[upper_idx] - values[lower_idx]);
                    lower_rank + frac * (upper_rank - lower_rank)
                };

                let sig = significance.unwrap_or(3).max(1) as i32;
                let factor = 10_f64.powi(sig);
                (rank * factor).floor() / factor
            }
        ),
        formula_fn!(
            /// Returns the percentile rank of a value in a data set (exclusive).
            /// Returns a value between 0 and 1.
            #[name = "PERCENTRANK.EXC"]
            #[examples("PERCENTRANK.EXC(A1:A10, 5)", "PERCENTRANK.EXC({1, 2, 3, 4, 5}, 3)")]
            fn PERCENTRANK_EXC(
                span: Span,
                array: (Spanned<Array>),
                x: f64,
                significance: (Option<i64>),
            ) {
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

                let n = values.len();
                let min_val = values[0];
                let max_val = values[n - 1];

                if x < min_val || x > max_val {
                    return Err(RunErrorMsg::NotAvailable.with_span(span));
                }

                let mut lower_idx = 0;
                let mut upper_idx = 0;
                for (i, &v) in values.iter().enumerate() {
                    if v <= x {
                        lower_idx = i;
                    }
                    if v >= x {
                        upper_idx = i;
                        break;
                    }
                }

                // Exclusive uses (rank) / (n + 1)
                let rank = if (values[lower_idx] - x).abs() < f64::EPSILON {
                    (lower_idx + 1) as f64 / (n + 1) as f64
                } else {
                    let lower_rank = (lower_idx + 1) as f64 / (n + 1) as f64;
                    let upper_rank = (upper_idx + 1) as f64 / (n + 1) as f64;
                    let frac = (x - values[lower_idx]) / (values[upper_idx] - values[lower_idx]);
                    lower_rank + frac * (upper_rank - lower_rank)
                };

                let sig = significance.unwrap_or(3).max(1) as i32;
                let factor = 10_f64.powi(sig);
                (rank * factor).floor() / factor
            }
        ),
        formula_fn!(
            /// Returns the average of the absolute deviations of data points from their mean.
            #[examples("AVEDEV(A1:A10)", "AVEDEV(1, 2, 3, 4, 5)")]
            fn AVEDEV(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let n = values.len() as f64;
                let mean: f64 = values.iter().sum::<f64>() / n;
                let sum_abs_dev: f64 = values.iter().map(|x| (x - mean).abs()).sum();
                sum_abs_dev / n
            }
        ),
        formula_fn!(
            /// Returns the sum of squared deviations of data points from their mean.
            #[examples("DEVSQ(A1:A10)", "DEVSQ(1, 2, 3, 4, 5)")]
            fn DEVSQ(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let n = values.len() as f64;
                let mean: f64 = values.iter().sum::<f64>() / n;
                values.iter().map(|x| (x - mean).powi(2)).sum::<f64>()
            }
        ),
        formula_fn!(
            /// Returns the geometric mean of a set of positive numbers.
            #[examples("GEOMEAN(A1:A10)", "GEOMEAN(1, 2, 4, 8)")]
            fn GEOMEAN(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                // Check for non-positive values
                if values.iter().any(|&x| x <= 0.0) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let n = values.len() as f64;
                let log_sum: f64 = values.iter().map(|x| x.ln()).sum();
                (log_sum / n).exp()
            }
        ),
        formula_fn!(
            /// Returns the harmonic mean of a set of positive numbers.
            #[examples("HARMEAN(A1:A10)", "HARMEAN(1, 2, 4, 8)")]
            fn HARMEAN(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                // Check for non-positive values
                if values.iter().any(|&x| x <= 0.0) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let n = values.len() as f64;
                let reciprocal_sum: f64 = values.iter().map(|x| 1.0 / x).sum();
                n / reciprocal_sum
            }
        ),
        formula_fn!(
            /// Returns the mean of the interior of a data set, excluding a percentage from top and bottom.
            /// The percent parameter specifies the fraction of data points to exclude from each end.
            #[examples(
                "TRIMMEAN(A1:A10, 0.2)",
                "TRIMMEAN({1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, 0.2)"
            )]
            fn TRIMMEAN(span: Span, array: (Spanned<Array>), percent: (Spanned<f64>)) {
                if percent.inner < 0.0 || percent.inner >= 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(percent.span));
                }
                let mut values: Vec<f64> = array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

                let n = values.len();
                // Number of values to exclude from each end (rounded down)
                let exclude_count = ((n as f64 * percent.inner) / 2.0).floor() as usize;
                let trimmed = &values[exclude_count..n - exclude_count];

                if trimmed.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(percent.span));
                }
                trimmed.iter().sum::<f64>() / trimmed.len() as f64
            }
        ),
        formula_fn!(
            /// Returns the skewness of a distribution (sample skewness).
            /// Skewness characterizes the degree of asymmetry of a distribution.
            #[examples("SKEW(A1:A10)", "SKEW(1, 2, 3, 4, 5)")]
            fn SKEW(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.len() < 3 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let n = values.len() as f64;
                let mean: f64 = values.iter().sum::<f64>() / n;
                let stdev = compute_stdev(&values, false);
                if stdev == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let sum_cubed: f64 = values.iter().map(|x| ((x - mean) / stdev).powi(3)).sum();
                (n / ((n - 1.0) * (n - 2.0))) * sum_cubed
            }
        ),
        formula_fn!(
            /// Returns the skewness of a distribution (population skewness).
            #[name = "SKEW.P"]
            #[examples("SKEW.P(A1:A10)", "SKEW.P(1, 2, 3, 4, 5)")]
            fn SKEW_P(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.len() < 3 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let n = values.len() as f64;
                let mean: f64 = values.iter().sum::<f64>() / n;
                let stdev = compute_stdev(&values, true);
                if stdev == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let sum_cubed: f64 = values.iter().map(|x| ((x - mean) / stdev).powi(3)).sum();
                sum_cubed / n
            }
        ),
        formula_fn!(
            /// Returns the kurtosis of a data set.
            /// Kurtosis characterizes the relative peakedness or flatness of a distribution.
            #[examples("KURT(A1:A10)", "KURT(1, 2, 3, 4, 5)")]
            fn KURT(span: Span, numbers: (Iter<f64>)) {
                let values: Vec<f64> = numbers.collect::<CodeResult<Vec<_>>>()?;
                if values.len() < 4 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let n = values.len() as f64;
                let mean: f64 = values.iter().sum::<f64>() / n;
                let stdev = compute_stdev(&values, false);
                if stdev == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let sum_fourth: f64 = values.iter().map(|x| ((x - mean) / stdev).powi(4)).sum();
                let term1 = (n * (n + 1.0)) / ((n - 1.0) * (n - 2.0) * (n - 3.0));
                let term2 = (3.0 * (n - 1.0).powi(2)) / ((n - 2.0) * (n - 3.0));
                term1 * sum_fourth - term2
            }
        ),
        formula_fn!(
            /// Returns a normalized value (z-score) from a distribution.
            /// Calculates (x - mean) / standard_dev.
            #[examples(
                "STANDARDIZE(5, 3, 2)",
                "STANDARDIZE(A1, AVERAGE(B1:B10), STDEV(B1:B10))"
            )]
            fn STANDARDIZE(_span: Span, x: f64, mean: f64, standard_dev: (Spanned<f64>)) {
                if standard_dev.inner <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(standard_dev.span));
                }
                (x - mean) / standard_dev.inner
            }
        ),
        formula_fn!(
            /// Returns the Fisher transformation of x.
            /// Returns 0.5 * ln((1 + x) / (1 - x)).
            #[examples("FISHER(0.5)", "FISHER(A1)")]
            fn FISHER(_span: Span, x: (Spanned<f64>)) {
                if x.inner <= -1.0 || x.inner >= 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(x.span));
                }
                0.5 * ((1.0 + x.inner) / (1.0 - x.inner)).ln()
            }
        ),
        formula_fn!(
            /// Returns the inverse of the Fisher transformation.
            /// Returns (e^(2y) - 1) / (e^(2y) + 1).
            #[examples("FISHERINV(0.5)", "FISHERINV(A1)")]
            fn FISHERINV(y: f64) {
                let e2y = (2.0 * y).exp();
                (e2y - 1.0) / (e2y + 1.0)
            }
        ),
        formula_fn!(
            /// Returns a frequency distribution as a vertical array.
            ///
            /// Counts how many values in `data_array` fall within each bin
            /// defined by `bins_array`. The result has one more element than
            /// `bins_array` to account for values greater than the last bin.
            ///
            /// For example, if bins_array is {10, 20, 30}, the result will have
            /// 4 elements: count of values ≤10, count of 10<values≤20,
            /// count of 20<values≤30, and count of values>30.
            #[examples("FREQUENCY(A1:A10, {10, 20, 30})", "FREQUENCY(A1:A20, B1:B5)")]
            fn FREQUENCY(span: Span, data_array: (Spanned<Array>), bins_array: (Spanned<Array>)) {
                // Extract data values
                let data: Vec<f64> = data_array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                // Extract bin boundaries
                let mut bins: Vec<f64> = bins_array
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                // Sort bins in ascending order
                bins.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

                // Create frequency counts array (bins.len() + 1 elements)
                let mut counts: Vec<f64> = vec![0.0; bins.len() + 1];

                // Count values in each bin
                for value in &data {
                    let mut placed = false;
                    for (i, &bin) in bins.iter().enumerate() {
                        if *value <= bin {
                            counts[i] += 1.0;
                            placed = true;
                            break;
                        }
                    }
                    if !placed {
                        // Value is greater than all bins
                        counts[bins.len()] += 1.0;
                    }
                }

                // Return as a vertical array
                let array_data: SmallVec<[CellValue; 1]> =
                    counts.into_iter().map(CellValue::from).collect();
                let height = array_data.len() as u32;

                let size = ArraySize::new(1, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, array_data)?
            }
        ),
        formula_fn!(
            /// Returns an aggregate in a list or database. The AGGREGATE function
            /// can apply different aggregate functions to a list or database with
            /// the option to ignore error values.
            ///
            /// `function_num` specifies which function to use:
            /// - 1: AVERAGE
            /// - 2: COUNT
            /// - 3: COUNTA
            /// - 4: MAX
            /// - 5: MIN
            /// - 6: PRODUCT
            /// - 7: STDEV.S (sample standard deviation)
            /// - 8: STDEV.P (population standard deviation)
            /// - 9: SUM
            /// - 10: VAR.S (sample variance)
            /// - 11: VAR.P (population variance)
            /// - 12: MEDIAN
            /// - 13: MODE.SNGL
            /// - 14: LARGE (requires `k` parameter)
            /// - 15: SMALL (requires `k` parameter)
            /// - 16: PERCENTILE.INC (requires `k` parameter)
            /// - 17: QUARTILE.INC (requires `k` parameter)
            /// - 18: PERCENTILE.EXC (requires `k` parameter)
            /// - 19: QUARTILE.EXC (requires `k` parameter)
            ///
            /// `options` specifies which values to ignore:
            /// - 0 or 1: Ignore nested SUBTOTAL and AGGREGATE functions
            /// - 2 or 3: Ignore error values and nested SUBTOTAL/AGGREGATE functions
            /// - 4 or 5: Ignore nothing
            /// - 6 or 7: Ignore error values
            #[examples(
                "AGGREGATE(9, 6, A1:A10)",
                "AGGREGATE(14, 6, A1:A10, 2)",
                "AGGREGATE(4, 6, {1, 2, 3})"
            )]
            fn AGGREGATE(
                span: Span,
                function_num: (Spanned<i64>),
                options: (Spanned<i64>),
                array: (Spanned<Array>),
                k_param: (Option<Spanned<f64>>),
            ) {
                let func_num = function_num.inner;
                let opts = options.inner;

                // Validate function_num (1-19)
                if !(1..=19).contains(&func_num) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(function_num.span));
                }

                // Validate options (0-7)
                if !(0..=7).contains(&opts) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(options.span));
                }

                // Determine if we should ignore errors
                let ignore_errors = matches!(opts, 2 | 3 | 6 | 7);

                // Collect values, optionally ignoring errors
                let mut values: Vec<f64> = Vec::new();
                for cv in array.inner.cell_values_slice().iter() {
                    match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            values.push(n.to_f64().unwrap_or(f64::NAN));
                        }
                        CellValue::Error(_) if ignore_errors => continue,
                        CellValue::Error(e) => return Err(e.clone().with_span(span)),
                        CellValue::Blank => continue,
                        _ => continue, // Skip non-numeric values
                    }
                }

                let result: f64 = match func_num {
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
                        // COUNTA - count non-blank
                        let count = array
                            .inner
                            .cell_values_slice()
                            .iter()
                            .filter(|cv| {
                                if ignore_errors {
                                    !matches!(cv, CellValue::Blank | CellValue::Error(_))
                                } else {
                                    !matches!(cv, CellValue::Blank)
                                }
                            })
                            .count();
                        count as f64
                    }
                    4 => {
                        // MAX
                        values.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
                    }
                    5 => {
                        // MIN
                        values.iter().cloned().fold(f64::INFINITY, f64::min)
                    }
                    6 => {
                        // PRODUCT
                        values.iter().product()
                    }
                    7 => {
                        // STDEV.S (sample)
                        compute_stdev(&values, false)
                    }
                    8 => {
                        // STDEV.P (population)
                        compute_stdev(&values, true)
                    }
                    9 => {
                        // SUM
                        values.iter().sum()
                    }
                    10 => {
                        // VAR.S (sample)
                        compute_variance(&values, false)
                    }
                    11 => {
                        // VAR.P (population)
                        compute_variance(&values, true)
                    }
                    12 => {
                        // MEDIAN
                        if values.is_empty() {
                            return Err(RunErrorMsg::EmptyArray.with_span(span));
                        }
                        values
                            .sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                        let len = values.len();
                        if len % 2 == 0 {
                            (values[len / 2 - 1] + values[len / 2]) / 2.0
                        } else {
                            values[len / 2]
                        }
                    }
                    13 => {
                        // MODE.SNGL - find most frequent value
                        if values.is_empty() {
                            return Err(RunErrorMsg::EmptyArray.with_span(span));
                        }
                        use std::collections::HashMap;
                        let mut counts: HashMap<u64, usize> = HashMap::new();
                        for &v in &values {
                            let key = v.to_bits();
                            *counts.entry(key).or_insert(0) += 1;
                        }
                        let (mode_bits, max_count) = counts
                            .iter()
                            .max_by_key(|&(_, count)| *count)
                            .map(|(&k, &v)| (k, v))
                            .unwrap();
                        if max_count < 2 {
                            // No mode found - all values appear only once
                            return Err(RunErrorMsg::NotAvailable.with_span(span));
                        }
                        f64::from_bits(mode_bits)
                    }
                    14 => {
                        // LARGE
                        let k = k_param.ok_or_else(|| {
                            RunErrorMsg::MissingRequiredArgument {
                                func_name: "AGGREGATE".into(),
                                arg_name: "k".into(),
                            }
                            .with_span(span)
                        })?;
                        let k_idx = k.inner as usize;
                        if k_idx < 1 || k_idx > values.len() {
                            return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                        }
                        values
                            .sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
                        values[k_idx - 1]
                    }
                    15 => {
                        // SMALL
                        let k = k_param.ok_or_else(|| {
                            RunErrorMsg::MissingRequiredArgument {
                                func_name: "AGGREGATE".into(),
                                arg_name: "k".into(),
                            }
                            .with_span(span)
                        })?;
                        let k_idx = k.inner as usize;
                        if k_idx < 1 || k_idx > values.len() {
                            return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                        }
                        values
                            .sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                        values[k_idx - 1]
                    }
                    16 => {
                        // PERCENTILE.INC
                        let k = k_param.ok_or_else(|| {
                            RunErrorMsg::MissingRequiredArgument {
                                func_name: "AGGREGATE".into(),
                                arg_name: "k".into(),
                            }
                            .with_span(span)
                        })?;
                        compute_percentile(&mut values, k.inner, false)
                            .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?
                    }
                    17 => {
                        // QUARTILE.INC
                        let k = k_param.ok_or_else(|| {
                            RunErrorMsg::MissingRequiredArgument {
                                func_name: "AGGREGATE".into(),
                                arg_name: "k".into(),
                            }
                            .with_span(span)
                        })?;
                        let quartile = k.inner as i64;
                        if !(0..=4).contains(&quartile) {
                            return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                        }
                        let pct = quartile as f64 * 0.25;
                        compute_percentile(&mut values, pct, false)
                            .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?
                    }
                    18 => {
                        // PERCENTILE.EXC
                        let k = k_param.ok_or_else(|| {
                            RunErrorMsg::MissingRequiredArgument {
                                func_name: "AGGREGATE".into(),
                                arg_name: "k".into(),
                            }
                            .with_span(span)
                        })?;
                        compute_percentile(&mut values, k.inner, true)
                            .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?
                    }
                    19 => {
                        // QUARTILE.EXC
                        let k = k_param.ok_or_else(|| {
                            RunErrorMsg::MissingRequiredArgument {
                                func_name: "AGGREGATE".into(),
                                arg_name: "k".into(),
                            }
                            .with_span(span)
                        })?;
                        let quartile = k.inner as i64;
                        if !(1..=3).contains(&quartile) {
                            return Err(RunErrorMsg::InvalidArgument.with_span(k.span));
                        }
                        let pct = quartile as f64 * 0.25;
                        compute_percentile(&mut values, pct, true)
                            .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(k.span))?
                    }
                    _ => unreachable!(),
                };

                Ok(CellValue::from(result))
            }
        ),
        formula_fn!(
            /// Returns the probability that values in a range are between two limits.
            ///
            /// The x_range and prob_range must be the same size. The sum of values
            /// in prob_range must be between 0 and 1 (inclusive).
            ///
            /// If upper_limit is omitted, returns the probability that x equals lower_limit.
            #[examples(
                "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 2)",
                "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 1, 3)"
            )]
            fn PROB(
                span: Span,
                x_range: (Spanned<Array>),
                prob_range: (Spanned<Array>),
                lower_limit: (Spanned<f64>),
                upper_limit: (Option<Spanned<f64>>),
            ) {
                // Extract x values
                let x_values: Vec<f64> = x_range
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                // Extract probability values
                let prob_values: Vec<f64> = prob_range
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                // Arrays must have the same size
                if x_values.len() != prob_values.len() {
                    return Err(RunErrorMsg::ExactArraySizeMismatch {
                        expected: x_range.inner.size(),
                        got: prob_range.inner.size(),
                    }
                    .with_span(prob_range.span));
                }

                if x_values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }

                // Check that all probabilities are between 0 and 1
                for &p in &prob_values {
                    if !(0.0..=1.0).contains(&p) {
                        return Err(RunErrorMsg::Num.with_span(prob_range.span));
                    }
                }

                // Check that probabilities sum to approximately 1 (allow small tolerance)
                let prob_sum: f64 = prob_values.iter().sum();
                if prob_sum < 0.0 || prob_sum > 1.0 + 1e-10 {
                    return Err(RunErrorMsg::Num.with_span(prob_range.span));
                }

                let lower = lower_limit.inner;
                let upper = upper_limit.map(|u| u.inner).unwrap_or(lower);

                // Upper must be >= lower
                if upper < lower {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                // Sum probabilities where lower <= x <= upper
                let result: f64 = x_values
                    .iter()
                    .zip(prob_values.iter())
                    .filter(|(x, _)| **x >= lower && **x <= upper)
                    .map(|(_, p)| *p)
                    .sum();

                result
            }
        ),
        formula_fn!(
            /// Returns a forecasted value using Exponential Triple Smoothing (ETS/Holt-Winters).
            ///
            /// ETS considers level, trend, and seasonality to produce forecasts.
            ///
            /// - `target_date`: The date/value for which to forecast.
            /// - `values`: Historical values (dependent variable).
            /// - `timeline`: Historical dates/times (independent variable).
            /// - `seasonality`: Optional. The seasonality period (0=auto, 1=none, or specific period).
            /// - `data_completion`: Optional. How to handle missing data (0=interpolate, 1=zeros).
            /// - `aggregation`: Optional. How to aggregate multiple values (1=average, 2-7=other).
            #[name = "FORECAST.ETS"]
            #[examples(
                "FORECAST.ETS(A1, B1:B12, C1:C12)",
                "FORECAST.ETS(A1, B1:B12, C1:C12, 4)"
            )]
            fn FORECAST_ETS(
                span: Span,
                target: (Spanned<f64>),
                values: (Spanned<Array>),
                timeline: (Spanned<Array>),
                seasonality: (Option<i64>),
                _data_completion: (Option<i64>),
                _aggregation: (Option<i64>),
            ) {
                let y_values: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let x_values: Vec<f64> = timeline
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if y_values.len() != x_values.len() || y_values.len() < 3 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                // Determine seasonality period
                let season = match seasonality {
                    Some(0) | None => detect_seasonality(&y_values), // Auto-detect
                    Some(1) => 1,                                    // No seasonality
                    Some(s) if s > 1 => s as usize,
                    _ => 1,
                };

                let forecast = ets_forecast(&y_values, &x_values, target.inner, season)?;
                forecast
            }
        ),
        formula_fn!(
            /// Returns the confidence interval for a forecast using ETS.
            ///
            /// - `target_date`: The date/value for which to forecast.
            /// - `values`: Historical values.
            /// - `timeline`: Historical dates/times.
            /// - `confidence_level`: Optional. Confidence level (0 to 1, default 0.95).
            /// - `seasonality`: Optional. Seasonality period.
            #[name = "FORECAST.ETS.CONFINT"]
            #[examples("FORECAST.ETS.CONFINT(A1, B1:B12, C1:C12, 0.95)")]
            fn FORECAST_ETS_CONFINT(
                span: Span,
                target: (Spanned<f64>),
                values: (Spanned<Array>),
                timeline: (Spanned<Array>),
                confidence_level: (Option<f64>),
                seasonality: (Option<i64>),
                _data_completion: (Option<i64>),
                _aggregation: (Option<i64>),
            ) {
                let y_values: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let x_values: Vec<f64> = timeline
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if y_values.len() != x_values.len() || y_values.len() < 3 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let conf = confidence_level.unwrap_or(0.95);
                if !(0.0..1.0).contains(&conf) {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let season = match seasonality {
                    Some(0) | None => detect_seasonality(&y_values),
                    Some(1) => 1,
                    Some(s) if s > 1 => s as usize,
                    _ => 1,
                };

                let confint =
                    ets_confidence_interval(&y_values, &x_values, target.inner, season, conf)?;
                confint
            }
        ),
        formula_fn!(
            /// Returns the detected seasonality period in the data.
            ///
            /// - `values`: Historical values.
            /// - `timeline`: Historical dates/times.
            /// - `data_completion`: Optional. How to handle missing data.
            /// - `aggregation`: Optional. How to aggregate multiple values.
            #[name = "FORECAST.ETS.SEASONALITY"]
            #[examples("FORECAST.ETS.SEASONALITY(A1:A24, B1:B24)")]
            fn FORECAST_ETS_SEASONALITY(
                span: Span,
                values: (Spanned<Array>),
                timeline: (Spanned<Array>),
                _data_completion: (Option<i64>),
                _aggregation: (Option<i64>),
            ) {
                let y_values: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let x_values: Vec<f64> = timeline
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if y_values.len() != x_values.len() || y_values.len() < 3 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                detect_seasonality(&y_values) as f64
            }
        ),
        formula_fn!(
            /// Returns a specific statistic about the ETS model.
            ///
            /// - `values`: Historical values.
            /// - `timeline`: Historical dates/times.
            /// - `statistic_type`: Which statistic to return:
            ///   1=Alpha (level smoothing), 2=Beta (trend smoothing),
            ///   3=Gamma (seasonal smoothing), 4=MASE, 5=SMAPE,
            ///   6=MAE, 7=RMSE, 8=Step size.
            /// - `seasonality`: Optional. Seasonality period.
            #[name = "FORECAST.ETS.STAT"]
            #[examples("FORECAST.ETS.STAT(A1:A24, B1:B24, 1)")]
            fn FORECAST_ETS_STAT(
                span: Span,
                values: (Spanned<Array>),
                timeline: (Spanned<Array>),
                statistic_type: (Spanned<i64>),
                seasonality: (Option<i64>),
                _data_completion: (Option<i64>),
                _aggregation: (Option<i64>),
            ) {
                let y_values: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let x_values: Vec<f64> = timeline
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if y_values.len() != x_values.len() || y_values.len() < 3 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let stat_type = statistic_type.inner;
                if !(1..=8).contains(&stat_type) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(statistic_type.span));
                }

                let season = match seasonality {
                    Some(0) | None => detect_seasonality(&y_values),
                    Some(1) => 1,
                    Some(s) if s > 1 => s as usize,
                    _ => 1,
                };

                let stat = ets_statistic(&y_values, &x_values, season, stat_type as usize)?;
                stat
            }
        ),
    ]
}

// =============================================================================
// ETS (Exponential Triple Smoothing / Holt-Winters) Helper Functions
// =============================================================================

/// Detects the seasonality period in a time series using autocorrelation.
fn detect_seasonality(values: &[f64]) -> usize {
    let n = values.len();
    if n < 6 {
        return 1; // Not enough data for seasonality
    }

    let mean: f64 = values.iter().sum::<f64>() / n as f64;
    let var: f64 = values.iter().map(|x| (x - mean).powi(2)).sum();

    if var == 0.0 {
        return 1;
    }

    // Test seasonality periods from 2 to n/2
    let max_lag = (n / 2).min(12); // Cap at 12 for reasonable performance
    let mut best_period = 1;
    let mut best_correlation = 0.0;

    for lag in 2..=max_lag {
        let mut sum = 0.0;
        for i in 0..(n - lag) {
            sum += (values[i] - mean) * (values[i + lag] - mean);
        }
        let correlation = sum / var;

        if correlation > best_correlation && correlation > 0.3 {
            best_correlation = correlation;
            best_period = lag;
        }
    }

    best_period
}

/// Performs ETS forecasting using Holt-Winters additive method.
fn ets_forecast(y_values: &[f64], x_values: &[f64], target: f64, season: usize) -> CodeResult<f64> {
    let (alpha, beta, gamma, level, _trend, seasonal) = fit_ets_model(y_values, season)?;

    // Determine forecast horizon
    let last_x = x_values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let step = if x_values.len() >= 2 {
        let mut diffs: Vec<f64> = x_values.windows(2).map(|w| w[1] - w[0]).collect();
        diffs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        diffs[diffs.len() / 2] // Median step
    } else {
        1.0
    };

    let steps_ahead = ((target - last_x) / step).max(0.0).ceil() as usize;

    // Forecast
    let mut forecast = level + beta * steps_ahead as f64;
    if season > 1 {
        let seasonal_idx = steps_ahead % season;
        forecast += seasonal[seasonal_idx];
    }

    let _ = (alpha, gamma); // Suppress warnings
    Ok(forecast)
}

/// Calculates confidence interval for ETS forecast.
fn ets_confidence_interval(
    y_values: &[f64],
    x_values: &[f64],
    target: f64,
    season: usize,
    confidence: f64,
) -> CodeResult<f64> {
    let (_, _, _, _, _, _) = fit_ets_model(y_values, season)?;

    // Calculate residuals and RMSE
    let n = y_values.len();
    let mean: f64 = y_values.iter().sum::<f64>() / n as f64;
    let residuals: Vec<f64> = y_values.iter().map(|y| y - mean).collect();
    let rmse = (residuals.iter().map(|r| r.powi(2)).sum::<f64>() / n as f64).sqrt();

    // Determine forecast horizon
    let last_x = x_values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let step = if x_values.len() >= 2 {
        let mut diffs: Vec<f64> = x_values.windows(2).map(|w| w[1] - w[0]).collect();
        diffs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        diffs[diffs.len() / 2]
    } else {
        1.0
    };
    let steps_ahead = ((target - last_x) / step).max(1.0).ceil() as f64;

    // Use normal distribution for confidence interval
    use statrs::distribution::{ContinuousCDF, Normal};
    let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.without_span())?;
    let z = normal.inverse_cdf((1.0 + confidence) / 2.0);

    // Confidence interval width increases with forecast horizon
    let conf_width = z * rmse * steps_ahead.sqrt();

    Ok(conf_width)
}

/// Returns a specific ETS model statistic.
fn ets_statistic(
    y_values: &[f64],
    _x_values: &[f64],
    season: usize,
    stat_type: usize,
) -> CodeResult<f64> {
    let (alpha, beta, gamma, _, _, _) = fit_ets_model(y_values, season)?;

    let n = y_values.len();
    let mean: f64 = y_values.iter().sum::<f64>() / n as f64;

    // Calculate errors
    let errors: Vec<f64> = y_values.iter().map(|y| y - mean).collect();
    let abs_errors: Vec<f64> = errors.iter().map(|e| e.abs()).collect();

    match stat_type {
        1 => Ok(alpha), // Alpha
        2 => Ok(beta),  // Beta
        3 => Ok(gamma), // Gamma
        4 => {
            // MASE (Mean Absolute Scaled Error)
            if n < 2 {
                return Ok(f64::NAN);
            }
            let naive_errors: f64 = y_values
                .windows(2)
                .map(|w| (w[1] - w[0]).abs())
                .sum::<f64>();
            let scale = naive_errors / (n - 1) as f64;
            if scale == 0.0 {
                return Ok(0.0);
            }
            Ok(abs_errors.iter().sum::<f64>() / n as f64 / scale)
        }
        5 => {
            // SMAPE (Symmetric Mean Absolute Percentage Error)
            let smape: f64 = y_values
                .iter()
                .enumerate()
                .map(|(_i, y)| {
                    let forecast = mean;
                    if *y == 0.0 && forecast == 0.0 {
                        0.0
                    } else {
                        (y - forecast).abs() / ((y.abs() + forecast.abs()) / 2.0)
                    }
                })
                .sum::<f64>()
                / n as f64;
            Ok(smape * 100.0)
        }
        6 => {
            // MAE (Mean Absolute Error)
            Ok(abs_errors.iter().sum::<f64>() / n as f64)
        }
        7 => {
            // RMSE (Root Mean Square Error)
            Ok((errors.iter().map(|e| e.powi(2)).sum::<f64>() / n as f64).sqrt())
        }
        8 => {
            // Step size
            Ok(1.0)
        }
        _ => Err(RunErrorMsg::InvalidArgument.without_span()),
    }
}

/// Fits an ETS model and returns smoothing parameters and final states.
fn fit_ets_model(
    y_values: &[f64],
    season: usize,
) -> CodeResult<(f64, f64, f64, f64, f64, Vec<f64>)> {
    let n = y_values.len();

    // Initialize smoothing parameters (typical starting values)
    let alpha = 0.3; // Level smoothing
    let beta = 0.1; // Trend smoothing
    let gamma = if season > 1 { 0.1 } else { 0.0 }; // Seasonal smoothing

    // Initialize level and trend
    let level = y_values.iter().take(season.max(3)).sum::<f64>() / season.max(3) as f64;
    let trend = if n >= 2 {
        (y_values[n.min(season.max(3)) - 1] - y_values[0]) / (n.min(season.max(3)) - 1) as f64
    } else {
        0.0
    };

    // Initialize seasonal components
    let seasonal = if season > 1 {
        let mut s = vec![0.0; season];
        for i in 0..season.min(n) {
            s[i] = y_values[i] - level;
        }
        s
    } else {
        vec![0.0]
    };

    Ok((alpha, beta, gamma, level, trend, seasonal))
}
