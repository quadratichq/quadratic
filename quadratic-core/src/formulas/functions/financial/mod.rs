//! Financial functions for loans, bonds, and investments.

mod bond;
mod investment;
mod loan;
mod securities;
mod treasury;

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

fn get_functions() -> Vec<FormulaFunction> {
    [
        loan::get_functions(),
        bond::get_functions(),
        investment::get_functions(),
        treasury::get_functions(),
        securities::get_functions(),
    ]
    .into_iter()
    .flatten()
    .collect()
}

// ============================================================================
// Shared helper functions for loan calculations
// ============================================================================

/// Helper function to calculate payment (PMT)
pub(crate) fn calculate_pmt(rate: f64, nper: f64, pv: f64, fv: f64, payment_type: f64) -> f64 {
    if rate == 0.0 {
        -(pv + fv) / nper
    } else {
        let pvif = (1.0 + rate).powf(nper);
        let pmt = rate * (pv * pvif + fv) / (pvif - 1.0);
        -pmt / (1.0 + rate * payment_type)
    }
}

/// Helper function to calculate future value (FV)
pub(crate) fn calculate_fv(rate: f64, nper: f64, pmt: f64, pv: f64, payment_type: f64) -> f64 {
    if rate == 0.0 {
        -(pv + pmt * nper)
    } else {
        let pvif = (1.0 + rate).powf(nper);
        let fvifa = (pvif - 1.0) / rate;
        -pv * pvif - pmt * (1.0 + rate * payment_type) * fvifa
    }
}

/// Helper function to calculate present value (PV)
pub(crate) fn calculate_pv(rate: f64, nper: f64, pmt: f64, fv: f64, payment_type: f64) -> f64 {
    if rate == 0.0 {
        -(fv + pmt * nper)
    } else {
        let pvif = (1.0 + rate).powf(nper);
        let fvifa = (pvif - 1.0) / rate;
        (-fv - pmt * (1.0 + rate * payment_type) * fvifa) / pvif
    }
}

/// Helper function to normalize payment_type to 0 or 1
pub(crate) fn normalize_payment_type(payment_type: Option<f64>) -> f64 {
    if payment_type.unwrap_or(0.0) != 0.0 {
        1.0
    } else {
        0.0
    }
}

// ============================================================================
// Shared helper functions for bond/coupon calculations
// ============================================================================

/// Validates and converts frequency to months per coupon period
pub(crate) fn frequency_to_months(frequency: i64) -> Option<u32> {
    match frequency {
        1 => Some(12), // Annual
        2 => Some(6),  // Semi-annual
        4 => Some(3),  // Quarterly
        _ => None,
    }
}

/// Validates the basis (day count convention)
pub(crate) fn is_valid_basis(basis: i64) -> bool {
    (0..=4).contains(&basis)
}

/// Adjusts a date to match the maturity date's day-of-month as closely as possible.
pub(crate) fn adjust_day_to_match(
    target_year: i32,
    target_month: u32,
    maturity: NaiveDate,
) -> NaiveDate {
    let mat_day = maturity.day();
    let days_in_month = last_day_of_month(target_year, target_month);
    let day = mat_day.min(days_in_month);
    NaiveDate::from_ymd_opt(target_year, target_month, day).unwrap()
}

