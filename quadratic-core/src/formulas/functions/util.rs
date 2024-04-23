use super::*;

/// Divides one number by another, handling the error case of division by zero.
pub fn checked_div(span: impl Into<Span>, dividend: f64, divisor: f64) -> CodeResult<f64> {
    let result = dividend / divisor;
    match result.is_finite() {
        true => Ok(result),
        false => Err(RunErrorMsg::DivideByZero.with_span(span)),
    }
}

pub fn average(
    span: impl Into<Span>,
    numbers: impl IntoIterator<Item = CodeResult<f64>>,
) -> CodeResult<f64> {
    let mut sum = 0.0;
    let mut count = 0;
    for n in numbers {
        sum += n?;
        count += 1;
    }
    util::checked_div(span, sum, count as f64)
}

pub fn pmt(rate: f64, nper: f64, pv: f64, fv: f64) -> CodeResult<f64> {
    let is_rate_zero = rate == 0.0;
    let temp = (1.0 + rate).powf(nper);
    let masked_rate = if is_rate_zero { 1.0 } else { rate };
    let fact = if is_rate_zero {
        nper
    } else {
        ((1.0 + masked_rate) * (temp - 1.0)) / masked_rate
    };
    let pmt = (-1.0 * (fv + pv * temp) / fact).abs();
    Ok(pmt)
}
