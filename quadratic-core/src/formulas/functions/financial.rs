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
        1..=3 => days_actual(start, date) as f64,
        4 => days_30_360_eu(start, date) as f64,
        _ => days_30_360_us(start, date) as f64,
    }
}

/// Returns the annual basis (number of days in a year) for a given day count convention
fn annual_basis(basis: i64) -> f64 {
    match basis {
        0 => 360.0, // 30/360 US
        1 => 365.0, // Actual/Actual (approximation for year)
        2 => 360.0, // Actual/360
        3 => 365.0, // Actual/365
        4 => 360.0, // 30/360 European
        _ => 360.0,
    }
}

/// Calculates days between two dates based on the day count basis
fn days_between(start: NaiveDate, end: NaiveDate, basis: i64) -> f64 {
    match basis {
        0 => days_30_360_us(start, end) as f64,
        1..=3 => days_actual(start, end) as f64,
        4 => days_30_360_eu(start, end) as f64,
        _ => days_30_360_us(start, end) as f64,
    }
}

/// Calculates the year fraction for Actual/Actual day count basis
fn year_fraction_actual_actual(start: NaiveDate, end: NaiveDate) -> f64 {
    let days = days_actual(start, end) as f64;
    let start_year = start.year();
    let end_year = end.year();

    if start_year == end_year {
        // Same year - use that year's day count
        let days_in_year = if is_leap_year(start_year) {
            366.0
        } else {
            365.0
        };
        days / days_in_year
    } else {
        // Spans multiple years - calculate fraction for each year
        let mut fraction = 0.0;

        // Days remaining in start year
        let end_of_start_year = NaiveDate::from_ymd_opt(start_year, 12, 31).unwrap();
        let days_in_start_year = if is_leap_year(start_year) {
            366.0
        } else {
            365.0
        };
        fraction += days_actual(start, end_of_start_year) as f64 / days_in_start_year;

        // Full years in between
        for _ in (start_year + 1)..end_year {
            fraction += 1.0;
        }

        // Days in end year
        let start_of_end_year = NaiveDate::from_ymd_opt(end_year, 1, 1).unwrap();
        let days_in_end_year = if is_leap_year(end_year) { 366.0 } else { 365.0 };
        fraction += days_actual(start_of_end_year, end) as f64 / days_in_end_year;

        fraction
    }
}

/// Checks if a year is a leap year
fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// Calculates the number of coupon periods from a date to another, using quasi-coupon periods
fn count_quasi_coupon_periods(start: NaiveDate, end: NaiveDate, frequency: i64) -> Option<i64> {
    let months_per_period = frequency_to_months(frequency)?;

    // Count the number of full periods from start to end
    let mut count = 0i64;
    let mut current = start;

    while current < end {
        current = current.checked_add_months(Months::new(months_per_period))?;
        if current <= end {
            count += 1;
        }
    }

    Some(count)
}

/// Finds a quasi-coupon date by going backwards from the first coupon date
fn find_quasi_coupon_before_issue(
    issue: NaiveDate,
    first_coupon: NaiveDate,
    frequency: i64,
) -> Option<NaiveDate> {
    let months_per_period = frequency_to_months(frequency)?;

    // Work backwards from first_coupon until we find a date <= issue
    let mut quasi_date = first_coupon;
    while quasi_date > issue {
        quasi_date = quasi_date.checked_sub_months(Months::new(months_per_period))?;
    }

    Some(adjust_day_to_match(
        quasi_date.year(),
        quasi_date.month(),
        first_coupon,
    ))
}

