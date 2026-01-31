//! Financial functions for loans, bonds, and investments.

mod bond;
mod investment;
mod loan;
mod securities;
pub mod stock_history;
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
        stock_history::get_functions(),
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

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // Loan calculation helpers
    // ========================================================================

    #[test]
    fn test_calculate_pmt() {
        // Zero interest rate
        let pmt = calculate_pmt(0.0, 12.0, 1200.0, 0.0, 0.0);
        assert!((pmt - (-100.0)).abs() < 0.01);

        // Standard loan: $10,000 at 5% annual for 12 months
        let rate = 0.05 / 12.0;
        let pmt = calculate_pmt(rate, 12.0, 10000.0, 0.0, 0.0);
        assert!((pmt - (-856.07)).abs() < 0.01);

        // With future value
        let pmt = calculate_pmt(rate, 12.0, 10000.0, -5000.0, 0.0);
        assert!(pmt < 0.0); // Still a payment

        // Beginning of period (payment_type = 1)
        let pmt_end = calculate_pmt(rate, 12.0, 10000.0, 0.0, 0.0);
        let pmt_begin = calculate_pmt(rate, 12.0, 10000.0, 0.0, 1.0);
        assert!(pmt_begin.abs() < pmt_end.abs()); // Beginning payments are smaller
    }

    #[test]
    fn test_calculate_fv() {
        // Zero interest rate
        let fv = calculate_fv(0.0, 12.0, -100.0, -1000.0, 0.0);
        assert!((fv - 2200.0).abs() < 0.01);

        // Standard investment: $100/month at 5% annual for 12 months
        let rate = 0.05 / 12.0;
        let fv = calculate_fv(rate, 12.0, -100.0, 0.0, 0.0);
        assert!(fv > 1200.0); // Should be more than sum of payments due to interest
    }

    #[test]
    fn test_calculate_pv() {
        // Zero interest rate
        let pv = calculate_pv(0.0, 12.0, -100.0, 0.0, 0.0);
        assert!((pv - 1200.0).abs() < 0.01);

        // Standard calculation
        let rate = 0.05 / 12.0;
        let pv = calculate_pv(rate, 12.0, -856.07, 0.0, 0.0);
        assert!((pv - 10000.0).abs() < 1.0);
    }

    #[test]
    fn test_normalize_payment_type() {
        assert_eq!(normalize_payment_type(None), 0.0);
        assert_eq!(normalize_payment_type(Some(0.0)), 0.0);
        assert_eq!(normalize_payment_type(Some(1.0)), 1.0);
        assert_eq!(normalize_payment_type(Some(0.5)), 1.0);
        assert_eq!(normalize_payment_type(Some(-1.0)), 1.0);
        assert_eq!(normalize_payment_type(Some(100.0)), 1.0);
    }

    // ========================================================================
    // Bond/coupon helpers
    // ========================================================================

    #[test]
    fn test_frequency_to_months() {
        assert_eq!(frequency_to_months(1), Some(12)); // Annual
        assert_eq!(frequency_to_months(2), Some(6)); // Semi-annual
        assert_eq!(frequency_to_months(4), Some(3)); // Quarterly
        assert_eq!(frequency_to_months(0), None);
        assert_eq!(frequency_to_months(3), None);
        assert_eq!(frequency_to_months(12), None);
    }

    #[test]
    fn test_is_valid_basis() {
        assert!(is_valid_basis(0));
        assert!(is_valid_basis(1));
        assert!(is_valid_basis(2));
        assert!(is_valid_basis(3));
        assert!(is_valid_basis(4));
        assert!(!is_valid_basis(-1));
        assert!(!is_valid_basis(5));
    }

    #[test]
    fn test_last_day_of_month() {
        // 31-day months
        assert_eq!(last_day_of_month(2024, 1), 31);
        assert_eq!(last_day_of_month(2024, 3), 31);
        assert_eq!(last_day_of_month(2024, 12), 31);

        // 30-day months
        assert_eq!(last_day_of_month(2024, 4), 30);
        assert_eq!(last_day_of_month(2024, 6), 30);
        assert_eq!(last_day_of_month(2024, 11), 30);

        // February leap year
        assert_eq!(last_day_of_month(2024, 2), 29);
        assert_eq!(last_day_of_month(2000, 2), 29);

        // February non-leap year
        assert_eq!(last_day_of_month(2023, 2), 28);
        assert_eq!(last_day_of_month(1900, 2), 28);
    }

    #[test]
    fn test_adjust_day_to_match() {
        let maturity = NaiveDate::from_ymd_opt(2025, 3, 31).unwrap();

        // Target month has 31 days - exact match
        let result = adjust_day_to_match(2024, 1, maturity);
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 1, 31).unwrap());

        // Target month has 30 days - clamped
        let result = adjust_day_to_match(2024, 4, maturity);
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 4, 30).unwrap());

        // February leap year - clamped to 29
        let result = adjust_day_to_match(2024, 2, maturity);
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 2, 29).unwrap());

        // February non-leap year - clamped to 28
        let result = adjust_day_to_match(2023, 2, maturity);
        assert_eq!(result, NaiveDate::from_ymd_opt(2023, 2, 28).unwrap());
    }

    #[test]
    fn test_find_previous_coupon_date() {
        let maturity = NaiveDate::from_ymd_opt(2025, 6, 15).unwrap();

        // Semi-annual (frequency = 2)
        let settlement = NaiveDate::from_ymd_opt(2024, 8, 1).unwrap();
        let prev = find_previous_coupon_date(settlement, maturity, 2).unwrap();
        assert_eq!(prev, NaiveDate::from_ymd_opt(2024, 6, 15).unwrap());

        // Quarterly (frequency = 4)
        let prev = find_previous_coupon_date(settlement, maturity, 4).unwrap();
        assert_eq!(prev, NaiveDate::from_ymd_opt(2024, 6, 15).unwrap());

        // Settlement equals maturity - returns None
        assert!(find_previous_coupon_date(maturity, maturity, 2).is_none());

        // Invalid frequency
        assert!(find_previous_coupon_date(settlement, maturity, 3).is_none());
    }

    #[test]
    fn test_find_next_coupon_date() {
        let maturity = NaiveDate::from_ymd_opt(2025, 6, 15).unwrap();

        // Semi-annual
        let settlement = NaiveDate::from_ymd_opt(2024, 8, 1).unwrap();
        let next = find_next_coupon_date(settlement, maturity, 2).unwrap();
        assert_eq!(next, NaiveDate::from_ymd_opt(2024, 12, 15).unwrap());

        // Quarterly
        let next = find_next_coupon_date(settlement, maturity, 4).unwrap();
        assert_eq!(next, NaiveDate::from_ymd_opt(2024, 9, 15).unwrap());
    }

    #[test]
    fn test_count_coupons() {
        let maturity = NaiveDate::from_ymd_opt(2025, 6, 15).unwrap();

        // Settlement early in 2024, semi-annual
        let settlement = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let count = count_coupons(settlement, maturity, 2).unwrap();
        assert_eq!(count, 3); // Jun 2024, Dec 2024, Jun 2025

        // Settlement past maturity
        let future_settlement = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        assert!(count_coupons(future_settlement, maturity, 2).is_none());
    }

    // ========================================================================
    // Day count conventions
    // ========================================================================

    #[test]
    fn test_days_30_360_us() {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 7, 1).unwrap();
        assert_eq!(days_30_360_us(start, end), 180);

        // Day 31 handling
        let start = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 2, 28).unwrap();
        let days = days_30_360_us(start, end);
        assert_eq!(days, 28); // 30 - 30 + 28 = 28

        // End of February handling
        let start = NaiveDate::from_ymd_opt(2024, 2, 29).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 3, 31).unwrap();
        let days = days_30_360_us(start, end);
        assert_eq!(days, 31);
    }

    #[test]
    fn test_days_30_360_eu() {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 7, 1).unwrap();
        assert_eq!(days_30_360_eu(start, end), 180);

        // Day 31 is always adjusted to 30
        let start = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 3, 31).unwrap();
        let days = days_30_360_eu(start, end);
        assert_eq!(days, 60); // 2 months * 30 days
    }

    #[test]
    fn test_days_actual() {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap();
        assert_eq!(days_actual(start, end), 30);

        let end = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        assert_eq!(days_actual(start, end), 366); // 2024 is leap year
    }

    #[test]
    fn test_coupon_days_in_period() {
        let prev = NaiveDate::from_ymd_opt(2024, 1, 15).unwrap();
        let next = NaiveDate::from_ymd_opt(2024, 7, 15).unwrap();

        // Basis 0: 30/360 US
        assert_eq!(coupon_days_in_period(prev, next, 2, 0), 180.0);

        // Basis 1: Actual/Actual
        assert_eq!(coupon_days_in_period(prev, next, 2, 1), 182.0);

        // Basis 3: Actual/365
        assert_eq!(coupon_days_in_period(prev, next, 2, 3), 182.5);
    }

    #[test]
    fn test_coupon_days_from_start() {
        let start = NaiveDate::from_ymd_opt(2024, 1, 15).unwrap();
        let date = NaiveDate::from_ymd_opt(2024, 4, 15).unwrap();

        // Basis 0: 30/360 US
        assert_eq!(coupon_days_from_start(start, date, 0), 90.0);

        // Basis 1: Actual
        assert_eq!(coupon_days_from_start(start, date, 1), 91.0); // 16+29+31+15

        // Basis 4: 30/360 EU
        assert_eq!(coupon_days_from_start(start, date, 4), 90.0);
    }

    #[test]
    fn test_annual_basis() {
        assert_eq!(annual_basis(0), 360.0);
        assert_eq!(annual_basis(1), 365.0);
        assert_eq!(annual_basis(2), 360.0);
        assert_eq!(annual_basis(3), 365.0);
        assert_eq!(annual_basis(4), 360.0);
        assert_eq!(annual_basis(99), 360.0); // default
    }

    #[test]
    fn test_days_between() {
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 7, 1).unwrap();

        assert_eq!(days_between(start, end, 0), 180.0); // 30/360 US
        assert_eq!(days_between(start, end, 1), 182.0); // Actual
        assert_eq!(days_between(start, end, 4), 180.0); // 30/360 EU
    }
}
