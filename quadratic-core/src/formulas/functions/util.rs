use super::*;

/// Constructs a pure formula function that maps a pure function over arguments
/// that may be arrays.
///
/// This function leaks memory, so it should only be called during
/// initialization.
pub fn array_mapped<const N: usize>(
    f: impl 'static + Send + Sync + Copy + Fn([Spanned<Value>; N]) -> FormulaResult<Value>,
) -> FormulaFunctionEvalFn {
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
    f: impl 'static + Send + Sync + Fn(Spanned<Vec<Spanned<Value>>>) -> FormulaResult<Value>,
) -> FormulaFunctionEvalFn {
    // Leak `f` so that the future returned from the closure can access `f`
    // forever.
    let f = &*Box::leak(Box::new(f));

    Box::new(move |_ctx, args| async { f(args) }.boxed_local())
}

/// Constructs a formula function that takes no inputs and returns a constant value.
///
/// This function leaks memory, so it should only be called during
/// initialization.
pub fn constant_fn(v: Value) -> FormulaFunctionEvalFn {
    pure_fn(move |args| {
        if !args.inner.is_empty() {
            return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span));
        }
        Ok(v.clone())
    })
}

/// Returns the sum of a list of values, which may be arrays. This is
/// essentially the `SUM` function.
pub fn sum(args: &[Spanned<Value>]) -> FormulaResult<f64> {
    flat_iter_numbers(args).try_fold(0.0, |sum, next| FormulaResult::Ok(sum + next?))
}
/// Returns the product of a list of values, which may be arrays. This is
/// essentially the `PRODUCT` function.
pub fn product(args: &[Spanned<Value>]) -> FormulaResult<f64> {
    flat_iter_numbers(args).try_fold(1.0, |prod, next| FormulaResult::Ok(prod * next?))
}
/// Returns the number of values in a list of values, which may be arrays. This
/// is essentially the `COUNT` function.
pub fn count(args: &[Spanned<Value>]) -> usize {
    args.iter().map(|v| v.inner.count()).sum()
}

/// Iterates over arguments converted to numbers, with any arrays flattened.
pub fn flat_iter_numbers<'a>(
    args: &'a [Spanned<Value>],
) -> impl 'a + Iterator<Item = FormulaResult<f64>> {
    args.iter().map(|v| v.to_numbers()).flatten_ok()
}
/// Iterates over arguments converted to booleans, with any arrays flattened.
pub fn flat_iter_bools<'a>(
    args: &'a [Spanned<Value>],
) -> impl 'a + Iterator<Item = FormulaResult<bool>> {
    args.iter().map(|v| v.to_bools()).flatten_ok()
}
/// Iterates over arguments converted to strings, with any arrays flattened.
pub fn flat_iter_strings<'a>(
    args: &'a [Spanned<Value>],
) -> impl 'a + Iterator<Item = FormulaResult<String>> {
    args.iter().map(|v| v.to_strings()).flatten_ok()
}