/// Finds a quasi-coupon date by going forward from the last interest date
fn find_quasi_coupon_after_maturity(
    maturity: NaiveDate,
    last_interest: NaiveDate,
    frequency: i64,
) -> Option<NaiveDate> {
    let months_per_period = frequency_to_months(frequency)?;

    // Work forward from last_interest until we find a date >= maturity
    let mut quasi_date = last_interest;
    while quasi_date < maturity {
        quasi_date = quasi_date.checked_add_months(Months::new(months_per_period))?;
    }

    Some(adjust_day_to_match(
        quasi_date.year(),
        quasi_date.month(),
        last_interest,
    ))
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
        formula_fn!(
            /// Returns the accrued interest for a security that pays periodic interest.
            ///
            /// - issue: The security's issue date
            /// - first_interest: The security's first interest date
            /// - settlement: The security's settlement date
            /// - rate: The security's annual coupon rate
            /// - par: The security's par value (face value)
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            /// - [calc_method]: The calculation method for accrued interest. TRUE (default) calculates from issue to settlement. FALSE calculates from first_interest to settlement.
            #[examples(
                "ACCRINT(DATE(2020, 1, 1), DATE(2020, 7, 1), DATE(2020, 4, 1), 0.05, 1000, 2)",
                "ACCRINT(DATE(2020, 1, 1), DATE(2020, 7, 1), DATE(2020, 4, 1), 0.05, 1000, 2, 0, TRUE)"
            )]
            #[zip_map]
            fn ACCRINT(
                span: Span,
                [issue]: NaiveDate,
                [first_interest]: NaiveDate,
                [settlement]: NaiveDate,
                [rate]: f64,
                [par]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
                [calc_method]: (Option<bool>),
            ) {
                let basis = basis.unwrap_or(0);
                let calc_method = calc_method.unwrap_or(true);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate <= 0.0 || par <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue > first_interest {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let months_per_period = frequency_to_months(frequency).unwrap();

                // Calculate accrued interest based on calc_method
                let accrued = if calc_method {
                    // TRUE: Calculate from issue to settlement, counting complete periods
                    if settlement <= first_interest {
                        // Settlement is before first interest date - simple case
                        // Just calculate from issue to settlement
                        let accrued_days = days_between(issue, settlement, basis);
                        let days_in_period = coupon_days_in_period(
                            issue,
                            issue
                                .checked_add_months(Months::new(months_per_period))
                                .unwrap_or(first_interest),
                            frequency,
                            basis,
                        );
                        par * rate * (accrued_days / days_in_period) / frequency as f64
                    } else {
                        // Settlement is after first interest date
                        // Sum up accrued interest from each coupon period from issue to settlement
                        let mut total_accrued = 0.0;

                        // First partial period: issue to first_interest
                        let first_period_days = days_between(issue, first_interest, basis);
                        let first_period_total =
                            coupon_days_in_period(issue, first_interest, frequency, basis);
                        total_accrued += par * rate * (first_period_days / first_period_total)
                            / frequency as f64;

                        // Count complete periods from first_interest to settlement
                        let mut current_date = first_interest;
                        while let Some(next_date) =
                            current_date.checked_add_months(Months::new(months_per_period))
                        {
                            if next_date > settlement {
                                // Final partial period
                                let partial_days = days_between(current_date, settlement, basis);
                                let period_days = coupon_days_in_period(
                                    current_date,
                                    next_date,
                                    frequency,
                                    basis,
                                );
                                total_accrued +=
                                    par * rate * (partial_days / period_days) / frequency as f64;
                                break;
                            } else {
                                // Complete period
                                total_accrued += par * rate / frequency as f64;
                                current_date = next_date;
                            }
                        }

                        total_accrued
                    }
                } else {
                    // FALSE: Calculate from first_interest to settlement only
                    if settlement <= first_interest {
                        0.0
                    } else {
                        // Find the last coupon date before or on settlement
                        let prev_coupon = find_previous_coupon_date(
                            settlement,
                            first_interest
                                .checked_add_months(Months::new(months_per_period * 100))
                                .unwrap_or(settlement),
                            frequency,
                        )
                        .unwrap_or(first_interest);

                        let next_coupon = prev_coupon
                            .checked_add_months(Months::new(months_per_period))
                            .unwrap_or(settlement);

                        let accrued_days = days_between(prev_coupon, settlement, basis);
                        let period_days =
                            coupon_days_in_period(prev_coupon, next_coupon, frequency, basis);

                        par * rate * (accrued_days / period_days) / frequency as f64
                    }
                };

                Ok(CellValue::from(accrued))
            }
        ),
        formula_fn!(
            /// Returns the accrued interest for a security that pays interest at maturity.
            ///
            /// - issue: The security's issue date
            /// - settlement: The security's settlement (maturity) date
            /// - rate: The security's annual coupon rate
            /// - par: The security's par value (face value)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 1000)",
                "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 1000, 1)"
            )]
            #[zip_map]
            fn ACCRINTM(
                span: Span,
                [issue]: NaiveDate,
                [settlement]: NaiveDate,
                [rate]: f64,
                [par]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate <= 0.0 || par <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate year fraction based on basis
                let year_fraction = if basis == 1 {
                    // Actual/Actual
                    year_fraction_actual_actual(issue, settlement)
                } else {
                    // For other bases, use accrued days / annual basis
                    let accrued_days = days_between(issue, settlement, basis);
                    accrued_days / annual_basis(basis)
                };

                // Accrued interest = par * rate * year_fraction
                let accrued = par * rate * year_fraction;

                Ok(CellValue::from(accrued))
            }
        ),
        formula_fn!(
            /// Returns the depreciation for each accounting period using straight-line (linear) depreciation.
            ///
            /// This function calculates depreciation based on the date of purchase, prorating
            /// the first and last periods appropriately.
            ///
            /// - cost: The cost of the asset
            /// - date_purchased: The date the asset was purchased
            /// - first_period: The end date of the first accounting period
            /// - salvage: The salvage value at the end of the asset's life
            /// - period: The period number (0-based)
            /// - rate: The annual depreciation rate
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15)",
                "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 0, 0.15, 1)"
            )]
            #[zip_map]
            fn AMORLINC(
                span: Span,
                [cost]: f64,
                [date_purchased]: NaiveDate,
                [first_period]: NaiveDate,
                [salvage]: f64,
                [period]: i64,
                [rate]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if cost < 0.0 || salvage < 0.0 || rate <= 0.0 || period < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if date_purchased > first_period {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate the annual depreciation amount
                let annual_depreciation = cost * rate;

                // Calculate the number of days in the first period
                let days_in_first_period = days_between(date_purchased, first_period, basis);
                let year_basis = annual_basis(basis);

                // Calculate the first period depreciation (prorated)
                let first_period_depreciation =
                    annual_depreciation * days_in_first_period / year_basis;

                // Track accumulated depreciation
                let max_depreciation = cost - salvage;

                let depreciation = if period == 0 {
                    // First period: prorated depreciation
                    first_period_depreciation.min(max_depreciation)
                } else {
                    // Calculate accumulated depreciation up to this period
                    let mut accumulated = first_period_depreciation;

                    for _ in 1..period {
                        if accumulated >= max_depreciation {
                            break;
                        }
                        let period_dep = annual_depreciation.min(max_depreciation - accumulated);
                        accumulated += period_dep;
                    }

                    if accumulated >= max_depreciation {
                        0.0
                    } else {
                        // This period's depreciation
                        annual_depreciation.min(max_depreciation - accumulated)
                    }
                };

                Ok(CellValue::from(depreciation))
            }
        ),
        formula_fn!(
            /// Returns the depreciation for each accounting period using degressive (declining balance) depreciation with a coefficient.
            ///
            /// This function uses a degressive depreciation coefficient based on the asset's life:
            /// - Life between 3-4 years: coefficient = 1.5
            /// - Life between 5-6 years: coefficient = 2.0
            /// - Life of 7 or more years: coefficient = 2.5
            ///
            /// - cost: The cost of the asset
            /// - date_purchased: The date the asset was purchased
            /// - first_period: The end date of the first accounting period
            /// - salvage: The salvage value at the end of the asset's life
            /// - period: The period number (0-based)
            /// - rate: The annual depreciation rate
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15)",
                "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 0, 0.15, 1)"
            )]
            #[zip_map]
            fn AMORDEGRC(
                span: Span,
                [cost]: f64,
                [date_purchased]: NaiveDate,
                [first_period]: NaiveDate,
                [salvage]: f64,
                [period]: i64,
                [rate]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if cost < 0.0 || salvage < 0.0 || rate <= 0.0 || period < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if date_purchased > first_period {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate the asset life from the rate
                let life = 1.0 / rate;

                // Determine the degressive coefficient based on asset life
                // French accounting rules:
                // - life < 3 years: 1.0
                // - 3 ≤ life < 5 years: 1.5
                // - 5 ≤ life ≤ 6 years: 2.0
                // - life > 6 years: 2.5
                let coefficient = if life < 3.0 {
                    1.0
                } else if life < 5.0 {
                    1.5
                } else if life <= 6.0 {
                    2.0
                } else {
                    2.5
                };

                // Apply the coefficient to the rate
                let adjusted_rate = rate * coefficient;

                // Calculate the number of days in the first period
                let days_in_first_period = days_between(date_purchased, first_period, basis);
                let year_basis = annual_basis(basis);

                // Calculate first period depreciation (prorated and rounded)
                let first_period_depreciation =
                    (cost * adjusted_rate * days_in_first_period / year_basis).round();

                // Track book value and accumulated depreciation
                let mut book_value = cost - first_period_depreciation;
                let max_depreciation = cost - salvage;
                let mut accumulated = first_period_depreciation;

                if period == 0 {
                    // First period: prorated depreciation
                    let result = first_period_depreciation.min(max_depreciation);
                    return Ok(CellValue::from(result));
                }

                // For subsequent periods, calculate depreciation
                for p in 1..=period {
                    if accumulated >= max_depreciation {
                        return Ok(CellValue::from(0.0));
                    }

                    // Calculate this period's depreciation (rounded)
                    let period_depreciation = (book_value * adjusted_rate).round();

                    // Check if we've reached the end of depreciation
                    // The last period gets the remaining amount
                    let remaining = max_depreciation - accumulated;

                    if p == period {
                        // This is the period we're calculating
                        // Check if this is one of the final periods
                        if period_depreciation >= remaining {
                            // Return the remaining amount
                            return Ok(CellValue::from(remaining));
                        } else {
                            return Ok(CellValue::from(period_depreciation));
                        }
                    }

                    // Update for next period
                    let actual_depreciation = period_depreciation.min(remaining);
                    accumulated += actual_depreciation;
                    book_value -= actual_depreciation;
                }

                Ok(CellValue::from(0.0))
            }
        ),
        formula_fn!(
            /// Calculates the net present value of an investment based on a discount rate
            /// and a series of future periodic cash flows.
            ///
            /// - rate: The discount rate over one period
            /// - values: Cash flows, occurring at the end of each period (1, 2, 3, ...).
            ///   The first value is discounted by (1+rate)^1, the second by (1+rate)^2, etc.
            ///
            /// Note: NPV differs from PV in that it discounts the first cash flow.
            /// To include an initial investment at time 0, add it separately: NPV(rate, values) + initial_investment
            #[examples(
                "NPV(0.1, -10000, 3000, 4200, 6800)",
                "NPV(0.08, 8000, 9200, 10000, 12000, 14500) + (-40000)"
            )]
            fn NPV(span: Span, rate: (f64), values: (Iter<f64>)) {
                if rate == -1.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                let mut npv = 0.0;
                let mut period = 1;

                for value in values {
                    let cf = value?;
                    npv += cf / (1.0 + rate).powi(period);
                    period += 1;
                }

                Ok(CellValue::from(npv))
            }
        ),
        formula_fn!(
            /// Calculates the internal rate of return for a series of periodic cash flows.
            ///
            /// - values: An array or range containing cash flows. Must contain at least one
            ///   positive and one negative value.
            /// - [guess]: An initial guess for the rate. Default is 0.1 (10%).
            ///
            /// IRR finds the rate where NPV of the cash flows equals zero.
            /// The first value typically represents the initial investment (negative).
            #[examples(
                "IRR({-100, 30, 35, 40, 45})",
                "IRR({-70000, 12000, 15000, 18000, 21000, 26000}, 0.15)"
            )]
            fn IRR(span: Span, values: (Spanned<Array>), guess: (Option<f64>)) {
                let cash_flows: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if cash_flows.len() < 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Check for at least one positive and one negative value
                let has_positive = cash_flows.iter().any(|&v| v > 0.0);
                let has_negative = cash_flows.iter().any(|&v| v < 0.0);
                if !has_positive || !has_negative {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let guess = guess.unwrap_or(0.1);
                let mut rate = guess;
                let max_iterations = 100;
                let tolerance = 1e-10;
                let mut converged = false;

                // Newton-Raphson method
                for _ in 0..max_iterations {
                    let mut npv = 0.0;
                    let mut dnpv = 0.0; // derivative of NPV with respect to rate

                    for (i, &cf) in cash_flows.iter().enumerate() {
                        let factor = (1.0 + rate).powi(i as i32);
                        if factor == 0.0 {
                            return Err(RunErrorMsg::InvalidArgument.with_span(span));
                        }
                        npv += cf / factor;
                        if i > 0 {
                            dnpv -= (i as f64) * cf / (1.0 + rate).powi(i as i32 + 1);
                        }
                    }

                    if npv.abs() < tolerance {
                        converged = true;
                        break;
                    }

                    if dnpv.abs() < 1e-15 {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }

                    let new_rate = rate - npv / dnpv;

                    if (new_rate - rate).abs() < tolerance {
                        rate = new_rate;
                        converged = true;
                        break;
                    }

                    rate = new_rate;

                    // Prevent rate from going too far negative
                    if rate <= -1.0 {
                        rate = -0.99;
                    }
                }

                if !converged {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                Ok(CellValue::from(rate))
            }
        ),
        formula_fn!(
            /// Calculates the modified internal rate of return for a series of periodic cash flows.
            ///
            /// MIRR considers both the cost of investment (finance rate) and the interest
            /// received on reinvestment of cash (reinvestment rate).
            ///
            /// - values: An array or range containing cash flows. Must contain at least one
            ///   positive and one negative value.
            /// - finance_rate: The interest rate paid on money used for the investment (cost of borrowing)
            /// - reinvest_rate: The interest rate received on cash flows when reinvested
            #[examples("MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.10, 0.12)")]
            fn MIRR(
                span: Span,
                values: (Spanned<Array>),
                finance_rate: (f64),
                reinvest_rate: (f64),
            ) {
                let cash_flows: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let n = cash_flows.len();
                if n < 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Check for at least one positive and one negative value
                let has_positive = cash_flows.iter().any(|&v| v > 0.0);
                let has_negative = cash_flows.iter().any(|&v| v < 0.0);
                if !has_positive || !has_negative {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate present value of negative cash flows (at finance rate)
                let mut pv_negative = 0.0;
                // Calculate future value of positive cash flows (at reinvestment rate)
                let mut fv_positive = 0.0;

                for (i, &cf) in cash_flows.iter().enumerate() {
                    if cf < 0.0 {
                        pv_negative += cf / (1.0 + finance_rate).powi(i as i32);
                    } else {
                        fv_positive += cf * (1.0 + reinvest_rate).powi((n - 1 - i) as i32);
                    }
                }

                if pv_negative >= 0.0 || fv_positive <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // MIRR = (FV_positive / -PV_negative)^(1/(n-1)) - 1
                let mirr = (-fv_positive / pv_negative).powf(1.0 / (n - 1) as f64) - 1.0;

                Ok(CellValue::from(mirr))
            }
        ),
        formula_fn!(
            /// Calculates the net present value for cash flows that are not necessarily periodic.
            ///
            /// - rate: The discount rate to apply
            /// - values: A series of cash flows corresponding to the dates
            /// - dates: A series of dates corresponding to the cash flows
            ///
            /// The first date is the basis for discounting. Cash flows are discounted
            /// based on a 365-day year.
            #[examples(
                "XNPV(0.09, {-10000, 2750, 4250, 3250, 2750}, {DATE(2008,1,1), DATE(2008,3,1), DATE(2008,10,30), DATE(2009,2,15), DATE(2009,4,1)})"
            )]
            fn XNPV(span: Span, rate: (f64), values: (Spanned<Array>), dates: (Spanned<Array>)) {
                if rate <= -1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let cash_flows: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let date_values: Vec<NaiveDate> = dates
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Date(d) => Some(*d),
                        CellValue::DateTime(dt) => Some(dt.date()),
                        _ => None,
                    })
                    .collect();

                if cash_flows.is_empty() || date_values.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                if cash_flows.len() != date_values.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // First date is the basis
                let base_date = date_values[0];

                let mut npv = 0.0;
                for (i, &cf) in cash_flows.iter().enumerate() {
                    let days = (date_values[i] - base_date).num_days() as f64;
                    let years = days / 365.0;
                    npv += cf / (1.0 + rate).powf(years);
                }

                Ok(CellValue::from(npv))
            }
        ),
        formula_fn!(
            /// Calculates the internal rate of return for cash flows that are not necessarily periodic.
            ///
            /// - values: A series of cash flows. Must contain at least one positive and one negative value.
            /// - dates: A series of dates corresponding to the cash flows. The first date is the start of the investment.
            /// - [guess]: An initial guess for the rate. Default is 0.1 (10%).
            ///
            /// XIRR finds the rate where XNPV of the cash flows equals zero.
            #[examples(
                "XIRR({-10000, 2750, 4250, 3250, 2750}, {DATE(2008,1,1), DATE(2008,3,1), DATE(2008,10,30), DATE(2009,2,15), DATE(2009,4,1)}, 0.1)"
            )]
            fn XIRR(
                span: Span,
                values: (Spanned<Array>),
                dates: (Spanned<Array>),
                guess: (Option<f64>),
            ) {
                let cash_flows: Vec<f64> = values
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                let date_values: Vec<NaiveDate> = dates
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|cv| match cv {
                        CellValue::Date(d) => Some(*d),
                        CellValue::DateTime(dt) => Some(dt.date()),
                        _ => None,
                    })
                    .collect();

                if cash_flows.len() < 2 || date_values.len() < 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                if cash_flows.len() != date_values.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Check for at least one positive and one negative value
                let has_positive = cash_flows.iter().any(|&v| v > 0.0);
                let has_negative = cash_flows.iter().any(|&v| v < 0.0);
                if !has_positive || !has_negative {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let base_date = date_values[0];
                let guess = guess.unwrap_or(0.1);
                let mut rate = guess;
                let max_iterations = 100;
                let tolerance = 1e-10;
                let mut converged = false;

                // Calculate year fractions once
                let year_fractions: Vec<f64> = date_values
                    .iter()
                    .map(|d| ((*d - base_date).num_days() as f64) / 365.0)
                    .collect();

                // Newton-Raphson method
                for _ in 0..max_iterations {
                    let mut xnpv = 0.0;
                    let mut dxnpv = 0.0; // derivative

                    for (i, &cf) in cash_flows.iter().enumerate() {
                        let t = year_fractions[i];
                        let factor = (1.0 + rate).powf(t);
                        if factor == 0.0 || factor.is_nan() || factor.is_infinite() {
                            return Err(RunErrorMsg::InvalidArgument.with_span(span));
                        }
                        xnpv += cf / factor;
                        if t != 0.0 {
                            dxnpv -= t * cf / (1.0 + rate).powf(t + 1.0);
                        }
                    }

                    if xnpv.abs() < tolerance {
                        converged = true;
                        break;
                    }

                    if dxnpv.abs() < 1e-15 {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }

                    let new_rate = rate - xnpv / dxnpv;

                    if (new_rate - rate).abs() < tolerance {
                        rate = new_rate;
                        converged = true;
                        break;
                    }

                    rate = new_rate;

                    // Prevent rate from going too far negative
                    if rate <= -1.0 {
                        rate = -0.99;
                    }
                }

                if !converged {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                Ok(CellValue::from(rate))
            }
        ),
        formula_fn!(
            /// Calculates the future value of an initial principal after applying a series of compound interest rates.
            ///
            /// - principal: The initial value (present value) of the investment
            /// - schedule: An array of interest rates to apply. Each rate is applied in sequence.
            ///
            /// FVSCHEDULE is useful for calculating compound growth with variable rates.
            #[examples(
                "FVSCHEDULE(1, {0.09, 0.11, 0.1})",
                "FVSCHEDULE(10000, {0.05, 0.06, 0.07, 0.08})"
            )]
            fn FVSCHEDULE(span: Span, principal: (f64), schedule: (Spanned<Array>)) {
                let rates: Vec<f64> = schedule
                    .inner
                    .cell_values_slice()
                    .iter()
                    .filter_map(|v| v.coerce_nonblank::<f64>())
                    .collect();

                if rates.is_empty() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let mut fv = principal;
                for rate in rates {
                    fv *= 1.0 + rate;
                }

                Ok(CellValue::from(fv))
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a discounted security.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - discount: The security's discount rate
            /// - redemption: The security's redemption value per $100 face value
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.0525, 100)",
                "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.0525, 100, 2)"
            )]
            #[zip_map]
            fn PRICEDISC(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [discount]: f64,
                [redemption]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if discount <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate days from settlement to maturity
                let dsm = days_between(settlement, maturity, basis);
                let b = annual_basis(basis);

                // Price = redemption - discount * redemption * (DSM / B)
                // Which is equivalent to: redemption * (1 - discount * DSM / B)
                let price = redemption * (1.0 - discount * dsm / b);

                Ok(CellValue::from(price))
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a security that pays interest at maturity.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - issue: The security's issue date
            /// - rate: The security's annual interest rate at date of issue
            /// - yld: The security's annual yield
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.061, 0.061)",
                "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.061, 0.061, 0)"
            )]
            #[zip_map]
            fn PRICEMAT(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [issue]: NaiveDate,
                [rate]: f64,
                [yld]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let b = annual_basis(basis);

                // Calculate day counts
                let dim = days_between(issue, maturity, basis); // Days from issue to maturity
                let dsm = days_between(settlement, maturity, basis); // Days from settlement to maturity
                let a = days_between(issue, settlement, basis); // Days from issue to settlement (accrued interest)

                // Price formula for security paying interest at maturity:
                // Price = (100 + (DIM/B * rate * 100)) / (1 + (DSM/B * yld)) - (A/B * rate * 100)
                let numerator = 100.0 + (dim / b * rate * 100.0);
                let denominator = 1.0 + (dsm / b * yld);
                let accrued_interest = a / b * rate * 100.0;

                let price = numerator / denominator - accrued_interest;

                Ok(CellValue::from(price))
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a security that pays periodic interest.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - rate: The security's annual coupon rate
            /// - yld: The security's annual yield
            /// - redemption: The security's redemption value per $100 face value
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 2)",
                "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 2, 0)"
            )]
            #[zip_map]
            fn PRICE(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [rate]: f64,
                [yld]: f64,
                [redemption]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let price = calculate_bond_price(
                    settlement, maturity, rate, yld, redemption, frequency, basis,
                )
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;

                Ok(CellValue::from(price))
            }
        ),
        formula_fn!(
            /// Returns the annual yield for a discounted security.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - price: The security's price per $100 face value
            /// - redemption: The security's redemption value per $100 face value
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "YIELDDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100)",
                "YIELDDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100, 2)"
            )]
            #[zip_map]
            fn YIELDDISC(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [price]: f64,
                [redemption]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if price <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate days from settlement to maturity
                let dsm = days_between(settlement, maturity, basis);
                let b = annual_basis(basis);

                // Yield = ((redemption - price) / price) * (B / DSM)
                let yld = ((redemption - price) / price) * (b / dsm);

                Ok(CellValue::from(yld))
            }
        ),
        formula_fn!(
            /// Returns the annual yield of a security that pays interest at maturity.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - issue: The security's issue date
            /// - rate: The security's annual interest rate at date of issue
            /// - price: The security's price per $100 face value
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "YIELDMAT(DATE(2008, 3, 15), DATE(2008, 11, 3), DATE(2007, 11, 8), 0.0625, 100.0123)",
                "YIELDMAT(DATE(2008, 3, 15), DATE(2008, 11, 3), DATE(2007, 11, 8), 0.0625, 100.0123, 0)"
            )]
            #[zip_map]
            fn YIELDMAT(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [issue]: NaiveDate,
                [rate]: f64,
                [price]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || price <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let b = annual_basis(basis);

                // Calculate day counts
                let dim = days_between(issue, maturity, basis); // Days from issue to maturity
                let dsm = days_between(settlement, maturity, basis); // Days from settlement to maturity
                let a = days_between(issue, settlement, basis); // Days from issue to settlement (accrued interest)

                // Yield formula for security paying interest at maturity:
                // Yield = ((100 + DIM/B * rate * 100) / (price + A/B * rate * 100) - 1) * (B / DSM)
                let term1 = 100.0 + (dim / b * rate * 100.0);
                let term2 = price + (a / b * rate * 100.0);
                let yld = (term1 / term2 - 1.0) * (b / dsm);

                Ok(CellValue::from(yld))
            }
        ),
        formula_fn!(
            /// Returns the yield on a security that pays periodic interest.
            ///
            /// Uses Newton-Raphson iteration to find the yield.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - rate: The security's annual coupon rate
            /// - price: The security's price per $100 face value
            /// - redemption: The security's redemption value per $100 face value
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.0575, 95.04287, 100, 2)",
                "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.0575, 95.04287, 100, 2, 0)"
            )]
            #[zip_map]
            fn YIELD(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [rate]: f64,
                [price]: f64,
                [redemption]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || price <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Use Newton-Raphson to find yield such that PRICE(yield) = price
                const MAX_ITERATIONS: i32 = 100;
                const TOLERANCE: f64 = 1e-10;

                // Initial guess: use coupon rate as starting point
                let mut yld = if rate > 0.0 { rate } else { 0.1 };
                let mut converged = false;

                for _ in 0..MAX_ITERATIONS {
                    // Calculate price at current yield
                    let calc_price = match calculate_bond_price(
                        settlement, maturity, rate, yld, redemption, frequency, basis,
                    ) {
                        Ok(p) => p,
                        Err(_) => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    };

                    // Calculate price at yield + small delta for numerical derivative
                    let delta = 0.0001;
                    let calc_price_delta = match calculate_bond_price(
                        settlement,
                        maturity,
                        rate,
                        yld + delta,
                        redemption,
                        frequency,
                        basis,
                    ) {
                        Ok(p) => p,
                        Err(_) => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    };

                    let f = calc_price - price;
                    let f_prime = (calc_price_delta - calc_price) / delta;

                    if f.abs() < TOLERANCE {
                        converged = true;
                        break;
                    }

                    if f_prime.abs() < 1e-15 {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }

                    let new_yld = yld - f / f_prime;

                    if (new_yld - yld).abs() < TOLERANCE {
                        yld = new_yld;
                        converged = true;
                        break;
                    }

                    yld = new_yld;

                    // Keep yield in reasonable bounds
                    if yld < -0.99 {
                        yld = -0.99;
                    } else if yld > 10.0 {
                        yld = 10.0;
                    }
                }

                if !converged {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                Ok(CellValue::from(yld))
            }
        ),
        formula_fn!(
            /// Returns the Macaulay duration for a security with an assumed par value of $100.
            ///
            /// Duration is defined as the weighted average of the present value of cash flows,
            /// and is used as a measure of a bond price's response to changes in yield.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - coupon: The security's annual coupon rate
            /// - yld: The security's annual yield
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2)",
                "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2, 1)"
            )]
            #[zip_map]
            fn DURATION(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [coupon]: f64,
                [yld]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if coupon < 0.0 || yld < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let duration = calculate_macaulay_duration(
                    settlement, maturity, coupon, yld, frequency, basis,
                )
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;

                Ok(CellValue::from(duration))
            }
        ),
        formula_fn!(
            /// Returns the modified Macaulay duration for a security with an assumed par value of $100.
            ///
            /// Modified duration measures the price sensitivity of a bond to changes in yield.
            /// It is calculated as: MDURATION = DURATION / (1 + yld/frequency)
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - coupon: The security's annual coupon rate
            /// - yld: The security's annual yield
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2)",
                "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2, 1)"
            )]
            #[zip_map]
            fn MDURATION(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [coupon]: f64,
                [yld]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if coupon < 0.0 || yld < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let duration = calculate_macaulay_duration(
                    settlement, maturity, coupon, yld, frequency, basis,
                )
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;

                // Modified duration = Macaulay duration / (1 + yld/frequency)
                let mduration = duration / (1.0 + yld / frequency as f64);

                Ok(CellValue::from(mduration))
            }
        ),
        formula_fn!(
            /// Returns the discount rate for a security.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - pr: The security's price per $100 face value
            /// - redemption: The security's redemption value per $100 face value
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100)",
                "DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100, 2)"
            )]
            #[zip_map]
            fn DISC(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [pr]: f64,
                [redemption]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if pr <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate days from settlement to maturity
                let dsm = days_between(settlement, maturity, basis);
                let b = annual_basis(basis);

                // DISC = (redemption - pr) / redemption * (B / DSM)
                let disc = ((redemption - pr) / redemption) * (b / dsm);

                Ok(CellValue::from(disc))
            }
        ),
        formula_fn!(
            /// Returns the interest rate for a fully invested security.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - investment: The amount invested in the security
            /// - redemption: The amount to be received at maturity
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "INTRATE(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 1014420)",
                "INTRATE(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 1014420, 2)"
            )]
            #[zip_map]
            fn INTRATE(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [investment]: f64,
                [redemption]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if investment <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate days from settlement to maturity
                let dsm = days_between(settlement, maturity, basis);
                let b = annual_basis(basis);

                // INTRATE = (redemption - investment) / investment * (B / DSM)
                let intrate = ((redemption - investment) / investment) * (b / dsm);

                Ok(CellValue::from(intrate))
            }
        ),
        formula_fn!(
            /// Returns the amount received at maturity for a fully invested security.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - investment: The amount invested in the security
            /// - discount: The security's discount rate
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 0.0575)",
                "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 0.0575, 2)"
            )]
            #[zip_map]
            fn RECEIVED(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [investment]: f64,
                [discount]: f64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if investment <= 0.0 || discount < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Calculate days from settlement to maturity
                let dsm = days_between(settlement, maturity, basis);
                let b = annual_basis(basis);

                // Check for division by zero
                let denominator = 1.0 - discount * (dsm / b);
                if denominator <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // RECEIVED = investment / (1 - discount * (DSM / B))
                let received = investment / denominator;

                Ok(CellValue::from(received))
            }
        ),
        formula_fn!(
            /// Returns the bond-equivalent yield for a Treasury bill.
            ///
            /// T-bills are short-term securities sold at a discount from face value. This function
            /// calculates the bond-equivalent yield, which allows comparison with coupon bonds.
            ///
            /// - settlement: The Treasury bill's settlement date
            /// - maturity: The Treasury bill's maturity date (must be within one year of settlement)
            /// - discount: The Treasury bill's discount rate
            ///
            /// Note: Maturity must be more than one day but no more than one year after settlement.
            #[examples(
                "TBILLEQ(DATE(2008, 3, 31), DATE(2008, 6, 1), 0.0914)",
                "TBILLEQ(DATE(2023, 1, 15), DATE(2023, 4, 15), 0.05)"
            )]
            #[zip_map]
            fn TBILLEQ(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [discount]: f64,
            ) {
                // Calculate days from settlement to maturity
                let dsm = days_actual(settlement, maturity) as f64;

                // Validate inputs
                // Maturity must be after settlement
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Maturity must be within one year (366 days to account for leap years)
                if dsm > 366.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Discount rate must be positive
                if discount <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Check for division by zero (when discount * dsm = 360)
                let denominator = 360.0 - discount * dsm;
                if denominator <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Bond-equivalent yield formula:
                // TBILLEQ = (365 * discount) / (360 - discount * DSM)
                let tbilleq = (365.0 * discount) / denominator;

                Ok(CellValue::from(tbilleq))
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value for a Treasury bill.
            ///
            /// T-bills are short-term securities sold at a discount from face value.
            /// This function calculates the price based on the discount rate.
            ///
            /// - settlement: The Treasury bill's settlement date
            /// - maturity: The Treasury bill's maturity date (must be within one year of settlement)
            /// - discount: The Treasury bill's discount rate
            ///
            /// Note: Maturity must be more than one day but no more than one year after settlement.
            #[examples(
                "TBILLPRICE(DATE(2008, 3, 31), DATE(2008, 6, 1), 0.09)",
                "TBILLPRICE(DATE(2023, 1, 15), DATE(2023, 4, 15), 0.05)"
            )]
            #[zip_map]
            fn TBILLPRICE(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [discount]: f64,
            ) {
                // Calculate days from settlement to maturity
                let dsm = days_actual(settlement, maturity) as f64;

                // Validate inputs
                // Maturity must be after settlement
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Maturity must be within one year (366 days to account for leap years)
                if dsm > 366.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Discount rate must be non-negative
                if discount < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Price formula for T-bill:
                // TBILLPRICE = 100 * (1 - discount * DSM / 360)
                let price = 100.0 * (1.0 - discount * dsm / 360.0);

                // Price must be positive
                if price <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                Ok(CellValue::from(price))
            }
        ),
        formula_fn!(
            /// Returns the yield for a Treasury bill.
            ///
            /// T-bills are short-term securities sold at a discount from face value.
            /// This function calculates the yield based on the price.
            ///
            /// - settlement: The Treasury bill's settlement date
            /// - maturity: The Treasury bill's maturity date (must be within one year of settlement)
            /// - price: The Treasury bill's price per $100 face value
            ///
            /// Note: Maturity must be more than one day but no more than one year after settlement.
            #[examples(
                "TBILLYIELD(DATE(2008, 3, 31), DATE(2008, 6, 1), 98.45)",
                "TBILLYIELD(DATE(2023, 1, 15), DATE(2023, 4, 15), 98.75)"
            )]
            #[zip_map]
            fn TBILLYIELD(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [price]: f64,
            ) {
                // Calculate days from settlement to maturity
                let dsm = days_actual(settlement, maturity) as f64;

                // Validate inputs
                // Maturity must be after settlement
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Maturity must be within one year (366 days to account for leap years)
                if dsm > 366.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // Price must be positive
                if price <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Yield formula for T-bill:
                // TBILLYIELD = ((100 - price) / price) * (360 / DSM)
                let yld = ((100.0 - price) / price) * (360.0 / dsm);

                Ok(CellValue::from(yld))
            }
        ),
        formula_fn!(
            /// Returns the effective annual interest rate given the nominal annual interest rate and the number of compounding periods per year.
            ///
            /// - nominal_rate: The nominal annual interest rate
            /// - npery: The number of compounding periods per year
            #[examples("EFFECT(0.0525, 4)", "EFFECT(0.1, 12)")]
            #[zip_map]
            fn EFFECT(span: Span, [nominal_rate]: f64, [npery]: f64) {
                // Validate inputs
                if nominal_rate <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if npery < 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Use floor of npery for compounding periods
                let npery = npery.floor();

                // EFFECT = (1 + nominal_rate/npery)^npery - 1
                let effect = (1.0 + nominal_rate / npery).powf(npery) - 1.0;

                Ok(CellValue::from(effect))
            }
        ),
        formula_fn!(
            /// Returns the nominal annual interest rate given the effective annual interest rate and the number of compounding periods per year.
            ///
            /// - effect_rate: The effective annual interest rate
            /// - npery: The number of compounding periods per year
            #[examples("NOMINAL(0.053543, 4)", "NOMINAL(0.1, 12)")]
            #[zip_map]
            fn NOMINAL(span: Span, [effect_rate]: f64, [npery]: f64) {
                // Validate inputs
                if effect_rate <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if npery < 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Use floor of npery for compounding periods
                let npery = npery.floor();

                // NOMINAL = npery * ((1 + effect_rate)^(1/npery) - 1)
                let nominal = npery * ((1.0 + effect_rate).powf(1.0 / npery) - 1.0);

                Ok(CellValue::from(nominal))
            }
        ),
        formula_fn!(
            /// Returns an equivalent interest rate for the growth of an investment.
            ///
            /// - nper: The number of periods for the investment
            /// - pv: The present value of the investment
            /// - fv: The future value of the investment
            #[examples("RRI(96, 10000, 11000)", "RRI(12, 1000, 2000)")]
            #[zip_map]
            fn RRI(span: Span, [nper]: f64, [pv]: f64, [fv]: f64) {
                // Validate inputs
                if nper <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if pv == 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                // pv and fv must have the same sign
                if (pv > 0.0 && fv < 0.0) || (pv < 0.0 && fv > 0.0) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // RRI = (fv/pv)^(1/nper) - 1
                let rri = (fv / pv).powf(1.0 / nper) - 1.0;

                Ok(CellValue::from(rri))
            }
        ),
        formula_fn!(
            /// Returns the number of periods required by an investment to reach a specified value.
            ///
            /// - rate: The interest rate per period
            /// - pv: The present value of the investment
            /// - fv: The future value of the investment
            #[examples("PDURATION(0.025, 2000, 2200)", "PDURATION(0.05, 1000, 2000)")]
            #[zip_map]
            fn PDURATION(span: Span, [rate]: f64, [pv]: f64, [fv]: f64) {
                // Validate inputs
                if rate <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if pv <= 0.0 || fv <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // PDURATION = (log(fv) - log(pv)) / log(1 + rate)
                let pduration = (fv.ln() - pv.ln()) / (1.0 + rate).ln();

                Ok(CellValue::from(pduration))
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a security with an odd (short or long) first period.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - issue: The security's issue date
            /// - first_coupon: The security's first coupon date
            /// - rate: The security's annual coupon rate
            /// - yld: The security's annual yield
            /// - redemption: The security's redemption value per $100 face value
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "ODDFPRICE(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 0.0625, 100, 2, 1)"
            )]
            #[zip_map]
            fn ODDFPRICE(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [issue]: NaiveDate,
                [first_coupon]: NaiveDate,
                [rate]: f64,
                [yld]: f64,
                [redemption]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement || settlement >= first_coupon || first_coupon >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let price = calculate_odd_first_price(
                    settlement,
                    maturity,
                    issue,
                    first_coupon,
                    rate,
                    yld,
                    redemption,
                    frequency,
                    basis,
                )
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;

                Ok(CellValue::from(price))
            }
        ),
        formula_fn!(
            /// Returns the yield of a security with an odd (short or long) first period.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - issue: The security's issue date
            /// - first_coupon: The security's first coupon date
            /// - rate: The security's annual coupon rate
            /// - price: The security's price per $100 face value
            /// - redemption: The security's redemption value per $100 face value
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "ODDFYIELD(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 84.50, 100, 2, 1)"
            )]
            #[zip_map]
            fn ODDFYIELD(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [issue]: NaiveDate,
                [first_coupon]: NaiveDate,
                [rate]: f64,
                [price]: f64,
                [redemption]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement || settlement >= first_coupon || first_coupon >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || price <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Use Newton-Raphson to find yield such that ODDFPRICE(yield) = price
                const MAX_ITERATIONS: i32 = 100;
                const TOLERANCE: f64 = 1e-10;

                // Initial guess
                let mut yld = if rate > 0.0 { rate } else { 0.1 };
                let mut converged = false;

                for _ in 0..MAX_ITERATIONS {
                    let calc_price = match calculate_odd_first_price(
                        settlement,
                        maturity,
                        issue,
                        first_coupon,
                        rate,
                        yld,
                        redemption,
                        frequency,
                        basis,
                    ) {
                        Ok(p) => p,
                        Err(_) => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    };

                    let delta = 0.0001;
                    let calc_price_delta = match calculate_odd_first_price(
                        settlement,
                        maturity,
                        issue,
                        first_coupon,
                        rate,
                        yld + delta,
                        redemption,
                        frequency,
                        basis,
                    ) {
                        Ok(p) => p,
                        Err(_) => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    };

                    let f = calc_price - price;
                    let f_prime = (calc_price_delta - calc_price) / delta;

                    if f_prime.abs() < 1e-20 {
                        break;
                    }

                    let new_yld = yld - f / f_prime;

                    if (new_yld - yld).abs() < TOLERANCE {
                        yld = new_yld;
                        converged = true;
                        break;
                    }

                    yld = new_yld;

                    if yld <= -1.0 {
                        yld = -0.99;
                    }
                }

                if !converged {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                Ok(CellValue::from(yld))
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a security with an odd (short or long) last period.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - last_interest: The security's last coupon date before maturity
            /// - rate: The security's annual coupon rate
            /// - yld: The security's annual yield
            /// - redemption: The security's redemption value per $100 face value
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "ODDLPRICE(DATE(2008, 2, 7), DATE(2008, 6, 15), DATE(2007, 10, 15), 0.0375, 0.0405, 100, 2, 0)"
            )]
            #[zip_map]
            fn ODDLPRICE(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [last_interest]: NaiveDate,
                [rate]: f64,
                [yld]: f64,
                [redemption]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if last_interest >= settlement || settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let price = calculate_odd_last_price(
                    settlement,
                    maturity,
                    last_interest,
                    rate,
                    yld,
                    redemption,
                    frequency,
                    basis,
                )
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;

                Ok(CellValue::from(price))
            }
        ),
        formula_fn!(
            /// Returns the yield of a security with an odd (short or long) last period.
            ///
            /// - settlement: The security's settlement date
            /// - maturity: The security's maturity date
            /// - last_interest: The security's last coupon date before maturity
            /// - rate: The security's annual coupon rate
            /// - price: The security's price per $100 face value
            /// - redemption: The security's redemption value per $100 face value
            /// - frequency: The number of coupon payments per year (1=annual, 2=semi-annual, 4=quarterly)
            /// - [basis]: The day count basis (0=US 30/360, 1=Actual/actual, 2=Actual/360, 3=Actual/365, 4=European 30/360). Default is 0.
            #[examples(
                "ODDLYIELD(DATE(2008, 4, 20), DATE(2008, 6, 15), DATE(2007, 12, 24), 0.0375, 99.875, 100, 2, 0)"
            )]
            #[zip_map]
            fn ODDLYIELD(
                span: Span,
                [settlement]: NaiveDate,
                [maturity]: NaiveDate,
                [last_interest]: NaiveDate,
                [rate]: f64,
                [price]: f64,
                [redemption]: f64,
                [frequency]: i64,
                [basis]: (Option<i64>),
            ) {
                let basis = basis.unwrap_or(0);

                // Validate inputs
                if frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if last_interest >= settlement || settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || price <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Use Newton-Raphson to find yield such that ODDLPRICE(yield) = price
                const MAX_ITERATIONS: i32 = 100;
                const TOLERANCE: f64 = 1e-10;

                // Initial guess
                let mut yld = if rate > 0.0 { rate } else { 0.1 };
                let mut converged = false;

                for _ in 0..MAX_ITERATIONS {
                    let calc_price = match calculate_odd_last_price(
                        settlement,
                        maturity,
                        last_interest,
                        rate,
                        yld,
                        redemption,
                        frequency,
                        basis,
                    ) {
                        Ok(p) => p,
                        Err(_) => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    };

                    let delta = 0.0001;
                    let calc_price_delta = match calculate_odd_last_price(
                        settlement,
                        maturity,
                        last_interest,
                        rate,
                        yld + delta,
                        redemption,
                        frequency,
                        basis,
                    ) {
                        Ok(p) => p,
                        Err(_) => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    };

                    let f = calc_price - price;
                    let f_prime = (calc_price_delta - calc_price) / delta;

                    if f_prime.abs() < 1e-20 {
                        break;
                    }

                    let new_yld = yld - f / f_prime;

                    if (new_yld - yld).abs() < TOLERANCE {
                        yld = new_yld;
                        converged = true;
                        break;
                    }

                    yld = new_yld;

                    if yld <= -1.0 {
                        yld = -0.99;
                    }
                }

                if !converged {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                Ok(CellValue::from(yld))
            }
        ),
        formula_fn!(
            /// Converts a dollar price expressed as a fraction into a decimal number.
            ///
            /// In fractional notation, the decimal portion represents a fraction where `fraction`
            /// is the denominator. For example, 1.02 with fraction=16 means 1 and 2/16 dollars.
            ///
            /// - fractional_dollar: A number expressed as an integer part and a fractional part
            /// - fraction: The integer to use as the denominator of the fraction
            ///
            /// Returns the dollar value as a decimal number.
            #[examples("DOLLARDE(1.02, 16)", "DOLLARDE(1.1, 8)")]
            #[zip_map]
            fn DOLLARDE(span: Span, [fractional_dollar]: f64, [fraction]: f64) {
                // Fraction must be >= 1
                let fraction = fraction.trunc();
                if fraction < 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Handle the sign
                let sign = fractional_dollar.signum();
                let abs_value = fractional_dollar.abs();

                // Split into integer and fractional parts
                let integer_part = abs_value.trunc();
                let fractional_part = abs_value - integer_part;

                // Calculate the number of decimal places needed for the fraction
                // This is ceil(log10(fraction))
                let decimal_places = fraction.log10().ceil();
                let multiplier = 10_f64.powf(decimal_places);

                // Convert: the fractional part represents numerator/10^n, we want numerator/fraction
                let decimal_value = integer_part + (fractional_part * multiplier) / fraction;

                Ok(CellValue::from(sign * decimal_value))
            }
        ),
        formula_fn!(
            /// Converts a dollar price expressed as a decimal into a fractional notation.
            ///
            /// This is the inverse of DOLLARDE. The result uses fractional notation where
            /// the decimal portion represents a fraction with `fraction` as the denominator.
            ///
            /// - decimal_dollar: A decimal number
            /// - fraction: The integer to use as the denominator of the fraction
            ///
            /// Returns the dollar value in fractional notation.
            #[examples("DOLLARFR(1.125, 16)", "DOLLARFR(1.125, 8)")]
            #[zip_map]
            fn DOLLARFR(span: Span, [decimal_dollar]: f64, [fraction]: f64) {
                // Fraction must be >= 1
                let fraction = fraction.trunc();
                if fraction < 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Handle the sign
                let sign = decimal_dollar.signum();
                let abs_value = decimal_dollar.abs();

                // Split into integer and fractional parts
                let integer_part = abs_value.trunc();
                let fractional_part = abs_value - integer_part;

                // Calculate the number of decimal places needed for the fraction
                let decimal_places = fraction.log10().ceil();
                let divisor = 10_f64.powf(decimal_places);

                // Convert: the fractional part (as decimal) becomes numerator/10^n
                let fractional_value = integer_part + (fractional_part * fraction) / divisor;

                Ok(CellValue::from(sign * fractional_value))
            }
        ),
    ]
}

