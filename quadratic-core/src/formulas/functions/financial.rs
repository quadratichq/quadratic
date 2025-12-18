use chrono::{Datelike, Months, NaiveDate};

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Financial functions",
    docs: Some(
        "Financial functions for calculating loan payments, interest rates, and other financial calculations.",
    ),
    get_functions,
};

/// Helper function to calculate payment (PMT)
fn calculate_pmt(rate: f64, nper: f64, pv: f64, fv: f64, payment_type: f64) -> f64 {
    if rate == 0.0 {
        -(pv + fv) / nper
    } else {
        let pvif = (1.0 + rate).powf(nper);
        let pmt = rate * (pv * pvif + fv) / (pvif - 1.0);
        -pmt / (1.0 + rate * payment_type)
    }
}

/// Helper function to calculate future value (FV)
fn calculate_fv(rate: f64, nper: f64, pmt: f64, pv: f64, payment_type: f64) -> f64 {
    if rate == 0.0 {
        -(pv + pmt * nper)
    } else {
        let pvif = (1.0 + rate).powf(nper);
        let fvifa = (pvif - 1.0) / rate;
        -pv * pvif - pmt * (1.0 + rate * payment_type) * fvifa
    }
}

/// Helper function to calculate present value (PV)
fn calculate_pv(rate: f64, nper: f64, pmt: f64, fv: f64, payment_type: f64) -> f64 {
    if rate == 0.0 {
        -(fv + pmt * nper)
    } else {
        let pvif = (1.0 + rate).powf(nper);
        let fvifa = (pvif - 1.0) / rate;
        (-fv - pmt * (1.0 + rate * payment_type) * fvifa) / pvif
    }
}

/// Helper function to normalize payment_type to 0 or 1
fn normalize_payment_type(payment_type: Option<f64>) -> f64 {
    if payment_type.unwrap_or(0.0) != 0.0 {
        1.0
    } else {
        0.0
    }
}

/// Validates and converts frequency to months per coupon period
/// Returns Ok(months) or Err if frequency is invalid
fn frequency_to_months(frequency: i64) -> Option<u32> {
    match frequency {
        1 => Some(12), // Annual
        2 => Some(6),  // Semi-annual
        4 => Some(3),  // Quarterly
        _ => None,
    }
}

/// Validates the basis (day count convention)
/// Returns true if valid (0-4)
fn is_valid_basis(basis: i64) -> bool {
    (0..=4).contains(&basis)
}

/// Adjusts a date to match the maturity date's day-of-month as closely as possible.
/// Handles end-of-month situations correctly.
fn adjust_day_to_match(target_year: i32, target_month: u32, maturity: NaiveDate) -> NaiveDate {
    let mat_day = maturity.day();
    // Try to use the maturity day, but clamp to the last day of the target month
    let days_in_month = last_day_of_month(target_year, target_month);
    let day = mat_day.min(days_in_month);
    NaiveDate::from_ymd_opt(target_year, target_month, day).unwrap()
}

/// Returns the last day of the given month
fn last_day_of_month(year: i32, month: u32) -> u32 {
    // Get the first day of the next month and subtract one day
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .and_then(|d| d.pred_opt())
        .map(|d| d.day())
        .unwrap_or(28)
}

/// Finds the previous coupon date (COUPPCD) - the last coupon date on or before the settlement date
fn find_previous_coupon_date(
    settlement: NaiveDate,
    maturity: NaiveDate,
    frequency: i64,
) -> Option<NaiveDate> {
    let months_per_period = frequency_to_months(frequency)?;

    // Start from maturity and work backwards
    let mut coupon_date = maturity;

    // If settlement is on or after maturity, invalid
    if settlement >= maturity {
        return None;
    }

    // Work backwards from maturity until we find a coupon date <= settlement
    while coupon_date > settlement {
        coupon_date = coupon_date.checked_sub_months(Months::new(months_per_period))?;
    }

    // Adjust day to match maturity date's day pattern
    Some(adjust_day_to_match(
        coupon_date.year(),
        coupon_date.month(),
        maturity,
    ))
}

/// Finds the next coupon date (COUPNCD) - the first coupon date after the settlement date
fn find_next_coupon_date(
    settlement: NaiveDate,
    maturity: NaiveDate,
    frequency: i64,
) -> Option<NaiveDate> {
    let months_per_period = frequency_to_months(frequency)?;

    // If settlement is on or after maturity, invalid
    if settlement >= maturity {
        return None;
    }

    // Find the previous coupon date first
    let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency)?;

    // Next coupon date is one period after previous
    let next = prev_coupon.checked_add_months(Months::new(months_per_period))?;

    // Adjust day to match maturity date's day pattern
    Some(adjust_day_to_match(next.year(), next.month(), maturity))
}

/// Counts the number of coupons remaining between settlement and maturity
fn count_coupons(settlement: NaiveDate, maturity: NaiveDate, frequency: i64) -> Option<i64> {
    let months_per_period = frequency_to_months(frequency)?;

    // If settlement is on or after maturity, invalid
    if settlement >= maturity {
        return None;
    }

    // Find the next coupon date and count from there
    let mut next_coupon = find_next_coupon_date(settlement, maturity, frequency)?;
    let mut count = 0i64;

    while next_coupon <= maturity {
        count += 1;
        next_coupon = next_coupon.checked_add_months(Months::new(months_per_period))?;
        // Adjust day to match maturity date's day pattern
        next_coupon = adjust_day_to_match(next_coupon.year(), next_coupon.month(), maturity);
    }

    Some(count)
}

/// Calculates days between two dates according to the 30/360 US (NASD) convention
fn days_30_360_us(start: NaiveDate, end: NaiveDate) -> i64 {
    let mut d1 = start.day() as i64;
    let mut d2 = end.day() as i64;
    let m1 = start.month() as i64;
    let mut m2 = end.month() as i64;
    let y1 = start.year() as i64;
    let y2 = end.year() as i64;

    // NASD method adjustments
    if d1 == 31 {
        d1 = 30;
    }
    if d2 == 31 && d1 >= 30 {
        d2 = 30;
    }

    // Handle February end-of-month
    let is_feb_eom = |d: &NaiveDate| d.month() == 2 && d.day() == last_day_of_month(d.year(), 2);
    if is_feb_eom(&start) {
        d1 = 30;
        if is_feb_eom(&end) {
            d2 = 30;
        }
    }

    // Adjust month if d2 became 30 due to above
    if d2 == 30 && end.day() == 31 {
        m2 = end.month() as i64;
    }

    360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1)
}

/// Calculates days between two dates according to the 30/360 European convention
fn days_30_360_eu(start: NaiveDate, end: NaiveDate) -> i64 {
    let mut d1 = start.day() as i64;
    let mut d2 = end.day() as i64;
    let m1 = start.month() as i64;
    let m2 = end.month() as i64;
    let y1 = start.year() as i64;
    let y2 = end.year() as i64;

    // European method: if day is 31, change to 30
    if d1 == 31 {
        d1 = 30;
    }
    if d2 == 31 {
        d2 = 30;
    }

    360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1)
}

