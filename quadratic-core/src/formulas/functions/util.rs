use super::*;

/// Divides one number by another, handling the error case of division by zero.
pub fn checked_div(span: impl Into<Span>, dividend: f64, divisor: f64) -> FormulaResult<f64> {
    let result = dividend / divisor;
    match result.is_finite() {
        true => Ok(result),
        false => Err(FormulaErrorMsg::DivideByZero.with_span(span)),
    }
}

pub fn average(
    span: impl Into<Span>,
    numbers: impl IntoIterator<Item = FormulaResult<f64>>,
) -> FormulaResult<f64> {
    let mut sum = 0.0;
    let mut count = 0;
    for n in numbers {
        sum += n?;
        count += 1;
    }
    util::checked_div(span, sum, count as f64)
}