/// Helper function to calculate bond price for PRICE and YIELD functions
fn calculate_bond_price(
    settlement: NaiveDate,
    maturity: NaiveDate,
    rate: f64,
    yld: f64,
    redemption: f64,
    frequency: i64,
    basis: i64,
) -> Result<f64, ()> {
    // Get number of coupons
    let n = count_coupons(settlement, maturity, frequency).ok_or(())?;

    // Get previous and next coupon dates
    let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency).ok_or(())?;
    let next_coupon = find_next_coupon_date(settlement, maturity, frequency).ok_or(())?;

    // Calculate E = days in coupon period
    let e = coupon_days_in_period(prev_coupon, next_coupon, frequency, basis);

    // Calculate DSC = days from settlement to next coupon
    let dsc = e - coupon_days_from_start(prev_coupon, settlement, basis);

    // Calculate A = days from beginning of coupon period to settlement (for accrued interest)
    let a = coupon_days_from_start(prev_coupon, settlement, basis);

    // Coupon payment per period
    let coupon = 100.0 * rate / frequency as f64;

    // Accrued interest
    let accrued = coupon * a / e;

    // Calculate price
    let price = if n == 1 {
        // Special case: one coupon remaining
        // Price = (redemption + coupon) / (1 + (DSC/E) * (yld/freq)) - accrued
        (redemption + coupon) / (1.0 + (dsc / e) * (yld / frequency as f64)) - accrued
    } else {
        // General case: multiple coupons
        // Price = redemption / (1 + yld/freq)^(N-1+DSC/E)
        //       + sum of coupon / (1 + yld/freq)^(k-1+DSC/E) for k = 1 to N
        //       - accrued

        let yld_per_period = yld / frequency as f64;
        let dsc_frac = dsc / e;

        // Redemption value discounted
        let pv_redemption = redemption / (1.0 + yld_per_period).powf((n - 1) as f64 + dsc_frac);

        // Sum of coupon payments discounted
        let mut pv_coupons = 0.0;
        for k in 1..=n {
            pv_coupons += coupon / (1.0 + yld_per_period).powf((k - 1) as f64 + dsc_frac);
        }

        pv_redemption + pv_coupons - accrued
    };

    Ok(price)
}