/// Calculates the actual number of days between two dates
fn days_actual(start: NaiveDate, end: NaiveDate) -> i64 {
    (end - start).num_days()
}

/// Calculates days in the coupon period based on the basis
fn coupon_days_in_period(
    prev_coupon: NaiveDate,
    next_coupon: NaiveDate,
    frequency: i64,
    basis: i64,
) -> f64 {
    match basis {
        0 => 360.0 / frequency as f64,                     // 30/360 US
        1 => days_actual(prev_coupon, next_coupon) as f64, // Actual/Actual
        2 => 360.0 / frequency as f64,                     // Actual/360
        3 => 365.0 / frequency as f64,                     // Actual/365
        4 => 360.0 / frequency as f64,                     // 30/360 European
        _ => 360.0 / frequency as f64,
    }
}

/// Calculates days from start of coupon period to a date based on the basis
fn coupon_days_from_start(start: NaiveDate, date: NaiveDate, basis: i64) -> f64 {
    match basis {
        0 => days_30_360_us(start, date) as f64,
        1 | 2 | 3 => days_actual(start, date) as f64,
        4 => days_30_360_eu(start, date) as f64,
        _ => days_30_360_us(start, date) as f64,
    }
}

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Calculates the payment for a loan based on constant payments and a constant interest rate.
            ///
            /// - rate: The interest rate per period (e.g., 0.08/12 for 8% annual rate with monthly payments)
            /// - nper: The total number of payments (e.g., 5*12 for 5 years of monthly payments)
            /// - pv: The present value (the loan amount)
            /// - [fv]: The future value (default 0)
            /// - [type]: When payments are due (0=end of period, 1=beginning of period, default 0)
            ///
            /// Returns the negative of the payment amount (since it represents money you pay out).
            #[examples("PMT(0.08/12, 12*5, 10000)", "PMT(0.06/12, 24, 5000, 0, 1)")]
            fn PMT(
                rate: (f64),
                nper: (f64),
                pv: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);
                let payment = calculate_pmt(rate, nper, pv, fv, payment_type);
                Ok(CellValue::from(payment))
            }
        ),
        formula_fn!(
            /// Calculates the future value of an investment based on constant payments and a constant interest rate.
            ///
            /// - rate: The interest rate per period
            /// - nper: The total number of payment periods
            /// - pmt: The payment made each period (typically negative for payments out)
            /// - [pv]: The present value (default 0)
            /// - [type]: When payments are due (0=end of period, 1=beginning of period, default 0)
            #[examples("FV(0.06/12, 10, -200, -500, 1)", "FV(0.08/12, 12*5, -200)")]
            fn FV(
                rate: (f64),
                nper: (f64),
                pmt: (f64),
                pv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let pv = pv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);
                let fv = calculate_fv(rate, nper, pmt, pv, payment_type);
                Ok(CellValue::from(fv))
            }
        ),
        formula_fn!(
            /// Calculates the present value of an investment based on constant payments and a constant interest rate.
            ///
            /// - rate: The interest rate per period
            /// - nper: The total number of payment periods
            /// - pmt: The payment made each period (typically negative for payments out)
            /// - [fv]: The future value (default 0)
            /// - [type]: When payments are due (0=end of period, 1=beginning of period, default 0)
            #[examples("PV(0.08/12, 12*5, -200)", "PV(0.06/12, 24, -250, 1000, 1)")]
            fn PV(
                rate: (f64),
                nper: (f64),
                pmt: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {
                let fv = fv.unwrap_or(0.0);
                let payment_type = normalize_payment_type(payment_type);
                let pv = calculate_pv(rate, nper, pmt, fv, payment_type);
                Ok(CellValue::from(pv))
            }
        ),
        formula_fn!(
            /// Calculates the number of periods for an investment based on constant payments and a constant interest rate.
            ///
            /// - rate: The interest rate per period
            /// - pmt: The payment made each period (typically negative for payments out)
            /// - pv: The present value
            /// - [fv]: The future value (default 0)
            /// - [type]: When payments are due (0=end of period, 1=beginning of period, default 0)
            #[examples("NPER(0.08/12, -200, 8000)", "NPER(0.06/12, -250, 10000, 0, 1)")]
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

                let nper = if rate == 0.0 {
                    -(pv + fv) / pmt
                } else {
                    // NPER = ln((PMT*(1+r*type) - FV*r) / (PMT*(1+r*type) + PV*r)) / ln(1+r)
                    let pmt_adj = pmt * (1.0 + rate * payment_type);
                    let numerator = pmt_adj - fv * rate;
                    let denominator = pmt_adj + pv * rate;
                    let ratio = numerator / denominator;
                    if ratio <= 0.0 {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }
                    ratio.ln() / (1.0 + rate).ln()
                };

                Ok(CellValue::from(nper))
            }
        ),
        formula_fn!(
            /// Calculates the interest rate per period for an investment.
            ///
            /// Uses Newton-Raphson iteration to find the rate.
            ///
            /// - nper: The total number of payment periods
            /// - pmt: The payment made each period (typically negative for payments out)
            /// - pv: The present value
            /// - [fv]: The future value (default 0)
            /// - [type]: When payments are due (0=end of period, 1=beginning of period, default 0)
            /// - [guess]: An initial guess for the rate (default 0.1)
            #[examples("RATE(60, -200, 10000)", "RATE(24, -500, 10000, 0, 0, 0.05)")]
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

                const MAX_ITERATIONS: i32 = 100;
                const TOLERANCE: f64 = 1e-10;

                let mut converged = false;
                let mut error_occurred = false;

                for _ in 0..MAX_ITERATIONS {
                    let pvif = (1.0 + rate).powf(nper);
                    let fvifa = if rate == 0.0 {
                        nper
                    } else {
                        (pvif - 1.0) / rate
                    };

                    // f(rate) = pv + pmt*(1+rate*type)*fvifa + fv/pvif = 0
                    let f = pv * pvif + pmt * (1.0 + rate * payment_type) * fvifa + fv;

                    // Derivative of f with respect to rate
                    let f_prime = if rate == 0.0 {
                        pv * nper + pmt * payment_type * nper + pmt * nper * (nper - 1.0) / 2.0
                    } else {
                        let dpvif = nper * (1.0 + rate).powf(nper - 1.0);
                        let dfvifa = (dpvif * rate - (pvif - 1.0)) / (rate * rate);
                        pv * dpvif
                            + pmt * payment_type * fvifa
                            + pmt * (1.0 + rate * payment_type) * dfvifa
                    };

                    if f_prime.abs() < 1e-20 {
                        error_occurred = true;
                        break;
                    }

                    let new_rate = rate - f / f_prime;

                    if (new_rate - rate).abs() < TOLERANCE {
                        rate = new_rate;
                        converged = true;
                        break;
                    }

                    rate = new_rate;
                }

                if error_occurred || !converged {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                Ok(CellValue::from(rate))
            }
        ),
        formula_fn!(
            /// Calculates the interest payment for a specific period of an investment.
            ///
            /// - rate: The interest rate per period
            /// - per: The period for which you want to find the interest (1 to nper)
            /// - nper: The total number of payment periods
            /// - pv: The present value
            /// - [fv]: The future value (default 0)
            /// - [type]: When payments are due (0=end of period, 1=beginning of period, default 0)
            #[examples("IPMT(0.08/12, 1, 12*5, 10000)", "IPMT(0.06/12, 6, 24, 5000, 0, 1)")]
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
                let per = per as i64;

                if per < 1 || per > nper as i64 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // For beginning of period type, first payment doesn't include interest
                if payment_type == 1.0 && per == 1 {
                    return Ok(Value::Single(CellValue::from(0.0)));
                }

                let pmt = calculate_pmt(rate, nper, pv, fv, payment_type);

                // Calculate the remaining balance at the start of the period
                // FV gives us the negative of the remaining balance
                let periods = per - 1;
                let fv_val = calculate_fv(rate, periods as f64, pmt, pv, payment_type);

                // Interest is the balance times the rate
                // FV is negative of balance, so interest = fv_val * rate
                let interest = if payment_type == 1.0 {
                    fv_val * rate / (1.0 + rate)
                } else {
                    fv_val * rate
                };

                Ok(CellValue::from(interest))
            }
        ),
        formula_fn!(
            /// Calculates the principal payment for a specific period of an investment.
            ///
            /// - rate: The interest rate per period
            /// - per: The period for which you want to find the principal (1 to nper)
            /// - nper: The total number of payment periods
            /// - pv: The present value
            /// - [fv]: The future value (default 0)
            /// - [type]: When payments are due (0=end of period, 1=beginning of period, default 0)
            #[examples("PPMT(0.08/12, 1, 12*5, 10000)", "PPMT(0.06/12, 6, 24, 5000, 0, 1)")]
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
                let per = per as i64;

                if per < 1 || per > nper as i64 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pmt = calculate_pmt(rate, nper, pv, fv, payment_type);

                // Calculate the remaining balance at the start of the period
                let periods = per - 1;
                let fv_val = calculate_fv(rate, periods as f64, pmt, pv, payment_type);

                // Interest for this period
                let interest = if payment_type == 1.0 && per == 1 {
                    0.0
                } else if payment_type == 1.0 {
                    fv_val * rate / (1.0 + rate)
                } else {
                    fv_val * rate
                };

                // Principal = PMT - Interest
                let principal = pmt - interest;

                Ok(CellValue::from(principal))
            }
        ),
        formula_fn!(
            /// Calculates the cumulative interest paid between two periods.
            ///
            /// - rate: The interest rate per period
            /// - nper: The total number of payment periods
            /// - pv: The present value (loan amount)
            /// - start_period: The first period in the calculation (1-based)
            /// - end_period: The last period in the calculation
            /// - type: When payments are due (0=end of period, 1=beginning of period)
            #[examples(
                "CUMIPMT(0.08/12, 12*5, 10000, 1, 12, 0)",
                "CUMIPMT(0.06/12, 24, 5000, 1, 6, 1)"
            )]
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
                let start = start_period as i64;
                let end = end_period as i64;

                if rate <= 0.0 || nper <= 0.0 || pv <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if start < 1 || end < start || end > nper as i64 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pmt = calculate_pmt(rate, nper, pv, 0.0, payment_type);
                let mut total_interest = 0.0;

                for per in start..=end {
                    if payment_type == 1.0 && per == 1 {
                        continue; // No interest for first period with type=1
                    }

                    let periods = per - 1;
                    let fv_val = calculate_fv(rate, periods as f64, pmt, pv, payment_type);

                    let interest = if payment_type == 1.0 {
                        fv_val * rate / (1.0 + rate)
                    } else {
                        fv_val * rate
                    };

                    total_interest += interest;
                }

                Ok(CellValue::from(total_interest))
            }
        ),
        formula_fn!(
            /// Calculates the cumulative principal paid between two periods.
            ///
            /// - rate: The interest rate per period
            /// - nper: The total number of payment periods
            /// - pv: The present value (loan amount)
            /// - start_period: The first period in the calculation (1-based)
            /// - end_period: The last period in the calculation
            /// - type: When payments are due (0=end of period, 1=beginning of period)
            #[examples(
                "CUMPRINC(0.08/12, 12*5, 10000, 1, 12, 0)",
                "CUMPRINC(0.06/12, 24, 5000, 1, 6, 1)"
            )]
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
                let start = start_period as i64;
                let end = end_period as i64;

                if rate <= 0.0 || nper <= 0.0 || pv <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if start < 1 || end < start || end > nper as i64 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pmt = calculate_pmt(rate, nper, pv, 0.0, payment_type);
                let mut total_principal = 0.0;

                for per in start..=end {
                    let periods = per - 1;
                    let fv_val = calculate_fv(rate, periods as f64, pmt, pv, payment_type);

                    let interest = if payment_type == 1.0 && per == 1 {
                        0.0
                    } else if payment_type == 1.0 {
                        fv_val * rate / (1.0 + rate)
                    } else {
                        fv_val * rate
                    };

                    let principal = pmt - interest;
                    total_principal += principal;
                }

                Ok(CellValue::from(total_principal))
            }
        ),
        formula_fn!(
            /// Calculates the interest paid during a specific period of an investment (using the simple interest method).
            ///
            /// Unlike IPMT, ISPMT calculates using simple interest instead of compound interest.
            /// This function is provided for compatibility with other spreadsheet software.
            ///
            /// - rate: The interest rate per period
            /// - per: The period for which you want to find the interest (0 to nper-1)
            /// - nper: The total number of payment periods
            /// - pv: The present value (loan amount)
            #[examples("ISPMT(0.08/12, 0, 12, 10000)", "ISPMT(0.06/12, 5, 24, 5000)")]
            fn ISPMT(rate: (f64), per: (f64), nper: (f64), pv: (f64)) {
                // ISPMT uses simple interest calculation
                // Interest = rate * pv * (1 - (per + 1) / nper)
                // Actually Excel's ISPMT formula is: rate * pv * ((per - nper) / nper)
                // Note: per is 0-indexed in ISPMT
                let interest = rate * pv * (per / nper - 1.0);
                Ok(CellValue::from(interest))
            }
        ),
        formula_fn!(
            /// Calculates the straight-line depreciation of an asset for one period.
            ///
            /// Straight-line depreciation spreads the cost evenly over the asset's useful life.
            ///
            /// - cost: The initial cost of the asset
            /// - salvage: The value at the end of the depreciation (also called residual value)
            /// - life: The number of periods over which the asset is depreciated
            #[examples("SLN(10000, 1000, 5)", "SLN(50000, 5000, 10)")]
            fn SLN(span: Span, cost: (f64), salvage: (f64), life: (f64)) {
                if life == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let depreciation = (cost - salvage) / life;
                Ok(CellValue::from(depreciation))
            }
        ),
        formula_fn!(
            /// Calculates the sum-of-years' digits depreciation of an asset for a specific period.
            ///
            /// This method results in a more accelerated depreciation than straight-line.
            ///
            /// - cost: The initial cost of the asset
            /// - salvage: The value at the end of the depreciation
            /// - life: The number of periods over which the asset is depreciated
            /// - per: The period for which to calculate depreciation (1-based)
            #[examples("SYD(10000, 1000, 5, 1)", "SYD(50000, 5000, 10, 3)")]
            fn SYD(span: Span, cost: (f64), salvage: (f64), life: (f64), per: (f64)) {
                let life = life as i64;
                let per = per as i64;

                if life <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if per < 1 || per > life {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Sum of years' digits = n*(n+1)/2
                let sum_of_years = (life * (life + 1)) / 2;
                // Remaining life at start of period
                let remaining_life = life - per + 1;
                let depreciation =
                    (cost - salvage) * (remaining_life as f64) / (sum_of_years as f64);

                Ok(CellValue::from(depreciation))
            }
        ),
        formula_fn!(
            /// Calculates the depreciation of an asset using the fixed-declining balance method.
            ///
            /// The DB function uses a fixed rate to calculate depreciation.
            ///
            /// - cost: The initial cost of the asset
            /// - salvage: The value at the end of the depreciation
            /// - life: The number of periods over which the asset is depreciated
            /// - period: The period for which to calculate depreciation (1-based)
            /// - [month]: The number of months in the first year (default 12)
            #[examples("DB(10000, 1000, 5, 1)", "DB(50000, 5000, 10, 3, 6)")]
            fn DB(
                span: Span,
                cost: (f64),
                salvage: (f64),
                life: (f64),
                period: (f64),
                month: (Option<f64>),
            ) {
                let life = life as i64;
                let period = period as i64;
                let month = month.unwrap_or(12.0) as i64;

                if life <= 0 || cost < 0.0 || salvage < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if period < 1 || period > life + 1 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !(1..=12).contains(&month) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate the fixed depreciation rate
                // rate = 1 - (salvage / cost)^(1/life), rounded to 3 decimal places
                let rate = if cost == 0.0 {
                    0.0
                } else {
                    let r = 1.0 - (salvage / cost).powf(1.0 / life as f64);
                    (r * 1000.0).round() / 1000.0
                };

                let depreciation = if period == 1 {
                    // First period: prorate based on months
                    cost * rate * month as f64 / 12.0
                } else if period == life + 1 {
                    // Last period (if there's a partial year at the end)
                    // Calculate remaining value after previous periods
                    let mut remaining = cost;
                    remaining -= cost * rate * month as f64 / 12.0; // First period
                    for _ in 2..=life {
                        remaining -= remaining * rate;
                    }
                    remaining * rate * (12 - month) as f64 / 12.0
                } else {
                    // Middle periods: depreciate remaining value
                    let mut remaining = cost;
                    remaining -= cost * rate * month as f64 / 12.0; // First period
                    for _ in 2..period {
                        remaining -= remaining * rate;
                    }
                    remaining * rate
                };

                Ok(CellValue::from(depreciation))
            }
        ),
        formula_fn!(
            /// Calculates the depreciation of an asset using the double-declining balance method.
            ///
            /// This is an accelerated depreciation method that depreciates faster in early periods.
            ///
            /// - cost: The initial cost of the asset
            /// - salvage: The value at the end of the depreciation
            /// - life: The number of periods over which the asset is depreciated
            /// - period: The period for which to calculate depreciation (1-based)
            /// - [factor]: The rate at which the balance declines (default 2 for double-declining)
            #[examples("DDB(10000, 1000, 5, 1)", "DDB(50000, 5000, 10, 3, 1.5)")]
            fn DDB(
                span: Span,
                cost: (f64),
                salvage: (f64),
                life: (f64),
                period: (f64),
                factor: (Option<f64>),
            ) {
                let factor = factor.unwrap_or(2.0);
                let period = period as i64;
                let life_int = life as i64;

                if life <= 0.0 || cost < 0.0 || salvage < 0.0 || factor <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if period < 1 || period > life_int {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let rate = factor / life;

                // Calculate book value at start of this period
                let mut book_value = cost;
                for _ in 1..period {
                    let depreciation = book_value * rate;
                    book_value -= depreciation;
                    // Don't depreciate below salvage value
                    if book_value < salvage {
                        book_value = salvage;
                    }
                }

                // Calculate depreciation for this period
                let mut depreciation = book_value * rate;

                // Don't depreciate below salvage value
                if book_value - depreciation < salvage {
                    depreciation = book_value - salvage;
                }
                if depreciation < 0.0 {
                    depreciation = 0.0;
                }

                Ok(CellValue::from(depreciation))
            }
        ),
        formula_fn!(
            /// Calculates the depreciation of an asset using the variable declining balance method.
            ///
            /// VDB is a flexible depreciation function that can calculate depreciation for any period
            /// or partial period. It can optionally switch to straight-line depreciation when that
            /// gives a larger depreciation amount.
            ///
            /// - cost: The initial cost of the asset
            /// - salvage: The value at the end of the depreciation
            /// - life: The number of periods over which the asset is depreciated
            /// - start_period: The starting period for depreciation calculation
            /// - end_period: The ending period for depreciation calculation
            /// - [factor]: The rate at which the balance declines (default 2)
            /// - [no_switch]: If TRUE, does not switch to straight-line (default FALSE)
            #[examples(
                "VDB(10000, 1000, 5, 0, 1)",
                "VDB(50000, 5000, 10, 2, 3, 1.5)",
                "VDB(10000, 1000, 5, 0, 5, 2, TRUE)"
            )]
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

                if life <= 0.0 || cost < 0.0 || salvage < 0.0 || factor <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if start_period < 0.0 || end_period < start_period || end_period > life {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let rate = factor / life;
                let mut total_depreciation = 0.0;
                let mut book_value = cost;

                // Process each period from 0 to end_period
                let mut current_period = 0.0;
                while current_period < end_period {
                    let period_end = (current_period + 1.0).min(end_period);
                    let period_fraction = period_end - current_period.max(start_period);

                    if period_fraction > 0.0 {
                        // Calculate DDB depreciation for this period
                        let ddb_depreciation = book_value * rate;

                        // Calculate straight-line depreciation for remaining life
                        let remaining_life = life - current_period;
                        let sl_depreciation = if remaining_life > 0.0 {
                            (book_value - salvage) / remaining_life
                        } else {
                            0.0
                        };

                        // Use the larger of DDB or SL (unless no_switch is true)
                        let period_depreciation = if no_switch {
                            ddb_depreciation
                        } else {
                            ddb_depreciation.max(sl_depreciation)
                        };

                        // Don't depreciate below salvage
                        let max_depreciation = (book_value - salvage).max(0.0);
                        let actual_depreciation = period_depreciation.min(max_depreciation);

                        // Add prorated depreciation to total
                        total_depreciation += actual_depreciation * period_fraction;

                        // Update book value for partial period
                        if current_period >= start_period {
                            book_value -= actual_depreciation * period_fraction;
                        }
                    }

                    // Update book value for periods before start_period
                    if current_period < start_period {
                        let ddb_depreciation = book_value * rate;
                        let remaining_life = life - current_period;
                        let sl_depreciation = if remaining_life > 0.0 {
                            (book_value - salvage) / remaining_life
                        } else {
                            0.0
                        };
                        let period_depreciation = if no_switch {
                            ddb_depreciation
                        } else {
                            ddb_depreciation.max(sl_depreciation)
                        };
                        let max_depreciation = (book_value - salvage).max(0.0);
                        let actual_depreciation = period_depreciation.min(max_depreciation);
                        book_value -=
                            actual_depreciation * (start_period - current_period).min(1.0);
                    }

                    current_period += 1.0;
                }

                Ok(CellValue::from(total_depreciation))
            }
        ),
        formula_fn!(
            /// Returns the previous coupon date before the settlement date.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "COUPPCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)",
                "COUPPCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)"
            )]
            #[zip_map]
            fn COUPPCD(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                Ok(CellValue::Date(prev_coupon))
            }
        ),
        formula_fn!(
            /// Returns the next coupon date after the settlement date.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "COUPNCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)",
                "COUPNCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)"
            )]
            #[zip_map]
            fn COUPNCD(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let next_coupon = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                Ok(CellValue::Date(next_coupon))
            }
        ),
        formula_fn!(
            /// Returns the number of coupons payable between the settlement date and maturity date.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "COUPNUM(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)",
                "COUPNUM(DATE(2023, 1, 25), DATE(2025, 11, 15), 4)"
            )]
            #[zip_map]
            fn COUPNUM(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let count = count_coupons(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                Ok(CellValue::from(count))
            }
        ),
        formula_fn!(
            /// Returns the number of days from the beginning of the coupon period to the settlement date.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "COUPDAYBS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)",
                "COUPDAYBS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)"
            )]
            #[zip_map]
            fn COUPDAYBS(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let days = coupon_days_from_start(prev_coupon, settlement, basis);

                Ok(CellValue::from(days))
            }
        ),
        formula_fn!(
            /// Returns the number of days in the coupon period that contains the settlement date.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)",
                "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 4, 1)"
            )]
            #[zip_map]
            fn COUPDAYS(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let next_coupon = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let days = coupon_days_in_period(prev_coupon, next_coupon, frequency, basis);

                Ok(CellValue::from(days))
            }
        ),
        formula_fn!(
            /// Returns the number of days from the settlement date to the next coupon date.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "COUPDAYSNC(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)",
                "COUPDAYSNC(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)"
            )]
            #[zip_map]
            fn COUPDAYSNC(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let next_coupon = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                // COUPDAYSNC = COUPDAYS - COUPDAYBS
                let total_days = coupon_days_in_period(prev_coupon, next_coupon, frequency, basis);
                let days_from_start = coupon_days_from_start(prev_coupon, settlement, basis);
                let days = total_days - days_from_start;

                Ok(CellValue::from(days))
            }
        ),
    ]
}
#[cfg(test)]
mod tests {
    use crate::RunErrorMsg;
    use crate::controller::GridController;
    use crate::formulas::tests::*;
    use crate::util::assert_f64_approx_eq;

