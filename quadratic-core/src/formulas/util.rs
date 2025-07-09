use rust_decimal::Decimal;

use crate::{CodeResult, RunErrorMsg, Span};

/// Divides one number by another, return an error in case of division by zero.
pub fn checked_div(
    span: impl Into<Span>,
    dividend: Decimal,
    divisor: Decimal,
) -> CodeResult<Decimal> {
    match Decimal::checked_div(dividend, divisor) {
        Some(result) => Ok(result),
        None => Err(RunErrorMsg::DivideByZero.with_span(span)),
    }
}
