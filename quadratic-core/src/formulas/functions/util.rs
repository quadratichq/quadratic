use super::*;

/// Outputs a string containing a sentence linking to the documentation for
/// user-specification of criteria used in `SUMIF`, `COUNTIF`, and `AVERAGEIF`.
/// The string begins with a space.
///
/// This is a macro instead of a constant so that it can be used with `concat!`.
macro_rules! see_docs_for_more_about_criteria {
    () => { " See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas." };
}

/// Constructs a pure formula function that maps a pure function over arguments
/// that may be arrays.
///
/// This function leaks memory, so it should only be called during
/// initialization.
pub fn array_mapped<const N: usize>(
    f: impl 'static + Send + Sync + Copy + Fn([Spanned<Value>; N]) -> FormulaResult,
) -> FormulaFn {
    // Leak `f` so that the future returned from the closure can access `f`
    // forever.
    let f = &*Box::leak(Box::new(f));

    Box::new(move |ctx, args| ctx.array_map(args, |_ctx, args| f(args)).boxed_local())
}

/// Constructs a pure formula function.
///
/// This function leaks memory, so it should only be called during
/// initialization.
pub fn pure_fn(
    f: impl 'static + Send + Sync + Fn(Spanned<Vec<Spanned<Value>>>) -> FormulaResult,
) -> FormulaFn {
    // Leak `f` so that the future returned from the closure can access `f`
    // forever.
    let f = &*Box::leak(Box::new(f));

    Box::new(move |_ctx, args| async { f(args) }.boxed_local())
}

/// Constructs a formula function that takes no inputs and returns a constant value.
///
/// This function leaks memory, so it should only be called during
/// initialization.
pub fn constant_fn(v: Value) -> FormulaFn {
    pure_fn(move |args| {
        if !args.inner.is_empty() {
            return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span));
        }
        Ok(v.clone())
    })
}

/// Returns the sum of a list of values, which may be arrays. This is
/// essentially the `SUM` function.
pub fn sum(args: &[Spanned<Value>]) -> f64 {
    flat_iter_numbers(args).sum()
}
/// Returns the product of a list of values, which may be arrays. This is
/// essentially the `PRODUCT` function.
pub fn product(args: &[Spanned<Value>]) -> f64 {
    flat_iter_numbers(args).product()
}
/// Returns the number of numeric values in a list of values, which may be
/// arrays. This is essentially the `COUNT` function.
pub fn count_numeric(args: &[Spanned<Value>]) -> usize {
    args.iter().map(|v| v.inner.count_numeric()).sum()
}

/// Iterates over arguments converted to numbers, with any arrays flattened.
pub fn flat_iter_numbers(args: &[Spanned<Value>]) -> impl '_ + Iterator<Item = f64> {
    args.iter().flat_map(|v| v.to_numbers())
}
/// Iterates over arguments converted to booleans, with any arrays flattened.
pub fn flat_iter_bools(args: &[Spanned<Value>]) -> impl '_ + Iterator<Item = bool> {
    args.iter().flat_map(|v| v.to_bools())
}
/// Iterates over arguments converted to strings, with any arrays flattened.
pub fn flat_iter_strings(args: &[Spanned<Value>]) -> impl '_ + Iterator<Item = String> {
    args.iter().flat_map(|v| v.to_strings())
}

/// Iterates over values in `output_values_range` corresponding to values in
/// `eval_range` that meet `criteria`.
pub fn iter_values_meeting_criteria<'a>(
    eval_range: &'a Spanned<Value>,
    criteria: &'a Spanned<Value>,
    output_values_range: &'a Spanned<Value>,
) -> FormulaResult<impl 'a + Iterator<Item = FormulaResult<Spanned<Value>>>> {
    use super::super::criteria::Criterion;

    let criteria: Criterion = Criterion::try_from(criteria)?;

    let eval_array_size = eval_range.inner.array_size().unwrap_or((1, 1));
    if let Some(sum_array_size) = output_values_range.inner.array_size() {
        if eval_array_size != sum_array_size {
            return Err(FormulaErrorMsg::ArraySizeMismatch {
                expected: eval_array_size,
                got: sum_array_size,
            }
            .with_span(output_values_range.span));
        }
    }
    let (rows, cols) = eval_array_size;

    Ok(itertools::iproduct!(0..cols, 0..rows)
        .map(move |(col, row)| {
            if criteria.matches(&eval_range.get_array_value(row, col)?.inner) {
                output_values_range.get_array_value(row, col).map(Some)
            } else {
                Ok(None)
            }
        })
        .filter_map_ok(|optional_value| optional_value))
}