    #[test]
    fn test_pmt() {
        let g = GridController::new();

        // Test basic loan payment calculation
        assert_f64_approx_eq(
            -202.76394,
            eval_to_string(&g, "PMT(0.08/12, 12*5, 10000)")
                .parse::<f64>()
                .unwrap(),
            "Basic loan payment",
        );

        // Test with future value
        assert_f64_approx_eq(
            -260.92366,
            eval_to_string(&g, "PMT(0.06/12, 24, 5000, 1000)")
                .parse::<f64>()
                .unwrap(),
            "Payment with future value",
        );

        // Test with payment at beginning of period
        assert_f64_approx_eq(
            -259.62553,
            eval_to_string(&g, "PMT(0.06/12, 24, 5000, 1000, 1)")
                .parse::<f64>()
                .unwrap(),
            "Payment at beginning",
        );

        // Test with zero interest rate
        assert_f64_approx_eq(
            -100.0,
            eval_to_string(&g, "PMT(0, 12, 1200)")
                .parse::<f64>()
                .unwrap(),
            "Zero interest rate",
        );

        // Test with negative number of periods
        assert_f64_approx_eq(
            -136.09727,
            eval_to_string(&g, "PMT(0.08/12, -12*5, -10000)")
                .parse::<f64>()
                .unwrap(),
            "Negative periods",
        );
    }