/// Returns the last day of the given month
pub(crate) fn last_day_of_month(year: i32, month: u32) -> u32 {
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

/// Finds the previous coupon date
pub(crate) fn find_previous_coupon_date(
    settlement: NaiveDate,
    maturity: NaiveDate,
    frequency: i64,
) -> Option<NaiveDate> {
    let months_per_period = frequency_to_months(frequency)?;
    if settlement >= maturity {
        return None;
    }
    let mut coupon_date = maturity;
    while coupon_date > settlement {
        coupon_date = coupon_date.checked_sub_months(Months::new(months_per_period))?;
    }
    Some(adjust_day_to_match(
        coupon_date.year(),
        coupon_date.month(),
        maturity,
    ))
}

/// Finds the next coupon date
pub(crate) fn find_next_coupon_date(
    settlement: NaiveDate,
    maturity: NaiveDate,
    frequency: i64,
) -> Option<NaiveDate> {
    let months_per_period = frequency_to_months(frequency)?;
    if settlement >= maturity {
        return None;
    }
    let prev_coupon = find_previous_coupon_date(settlement, maturity, frequency)?;
    let next = prev_coupon.checked_add_months(Months::new(months_per_period))?;
    Some(adjust_day_to_match(next.year(), next.month(), maturity))
}

/// Counts the number of coupons remaining
pub(crate) fn count_coupons(
    settlement: NaiveDate,
    maturity: NaiveDate,
    frequency: i64,
) -> Option<i64> {
    let months_per_period = frequency_to_months(frequency)?;
    if settlement >= maturity {
        return None;
    }
    let mut next_coupon = find_next_coupon_date(settlement, maturity, frequency)?;
    let mut count = 0i64;
    while next_coupon <= maturity {
        count += 1;
        next_coupon = next_coupon.checked_add_months(Months::new(months_per_period))?;
        next_coupon = adjust_day_to_match(next_coupon.year(), next_coupon.month(), maturity);
    }
    Some(count)
}

/// Calculates days between two dates according to the 30/360 US convention
pub(crate) fn days_30_360_us(start: NaiveDate, end: NaiveDate) -> i64 {
    let mut d1 = start.day() as i64;
    let mut d2 = end.day() as i64;
    let m1 = start.month() as i64;
    let mut m2 = end.month() as i64;
    let y1 = start.year() as i64;
    let y2 = end.year() as i64;

    if d1 == 31 {
        d1 = 30;
    }
    if d2 == 31 && d1 >= 30 {
        d2 = 30;
    }

    let is_feb_eom = |d: &NaiveDate| d.month() == 2 && d.day() == last_day_of_month(d.year(), 2);
    if is_feb_eom(&start) {
        d1 = 30;
        if is_feb_eom(&end) {
            d2 = 30;
        }
    }

    if d2 == 30 && end.day() == 31 {
        m2 = end.month() as i64;
    }

    360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1)
}

/// Calculates days between two dates according to the 30/360 European convention
pub(crate) fn days_30_360_eu(start: NaiveDate, end: NaiveDate) -> i64 {
    let mut d1 = start.day() as i64;
    let mut d2 = end.day() as i64;
    let m1 = start.month() as i64;
    let m2 = end.month() as i64;
    let y1 = start.year() as i64;
    let y2 = end.year() as i64;

    if d1 == 31 {
        d1 = 30;
    }
    if d2 == 31 {
        d2 = 30;
    }

    360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1)
}

/// Calculates the actual number of days between two dates
pub(crate) fn days_actual(start: NaiveDate, end: NaiveDate) -> i64 {
    (end - start).num_days()
}

/// Calculates days in the coupon period based on the basis
pub(crate) fn coupon_days_in_period(
    prev_coupon: NaiveDate,
    next_coupon: NaiveDate,
    frequency: i64,
    basis: i64,
) -> f64 {
    match basis {
        0 => 360.0 / frequency as f64,
        1 => days_actual(prev_coupon, next_coupon) as f64,
        2 => 360.0 / frequency as f64,
        3 => 365.0 / frequency as f64,
        4 => 360.0 / frequency as f64,
        _ => 360.0 / frequency as f64,
    }
}

/// Calculates days from start of coupon period to a date
pub(crate) fn coupon_days_from_start(start: NaiveDate, date: NaiveDate, basis: i64) -> f64 {
    match basis {
        0 => days_30_360_us(start, date) as f64,
        1..=3 => days_actual(start, date) as f64,
        4 => days_30_360_eu(start, date) as f64,
        _ => days_30_360_us(start, date) as f64,
    }
}

/// Returns the annual basis (number of days in a year) for a given day count convention
pub(crate) fn annual_basis(basis: i64) -> f64 {
    match basis {
        0 => 360.0,
        1 => 365.0,
        2 => 360.0,
        3 => 365.0,
        4 => 360.0,
        _ => 360.0,
    }
}

/// Calculates days between two dates based on the day count basis
pub(crate) fn days_between(start: NaiveDate, end: NaiveDate, basis: i64) -> f64 {
    match basis {
        0 => days_30_360_us(start, end) as f64,
        1..=3 => days_actual(start, end) as f64,
        4 => days_30_360_eu(start, end) as f64,
        _ => days_30_360_us(start, end) as f64,
    }
}