/// Helper function to calculate Macaulay duration for DURATION and MDURATION functions
fn calculate_macaulay_duration(
    settlement: NaiveDate,
    maturity: NaiveDate,
    coupon_rate: f64,
    yld: f64,
    frequency: i64,
    basis: i64,
) -> Result<f64, ()> {
    // Get number of coupons
    let n = count_coupons(settlement, maturity, frequency).ok_or(())?;

    // Get previous and next coupon dates
    let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency).ok_or(())?;
    let next_coupon = find_next_coupon_date(settlement, maturity, frequency).ok_or(())?;

    // Calculate E = days in coupon period
    let e = coupon_days_in_period(prev_coupon, next_coupon, frequency, basis);

    // Calculate DSC = days from settlement to next coupon
    let dsc = e - coupon_days_from_start(prev_coupon, settlement, basis);

    // Coupon payment per period per $100 face value
    let coupon = 100.0 * coupon_rate / frequency as f64;

    // Yield per period
    let yld_per_period = yld / frequency as f64;

    // Fraction of period from settlement to next coupon
    let dsc_frac = dsc / e;

    // Calculate duration using the weighted average of present values
    // Duration = (1/Price) * sum of (t * PV of cash flow at time t)
    // where t is measured in years from settlement

    let mut weighted_pv_sum = 0.0;
    let mut pv_sum = 0.0;

    if n == 1 {
        // Special case: one coupon remaining
        // Time to maturity in years
        let t = dsc_frac / frequency as f64;

        // PV of redemption + coupon at maturity
        let pv = (100.0 + coupon) / (1.0 + dsc_frac * yld_per_period);

        weighted_pv_sum = t * pv;
        pv_sum = pv;
    } else {
        // General case: multiple coupons
        // For each coupon payment k (k = 1 to n):
        //   Time to payment = (dsc_frac + (k-1)) / frequency years
        //   PV = coupon / (1 + yld_per_period)^(dsc_frac + (k-1))

        for k in 1..=n {
            let exponent = dsc_frac + (k - 1) as f64;
            let discount_factor = (1.0 + yld_per_period).powf(exponent);
            let pv_coupon = coupon / discount_factor;

            // Time in years from settlement
            let t = exponent / frequency as f64;

            weighted_pv_sum += t * pv_coupon;
            pv_sum += pv_coupon;
        }

        // Add redemption value at maturity
        let exponent = dsc_frac + (n - 1) as f64;
        let discount_factor = (1.0 + yld_per_period).powf(exponent);
        let pv_redemption = 100.0 / discount_factor;
        let t = exponent / frequency as f64;

        weighted_pv_sum += t * pv_redemption;
        pv_sum += pv_redemption;
    }

    // Duration = weighted sum / total PV
    if pv_sum == 0.0 {
        return Err(());
    }

    Ok(weighted_pv_sum / pv_sum)
}

/// Helper function to calculate bond price for securities with odd first period
fn calculate_odd_first_price(
    settlement: NaiveDate,
    maturity: NaiveDate,
    issue: NaiveDate,
    first_coupon: NaiveDate,
    rate: f64,
    yld: f64,
    redemption: f64,
    frequency: i64,
    basis: i64,
) -> Result<f64, ()> {
    // Validate frequency (returned value not needed)
    frequency_to_months(frequency).ok_or(())?;

    // Coupon payment per period per $100 face value
    let coupon = 100.0 * rate / frequency as f64;

    // Find the quasi-coupon date before the issue date
    let dfc_start = find_quasi_coupon_before_issue(issue, first_coupon, frequency).ok_or(())?;

    // Calculate the number of quasi-coupon periods in the odd first period
    let nc = count_quasi_coupon_periods(dfc_start, first_coupon, frequency).ok_or(())?;

    // Calculate E = days in a normal coupon period (using dates around settlement for basis 1)
    let e = coupon_days_in_period(dfc_start, first_coupon, frequency, basis) / nc.max(1) as f64;

    // Number of coupons remaining from first coupon to maturity
    let n = count_coupons(first_coupon, maturity, frequency)
        .ok_or(())?
        .saturating_add(1); // +1 to include first coupon

    // Determine if this is a short or long odd first period
    // Short: settlement is between quasi-coupon date and first coupon (nc <= 1)
    // Long: there are multiple quasi-coupon periods before first coupon (nc > 1)

    let yld_per_period = yld / frequency as f64;

    // Calculate DSC = days from settlement to first coupon
    let dsc = days_between(settlement, first_coupon, basis);

    // Calculate DFC = days from issue to first coupon (for odd first coupon payment)
    let dfc = days_between(issue, first_coupon, basis);

    // Calculate A = days from issue to settlement (for accrued interest)
    let a = days_between(issue, settlement, basis);

    if n == 1 {
        // Only one coupon period (the odd first period) remaining
        // This is the formula for odd first security maturing on first coupon

        // First coupon is prorated based on the odd period
        let odd_first_coupon = coupon * dfc / e;

        // Accrued interest
        let accrued = coupon * a / e;

        // Price = (redemption + odd_first_coupon) / (1 + dsc/e * yld/freq) - accrued
        let price = (redemption + odd_first_coupon) / (1.0 + (dsc / e) * yld_per_period) - accrued;

        Ok(price)
    } else {
        // Multiple coupons remaining

        // Calculate the number of whole coupon periods from first coupon to maturity
        let n_whole = n - 1; // Number of regular coupon periods after first coupon

        // Calculate Nq = number of quasi-coupon periods from settlement to first coupon
        // For calculating the discount factor to the first coupon
        let nq = dsc / e;

        // Accrued interest for the odd first period
        let accrued = coupon * a / e;

        // Price calculation following the odd first coupon security formula

        // Present value of redemption
        let pv_redemption = redemption / (1.0 + yld_per_period).powf(n_whole as f64 + nq);

        // First coupon amount (prorated for odd period)
        let odd_first_coupon = coupon * dfc / e;

        // Present value of first coupon
        let pv_first_coupon = odd_first_coupon / (1.0 + yld_per_period).powf(nq);

        // Present value of subsequent regular coupons
        let mut pv_coupons = 0.0;
        for k in 1..=n_whole {
            pv_coupons += coupon / (1.0 + yld_per_period).powf(k as f64 + nq);
        }

        let price = pv_redemption + pv_first_coupon + pv_coupons - accrued;

        Ok(price)
    }
}