    #[test]
    fn test_fv() {
        let g = GridController::new();

        // Test basic future value calculation
        assert_f64_approx_eq(
            2581.40337,
            eval_to_string(&g, "FV(0.06/12, 10, -200, -500, 1)")
                .parse::<f64>()
                .unwrap(),
            "FV with initial investment and payments at beginning",
        );

        // Test future value with just payments (at 8%/year for 5 years)
        assert_f64_approx_eq(
            14695.37125,
            eval_to_string(&g, "FV(0.08/12, 12*5, -200)")
                .parse::<f64>()
                .unwrap(),
            "FV with regular payments",
        );

        // Test with zero interest rate
        assert_f64_approx_eq(
            2400.0,
            eval_to_string(&g, "FV(0, 12, -200)")
                .parse::<f64>()
                .unwrap(),
            "FV with zero interest",
        );
    }

    #[test]
    fn test_pv() {
        let g = GridController::new();

        // Test basic present value calculation (how much can you borrow with $200/month payments)
        assert_f64_approx_eq(
            9863.68667,
            eval_to_string(&g, "PV(0.08/12, 12*5, -200)")
                .parse::<f64>()
                .unwrap(),
            "PV of monthly payments",
        );

        // Test with future value
        assert_f64_approx_eq(
            4753.53089,
            eval_to_string(&g, "PV(0.06/12, 24, -250, 1000)")
                .parse::<f64>()
                .unwrap(),
            "PV with future value",
        );

        // Test with zero interest rate
        assert_f64_approx_eq(
            2400.0,
            eval_to_string(&g, "PV(0, 12, -200)")
                .parse::<f64>()
                .unwrap(),
            "PV with zero interest",
        );
    }

