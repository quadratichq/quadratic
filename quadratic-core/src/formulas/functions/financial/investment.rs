//! Investment, NPV, and IRR functions.

use super::*;
use crate::formulas::functions::datetime::parse_date_from_cell_value;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Calculates the net present value of an investment.
            #[examples("NPV(0.1, {-10000, 3000, 4200, 6800})")]
            fn NPV(_span: Span, rate: (f64), values: (Iter<f64>)) {
                let mut npv = 0.0;
                let mut period = 1;
                for value in values {
                    let v = value?;
                    npv += v / (1.0 + rate).powi(period);
                    period += 1;
                }
                npv
            }
        ),
        formula_fn!(
            /// Calculates the internal rate of return.
            #[examples("IRR({-10000, 3000, 4200, 6800})")]
            fn IRR(span: Span, values: (Spanned<Array>), guess: (Option<f64>)) {
                let mut cash_flows: Vec<f64> = Vec::new();
                for cv in values.inner.cell_values_slice().iter() {
                    let v: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    cash_flows.push(v);
                }

                if cash_flows.len() < 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Check for at least one positive and one negative value
                let has_positive = cash_flows.iter().any(|&v| v > 0.0);
                let has_negative = cash_flows.iter().any(|&v| v < 0.0);
                if !has_positive || !has_negative {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Newton-Raphson method
                let mut rate = guess.unwrap_or(0.1);
                for _ in 0..100 {
                    let mut npv = 0.0;
                    let mut dnpv = 0.0;
                    for (i, &cf) in cash_flows.iter().enumerate() {
                        let factor = (1.0 + rate).powi(i as i32);
                        npv += cf / factor;
                        dnpv -= (i as f64) * cf / factor / (1.0 + rate);
                    }
                    if dnpv.abs() < 1e-15 {
                        break;
                    }
                    let new_rate = rate - npv / dnpv;
                    if (new_rate - rate).abs() < 1e-10 {
                        rate = new_rate;
                        break;
                    }
                    rate = new_rate;
                }

                if !rate.is_finite() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                rate
            }
        ),
        formula_fn!(
            /// Calculates the modified internal rate of return.
            #[examples("MIRR({-10000, 3000, 4200, 6800}, 0.1, 0.12)")]
            fn MIRR(
                span: Span,
                values: (Spanned<Array>),
                finance_rate: (f64),
                reinvest_rate: (f64),
            ) {
                let mut cash_flows: Vec<f64> = Vec::new();
                for cv in values.inner.cell_values_slice().iter() {
                    let v: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    cash_flows.push(v);
                }

                let n = cash_flows.len();
                if n < 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate NPV of negative cash flows (at finance_rate)
                let mut npv_neg = 0.0;
                // Calculate FV of positive cash flows (at reinvest_rate)
                let mut fv_pos = 0.0;

                for (i, &cf) in cash_flows.iter().enumerate() {
                    if cf < 0.0 {
                        npv_neg += cf / (1.0 + finance_rate).powi(i as i32);
                    } else {
                        fv_pos += cf * (1.0 + reinvest_rate).powi((n - 1 - i) as i32);
                    }
                }

                if npv_neg == 0.0 || fv_pos == 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                (-fv_pos / npv_neg).powf(1.0 / (n - 1) as f64) - 1.0
            }
        ),
        formula_fn!(
            /// Calculates the net present value for non-periodic cash flows.
            #[examples("XNPV(0.1, {-10000, 3000}, {\"2021-01-01\", \"2021-06-01\"})")]
            fn XNPV(span: Span, rate: (f64), values: (Spanned<Array>), dates: (Spanned<Array>)) {
                let values_slice = values.inner.cell_values_slice();
                let dates_slice = dates.inner.cell_values_slice();

                if values_slice.len() != dates_slice.len() || values_slice.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let first_date_spanned = Spanned {
                    span: dates.span,
                    inner: dates_slice[0].clone(),
                };
                let first_date = parse_date_from_cell_value(&first_date_spanned)?;

                let mut xnpv = 0.0;
                for (i, cv) in values_slice.iter().enumerate() {
                    let v: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    let date_spanned = Spanned {
                        span: dates.span,
                        inner: dates_slice[i].clone(),
                    };
                    let date = parse_date_from_cell_value(&date_spanned)?;
                    let days = (date - first_date).num_days() as f64;
                    xnpv += v / (1.0 + rate).powf(days / 365.0);
                }

                xnpv
            }
        ),
        formula_fn!(
            /// Calculates the internal rate of return for non-periodic cash flows.
            #[examples("XIRR({-10000, 3000}, {\"2021-01-01\", \"2021-06-01\"})")]
            fn XIRR(
                span: Span,
                values: (Spanned<Array>),
                dates: (Spanned<Array>),
                guess: (Option<f64>),
            ) {
                let values_slice = values.inner.cell_values_slice();
                let dates_slice = dates.inner.cell_values_slice();

                if values_slice.len() != dates_slice.len() || values_slice.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let first_date_spanned = Spanned {
                    span: dates.span,
                    inner: dates_slice[0].clone(),
                };
                let first_date = parse_date_from_cell_value(&first_date_spanned)?;

                let mut cash_flows: Vec<(f64, f64)> = Vec::new();
                for (i, cv) in values_slice.iter().enumerate() {
                    let v: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    let date_spanned = Spanned {
                        span: dates.span,
                        inner: dates_slice[i].clone(),
                    };
                    let date = parse_date_from_cell_value(&date_spanned)?;
                    let days = (date - first_date).num_days() as f64;
                    cash_flows.push((v, days / 365.0));
                }

                // Newton-Raphson method
                let mut rate = guess.unwrap_or(0.1);
                for _ in 0..100 {
                    let mut xnpv = 0.0;
                    let mut dxnpv = 0.0;
                    for &(cf, years) in &cash_flows {
                        let factor = (1.0 + rate).powf(years);
                        xnpv += cf / factor;
                        if years != 0.0 {
                            dxnpv -= years * cf / factor / (1.0 + rate);
                        }
                    }
                    if dxnpv.abs() < 1e-15 {
                        break;
                    }
                    let new_rate = rate - xnpv / dxnpv;
                    if (new_rate - rate).abs() < 1e-10 {
                        rate = new_rate;
                        break;
                    }
                    rate = new_rate;
                }

                if !rate.is_finite() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                rate
            }
        ),
        formula_fn!(
            /// Calculates the future value of an initial principal after compound interest.
            #[examples("FVSCHEDULE(1000, {0.09, 0.11, 0.1})")]
            fn FVSCHEDULE(span: Span, principal: (f64), schedule: (Spanned<Array>)) {
                let mut fv = principal;
                for cv in schedule.inner.cell_values_slice().iter() {
                    let rate: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    fv *= 1.0 + rate;
                }
                fv
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_npv() {
        let g = GridController::new();
        let result = eval_to_string(&g, "NPV(0.1, -10000, 3000, 4200, 6800)");
        assert!(result.contains("1188") || result.contains("1189"));
    }

    #[test]
    fn test_fvschedule() {
        let g = GridController::new();
        let result = eval_to_string(&g, "FVSCHEDULE(1000, {0.09, 0.11, 0.1})");
        // FVSCHEDULE should return a value without error
        assert!(
            !result.contains("Error"),
            "FVSCHEDULE should not return an error"
        );
    }
}
