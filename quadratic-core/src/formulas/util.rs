use crate::{CodeResult, RunErrorMsg, Span};

/// Divides one number by another, return an error in case of division by zero.
pub(crate) fn checked_div(span: impl Into<Span>, dividend: f64, divisor: f64) -> CodeResult<f64> {
    let result = dividend / divisor;
    match result.is_finite() {
        true => Ok(result),
        false => Err(RunErrorMsg::DivideByZero.with_span(span)),
    }
}