    #[test]
    fn test_nper() {
        let g = GridController::new();

        // Test basic NPER calculation (how many periods to pay off $8000 at $200/month)
        assert_f64_approx_eq(
            46.67814,
            eval_to_string(&g, "NPER(0.08/12, -200, 8000)")
                .parse::<f64>()
                .unwrap(),
            "NPER for loan payoff",
        );

        // Test with zero interest rate
        assert_f64_approx_eq(
            40.0,
            eval_to_string(&g, "NPER(0, -200, 8000)")
                .parse::<f64>()
                .unwrap(),
            "NPER with zero interest",
        );
    }

    #[test]
    fn test_rate() {
        let g = GridController::new();

        // Test basic RATE calculation (what rate for $200/month to pay off $10000 in 60 months)
        // Verified: PMT(0.0061834, 60, 10000) = -200
        assert_f64_approx_eq(
            0.0061834,
            eval_to_string(&g, "RATE(60, -200, 10000)")
                .parse::<f64>()
                .unwrap(),
            "Monthly interest rate",
        );

        // Test with guess parameter
        assert_f64_approx_eq(
            0.0061834,
            eval_to_string(&g, "RATE(60, -200, 10000, 0, 0, 0.01)")
                .parse::<f64>()
                .unwrap(),
            "RATE with guess",
        );
    }