/// Helper function to calculate bond price for securities with odd last period
fn calculate_odd_last_price(
    settlement: NaiveDate,
    maturity: NaiveDate,
    last_interest: NaiveDate,
    rate: f64,
    yld: f64,
    redemption: f64,
    frequency: i64,
    basis: i64,
) -> Result<f64, ()> {
    let months_per_period = frequency_to_months(frequency).ok_or(())?;

    // Coupon payment per period per $100 face value
    let coupon = 100.0 * rate / frequency as f64;

    // Find the quasi-coupon date after maturity (if the last period were regular)
    let quasi_coupon_after_maturity =
        find_quasi_coupon_after_maturity(maturity, last_interest, frequency).ok_or(())?;

    // Calculate number of quasi-coupon periods in the odd last period (for validation)
    let _nc = count_quasi_coupon_periods(last_interest, quasi_coupon_after_maturity, frequency)
        .ok_or(())?
        .max(1);

    // Calculate E = days in a normal coupon period
    let e = coupon_days_in_period(
        last_interest,
        last_interest
            .checked_add_months(Months::new(months_per_period))
            .ok_or(())?,
        frequency,
        basis,
    );

    // Calculate DSM = days from settlement to maturity
    let dsm = days_between(settlement, maturity, basis);

    // Calculate DLM = days from last interest to maturity (for odd last coupon)
    let dlm = days_between(last_interest, maturity, basis);

    // Calculate A = days from last interest to settlement (accrued interest)
    let a = days_between(last_interest, settlement, basis);

    // Accrued interest
    let accrued = coupon * a / e;

    // Odd last coupon (prorated based on odd period)
    let odd_last_coupon = coupon * dlm / e;

    // For securities with odd last period, settlement is in the final period
    // The formula is simpler as there's only the final redemption and last coupon

    let yld_per_period = yld / frequency as f64;

    // Price = (redemption + odd_last_coupon) / (1 + dsm/e * yld/freq) - accrued
    let price = (redemption + odd_last_coupon) / (1.0 + (dsm / e) * yld_per_period) - accrued;

    Ok(price)
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

    #[test]
    fn test_accrint() {
        let g = GridController::new();

        // Basic ACCRINT test: Issue Jan 1, First Interest Jul 1, Settlement Apr 1
        // Rate 5%, Par 1000, Semi-annual, 30/360 basis
        // Days from Jan 1 to Apr 1 = 90 days (30/360)
        // Days in period = 180 (semi-annual, 30/360)
        // Accrued = 1000 * 0.05 * (90/180) / 2 = 1000 * 0.05 * 0.5 / 2 = 12.5
        assert_f64_approx_eq(
            12.5,
            eval_to_string(
                &g,
                "ACCRINT(DATE(2020, 1, 1), DATE(2020, 7, 1), DATE(2020, 4, 1), 0.05, 1000, 2)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINT basic semi-annual",
        );

        // Test with quarterly frequency
        // Days from Jan 1 to Apr 1 = 90 days (30/360)
        // Days in period = 90 (quarterly, 30/360)
        // Accrued = 1000 * 0.05 * (90/90) / 4 = 1000 * 0.05 * 1.0 / 4 = 12.5
        assert_f64_approx_eq(
            12.5,
            eval_to_string(
                &g,
                "ACCRINT(DATE(2020, 1, 1), DATE(2020, 4, 1), DATE(2020, 4, 1), 0.05, 1000, 4)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINT quarterly",
        );

        // Test with annual frequency
        // Days from Jan 1 to Apr 1 = 90 days (30/360)
        // Days in period = 360 (annual, 30/360)
        // Accrued = 1000 * 0.05 * (90/360) / 1 = 1000 * 0.05 * 0.25 = 12.5
        assert_f64_approx_eq(
            12.5,
            eval_to_string(
                &g,
                "ACCRINT(DATE(2020, 1, 1), DATE(2021, 1, 1), DATE(2020, 4, 1), 0.05, 1000, 1)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINT annual",
        );

        // Test with Actual/365 basis
        // Days from Jan 1 to Apr 1 = 91 actual days (leap year 2020)
        // Days in period = 182.5 (semi-annual, Actual/365)
        // Accrued = 1000 * 0.05 * (91/182.5) / 2 ≈ 12.466
        assert_f64_approx_eq(
            12.46575,
            eval_to_string(
                &g,
                "ACCRINT(DATE(2020, 1, 1), DATE(2020, 7, 1), DATE(2020, 4, 1), 0.05, 1000, 2, 3)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINT with Actual/365",
        );

        // Invalid: issue >= settlement
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINT(DATE(2020, 4, 1), DATE(2020, 7, 1), DATE(2020, 1, 1), 0.05, 1000, 2)",
        );

        // Invalid: rate <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINT(DATE(2020, 1, 1), DATE(2020, 7, 1), DATE(2020, 4, 1), 0, 1000, 2)",
        );

        // Invalid: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINT(DATE(2020, 1, 1), DATE(2020, 7, 1), DATE(2020, 4, 1), 0.05, 1000, 3)",
        );

        // Invalid: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINT(DATE(2020, 1, 1), DATE(2020, 7, 1), DATE(2020, 4, 1), 0.05, 1000, 2, 5)",
        );

        // Test with issue == first_interest (should be valid per Excel behavior)
        // 2020 has 366 days (leap year), from Jan 1 to Dec 31 = 365 days
        // With 30/360 basis (basis=0): 360 days in a year, semi-annual = 180 days per period
        // Days from Jan 1 to Dec 31 in 30/360 = 11*30 + 30 = 360 days
        // This spans 2 complete periods, so accrued = 1000 * 0.1 = 100
        assert_f64_approx_eq(
            100.0,
            eval_to_string(
                &g,
                r#"ACCRINT("2020-01-01", "2020-01-01", "2020-12-31", 0.1, 1000, 2, 0)"#,
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINT with issue == first_interest",
        );
    }

    #[test]
    fn test_accrintm() {
        let g = GridController::new();

        // Basic ACCRINTM test: Issue Jan 1, 2020, Settlement Apr 1, 2020
        // Rate 5%, Par 1000, 30/360 basis
        // Days = 90 (30/360: Jan 1 to Apr 1)
        // Accrued = 1000 * 0.05 * 90 / 360 = 12.5
        assert_f64_approx_eq(
            12.5,
            eval_to_string(
                &g,
                "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 1000)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINTM basic 30/360",
        );

        // Test with Actual/360 basis
        // Days = 91 actual days (2020 is leap year: Jan has 31, Feb has 29, Mar has 31)
        // Accrued = 1000 * 0.05 * 91 / 360 ≈ 12.639
        assert_f64_approx_eq(
            12.63889,
            eval_to_string(
                &g,
                "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 1000, 2)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINTM Actual/360",
        );

        // Test with Actual/365 basis
        // Days = 91 actual days
        // Accrued = 1000 * 0.05 * 91 / 365 ≈ 12.466
        assert_f64_approx_eq(
            12.46575,
            eval_to_string(
                &g,
                "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 1000, 3)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINTM Actual/365",
        );

        // Test with 30/360 European basis
        // Days = 90 (30/360 European)
        // Accrued = 1000 * 0.05 * 90 / 360 = 12.5
        assert_f64_approx_eq(
            12.5,
            eval_to_string(
                &g,
                "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 1000, 4)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINTM 30/360 European",
        );

        // Test one full year
        // Days = 360 (30/360)
        // Accrued = 1000 * 0.05 * 360 / 360 = 50
        assert_f64_approx_eq(
            50.0,
            eval_to_string(
                &g,
                "ACCRINTM(DATE(2020, 1, 1), DATE(2021, 1, 1), 0.05, 1000)",
            )
            .parse::<f64>()
            .unwrap(),
            "ACCRINTM one year",
        );

        // Invalid: issue >= settlement
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINTM(DATE(2020, 4, 1), DATE(2020, 1, 1), 0.05, 1000)",
        );

        // Invalid: rate <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0, 1000)",
        );

        // Invalid: par <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 0)",
        );

        // Invalid: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ACCRINTM(DATE(2020, 1, 1), DATE(2020, 4, 1), 0.05, 1000, 5)",
        );
    }

    #[test]
    fn test_amorlinc() {
        let g = GridController::new();

        // Basic AMORLINC test
        // Cost 2400, purchased Aug 19, 2008, first period Dec 31, 2008
        // Salvage 300, period 1, rate 15%
        // Annual depreciation = 2400 * 0.15 = 360
        // First period (period 0): prorated from Aug 19 to Dec 31
        // Period 1 onwards: full annual depreciation until salvage is reached
        assert_f64_approx_eq(
            360.0,
            eval_to_string(
                &g,
                "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15)",
            )
            .parse::<f64>()
            .unwrap(),
            "AMORLINC period 1",
        );

        // Test first period (period 0) - prorated
        // Days from Aug 19 to Dec 31 with 30/360 basis
        // Aug: 30-19 = 11, Sep-Dec: 4 * 30 = 120, total = 131 days
        // First period = 360 * 131/360 ≈ 130.83
        let first_period: f64 = eval_to_string(
            &g,
            "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 0, 0.15)",
        )
        .parse()
        .unwrap();
        assert!(
            first_period > 0.0 && first_period < 360.0,
            "First period should be prorated"
        );

        // Test with different rate
        // Cost 10000, salvage 1000, rate 20%
        // Annual depreciation = 10000 * 0.20 = 2000
        assert_f64_approx_eq(
            2000.0,
            eval_to_string(
                &g,
                "AMORLINC(10000, DATE(2020, 1, 1), DATE(2020, 12, 31), 1000, 1, 0.20)",
            )
            .parse::<f64>()
            .unwrap(),
            "AMORLINC with 20% rate",
        );

        // Test that depreciation stops at salvage value
        // After enough periods, depreciation should be 0
        let late_period: f64 = eval_to_string(
            &g,
            "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 10, 0.15)",
        )
        .parse()
        .unwrap();
        assert_f64_approx_eq(0.0, late_period, "AMORLINC should stop at salvage value");

        // Invalid: negative cost
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORLINC(-2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15)",
        );

        // Invalid: negative period
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, -1, 0.15)",
        );

        // Invalid: rate <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0)",
        );

        // Invalid: purchase date after first period
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORLINC(2400, DATE(2009, 1, 1), DATE(2008, 12, 31), 300, 1, 0.15)",
        );

        // Invalid: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORLINC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15, 5)",
        );
    }

    #[test]
    fn test_amordegrc() {
        let g = GridController::new();

        // Basic AMORDEGRC test
        // Cost 2400, purchased Aug 19, 2008, first period Dec 31, 2008
        // Salvage 300, period 1, rate 15%
        // Asset life = 1/0.15 ≈ 6.67 years (> 6), so coefficient = 2.5
        // Adjusted rate = 0.15 * 2.5 = 0.375
        // Period 0: round(2400 * 0.375 * 134/365) = round(330.41) = 330
        // Period 1: round((2400 - 330) * 0.375) = round(776.25) = 776
        let period_1: f64 = eval_to_string(
            &g,
            "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15)",
        )
        .parse()
        .unwrap();
        assert_f64_approx_eq(776.0, period_1, "AMORDEGRC period 1 should be 776");

        // Test first period (period 0) - prorated with coefficient
        // round(2400 * 0.375 * 134/365) = round(330.41) = 330
        let first_period: f64 = eval_to_string(
            &g,
            "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 0, 0.15)",
        )
        .parse()
        .unwrap();
        assert_f64_approx_eq(330.0, first_period, "AMORDEGRC period 0 should be 330");

        // Test with explicit basis=1 (user-reported formula)
        let period_1_basis_1: f64 = eval_to_string(
            &g,
            "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15, 1)",
        )
        .parse()
        .unwrap();
        assert_f64_approx_eq(
            776.0,
            period_1_basis_1,
            "AMORDEGRC with explicit basis=1 should be 776",
        );

        // Test with rate that gives coefficient of 1.5 (life 3-4 years, rate 0.25-0.33)
        let coef_1_5: f64 = eval_to_string(
            &g,
            "AMORDEGRC(10000, DATE(2020, 1, 1), DATE(2020, 12, 31), 1000, 1, 0.30)",
        )
        .parse()
        .unwrap();
        assert!(coef_1_5 > 0.0, "AMORDEGRC with coefficient 1.5");

        // Test with rate that gives coefficient of 2.5 (life > 6 years, rate < 0.167)
        let coef_2_5: f64 = eval_to_string(
            &g,
            "AMORDEGRC(10000, DATE(2020, 1, 1), DATE(2020, 12, 31), 1000, 1, 0.10)",
        )
        .parse()
        .unwrap();
        assert!(coef_2_5 > 0.0, "AMORDEGRC with coefficient 2.5");

        // Test that depreciation eventually stops at salvage value
        let late_period: f64 = eval_to_string(
            &g,
            "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 20, 0.15)",
        )
        .parse()
        .unwrap();
        assert_f64_approx_eq(0.0, late_period, "AMORDEGRC should stop at salvage value");

        // Invalid: negative cost
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORDEGRC(-2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15)",
        );

        // Invalid: negative period
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, -1, 0.15)",
        );

        // Invalid: rate <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0)",
        );

        // Invalid: purchase date after first period
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORDEGRC(2400, DATE(2009, 1, 1), DATE(2008, 12, 31), 300, 1, 0.15)",
        );

        // Invalid: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "AMORDEGRC(2400, DATE(2008, 8, 19), DATE(2008, 12, 31), 300, 1, 0.15, 5)",
        );
    }

    #[test]
    fn test_amordegrc_coefficients() {
        let g = GridController::new();

        // Test that different rates result in different depreciation due to coefficients
        // Rate 0.50 => life = 2 years => coefficient = 1.0 (no acceleration)
        // Rate 0.25 => life = 4 years => coefficient = 1.5
        // Rate 0.167 => life = 6 years => coefficient = 2.0
        // Rate 0.15 => life = 6.67 years => coefficient = 2.5 (life > 6)
        // Rate 0.10 => life = 10 years => coefficient = 2.5

        // For the same cost, higher coefficient means faster depreciation in early periods
        let dep_coef_1: f64 = eval_to_string(
            &g,
            "AMORDEGRC(10000, DATE(2020, 1, 1), DATE(2020, 12, 31), 0, 0, 0.50)",
        )
        .parse()
        .unwrap();

        let dep_coef_1_5: f64 = eval_to_string(
            &g,
            "AMORDEGRC(10000, DATE(2020, 1, 1), DATE(2020, 12, 31), 0, 0, 0.25)",
        )
        .parse()
        .unwrap();

        // With coefficient 1.0, adjusted rate is 0.50, so first year = 10000 * 0.50 = 5000
        // With coefficient 1.5, adjusted rate is 0.375, so first year = 10000 * 0.375 = 3750
        // The lower rate with coefficient 1.5 should still give less than coefficient 1.0 case
        assert!(
            dep_coef_1 > dep_coef_1_5,
            "Higher raw rate (coef 1.0) should have higher first period depreciation"
        );
    }

    #[test]
    fn test_npv() {
        let g = GridController::new();

        // Basic NPV calculation
        // NPV(10%, -10000, 3000, 4200, 6800) should calculate correctly
        // = 3000/1.1 + 4200/1.1^2 + 6800/1.1^3
        // = 2727.27 + 3471.07 + 5108.41 = 11306.76 (approximately)
        let npv: f64 = eval_to_string(&g, "NPV(0.1, 3000, 4200, 6800)")
            .parse()
            .unwrap();
        assert!(
            (npv - 11306.76).abs() < 1.0,
            "NPV basic calculation: got {}",
            npv
        );

        // NPV with array syntax
        let npv_array: f64 = eval_to_string(&g, "NPV(0.1, {3000, 4200, 6800})")
            .parse()
            .unwrap();
        assert_f64_approx_eq(
            npv,
            npv_array,
            "NPV with array should equal NPV with individual values",
        );

        // NPV of initial investment project
        // Initial investment -10000 at time 0 (not discounted), followed by cash flows
        let project_npv: f64 = eval_to_string(&g, "NPV(0.1, 3000, 4200, 6800) + (-10000)")
            .parse()
            .unwrap();
        assert!(project_npv > 0.0, "Project NPV should be positive");

        // Test with zero rate - should sum all values
        let npv_zero_rate: f64 = eval_to_string(&g, "NPV(0, 1000, 2000, 3000)")
            .parse()
            .unwrap();
        assert_f64_approx_eq(
            6000.0,
            npv_zero_rate,
            "NPV with zero rate should sum values",
        );

        // Test with rate = -1 should error (divide by zero)
        expect_err(&RunErrorMsg::DivideByZero, &g, "NPV(-1, 1000, 2000)");
    }

    #[test]
    fn test_irr() {
        let g = GridController::new();

        // Basic IRR calculation
        // For cash flows -100, 30, 35, 40, 45
        let irr: f64 = eval_to_string(&g, "IRR({-100, 30, 35, 40, 45})")
            .parse()
            .unwrap();
        // The IRR should be around 17-18%
        assert!(
            irr > 0.15 && irr < 0.20,
            "IRR should be approximately 17-18%: got {}",
            irr
        );

        // Verify IRR: NPV at the IRR rate should be approximately 0
        let formula = format!("NPV({}, 30, 35, 40, 45) + (-100)", irr);
        let npv_at_irr: f64 = eval_to_string(&g, &formula).parse().unwrap();
        assert!(
            npv_at_irr.abs() < 0.01,
            "NPV at IRR should be ~0, got {}",
            npv_at_irr
        );

        // IRR with custom guess
        let irr_with_guess: f64 =
            eval_to_string(&g, "IRR({-70000, 12000, 15000, 18000, 21000, 26000}, 0.15)")
                .parse()
                .unwrap();
        assert!(
            irr_with_guess > 0.05 && irr_with_guess < 0.15,
            "IRR with guess: got {}",
            irr_with_guess
        );

        // Error: all positive values
        expect_err(&RunErrorMsg::InvalidArgument, &g, "IRR({100, 200, 300})");

        // Error: all negative values
        expect_err(&RunErrorMsg::InvalidArgument, &g, "IRR({-100, -200, -300})");

        // Error: too few values
        expect_err(&RunErrorMsg::InvalidArgument, &g, "IRR({-100})");
    }

    #[test]
    fn test_mirr() {
        let g = GridController::new();

        // Basic MIRR calculation
        // Cash flows: -120000 initial, then positive returns
        let mirr: f64 = eval_to_string(
            &g,
            "MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.10, 0.12)",
        )
        .parse()
        .unwrap();
        // MIRR should be around 12-13%
        assert!(
            mirr > 0.10 && mirr < 0.15,
            "MIRR should be approximately 12-13%: got {}",
            mirr
        );

        // MIRR with equal finance and reinvestment rates
        let mirr_equal: f64 = eval_to_string(&g, "MIRR({-10000, 4000, 4000, 4000}, 0.08, 0.08)")
            .parse()
            .unwrap();
        assert!(
            mirr_equal > 0.05 && mirr_equal < 0.15,
            "MIRR with equal rates: got {}",
            mirr_equal
        );

        // Error: all positive values
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "MIRR({100, 200, 300}, 0.1, 0.1)",
        );

        // Error: all negative values
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "MIRR({-100, -200, -300}, 0.1, 0.1)",
        );

        // Error: too few values
        expect_err(&RunErrorMsg::InvalidArgument, &g, "MIRR({-100}, 0.1, 0.1)");
    }

    #[test]
    fn test_xnpv() {
        let g = GridController::new();

        // Basic XNPV calculation with irregular dates
        let xnpv: f64 = eval_to_string(
            &g,
            "XNPV(0.09, {-10000, 2750, 4250, 3250, 2750}, {DATE(2008,1,1), DATE(2008,3,1), DATE(2008,10,30), DATE(2009,2,15), DATE(2009,4,1)})",
        )
        .parse()
        .unwrap();
        // XNPV should be positive
        assert!(xnpv > 0.0, "XNPV should be positive: got {}", xnpv);

        // XNPV with all same-day payments (like regular NPV)
        let xnpv_same_day: f64 = eval_to_string(
            &g,
            "XNPV(0.1, {1000, 1000}, {DATE(2020,1,1), DATE(2021,1,1)})",
        )
        .parse()
        .unwrap();
        // First payment at day 0: 1000
        // Second payment at day 365 (1 year): 1000 / 1.1 = 909.09
        assert!(
            (xnpv_same_day - 1909.09).abs() < 10.0,
            "XNPV annual: got {}",
            xnpv_same_day
        );

        // Error: rate <= -1
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "XNPV(-1, {1000, 2000}, {DATE(2020,1,1), DATE(2020,6,1)})",
        );

        // Error: mismatched array sizes
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "XNPV(0.1, {1000, 2000, 3000}, {DATE(2020,1,1), DATE(2020,6,1)})",
        );
    }

    #[test]
    fn test_xirr() {
        let g = GridController::new();

        // Basic XIRR calculation
        let xirr: f64 = eval_to_string(
            &g,
            "XIRR({-10000, 2750, 4250, 3250, 2750}, {DATE(2008,1,1), DATE(2008,3,1), DATE(2008,10,30), DATE(2009,2,15), DATE(2009,4,1)}, 0.1)",
        )
        .parse()
        .unwrap();
        // XIRR should be positive and reasonable
        assert!(
            xirr > 0.0 && xirr < 1.0,
            "XIRR should be positive: got {}",
            xirr
        );

        // Verify XIRR: XNPV at the XIRR rate should be approximately 0
        let formula = format!(
            "XNPV({}, {{-10000, 2750, 4250, 3250, 2750}}, {{DATE(2008,1,1), DATE(2008,3,1), DATE(2008,10,30), DATE(2009,2,15), DATE(2009,4,1)}})",
            xirr
        );
        let xnpv_at_xirr: f64 = eval_to_string(&g, &formula).parse().unwrap();
        assert!(
            xnpv_at_xirr.abs() < 1.0,
            "XNPV at XIRR should be ~0, got {}",
            xnpv_at_xirr
        );

        // Error: all positive values
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "XIRR({100, 200, 300}, {DATE(2020,1,1), DATE(2020,6,1), DATE(2020,12,1)})",
        );

        // Error: all negative values
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "XIRR({-100, -200, -300}, {DATE(2020,1,1), DATE(2020,6,1), DATE(2020,12,1)})",
        );

        // Error: mismatched array sizes
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "XIRR({-1000, 2000, 3000}, {DATE(2020,1,1), DATE(2020,6,1)})",
        );
    }

    #[test]
    fn test_fvschedule() {
        let g = GridController::new();

        // Basic FVSCHEDULE calculation
        // 1 * (1 + 0.09) * (1 + 0.11) * (1 + 0.1) = 1.33089
        let fv: f64 = eval_to_string(&g, "FVSCHEDULE(1, {0.09, 0.11, 0.1})")
            .parse()
            .unwrap();
        assert_f64_approx_eq(1.33089, fv, "FVSCHEDULE basic calculation");

        // FVSCHEDULE with larger principal
        let fv_large: f64 = eval_to_string(&g, "FVSCHEDULE(10000, {0.05, 0.06, 0.07, 0.08})")
            .parse()
            .unwrap();
        // 10000 * 1.05 * 1.06 * 1.07 * 1.08 = 12861.828
        assert!(
            (fv_large - 12861.828).abs() < 1.0,
            "FVSCHEDULE with large principal: got {}",
            fv_large
        );

        // FVSCHEDULE with single rate
        let fv_single: f64 = eval_to_string(&g, "FVSCHEDULE(1000, {0.1})")
            .parse()
            .unwrap();
        assert_f64_approx_eq(1100.0, fv_single, "FVSCHEDULE with single rate");

        // FVSCHEDULE with negative rate (loss)
        let fv_loss: f64 = eval_to_string(&g, "FVSCHEDULE(1000, {-0.1})")
            .parse()
            .unwrap();
        assert_f64_approx_eq(900.0, fv_loss, "FVSCHEDULE with negative rate");

        // FVSCHEDULE with zero rate
        let fv_zero: f64 = eval_to_string(&g, "FVSCHEDULE(1000, {0, 0, 0})")
            .parse()
            .unwrap();
        assert_f64_approx_eq(1000.0, fv_zero, "FVSCHEDULE with zero rates");

        // Error: empty schedule
        expect_err(&RunErrorMsg::InvalidArgument, &g, "FVSCHEDULE(1000, {})");
    }

    #[test]
    fn test_pricedisc() {
        let g = GridController::new();

        // Basic PRICEDISC calculation
        // Settlement: Feb 16, 2008, Maturity: Mar 1, 2008, Discount: 5.25%, Redemption: 100
        // Using basis 0 (30/360), days = 15
        // Price = 100 * (1 - 0.0525 * 15/360) = 100 * (1 - 0.0021875) = 99.78125
        let price: f64 = eval_to_string(
            &g,
            "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.0525, 100)",
        )
        .parse()
        .unwrap();
        assert!(
            (price - 99.78).abs() < 0.1,
            "PRICEDISC basic calculation: got {}",
            price
        );

        // Test with basis 2 (Actual/360)
        // Actual days from Feb 16 to Mar 1 = 14 days
        let price_b2: f64 = eval_to_string(
            &g,
            "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.0525, 100, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            price_b2 > 99.0 && price_b2 < 100.0,
            "PRICEDISC with basis 2: got {}",
            price_b2
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICEDISC(DATE(2008, 3, 1), DATE(2008, 2, 16), 0.0525, 100)",
        );

        // Error: discount <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0, 100)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.0525, 100, 5)",
        );
    }

    #[test]
    fn test_pricemat() {
        let g = GridController::new();

        // Basic PRICEMAT calculation
        // Settlement: Feb 15, 2008, Maturity: Apr 13, 2008, Issue: Nov 11, 2007
        // Rate: 6.1%, Yield: 6.1%
        let price: f64 = eval_to_string(
            &g,
            "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.061, 0.061)",
        )
        .parse()
        .unwrap();
        // When rate = yield, price should be close to par (100)
        assert!(
            (price - 99.98).abs() < 0.5,
            "PRICEMAT when rate = yield should be near par: got {}",
            price
        );

        // Test with different rate and yield
        let price2: f64 = eval_to_string(
            &g,
            "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.05, 0.06)",
        )
        .parse()
        .unwrap();
        // Lower rate than yield means price < par
        assert!(
            price2 < 100.0,
            "PRICEMAT with rate < yield should be below par: got {}",
            price2
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICEMAT(DATE(2008, 5, 1), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.061, 0.061)",
        );

        // Error: issue >= settlement
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2008, 3, 1), 0.061, 0.061)",
        );

        // Error: negative rate
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), -0.061, 0.061)",
        );
    }

    #[test]
    fn test_price() {
        let g = GridController::new();

        // Basic PRICE calculation
        // Settlement: Feb 15, 2008, Maturity: Nov 15, 2017
        // Rate: 5.75%, Yield: 6.5%, Redemption: 100, Frequency: 2 (semi-annual)
        let price: f64 = eval_to_string(
            &g,
            "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 2)",
        )
        .parse()
        .unwrap();
        // Yield > coupon rate means price < par
        assert!(
            price > 90.0 && price < 100.0,
            "PRICE with yield > rate should be below par: got {}",
            price
        );
        // Expected value is approximately 94.63 based on Excel
        assert!(
            (price - 94.63).abs() < 1.0,
            "PRICE expected ~94.63: got {}",
            price
        );

        // Test with rate > yield (price > par)
        let price_premium: f64 = eval_to_string(
            &g,
            "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.075, 0.06, 100, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            price_premium > 100.0,
            "PRICE with rate > yield should be above par: got {}",
            price_premium
        );

        // Test with quarterly frequency
        let price_quarterly: f64 = eval_to_string(
            &g,
            "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 4)",
        )
        .parse()
        .unwrap();
        assert!(
            price_quarterly > 90.0 && price_quarterly < 100.0,
            "PRICE with quarterly frequency: got {}",
            price_quarterly
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICE(DATE(2018, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 2)",
        );

        // Error: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 3)",
        );

        // Error: negative rate
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), -0.0575, 0.065, 100, 2)",
        );
    }

    #[test]
    fn test_yielddisc() {
        let g = GridController::new();

        // Basic YIELDDISC calculation
        // Settlement: Feb 16, 2008, Maturity: Mar 1, 2008, Price: 99.795, Redemption: 100
        let yld: f64 = eval_to_string(
            &g,
            "YIELDDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100)",
        )
        .parse()
        .unwrap();
        // Yield = ((100 - 99.795) / 99.795) * (360 / days)
        assert!(
            yld > 0.04 && yld < 0.06,
            "YIELDDISC basic calculation: got {}",
            yld
        );

        // Verify relationship: PRICEDISC and YIELDDISC should be inverses
        let price: f64 = eval_to_string(
            &g,
            "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.05, 100)",
        )
        .parse()
        .unwrap();
        let yield_back: f64 = eval_to_string(
            &g,
            &format!(
                "YIELDDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), {}, 100)",
                price
            ),
        )
        .parse()
        .unwrap();
        // Note: YIELDDISC and PRICEDISC don't give exact inverses due to formula differences
        // but yield should be positive and reasonable
        assert!(
            yield_back > 0.04 && yield_back < 0.06,
            "YIELDDISC inverse check: got {}",
            yield_back
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELDDISC(DATE(2008, 3, 1), DATE(2008, 2, 16), 99.795, 100)",
        );

        // Error: price <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELDDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0, 100)",
        );
    }

    #[test]
    fn test_yieldmat() {
        let g = GridController::new();

        // Basic YIELDMAT calculation
        // Settlement: Mar 15, 2008, Maturity: Nov 3, 2008, Issue: Nov 8, 2007
        // Rate: 6.25%, Price: 100.0123
        let yld: f64 = eval_to_string(
            &g,
            "YIELDMAT(DATE(2008, 3, 15), DATE(2008, 11, 3), DATE(2007, 11, 8), 0.0625, 100.0123)",
        )
        .parse()
        .unwrap();
        // Yield should be close to rate when price is near par
        assert!(
            yld > 0.05 && yld < 0.08,
            "YIELDMAT basic calculation: got {}",
            yld
        );

        // Verify relationship: PRICEMAT and YIELDMAT should be approximately inverses
        let price: f64 = eval_to_string(
            &g,
            "PRICEMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.061, 0.061)",
        )
        .parse()
        .unwrap();
        let yield_back: f64 = eval_to_string(
            &g,
            &format!(
                "YIELDMAT(DATE(2008, 2, 15), DATE(2008, 4, 13), DATE(2007, 11, 11), 0.061, {})",
                price
            ),
        )
        .parse()
        .unwrap();
        assert!(
            (yield_back - 0.061).abs() < 0.001,
            "YIELDMAT inverse of PRICEMAT: expected ~0.061, got {}",
            yield_back
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELDMAT(DATE(2008, 12, 1), DATE(2008, 11, 3), DATE(2007, 11, 8), 0.0625, 100)",
        );

        // Error: issue >= settlement
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELDMAT(DATE(2008, 3, 15), DATE(2008, 11, 3), DATE(2008, 4, 1), 0.0625, 100)",
        );

        // Error: price <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELDMAT(DATE(2008, 3, 15), DATE(2008, 11, 3), DATE(2007, 11, 8), 0.0625, 0)",
        );
    }

    #[test]
    fn test_yield() {
        let g = GridController::new();

        // Basic YIELD calculation
        // Settlement: Feb 15, 2008, Maturity: Nov 15, 2016
        // Rate: 5.75%, Price: 95.04287, Redemption: 100, Frequency: 2 (semi-annual)
        let yld: f64 = eval_to_string(
            &g,
            "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.0575, 95.04287, 100, 2)",
        )
        .parse()
        .unwrap();
        // Price < par with positive coupon means yield > coupon rate
        assert!(
            yld > 0.0575 && yld < 0.10,
            "YIELD basic calculation: got {}",
            yld
        );

        // Verify relationship: PRICE and YIELD should be inverses
        let price: f64 = eval_to_string(
            &g,
            "PRICE(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, 0.065, 100, 2)",
        )
        .parse()
        .unwrap();
        let yield_back: f64 = eval_to_string(
            &g,
            &format!(
                "YIELD(DATE(2008, 2, 15), DATE(2017, 11, 15), 0.0575, {}, 100, 2)",
                price
            ),
        )
        .parse()
        .unwrap();
        assert!(
            (yield_back - 0.065).abs() < 0.001,
            "YIELD inverse of PRICE: expected ~0.065, got {}",
            yield_back
        );

        // Test with annual frequency
        let yld_annual: f64 = eval_to_string(
            &g,
            "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.06, 98.0, 100, 1)",
        )
        .parse()
        .unwrap();
        assert!(
            yld_annual > 0.06,
            "YIELD with annual frequency: got {}",
            yld_annual
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELD(DATE(2017, 2, 15), DATE(2016, 11, 15), 0.0575, 95.0, 100, 2)",
        );

        // Error: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.0575, 95.0, 100, 3)",
        );

        // Error: price <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "YIELD(DATE(2008, 2, 15), DATE(2016, 11, 15), 0.0575, 0, 100, 2)",
        );
    }

    #[test]
    fn test_price_yield_consistency() {
        let g = GridController::new();

        // Test that PRICE and YIELD are true inverses for various parameters
        let test_cases = [
            (
                "DATE(2020, 1, 15)",
                "DATE(2025, 7, 15)",
                "0.04",
                "0.05",
                "100",
                "2",
            ),
            (
                "DATE(2020, 3, 1)",
                "DATE(2030, 3, 1)",
                "0.06",
                "0.055",
                "100",
                "2",
            ),
            (
                "DATE(2020, 6, 15)",
                "DATE(2022, 6, 15)",
                "0.03",
                "0.04",
                "100",
                "4",
            ),
            (
                "DATE(2020, 1, 1)",
                "DATE(2040, 1, 1)",
                "0.05",
                "0.05",
                "100",
                "1",
            ),
        ];

        for (settle, mat, rate, yld, redemp, freq) in test_cases.iter() {
            let price_formula = format!(
                "PRICE({}, {}, {}, {}, {}, {})",
                settle, mat, rate, yld, redemp, freq
            );
            let price: f64 = eval_to_string(&g, &price_formula).parse().unwrap();

            let yield_formula = format!(
                "YIELD({}, {}, {}, {}, {}, {})",
                settle, mat, rate, price, redemp, freq
            );
            let yield_back: f64 = eval_to_string(&g, &yield_formula).parse().unwrap();

            let expected_yld: f64 = yld.parse().unwrap();
            assert!(
                (yield_back - expected_yld).abs() < 0.0001,
                "PRICE/YIELD consistency failed for rate={}, yield={}: got yield={}",
                rate,
                yld,
                yield_back
            );
        }
    }

    #[test]
    fn test_disc() {
        let g = GridController::new();

        // Basic DISC calculation
        // Settlement: Feb 16, 2008, Maturity: Mar 1, 2008, Price: 99.795, Redemption: 100
        // Using basis 0 (30/360), days = 15
        // DISC = (100 - 99.795) / 100 * (360 / 15) = 0.00205 * 24 = 0.0492
        let disc: f64 =
            eval_to_string(&g, "DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100)")
                .parse()
                .unwrap();
        assert!(
            (disc - 0.0492).abs() < 0.01,
            "DISC basic calculation: got {}",
            disc
        );

        // Test with basis 2 (Actual/360)
        let disc_b2: f64 = eval_to_string(
            &g,
            "DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            disc_b2 > 0.0 && disc_b2 < 1.0,
            "DISC with basis 2: got {}",
            disc_b2
        );

        // Verify DISC and PRICEDISC are inverses
        let price: f64 = eval_to_string(
            &g,
            "PRICEDISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0.0525, 100)",
        )
        .parse()
        .unwrap();
        let disc_back: f64 = eval_to_string(
            &g,
            &format!("DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), {}, 100)", price),
        )
        .parse()
        .unwrap();
        assert!(
            (disc_back - 0.0525).abs() < 0.0001,
            "DISC inverse of PRICEDISC: expected 0.0525, got {}",
            disc_back
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DISC(DATE(2008, 3, 1), DATE(2008, 2, 16), 99.795, 100)",
        );

        // Error: price <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 0, 100)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DISC(DATE(2008, 2, 16), DATE(2008, 3, 1), 99.795, 100, 5)",
        );
    }

    #[test]
    fn test_intrate() {
        let g = GridController::new();

        // Basic INTRATE calculation
        // Settlement: Feb 15, 2008, Maturity: May 15, 2008, Investment: 1000000, Redemption: 1014420
        // Using basis 0 (30/360), days = 90
        // INTRATE = (1014420 - 1000000) / 1000000 * (360 / 90) = 0.01442 * 4 = 0.05768
        let intrate: f64 = eval_to_string(
            &g,
            "INTRATE(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 1014420)",
        )
        .parse()
        .unwrap();
        assert!(
            (intrate - 0.05768).abs() < 0.01,
            "INTRATE basic calculation: got {}",
            intrate
        );

        // Test with basis 2 (Actual/360)
        let intrate_b2: f64 = eval_to_string(
            &g,
            "INTRATE(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 1014420, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            intrate_b2 > 0.0 && intrate_b2 < 1.0,
            "INTRATE with basis 2: got {}",
            intrate_b2
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "INTRATE(DATE(2008, 5, 15), DATE(2008, 2, 15), 1000000, 1014420)",
        );

        // Error: investment <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "INTRATE(DATE(2008, 2, 15), DATE(2008, 5, 15), 0, 1014420)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "INTRATE(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 1014420, 5)",
        );
    }

    #[test]
    fn test_received() {
        let g = GridController::new();

        // Basic RECEIVED calculation
        // Settlement: Feb 15, 2008, Maturity: May 15, 2008, Investment: 1000000, Discount: 5.75%
        // Using basis 0 (30/360), days = 90
        // RECEIVED = 1000000 / (1 - 0.0575 * 90/360) = 1000000 / (1 - 0.014375) = 1014584.65
        let received: f64 = eval_to_string(
            &g,
            "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 0.0575)",
        )
        .parse()
        .unwrap();
        assert!(
            (received - 1014584.65).abs() < 10.0,
            "RECEIVED basic calculation: got {}",
            received
        );

        // Test with basis 2 (Actual/360)
        let received_b2: f64 = eval_to_string(
            &g,
            "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 0.0575, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            received_b2 > 1000000.0,
            "RECEIVED with basis 2: got {}",
            received_b2
        );

        // Test with zero discount rate
        let received_zero: f64 = eval_to_string(
            &g,
            "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 0)",
        )
        .parse()
        .unwrap();
        assert_f64_approx_eq(1000000.0, received_zero, "RECEIVED with zero discount rate");

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "RECEIVED(DATE(2008, 5, 15), DATE(2008, 2, 15), 1000000, 0.0575)",
        );

        // Error: investment <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 0, 0.0575)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "RECEIVED(DATE(2008, 2, 15), DATE(2008, 5, 15), 1000000, 0.0575, 5)",
        );
    }

    #[test]
    fn test_effect() {
        let g = GridController::new();

        // Basic EFFECT calculation
        // Nominal: 5.25%, Periods: 4 (quarterly)
        // EFFECT = (1 + 0.0525/4)^4 - 1 = 1.0131328^4 - 1 = 0.053543
        let effect: f64 = eval_to_string(&g, "EFFECT(0.0525, 4)").parse().unwrap();
        assert!(
            (effect - 0.053543).abs() < 0.0001,
            "EFFECT basic calculation: got {}",
            effect
        );

        // Monthly compounding
        let effect_monthly: f64 = eval_to_string(&g, "EFFECT(0.1, 12)").parse().unwrap();
        // (1 + 0.1/12)^12 - 1 ≈ 0.1047
        assert!(
            (effect_monthly - 0.1047).abs() < 0.001,
            "EFFECT monthly: got {}",
            effect_monthly
        );

        // Daily compounding (365)
        let effect_daily: f64 = eval_to_string(&g, "EFFECT(0.1, 365)").parse().unwrap();
        assert!(
            effect_daily > effect_monthly,
            "EFFECT daily should be greater than monthly"
        );

        // Verify EFFECT and NOMINAL are inverses
        let nominal_back: f64 = eval_to_string(&g, &format!("NOMINAL({}, 4)", effect))
            .parse()
            .unwrap();
        assert!(
            (nominal_back - 0.0525).abs() < 0.0001,
            "NOMINAL inverse of EFFECT: expected 0.0525, got {}",
            nominal_back
        );

        // Error: nominal_rate <= 0
        expect_err(&RunErrorMsg::InvalidArgument, &g, "EFFECT(0, 4)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "EFFECT(-0.1, 4)");

        // Error: npery < 1
        expect_err(&RunErrorMsg::InvalidArgument, &g, "EFFECT(0.1, 0)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "EFFECT(0.1, 0.5)");
    }

    #[test]
    fn test_nominal() {
        let g = GridController::new();

        // Basic NOMINAL calculation
        // Effective: 5.3543%, Periods: 4 (quarterly)
        // NOMINAL = 4 * ((1 + 0.053543)^(1/4) - 1) ≈ 0.0525
        let nominal: f64 = eval_to_string(&g, "NOMINAL(0.053543, 4)").parse().unwrap();
        assert!(
            (nominal - 0.0525).abs() < 0.0001,
            "NOMINAL basic calculation: got {}",
            nominal
        );

        // Monthly compounding
        let nominal_monthly: f64 = eval_to_string(&g, "NOMINAL(0.1047, 12)").parse().unwrap();
        assert!(
            (nominal_monthly - 0.1).abs() < 0.01,
            "NOMINAL monthly: got {}",
            nominal_monthly
        );

        // Verify NOMINAL and EFFECT are inverses
        let effect_back: f64 = eval_to_string(&g, &format!("EFFECT({}, 4)", nominal))
            .parse()
            .unwrap();
        assert!(
            (effect_back - 0.053543).abs() < 0.0001,
            "EFFECT inverse of NOMINAL: expected 0.053543, got {}",
            effect_back
        );

        // Error: effect_rate <= 0
        expect_err(&RunErrorMsg::InvalidArgument, &g, "NOMINAL(0, 4)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "NOMINAL(-0.1, 4)");

        // Error: npery < 1
        expect_err(&RunErrorMsg::InvalidArgument, &g, "NOMINAL(0.1, 0)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "NOMINAL(0.1, 0.5)");
    }

    #[test]
    fn test_rri() {
        let g = GridController::new();

        // Basic RRI calculation
        // 96 periods, PV: 10000, FV: 11000
        // RRI = (11000/10000)^(1/96) - 1 = 1.1^(1/96) - 1 ≈ 0.000993
        let rri: f64 = eval_to_string(&g, "RRI(96, 10000, 11000)").parse().unwrap();
        assert!(
            (rri - 0.000993).abs() < 0.0001,
            "RRI basic calculation: got {}",
            rri
        );

        // Doubling money in 12 periods
        // RRI = (2000/1000)^(1/12) - 1 = 2^(1/12) - 1 ≈ 0.05946
        let rri_double: f64 = eval_to_string(&g, "RRI(12, 1000, 2000)").parse().unwrap();
        assert!(
            (rri_double - 0.05946).abs() < 0.001,
            "RRI doubling: got {}",
            rri_double
        );

        // Negative growth (loss)
        let rri_loss: f64 = eval_to_string(&g, "RRI(12, 1000, 500)").parse().unwrap();
        assert!(
            rri_loss < 0.0,
            "RRI with loss should be negative: got {}",
            rri_loss
        );

        // Error: nper <= 0
        expect_err(&RunErrorMsg::InvalidArgument, &g, "RRI(0, 1000, 2000)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "RRI(-1, 1000, 2000)");

        // Error: pv == 0
        expect_err(&RunErrorMsg::InvalidArgument, &g, "RRI(12, 0, 2000)");

        // Error: different signs for pv and fv
        expect_err(&RunErrorMsg::InvalidArgument, &g, "RRI(12, 1000, -2000)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "RRI(12, -1000, 2000)");
    }

    #[test]
    fn test_pduration() {
        let g = GridController::new();

        // Basic PDURATION calculation
        // Rate: 2.5%, PV: 2000, FV: 2200
        // PDURATION = (ln(2200) - ln(2000)) / ln(1.025) = ln(1.1) / ln(1.025) ≈ 3.86
        let pduration: f64 = eval_to_string(&g, "PDURATION(0.025, 2000, 2200)")
            .parse()
            .unwrap();
        assert!(
            (pduration - 3.86).abs() < 0.1,
            "PDURATION basic calculation: got {}",
            pduration
        );

        // Doubling money at 5%
        // PDURATION = ln(2) / ln(1.05) ≈ 14.21
        let pduration_double: f64 = eval_to_string(&g, "PDURATION(0.05, 1000, 2000)")
            .parse()
            .unwrap();
        assert!(
            (pduration_double - 14.21).abs() < 0.1,
            "PDURATION doubling: got {}",
            pduration_double
        );

        // Verify with FV calculation
        // If we compound 1000 at 5% for pduration_double periods, we should get 2000
        let fv_check: f64 =
            eval_to_string(&g, &format!("FV(0.05, {}, 0, -1000)", pduration_double))
                .parse()
                .unwrap();
        assert!(
            (fv_check - 2000.0).abs() < 1.0,
            "PDURATION verification: FV should be ~2000, got {}",
            fv_check
        );

        // Error: rate <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PDURATION(0, 2000, 2200)",
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PDURATION(-0.025, 2000, 2200)",
        );

        // Error: pv <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PDURATION(0.025, 0, 2200)",
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PDURATION(0.025, -2000, 2200)",
        );

        // Error: fv <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PDURATION(0.025, 2000, 0)",
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "PDURATION(0.025, 2000, -2200)",
        );
    }

    #[test]
    fn test_oddfprice() {
        let g = GridController::new();

        // Test ODDFPRICE with Excel example:
        // Settlement: 2008-11-11, Maturity: 2021-03-01, Issue: 2008-10-15
        // First coupon: 2009-03-01, Rate: 7.85%, Yield: 6.25%, Redemption: 100
        // Frequency: 2 (semi-annual), Basis: 1 (actual/actual)
        // Expected result: approximately 113.60 (Excel value)
        let price: f64 = eval_to_string(
            &g,
            "ODDFPRICE(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 0.0625, 100, 2, 1)",
        )
        .parse()
        .unwrap();
        assert!(
            (price - 113.60).abs() < 1.0,
            "ODDFPRICE basic calculation: expected ~113.60, got {}",
            price
        );

        // Test with different basis
        let price_basis0: f64 = eval_to_string(
            &g,
            "ODDFPRICE(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 0.0625, 100, 2, 0)",
        )
        .parse()
        .unwrap();
        assert!(
            price_basis0 > 100.0,
            "ODDFPRICE with basis 0: price should be > 100, got {}",
            price_basis0
        );

        // Error: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDFPRICE(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 0.0625, 100, 5, 1)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDFPRICE(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 0.0625, 100, 2, 5)",
        );

        // Error: dates out of order (issue >= settlement)
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDFPRICE(DATE(2008, 10, 15), DATE(2021, 3, 1), DATE(2008, 11, 11), DATE(2009, 3, 1), 0.0785, 0.0625, 100, 2, 1)",
        );

        // Error: negative rate
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDFPRICE(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), -0.01, 0.0625, 100, 2, 1)",
        );
    }

    #[test]
    fn test_oddfyield() {
        let g = GridController::new();

        // Test ODDFYIELD - use a price and verify we can recover the yield
        // Using the same example as ODDFPRICE but now solving for yield given price
        let yld: f64 = eval_to_string(
            &g,
            "ODDFYIELD(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 113.60, 100, 2, 1)",
        )
        .parse()
        .unwrap();
        assert!(
            (yld - 0.0625).abs() < 0.01,
            "ODDFYIELD basic calculation: expected ~0.0625, got {}",
            yld
        );

        // Verify round-trip: ODDFPRICE(ODDFYIELD(price)) ≈ price
        let price_check: f64 = eval_to_string(
            &g,
            &format!(
                "ODDFPRICE(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, {}, 100, 2, 1)",
                yld
            ),
        )
        .parse()
        .unwrap();
        assert!(
            (price_check - 113.60).abs() < 0.1,
            "ODDFYIELD round-trip: expected ~113.60, got {}",
            price_check
        );

        // Error: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDFYIELD(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 100, 100, 5, 1)",
        );

        // Error: price <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDFYIELD(DATE(2008, 11, 11), DATE(2021, 3, 1), DATE(2008, 10, 15), DATE(2009, 3, 1), 0.0785, 0, 100, 2, 1)",
        );
    }

    #[test]
    fn test_oddlprice() {
        let g = GridController::new();

        // Test ODDLPRICE with example:
        // Settlement: 2008-02-07, Maturity: 2008-06-15, Last interest: 2007-10-15
        // Rate: 3.75%, Yield: 4.05%, Redemption: 100
        // Frequency: 2 (semi-annual), Basis: 0
        // Expected result: approximately 99.88
        let price: f64 = eval_to_string(
            &g,
            "ODDLPRICE(DATE(2008, 2, 7), DATE(2008, 6, 15), DATE(2007, 10, 15), 0.0375, 0.0405, 100, 2, 0)",
        )
        .parse()
        .unwrap();
        assert!(
            (price - 99.88).abs() < 1.0,
            "ODDLPRICE basic calculation: expected ~99.88, got {}",
            price
        );

        // Lower yield should give higher price
        let price_low_yield: f64 = eval_to_string(
            &g,
            "ODDLPRICE(DATE(2008, 2, 7), DATE(2008, 6, 15), DATE(2007, 10, 15), 0.0375, 0.02, 100, 2, 0)",
        )
        .parse()
        .unwrap();
        assert!(
            price_low_yield > price,
            "ODDLPRICE: lower yield should give higher price: {} vs {}",
            price_low_yield,
            price
        );

        // Error: invalid date order (last_interest >= settlement)
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDLPRICE(DATE(2007, 10, 15), DATE(2008, 6, 15), DATE(2008, 2, 7), 0.0375, 0.0405, 100, 2, 0)",
        );

        // Error: negative yield
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDLPRICE(DATE(2008, 2, 7), DATE(2008, 6, 15), DATE(2007, 10, 15), 0.0375, -0.01, 100, 2, 0)",
        );
    }

    #[test]
    fn test_oddlyield() {
        let g = GridController::new();

        // Test ODDLYIELD with example:
        // Settlement: 2008-04-20, Maturity: 2008-06-15, Last interest: 2007-12-24
        // Rate: 3.75%, Price: 99.875, Redemption: 100
        // Frequency: 2 (semi-annual), Basis: 0
        let yld: f64 = eval_to_string(
            &g,
            "ODDLYIELD(DATE(2008, 4, 20), DATE(2008, 6, 15), DATE(2007, 12, 24), 0.0375, 99.875, 100, 2, 0)",
        )
        .parse()
        .unwrap();
        assert!(
            yld > 0.0 && yld < 0.2,
            "ODDLYIELD should return a reasonable yield: got {}",
            yld
        );

        // Verify round-trip: ODDLPRICE(ODDLYIELD(price)) ≈ price
        let price_check: f64 = eval_to_string(
            &g,
            &format!(
                "ODDLPRICE(DATE(2008, 4, 20), DATE(2008, 6, 15), DATE(2007, 12, 24), 0.0375, {}, 100, 2, 0)",
                yld
            ),
        )
        .parse()
        .unwrap();
        assert!(
            (price_check - 99.875).abs() < 0.1,
            "ODDLYIELD round-trip: expected ~99.875, got {}",
            price_check
        );

        // Error: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDLYIELD(DATE(2008, 4, 20), DATE(2008, 6, 15), DATE(2007, 12, 24), 0.0375, 99.875, 100, 3, 0)",
        );

        // Error: price <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDLYIELD(DATE(2008, 4, 20), DATE(2008, 6, 15), DATE(2007, 12, 24), 0.0375, -1, 100, 2, 0)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "ODDLYIELD(DATE(2008, 4, 20), DATE(2008, 6, 15), DATE(2007, 12, 24), 0.0375, 99.875, 100, 2, 6)",
        );
    }

    #[test]
    fn test_tbilleq() {
        let g = GridController::new();

        // Basic TBILLEQ calculation
        // Settlement: Mar 31, 2008, Maturity: Jun 1, 2008, Discount: 9.14%
        // DSM = 62 days (actual)
        // TBILLEQ = (365 * 0.0914) / (360 - 0.0914 * 62) = 33.361 / 354.3332 ≈ 0.09416
        let tbilleq: f64 =
            eval_to_string(&g, "TBILLEQ(DATE(2008, 3, 31), DATE(2008, 6, 1), 0.0914)")
                .parse()
                .unwrap();
        assert!(
            (tbilleq - 0.0942).abs() < 0.001,
            "TBILLEQ basic calculation: got {}",
            tbilleq
        );

        // Test with a different discount rate
        let tbilleq2: f64 =
            eval_to_string(&g, "TBILLEQ(DATE(2023, 1, 15), DATE(2023, 4, 15), 0.05)")
                .parse()
                .unwrap();
        assert!(
            tbilleq2 > 0.05 && tbilleq2 < 0.06,
            "TBILLEQ should be higher than discount rate: got {}",
            tbilleq2
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLEQ(DATE(2008, 6, 1), DATE(2008, 3, 31), 0.0914)",
        );

        // Error: maturity more than one year after settlement
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLEQ(DATE(2008, 1, 1), DATE(2009, 6, 1), 0.0914)",
        );

        // Error: discount <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLEQ(DATE(2008, 3, 31), DATE(2008, 6, 1), 0)",
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLEQ(DATE(2008, 3, 31), DATE(2008, 6, 1), -0.05)",
        );
    }

    #[test]
    fn test_tbillprice() {
        let g = GridController::new();

        // Basic TBILLPRICE calculation
        // Settlement: Mar 31, 2008, Maturity: Jun 1, 2008, Discount: 9%
        // DSM = 62 days (actual)
        // TBILLPRICE = 100 * (1 - 0.09 * 62 / 360) = 100 * (1 - 0.0155) = 98.45
        let price: f64 =
            eval_to_string(&g, "TBILLPRICE(DATE(2008, 3, 31), DATE(2008, 6, 1), 0.09)")
                .parse()
                .unwrap();
        assert!(
            (price - 98.45).abs() < 0.01,
            "TBILLPRICE basic calculation: got {}",
            price
        );

        // Test with different discount rate
        let price2: f64 =
            eval_to_string(&g, "TBILLPRICE(DATE(2023, 1, 15), DATE(2023, 4, 15), 0.05)")
                .parse()
                .unwrap();
        assert!(
            price2 > 98.0 && price2 < 100.0,
            "TBILLPRICE should be below 100 for positive discount: got {}",
            price2
        );

        // Verify relationship with TBILLYIELD
        let yield_back: f64 = eval_to_string(
            &g,
            &format!("TBILLYIELD(DATE(2008, 3, 31), DATE(2008, 6, 1), {})", price),
        )
        .parse()
        .unwrap();
        // Note: TBILLPRICE uses discount rate, TBILLYIELD returns yield (not discount rate)
        // The yield should be reasonably close to the discount rate for short-term securities
        assert!(
            yield_back > 0.08 && yield_back < 0.10,
            "TBILLYIELD from price should give reasonable yield: got {}",
            yield_back
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLPRICE(DATE(2008, 6, 1), DATE(2008, 3, 31), 0.09)",
        );

        // Error: maturity more than one year after settlement
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLPRICE(DATE(2008, 1, 1), DATE(2009, 6, 1), 0.09)",
        );

        // Error: discount < 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLPRICE(DATE(2008, 3, 31), DATE(2008, 6, 1), -0.05)",
        );
    }

    #[test]
    fn test_tbillyield() {
        let g = GridController::new();

        // Basic TBILLYIELD calculation
        // Settlement: Mar 31, 2008, Maturity: Jun 1, 2008, Price: 98.45
        // DSM = 62 days (actual)
        // TBILLYIELD = ((100 - 98.45) / 98.45) * (360 / 62) ≈ 0.0914
        let yld: f64 = eval_to_string(&g, "TBILLYIELD(DATE(2008, 3, 31), DATE(2008, 6, 1), 98.45)")
            .parse()
            .unwrap();
        assert!(
            (yld - 0.0914).abs() < 0.001,
            "TBILLYIELD basic calculation: got {}",
            yld
        );

        // Test with different price
        let yld2: f64 = eval_to_string(
            &g,
            "TBILLYIELD(DATE(2023, 1, 15), DATE(2023, 4, 15), 98.75)",
        )
        .parse()
        .unwrap();
        assert!(
            yld2 > 0.04 && yld2 < 0.07,
            "TBILLYIELD should give reasonable yield: got {}",
            yld2
        );

        // Verify round-trip: TBILLPRICE(TBILLYIELD(price)) calculation
        let price_test = 98.45_f64;
        let yld_from_price: f64 = eval_to_string(
            &g,
            &format!(
                "TBILLYIELD(DATE(2008, 3, 31), DATE(2008, 6, 1), {})",
                price_test
            ),
        )
        .parse()
        .unwrap();
        // Note: TBILLYIELD gives a simple yield, not the discount rate used in TBILLPRICE
        // So the round-trip isn't perfect, but the yield should be reasonable
        assert!(
            yld_from_price > 0.0 && yld_from_price < 0.2,
            "TBILLYIELD should return positive yield: got {}",
            yld_from_price
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLYIELD(DATE(2008, 6, 1), DATE(2008, 3, 31), 98.45)",
        );

        // Error: maturity more than one year after settlement
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLYIELD(DATE(2008, 1, 1), DATE(2009, 6, 1), 98.45)",
        );

        // Error: price <= 0
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLYIELD(DATE(2008, 3, 31), DATE(2008, 6, 1), 0)",
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "TBILLYIELD(DATE(2008, 3, 31), DATE(2008, 6, 1), -5)",
        );
    }

    #[test]
    fn test_dollarde() {
        let g = GridController::new();

        // Basic test from Excel documentation
        // DOLLARDE(1.02, 16) = 1 + 2/16 = 1.125
        assert_f64_approx_eq(
            1.125,
            eval_to_string(&g, "DOLLARDE(1.02, 16)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARDE(1.02, 16)",
        );

        // DOLLARDE(1.1, 8) = 1 + 1/8 = 1.125
        assert_f64_approx_eq(
            1.125,
            eval_to_string(&g, "DOLLARDE(1.1, 8)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARDE(1.1, 8)",
        );

        // DOLLARDE(1.1, 4) = 1 + 1/4 = 1.25
        assert_f64_approx_eq(
            1.25,
            eval_to_string(&g, "DOLLARDE(1.1, 4)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARDE(1.1, 4)",
        );

        // Test with negative number
        assert_f64_approx_eq(
            -1.125,
            eval_to_string(&g, "DOLLARDE(-1.02, 16)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARDE with negative",
        );

        // Test with whole number
        assert_f64_approx_eq(
            5.0,
            eval_to_string(&g, "DOLLARDE(5, 16)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARDE with whole number",
        );

        // Error: fraction < 1
        expect_err(&RunErrorMsg::InvalidArgument, &g, "DOLLARDE(1.02, 0)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "DOLLARDE(1.02, -1)");
    }

    #[test]
    fn test_dollarfr() {
        let g = GridController::new();

        // Basic test - inverse of DOLLARDE
        // DOLLARFR(1.125, 16) = 1.02 (1 and 2/16)
        assert_f64_approx_eq(
            1.02,
            eval_to_string(&g, "DOLLARFR(1.125, 16)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARFR(1.125, 16)",
        );

        // DOLLARFR(1.125, 8) = 1.1 (1 and 1/8)
        assert_f64_approx_eq(
            1.1,
            eval_to_string(&g, "DOLLARFR(1.125, 8)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARFR(1.125, 8)",
        );

        // DOLLARFR(1.25, 4) = 1.1 (1 and 1/4)
        assert_f64_approx_eq(
            1.1,
            eval_to_string(&g, "DOLLARFR(1.25, 4)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARFR(1.25, 4)",
        );

        // Test with negative number
        assert_f64_approx_eq(
            -1.02,
            eval_to_string(&g, "DOLLARFR(-1.125, 16)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARFR with negative",
        );

        // Test with whole number
        assert_f64_approx_eq(
            5.0,
            eval_to_string(&g, "DOLLARFR(5, 16)")
                .parse::<f64>()
                .unwrap(),
            "DOLLARFR with whole number",
        );

        // Round-trip test: DOLLARDE(DOLLARFR(x, n), n) should equal x
        let original = 1.5_f64;
        let round_trip: f64 = eval_to_string(&g, "DOLLARDE(DOLLARFR(1.5, 32), 32)")
            .parse()
            .unwrap();
        assert_f64_approx_eq(original, round_trip, "DOLLARDE/DOLLARFR round-trip");

        // Error: fraction < 1
        expect_err(&RunErrorMsg::InvalidArgument, &g, "DOLLARFR(1.125, 0)");
        expect_err(&RunErrorMsg::InvalidArgument, &g, "DOLLARFR(1.125, -1)");
    }

    #[test]
    fn test_duration() {
        let g = GridController::new();

        // Basic DURATION calculation
        // Based on Excel example: 8% coupon, 9% yield, semi-annual, 8 years
        let duration: f64 = eval_to_string(
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            (duration - 5.993775).abs() < 0.01,
            "DURATION basic calculation: got {}",
            duration
        );

        // Test with annual frequency
        let duration_annual: f64 = eval_to_string(
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 1)",
        )
        .parse()
        .unwrap();
        assert!(
            duration_annual > 0.0 && duration_annual < 8.0,
            "DURATION annual should be positive and less than maturity: got {}",
            duration_annual
        );

        // Test with quarterly frequency
        let duration_quarterly: f64 = eval_to_string(
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 4)",
        )
        .parse()
        .unwrap();
        assert!(
            duration_quarterly > 0.0,
            "DURATION quarterly should be positive: got {}",
            duration_quarterly
        );

        // Duration with different basis
        let duration_actual: f64 = eval_to_string(
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2, 1)",
        )
        .parse()
        .unwrap();
        assert!(
            duration_actual > 0.0,
            "DURATION with actual/actual basis should be positive: got {}",
            duration_actual
        );

        // Zero coupon bond - duration should equal time to maturity (approximately)
        let duration_zero: f64 = eval_to_string(
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0, 0.09, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            (duration_zero - 8.0).abs() < 0.5,
            "Zero coupon DURATION should be close to maturity: got {}",
            duration_zero
        );

        // Error: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 3)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2, 5)",
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DURATION(DATE(2016, 1, 1), DATE(2008, 1, 1), 0.08, 0.09, 2)",
        );

        // Error: negative coupon rate
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), -0.08, 0.09, 2)",
        );

        // Error: negative yield
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, -0.09, 2)",
        );
    }

    #[test]
    fn test_mduration() {
        let g = GridController::new();

        // Basic MDURATION calculation
        // MDURATION = DURATION / (1 + yld/frequency)
        let mduration: f64 = eval_to_string(
            &g,
            "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2)",
        )
        .parse()
        .unwrap();

        // Should be approximately 5.993775 / (1 + 0.09/2) = 5.993775 / 1.045 ≈ 5.735
        assert!(
            (mduration - 5.735).abs() < 0.1,
            "MDURATION basic calculation: got {}",
            mduration
        );

        // MDURATION should always be less than DURATION (when yield > 0)
        let duration: f64 = eval_to_string(
            &g,
            "DURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2)",
        )
        .parse()
        .unwrap();
        assert!(
            mduration < duration,
            "MDURATION should be less than DURATION: {} vs {}",
            mduration,
            duration
        );

        // Test relationship: MDURATION = DURATION / (1 + yld/frequency)
        let expected_mduration = duration / (1.0 + 0.09 / 2.0);
        assert!(
            (mduration - expected_mduration).abs() < 0.001,
            "MDURATION relationship: got {} expected {}",
            mduration,
            expected_mduration
        );

        // Test with annual frequency
        let mduration_annual: f64 = eval_to_string(
            &g,
            "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 1)",
        )
        .parse()
        .unwrap();
        assert!(
            mduration_annual > 0.0,
            "MDURATION annual should be positive: got {}",
            mduration_annual
        );

        // Test with quarterly frequency
        let mduration_quarterly: f64 = eval_to_string(
            &g,
            "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 4)",
        )
        .parse()
        .unwrap();
        assert!(
            mduration_quarterly > 0.0,
            "MDURATION quarterly should be positive: got {}",
            mduration_quarterly
        );

        // Error: invalid frequency
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 3)",
        );

        // Error: invalid basis
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, 0.09, 2, 5)",
        );

        // Error: settlement >= maturity
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "MDURATION(DATE(2016, 1, 1), DATE(2008, 1, 1), 0.08, 0.09, 2)",
        );

        // Error: negative coupon rate
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), -0.08, 0.09, 2)",
        );

        // Error: negative yield
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "MDURATION(DATE(2008, 1, 1), DATE(2016, 1, 1), 0.08, -0.09, 2)",
        );
    }
}
