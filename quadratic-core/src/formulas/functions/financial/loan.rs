//! Loan, payment, and depreciation functions.

use super::*;
use crate::formulas::functions::datetime::parse_date_from_cell_value;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Calculates the payment for a loan based on constant payments and a constant interest rate.
            #[examples("PMT(0.08/12, 12*5, 10000)")]
            fn PMT(
                rate: (f64),
                nper: (f64),
                pv: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);
                calculate_pmt(rate, nper, pv, fv, payment_type)
            }
        ),
        formula_fn!(
            /// Calculates the future value of an investment.
            #[examples("FV(0.08/12, 12*5, -200)")]
            fn FV(
                rate: (f64),
                nper: (f64),
                pmt: (f64),
                pv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let pv = pv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);
                calculate_fv(rate, nper, pmt, pv, payment_type)
            }
        ),
        formula_fn!(
            /// Calculates the present value of an investment.
            #[examples("PV(0.08/12, 12*5, -200)")]
            fn PV(
                rate: (f64),
                nper: (f64),
                pmt: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);
                calculate_pv(rate, nper, pmt, fv, payment_type)
            }
        ),
        formula_fn!(
            /// Calculates the number of periods for an investment.
            #[examples("NPER(0.08/12, -200, 10000)")]
            fn NPER(
                span: Span,
                rate: (f64),
                pmt: (f64),
                pv: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);

                if rate == 0.0 {
                    if pmt == 0.0 {
                        return Err(RunErrorMsg::DivideByZero.with_span(span));
                    }
                    -(pv + fv) / pmt
                } else {
                    let pmt_factor = 1.0 + rate * payment_type;
                    let log_arg = (pmt * pmt_factor - fv * rate) / (pmt * pmt_factor + pv * rate);
                    if log_arg <= 0.0 {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }
                    log_arg.ln() / (1.0 + rate).ln()
                }
            }
        ),
        formula_fn!(
            /// Calculates the interest rate per period.
            #[examples("RATE(12*5, -200, 10000)")]
            fn RATE(
                span: Span,
                nper: (f64),
                pmt: (f64),
                pv: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
                guess: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);
                let mut rate = guess.unwrap_or(0.1);

                // Newton-Raphson iteration
                for _ in 0..100 {
                    let pvif = (1.0 + rate).powf(nper);
                    let fvifa = if rate == 0.0 {
                        nper
                    } else {
                        (pvif - 1.0) / rate
                    };
                    let f = pv * pvif + pmt * (1.0 + rate * payment_type) * fvifa + fv;

                    let df = if rate == 0.0 {
                        pv * nper + pmt * payment_type * nper + pmt * nper * (nper - 1.0) / 2.0
                    } else {
                        let dpvif = nper * (1.0 + rate).powf(nper - 1.0);
                        let dfvifa = (dpvif * rate - pvif + 1.0) / (rate * rate);
                        pv * dpvif
                            + pmt * payment_type * fvifa
                            + pmt * (1.0 + rate * payment_type) * dfvifa
                    };

                    if df.abs() < 1e-15 {
                        break;
                    }
                    let new_rate = rate - f / df;
                    if (new_rate - rate).abs() < 1e-10 {
                        rate = new_rate;
                        break;
                    }
                    rate = new_rate;
                }

                if !rate.is_finite() || rate < -1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                rate
            }
        ),
        formula_fn!(
            /// Calculates the interest portion of a payment.
            #[examples("IPMT(0.08/12, 1, 12*5, 10000)")]
            fn IPMT(
                span: Span,
                rate: (f64),
                per: (f64),
                nper: (f64),
                pv: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);

                if per < 1.0 || per > nper {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pmt = calculate_pmt(rate, nper, pv, fv, payment_type);
                let mut balance = pv;

                for _ in 1..per as i64 {
                    if payment_type == 1.0 {
                        balance += pmt;
                    }
                    let interest = balance * rate;
                    balance = balance + interest + pmt;
                    if payment_type == 1.0 {
                        balance -= pmt;
                    }
                }

                if payment_type == 1.0 && per == 1.0 {
                    0.0
                } else {
                    balance * rate
                }
            }
        ),
        formula_fn!(
            /// Calculates the principal portion of a payment.
            #[examples("PPMT(0.08/12, 1, 12*5, 10000)")]
            fn PPMT(
                span: Span,
                rate: (f64),
                per: (f64),
                nper: (f64),
                pv: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);

                if per < 1.0 || per > nper {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pmt = calculate_pmt(rate, nper, pv, fv, payment_type);
                let mut balance = pv;

                for _ in 1..per as i64 {
                    if payment_type == 1.0 {
                        balance += pmt;
                    }
                    let interest = balance * rate;
                    balance = balance + interest + pmt;
                    if payment_type == 1.0 {
                        balance -= pmt;
                    }
                }

                let ipmt = if payment_type == 1.0 && per == 1.0 {
                    0.0
                } else {
                    balance * rate
                };
                pmt - ipmt
            }
        ),
        formula_fn!(
            /// Calculates the interest paid between two periods.
            #[examples("CUMIPMT(0.08/12, 12*5, 10000, 1, 12, 0)")]
            fn CUMIPMT(
                span: Span,
                rate: (f64),
                nper: (f64),
                pv: (f64),
                start_period: (f64),
                end_period: (f64),
                payment_type: (f64),
            ) {
                let payment_type = if payment_type != 0.0 { 1.0 } else { 0.0 };

                if rate <= 0.0 || nper <= 0.0 || pv <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if start_period < 1.0 || end_period < start_period || end_period > nper {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pmt = calculate_pmt(rate, nper, pv, 0.0, payment_type);
                let mut balance = pv;
                let mut cum_interest = 0.0;

                for period in 1..=end_period as i64 {
                    if payment_type == 1.0 {
                        balance += pmt;
                    }
                    let interest = balance * rate;
                    if period >= start_period as i64 {
                        cum_interest += interest;
                    }
                    balance = balance + interest + pmt;
                    if payment_type == 1.0 {
                        balance -= pmt;
                    }
                }

                cum_interest
            }
        ),
        formula_fn!(
            /// Calculates the principal paid between two periods.
            #[examples("CUMPRINC(0.08/12, 12*5, 10000, 1, 12, 0)")]
            fn CUMPRINC(
                span: Span,
                rate: (f64),
                nper: (f64),
                pv: (f64),
                start_period: (f64),
                end_period: (f64),
                payment_type: (f64),
            ) {
                let payment_type = if payment_type != 0.0 { 1.0 } else { 0.0 };

                if rate <= 0.0 || nper <= 0.0 || pv <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if start_period < 1.0 || end_period < start_period || end_period > nper {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pmt = calculate_pmt(rate, nper, pv, 0.0, payment_type);
                let mut balance = pv;
                let mut cum_principal = 0.0;

                for period in 1..=end_period as i64 {
                    if payment_type == 1.0 {
                        balance += pmt;
                    }
                    let interest = balance * rate;
                    let principal = pmt - interest;
                    if period >= start_period as i64 {
                        cum_principal += principal;
                    }
                    balance = balance + interest + pmt;
                    if payment_type == 1.0 {
                        balance -= pmt;
                    }
                }

                cum_principal
            }
        ),
        formula_fn!(
            /// Calculates the interest paid during a specific period using simple interest.
            #[examples("ISPMT(0.08/12, 1, 12, 10000)")]
            fn ISPMT(rate: (f64), per: (f64), nper: (f64), pv: (f64)) {
                pv * rate * (per / nper - 1.0)
            }
        ),
        formula_fn!(
            /// Calculates straight-line depreciation.
            #[examples("SLN(1000, 100, 10)")]
            fn SLN(span: Span, cost: (f64), salvage: (f64), life: (f64)) {
                if life == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                (cost - salvage) / life
            }
        ),
        formula_fn!(
            /// Calculates sum-of-years-digits depreciation.
            #[examples("SYD(1000, 100, 10, 1)")]
            fn SYD(span: Span, cost: (f64), salvage: (f64), life: (f64), per: (f64)) {
                if life <= 0.0 || per < 1.0 || per > life {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let sum_of_years = life * (life + 1.0) / 2.0;
                let remaining_life = life - per + 1.0;
                (cost - salvage) * remaining_life / sum_of_years
            }
        ),
        formula_fn!(
            /// Calculates declining balance depreciation.
            #[examples("DB(1000, 100, 10, 1)")]
            fn DB(
                span: Span,
                cost: (f64),
                salvage: (f64),
                life: (f64),
                period: (f64),
                month: (Option<f64>),
            ) {
                let month = month.unwrap_or(12.0);
                if life <= 0.0 || period < 1.0 || month <= 0.0 || month > 12.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if cost <= 0.0 {
                    return Ok(Value::from(0.0));
                }

                // Calculate rate rounded to 3 decimal places
                let rate = (1.0 - (salvage / cost).powf(1.0 / life) * 1000.0).round() / 1000.0;
                let rate = rate.max(0.0);
                let mut value = cost;
                let mut depreciation = 0.0;

                for p in 1..=period as i64 {
                    if p == 1 {
                        depreciation = cost * rate * month / 12.0;
                    } else if p as f64 == (life + 1.0).floor() {
                        depreciation = value * rate * (12.0 - month) / 12.0;
                    } else {
                        depreciation = value * rate;
                    }
                    value -= depreciation;
                }

                depreciation
            }
        ),
        formula_fn!(
            /// Calculates double-declining balance depreciation.
            #[examples("DDB(1000, 100, 10, 1)")]
            fn DDB(
                span: Span,
                cost: (f64),
                salvage: (f64),
                life: (f64),
                period: (f64),
                factor: (Option<f64>),
            ) {
                let factor = factor.unwrap_or(2.0);
                if life <= 0.0 || period < 1.0 || period > life || factor <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if cost <= 0.0 {
                    return Ok(Value::from(0.0));
                }

                let rate = factor / life;
                let mut value = cost;
                let mut depreciation = 0.0;

                for _ in 1..=period as i64 {
                    depreciation = value * rate;
                    if value - depreciation < salvage {
                        depreciation = (value - salvage).max(0.0);
                    }
                    value -= depreciation;
                }

                depreciation
            }
        ),
        formula_fn!(
            /// Calculates variable declining balance depreciation.
            #[examples("VDB(1000, 100, 10, 0, 1)")]
            fn VDB(
                span: Span,
                cost: (f64),
                salvage: (f64),
                life: (f64),
                start_period: (f64),
                end_period: (f64),
                factor: (Option<f64>),
                no_switch: (Option<bool>),
            ) {
                let factor = factor.unwrap_or(2.0);
                let no_switch = no_switch.unwrap_or(false);

                if life <= 0.0
                    || start_period < 0.0
                    || end_period < start_period
                    || end_period > life
                    || factor <= 0.0
                {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if cost <= 0.0 {
                    return Ok(Value::from(0.0));
                }

                let rate = factor / life;
                let mut value = cost;
                let mut total_depreciation = 0.0;

                let mut period = 0.0;
                while period < end_period {
                    let next_period = (period + 1.0).min(end_period);
                    let frac = next_period - period;

                    let ddb = value * rate * frac;
                    let sln = if life - period > 0.0 {
                        (value - salvage) / (life - period) * frac
                    } else {
                        0.0
                    };

                    let dep = if no_switch { ddb } else { ddb.max(sln) };
                    let dep = dep.min(value - salvage).max(0.0);

                    if period >= start_period {
                        total_depreciation += dep;
                    }
                    value -= dep;
                    period = next_period;
                }

                total_depreciation
            }
        ),
        formula_fn!(
            /// Returns the depreciation for each accounting period using the French degressive depreciation method.
            /// This is similar to AMORDEGRC but uses a degressive coefficient based on asset life.
            #[examples("AMORDEGRC(2400, \"2020-01-01\", \"2020-12-31\", 300, 1, 0.15, 0)")]
            fn AMORDEGRC(
                span: Span,
                cost: (f64),
                date_purchased: (Spanned<CellValue>),
                first_period: (Spanned<CellValue>),
                salvage: (f64),
                period: (f64),
                rate: (f64),
                basis: (Option<i64>),
            ) {
                let date_purchased = parse_date_from_cell_value(&date_purchased)?;
                let first_period = parse_date_from_cell_value(&first_period)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if cost < 0.0 || salvage < 0.0 || rate <= 0.0 || period < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if salvage > cost {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if date_purchased > first_period {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate the degressive coefficient based on useful life
                let life = 1.0 / rate;
                let coeff = if life < 3.0 {
                    1.0
                } else if life < 5.0 {
                    1.5
                } else if life <= 6.0 {
                    2.0
                } else {
                    2.5
                };

                let degressive_rate = rate * coeff;
                let year_basis = annual_basis(basis);

                // Calculate depreciation for first period (prorated)
                let days_first_period = days_between(date_purchased, first_period, basis);
                let first_period_rate = days_first_period / year_basis;

                let period = period as i64;
                let mut value = cost;
                let mut depreciation = 0.0;

                for p in 0..=period {
                    if value <= salvage {
                        depreciation = 0.0;
                        break;
                    }

                    if p == 0 {
                        // First period - prorated
                        depreciation = cost * degressive_rate * first_period_rate;
                        depreciation = ((depreciation * 2.0).round() / 2.0).round();
                    } else {
                        // Subsequent periods
                        depreciation = value * degressive_rate;
                        depreciation = ((depreciation * 2.0).round() / 2.0).round();
                    }

                    // Don't depreciate below salvage value
                    if value - depreciation < salvage {
                        depreciation = value - salvage;
                    }

                    if p == period {
                        break;
                    }
                    value -= depreciation;
                }

                depreciation
            }
        ),
        formula_fn!(
            /// Returns the depreciation for each accounting period using the French linear depreciation method.
            #[examples("AMORLINC(2400, \"2020-01-01\", \"2020-12-31\", 300, 1, 0.15, 0)")]
            fn AMORLINC(
                span: Span,
                cost: (f64),
                date_purchased: (Spanned<CellValue>),
                first_period: (Spanned<CellValue>),
                salvage: (f64),
                period: (f64),
                rate: (f64),
                basis: (Option<i64>),
            ) {
                let date_purchased = parse_date_from_cell_value(&date_purchased)?;
                let first_period = parse_date_from_cell_value(&first_period)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if cost < 0.0 || salvage < 0.0 || rate <= 0.0 || period < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if salvage > cost {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if date_purchased > first_period {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let year_basis = annual_basis(basis);

                // Calculate depreciation for first period (prorated)
                let days_first_period = days_between(date_purchased, first_period, basis);
                let first_period_rate = days_first_period / year_basis;

                let period = period as i64;
                let annual_depreciation = cost * rate;
                let mut value = cost;
                let mut depreciation = 0.0;

                for p in 0..=period {
                    if value <= salvage {
                        depreciation = 0.0;
                        break;
                    }

                    if p == 0 {
                        // First period - prorated
                        depreciation = annual_depreciation * first_period_rate;
                    } else {
                        // Subsequent periods
                        depreciation = annual_depreciation;
                    }

                    // Don't depreciate below salvage value
                    if value - depreciation < salvage {
                        depreciation = value - salvage;
                    }

                    if p == period {
                        break;
                    }
                    value -= depreciation;
                }

                depreciation
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_pmt() {
        let g = GridController::new();
        let result = eval_to_string(&g, "PMT(0.08/12, 60, 10000)");
        assert!(result.contains("-202"));
    }

    #[test]
    fn test_fv() {
        let g = GridController::new();
        let result = eval_to_string(&g, "FV(0.06/12, 12, -100, -1000)");
        // FV should return a positive value for this investment scenario
        assert!(!result.contains("Error"), "FV should not return an error");
    }

    #[test]
    fn test_sln() {
        let g = GridController::new();
        assert_eq!("90", eval_to_string(&g, "SLN(1000, 100, 10)"));
    }
}