    #[test]
    fn test_ipmt() {
        let g = GridController::new();

        // Test interest payment for first period
        assert_f64_approx_eq(
            -66.66666667,
            eval_to_string(&g, "IPMT(0.08/12, 1, 12*5, 10000)")
                .parse::<f64>()
                .unwrap(),
            "IPMT first period",
        );

        // Test interest payment for later period
        assert_f64_approx_eq(
            -37.74478,
            eval_to_string(&g, "IPMT(0.08/12, 30, 12*5, 10000)")
                .parse::<f64>()
                .unwrap(),
            "IPMT period 30",
        );
    }

    #[test]
    fn test_ppmt() {
        let g = GridController::new();

        // Test principal payment for first period
        assert_f64_approx_eq(
            -136.09727,
            eval_to_string(&g, "PPMT(0.08/12, 1, 12*5, 10000)")
                .parse::<f64>()
                .unwrap(),
            "PPMT first period",
        );

        // Test principal payment for later period
        assert_f64_approx_eq(
            -165.01917,
            eval_to_string(&g, "PPMT(0.08/12, 30, 12*5, 10000)")
                .parse::<f64>()
                .unwrap(),
            "PPMT period 30",
        );
    }

    #[test]
    fn test_cumipmt() {
        let g = GridController::new();

        // Test cumulative interest for first year
        assert_f64_approx_eq(
            -738.76629,
            eval_to_string(&g, "CUMIPMT(0.08/12, 12*5, 10000, 1, 12, 0)")
                .parse::<f64>()
                .unwrap(),
            "Cumulative interest first year",
        );
    }

    #[test]
    fn test_cumprinc() {
        let g = GridController::new();

        // Test cumulative principal for first year
        assert_f64_approx_eq(
            -1694.40102,
            eval_to_string(&g, "CUMPRINC(0.08/12, 12*5, 10000, 1, 12, 0)")
                .parse::<f64>()
                .unwrap(),
            "Cumulative principal first year",
        );
    }

    #[test]
    fn test_ispmt() {
        let g = GridController::new();

        // Test ISPMT for first period (period 0)
        assert_f64_approx_eq(
            -66.66666667,
            eval_to_string(&g, "ISPMT(0.08/12, 0, 12, 10000)")
                .parse::<f64>()
                .unwrap(),
            "ISPMT first period",
        );

        // Test ISPMT for later period
        assert_f64_approx_eq(
            -33.33333333,
            eval_to_string(&g, "ISPMT(0.08/12, 6, 12, 10000)")
                .parse::<f64>()
                .unwrap(),
            "ISPMT period 6",
        );
    }

    #[test]
    fn test_ipmt_ppmt_sum_equals_pmt() {
        let g = GridController::new();

        // IPMT + PPMT should equal PMT for any period
        let pmt: f64 = eval_to_string(&g, "PMT(0.08/12, 60, 10000)")
            .parse()
            .unwrap();
        let ipmt: f64 = eval_to_string(&g, "IPMT(0.08/12, 15, 60, 10000)")
            .parse()
            .unwrap();
        let ppmt: f64 = eval_to_string(&g, "PPMT(0.08/12, 15, 60, 10000)")
            .parse()
            .unwrap();

        assert_f64_approx_eq(pmt, ipmt + ppmt, "IPMT + PPMT should equal PMT");
    }

    #[test]
    fn test_sln() {
        let g = GridController::new();

        // Basic straight-line depreciation: (10000 - 1000) / 5 = 1800
        assert_f64_approx_eq(
            1800.0,
            eval_to_string(&g, "SLN(10000, 1000, 5)")
                .parse::<f64>()
                .unwrap(),
            "SLN basic depreciation",
        );

        // Another example: (50000 - 5000) / 10 = 4500
        assert_f64_approx_eq(
            4500.0,
            eval_to_string(&g, "SLN(50000, 5000, 10)")
                .parse::<f64>()
                .unwrap(),
            "SLN 10-year depreciation",
        );

        // Zero salvage value
        assert_f64_approx_eq(
            2000.0,
            eval_to_string(&g, "SLN(10000, 0, 5)")
                .parse::<f64>()
                .unwrap(),
            "SLN zero salvage",
        );

        // Division by zero should error
        expect_err(&RunErrorMsg::DivideByZero, &g, "SLN(10000, 1000, 0)");
    }

    #[test]
    fn test_syd() {
        let g = GridController::new();

        // Sum-of-years' digits for 5-year life: sum = 5+4+3+2+1 = 15
        // Year 1: (10000-1000) * 5/15 = 3000
        assert_f64_approx_eq(
            3000.0,
            eval_to_string(&g, "SYD(10000, 1000, 5, 1)")
                .parse::<f64>()
                .unwrap(),
            "SYD year 1",
        );

        // Year 2: (10000-1000) * 4/15 = 2400
        assert_f64_approx_eq(
            2400.0,
            eval_to_string(&g, "SYD(10000, 1000, 5, 2)")
                .parse::<f64>()
                .unwrap(),
            "SYD year 2",
        );

        // Year 5: (10000-1000) * 1/15 = 600
        assert_f64_approx_eq(
            600.0,
            eval_to_string(&g, "SYD(10000, 1000, 5, 5)")
                .parse::<f64>()
                .unwrap(),
            "SYD year 5",
        );

        // Invalid period should error
        expect_err(&RunErrorMsg::InvalidArgument, &g, "SYD(10000, 1000, 5, 0)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "SYD(10000, 1000, 5, 6)");
    }

    #[test]
    fn test_db() {
        let g = GridController::new();

        // Fixed declining balance depreciation
        // Rate = 1 - (1000/10000)^(1/5) = 1 - 0.1^0.2 ≈ 0.369 (rounded to 0.369)
        // Year 1: 10000 * 0.369 = 3690
        assert_f64_approx_eq(
            3690.0,
            eval_to_string(&g, "DB(10000, 1000, 5, 1)")
                .parse::<f64>()
                .unwrap(),
            "DB year 1",
        );

        // Year 2: (10000 - 3690) * 0.369 = 2328.39
        assert_f64_approx_eq(
            2328.39,
            eval_to_string(&g, "DB(10000, 1000, 5, 2)")
                .parse::<f64>()
                .unwrap(),
            "DB year 2",
        );

        // With partial first year (6 months)
        // Year 1: 10000 * 0.369 * 6/12 = 1845
        assert_f64_approx_eq(
            1845.0,
            eval_to_string(&g, "DB(10000, 1000, 5, 1, 6)")
                .parse::<f64>()
                .unwrap(),
            "DB year 1 with 6 months",
        );
    }

    #[test]
    fn test_ddb() {
        let g = GridController::new();

        // Double declining balance: rate = 2/5 = 0.4
        // Year 1: 10000 * 0.4 = 4000
        assert_f64_approx_eq(
            4000.0,
            eval_to_string(&g, "DDB(10000, 1000, 5, 1)")
                .parse::<f64>()
                .unwrap(),
            "DDB year 1",
        );

        // Year 2: (10000 - 4000) * 0.4 = 2400
        assert_f64_approx_eq(
            2400.0,
            eval_to_string(&g, "DDB(10000, 1000, 5, 2)")
                .parse::<f64>()
                .unwrap(),
            "DDB year 2",
        );

        // Year 3: (10000 - 4000 - 2400) * 0.4 = 1440
        assert_f64_approx_eq(
            1440.0,
            eval_to_string(&g, "DDB(10000, 1000, 5, 3)")
                .parse::<f64>()
                .unwrap(),
            "DDB year 3",
        );

        // With custom factor of 1.5 (150% declining balance)
        // Rate = 1.5/5 = 0.3
        // Year 1: 10000 * 0.3 = 3000
        assert_f64_approx_eq(
            3000.0,
            eval_to_string(&g, "DDB(10000, 1000, 5, 1, 1.5)")
                .parse::<f64>()
                .unwrap(),
            "DDB year 1 with factor 1.5",
        );

        // Invalid arguments should error
        expect_err(&RunErrorMsg::InvalidArgument, &g, "DDB(10000, 1000, 5, 0)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "DDB(10000, 1000, 5, 6)");
    }

    #[test]
    fn test_vdb() {
        let g = GridController::new();

        // VDB for first year (period 0 to 1) should match DDB year 1
        assert_f64_approx_eq(
            4000.0,
            eval_to_string(&g, "VDB(10000, 1000, 5, 0, 1)")
                .parse::<f64>()
                .unwrap(),
            "VDB first year",
        );

        // VDB with no_switch = TRUE (pure declining balance)
        let vdb_no_switch: f64 = eval_to_string(&g, "VDB(10000, 1000, 5, 0, 1, 2, TRUE)")
            .parse()
            .unwrap();
        assert_f64_approx_eq(4000.0, vdb_no_switch, "VDB with no_switch");

        // VDB for full life should equal total depreciation (cost - salvage)
        let total_vdb: f64 = eval_to_string(&g, "VDB(10000, 1000, 5, 0, 5)")
            .parse()
            .unwrap();
        assert_f64_approx_eq(9000.0, total_vdb, "VDB total depreciation");

        // VDB with custom factor
        assert_f64_approx_eq(
            3000.0,
            eval_to_string(&g, "VDB(10000, 1000, 5, 0, 1, 1.5)")
                .parse::<f64>()
                .unwrap(),
            "VDB with factor 1.5",
        );

        // Invalid arguments should error
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "VDB(10000, 1000, 5, -1, 1)",
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "VDB(10000, 1000, 5, 3, 2)",
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "VDB(10000, 1000, 5, 0, 6)",
        );
    }

    #[test]
    fn test_depreciation_sum() {
        let g = GridController::new();

        // Sum of SYD depreciation over all periods should equal cost - salvage
        let syd_sum: f64 = (1..=5)
            .map(|i| {
                eval_to_string(&g, &format!("SYD(10000, 1000, 5, {})", i))
                    .parse::<f64>()
                    .unwrap()
            })
            .sum();
        assert_f64_approx_eq(9000.0, syd_sum, "SYD sum equals cost - salvage");

        // Sum of SLN depreciation over all periods should equal cost - salvage
        let sln_sum: f64 = (1..=5)
            .map(|_| {
                eval_to_string(&g, "SLN(10000, 1000, 5)")
                    .parse::<f64>()
                    .unwrap()
            })
            .sum();
        assert_f64_approx_eq(9000.0, sln_sum, "SLN sum equals cost - salvage");
    }

    #[test]
    fn test_couppcd() {
        let g = GridController::new();

        // Settlement Jan 25, 2023, Maturity Nov 15, 2025, Semi-annual
        // Previous coupon should be Nov 15, 2022
        assert_eq!(
            eval_to_string(&g, "COUPPCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)"),
            "2022-11-15"
        );

        // Settlement Mar 1, 2024, Maturity Nov 15, 2025, Semi-annual
        // Previous coupon should be Nov 15, 2023
        assert_eq!(
            eval_to_string(&g, "COUPPCD(DATE(2024, 3, 1), DATE(2025, 11, 15), 2)"),
            "2023-11-15"
        );

        // Annual frequency
        assert_eq!(
            eval_to_string(&g, "COUPPCD(DATE(2023, 6, 15), DATE(2025, 11, 15), 1)"),
            "2022-11-15"
        );

        // Quarterly frequency
        assert_eq!(
            eval_to_string(&g, "COUPPCD(DATE(2023, 6, 15), DATE(2025, 11, 15), 4)"),
            "2023-05-15"
        );

        // Invalid: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "COUPPCD(DATE(2026, 1, 1), DATE(2025, 11, 15), 2)",
        );

        // Invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "COUPPCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 3)",
        );

        // Invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "COUPPCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 5)",
        );
    }

    #[test]
    fn test_coupncd() {
        let g = GridController::new();

        // Settlement Jan 25, 2023, Maturity Nov 15, 2025, Semi-annual
        // Next coupon should be May 15, 2023
        assert_eq!(
            eval_to_string(&g, "COUPNCD(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)"),
            "2023-05-15"
        );

        // Settlement Mar 1, 2024, Maturity Nov 15, 2025, Semi-annual
        // Next coupon should be May 15, 2024
        assert_eq!(
            eval_to_string(&g, "COUPNCD(DATE(2024, 3, 1), DATE(2025, 11, 15), 2)"),
            "2024-05-15"
        );

        // Annual frequency
        assert_eq!(
            eval_to_string(&g, "COUPNCD(DATE(2023, 6, 15), DATE(2025, 11, 15), 1)"),
            "2023-11-15"
        );

        // Quarterly frequency
        assert_eq!(
            eval_to_string(&g, "COUPNCD(DATE(2023, 6, 15), DATE(2025, 11, 15), 4)"),
            "2023-08-15"
        );

        // Invalid: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "COUPNCD(DATE(2026, 1, 1), DATE(2025, 11, 15), 2)",
        );
    }

    #[test]
    fn test_coupnum() {
        let g = GridController::new();

        // Settlement Jan 25, 2023, Maturity Nov 15, 2025, Semi-annual
        // Coupons: May 15 2023, Nov 15 2023, May 15 2024, Nov 15 2024, May 15 2025, Nov 15 2025 = 6
        assert_eq!(
            eval_to_string(&g, "COUPNUM(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)"),
            "6"
        );

        // Quarterly frequency should have more coupons
        assert_eq!(
            eval_to_string(&g, "COUPNUM(DATE(2023, 1, 25), DATE(2025, 11, 15), 4)"),
            "12"
        );

        // Annual frequency
        assert_eq!(
            eval_to_string(&g, "COUPNUM(DATE(2023, 1, 25), DATE(2025, 11, 15), 1)"),
            "3"
        );

        // Settlement closer to maturity
        assert_eq!(
            eval_to_string(&g, "COUPNUM(DATE(2025, 6, 1), DATE(2025, 11, 15), 2)"),
            "1"
        );

        // Invalid: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "COUPNUM(DATE(2026, 1, 1), DATE(2025, 11, 15), 2)",
        );
    }

    #[test]
    fn test_coupdaybs() {
        let g = GridController::new();

        // Settlement Jan 25, 2023, Maturity Nov 15, 2025, Semi-annual
        // Previous coupon: Nov 15, 2022
        // Days from Nov 15, 2022 to Jan 25, 2023 with 30/360 basis
        // = 360*(2023-2022) + 30*(1-11) + (25-15) = 360 - 300 + 10 = 70
        // Using 30/360: Nov 15-30 = 15 days, Dec = 30 days, Jan 1-25 = 25 days = 70 days
        assert_f64_approx_eq(
            70.0, // 30/360 calculation
            eval_to_string(&g, "COUPDAYBS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)")
                .parse::<f64>()
                .unwrap(),
            "COUPDAYBS with 30/360",
        );

        // Actual/Actual basis (1)
        // From Nov 15, 2022 to Jan 25, 2023 = 71 actual days
        assert_f64_approx_eq(
            71.0,
            eval_to_string(&g, "COUPDAYBS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)")
                .parse::<f64>()
                .unwrap(),
            "COUPDAYBS with Actual/Actual",
        );
    }

    #[test]
    fn test_coupdays() {
        let g = GridController::new();

        // With 30/360 basis, semi-annual = 180 days
        assert_f64_approx_eq(
            180.0,
            eval_to_string(&g, "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)")
                .parse::<f64>()
                .unwrap(),
            "COUPDAYS semi-annual 30/360",
        );

        // With 30/360 basis, quarterly = 90 days
        assert_f64_approx_eq(
            90.0,
            eval_to_string(&g, "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 4)")
                .parse::<f64>()
                .unwrap(),
            "COUPDAYS quarterly 30/360",
        );

        // With 30/360 basis, annual = 360 days
        assert_f64_approx_eq(
            360.0,
            eval_to_string(&g, "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 1)")
                .parse::<f64>()
                .unwrap(),
            "COUPDAYS annual 30/360",
        );

        // With Actual/365 basis (3), semi-annual = 182.5 days
        assert_f64_approx_eq(
            182.5,
            eval_to_string(&g, "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 3)")
                .parse::<f64>()
                .unwrap(),
            "COUPDAYS semi-annual Actual/365",
        );
    }

    #[test]
    fn test_coupdaysnc() {
        let g = GridController::new();

        // Settlement Jan 25, 2023, Maturity Nov 15, 2025, Semi-annual
        // COUPDAYSNC = COUPDAYS - COUPDAYBS
        // With 30/360: 180 - 71 = 109
        let coupdays: f64 =
            eval_to_string(&g, "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)")
                .parse()
                .unwrap();
        let coupdaybs: f64 =
            eval_to_string(&g, "COUPDAYBS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)")
                .parse()
                .unwrap();
        let coupdaysnc: f64 =
            eval_to_string(&g, "COUPDAYSNC(DATE(2023, 1, 25), DATE(2025, 11, 15), 2)")
                .parse()
                .unwrap();

        assert_f64_approx_eq(
            coupdays - coupdaybs,
            coupdaysnc,
            "COUPDAYSNC = COUPDAYS - COUPDAYBS",
        );

        // With Actual/Actual basis
        let coupdays_aa: f64 =
            eval_to_string(&g, "COUPDAYS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)")
                .parse()
                .unwrap();
        let coupdaybs_aa: f64 =
            eval_to_string(&g, "COUPDAYBS(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)")
                .parse()
                .unwrap();
        let coupdaysnc_aa: f64 = eval_to_string(
            &g,
            "COUPDAYSNC(DATE(2023, 1, 25), DATE(2025, 11, 15), 2, 1)",
        )
        .parse()
        .unwrap();

        assert_f64_approx_eq(
            coupdays_aa - coupdaybs_aa,
            coupdaysnc_aa,
            "COUPDAYSNC = COUPDAYS - COUPDAYBS (Actual/Actual)",
        );
    }

    #[test]
    fn test_coupon_end_of_month() {
        let g = GridController::new();

        // Test with end-of-month maturity date (Feb 28 in non-leap year)
        // Settlement: Jan 15, 2023, Maturity: Feb 28, 2025, Semi-annual
        assert_eq!(
            eval_to_string(&g, "COUPPCD(DATE(2023, 1, 15), DATE(2025, 2, 28), 2)"),
            "2022-08-28"
        );

        assert_eq!(
            eval_to_string(&g, "COUPNCD(DATE(2023, 1, 15), DATE(2025, 2, 28), 2)"),
            "2023-02-28"
        );

        // Test with 31st day maturity
        assert_eq!(
            eval_to_string(&g, "COUPPCD(DATE(2023, 4, 15), DATE(2025, 7, 31), 2)"),
            "2023-01-31"
        );
    }
}
