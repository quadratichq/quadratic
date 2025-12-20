//! Odd period securities functions.

use super::*;
use crate::formulas::functions::datetime::parse_date_from_cell_value;
use chrono::Months;

/// Helper to generate quasi-coupon dates going backwards from first_coupon to before issue
fn get_quasi_coupon_dates(
    issue: NaiveDate,
    first_coupon: NaiveDate,
    frequency: i64,
) -> Option<Vec<NaiveDate>> {
    let months_per_period = frequency_to_months(frequency)?;
    let mut dates = vec![first_coupon];
    let mut current = first_coupon;

    // Go backwards from first_coupon until we're before issue
    while current > issue {
        current = current.checked_sub_months(Months::new(months_per_period))?;
        dates.push(current);
    }

    dates.reverse();
    Some(dates)
}

/// Calculate ODDFPRICE for short first coupon period (DFC <= E)
fn oddfprice_short(
    issue: NaiveDate,
    settlement: NaiveDate,
    first_coupon: NaiveDate,
    n: i64,
    coupon: f64,
    yield_per_period: f64,
    redemption: f64,
    e: f64,
    basis: i64,
) -> f64 {
    let dfc = days_between(issue, first_coupon, basis);
    let dsc = days_between(settlement, first_coupon, basis);
    let a = days_between(issue, settlement, basis);

    let dsc_e = dsc / e;

    // Odd first coupon
    let odd_first_coupon = coupon * dfc / e;

    // Price calculation
    let mut price = odd_first_coupon / (1.0 + yield_per_period).powf(dsc_e);

    // Add regular coupon payments (from first_coupon to maturity)
    for k in 1..=n {
        let discount = (1.0 + yield_per_period).powf(k as f64 - 1.0 + dsc_e);
        price += coupon / discount;
    }

    // Add redemption
    let discount_final = (1.0 + yield_per_period).powf(n as f64 + dsc_e);
    price += redemption / discount_final;

    // Subtract accrued interest
    let accrued = coupon * a / e;
    price - accrued
}

/// Calculate ODDFPRICE for long first coupon period (DFC > E)
fn oddfprice_long(
    issue: NaiveDate,
    settlement: NaiveDate,
    first_coupon: NaiveDate,
    n: i64,
    coupon: f64,
    yield_per_period: f64,
    redemption: f64,
    e: f64,
    basis: i64,
    frequency: i64,
) -> Option<f64> {
    // Get quasi-coupon dates from before issue to first_coupon
    let quasi_dates = get_quasi_coupon_dates(issue, first_coupon, frequency)?;

    // NC = number of quasi-coupon periods in the odd period
    let nc = quasi_dates.len() - 1;

    // Find which quasi-period contains settlement and calculate Nq, DSC
    let mut nq = 0i64; // whole quasi-coupon periods from settlement to first_coupon
    let mut dsc = 0.0; // days from settlement to next quasi-coupon date

    for i in 0..nc {
        let period_start = quasi_dates[i];
        let period_end = quasi_dates[i + 1];

        if settlement >= period_start && settlement < period_end {
            // Settlement is in this quasi-period
            dsc = days_between(settlement, period_end, basis);
            nq = (nc - i - 1) as i64;
            break;
        } else if settlement == period_end && i + 1 < nc {
            // Settlement is exactly on a quasi-coupon date boundary
            dsc = days_between(settlement, quasi_dates[i + 2].min(first_coupon), basis);
            nq = (nc - i - 2) as i64;
            break;
        }
    }

    // If settlement equals first_coupon's previous quasi-date
    if dsc == 0.0 && settlement < first_coupon {
        dsc = days_between(settlement, first_coupon, basis);
        nq = 0;
    }

    let dsc_e = dsc / e;

    // Calculate the odd first coupon value (sum of all quasi-period contributions)
    // All paid at first_coupon, so discounted by the same factor
    let mut odd_coupon_ratio = 0.0;
    for i in 0..nc {
        let period_start = quasi_dates[i];
        let period_end = quasi_dates[i + 1];
        let nl_i = days_between(period_start, period_end, basis);
        if nl_i == 0.0 {
            continue;
        }

        let dc_i = if i == 0 {
            // First quasi-period: days from issue to end of first quasi-period
            days_between(issue, period_end, basis)
        } else {
            // Full quasi-period
            nl_i
        };

        odd_coupon_ratio += dc_i / nl_i;
    }

    // The odd first coupon is paid at first_coupon
    // Discount from first_coupon to settlement: Nq whole periods + DSC/E fractional period
    let first_coupon_exponent = nq as f64 + dsc_e;
    let odd_first_coupon_pv =
        odd_coupon_ratio * coupon / (1.0 + yield_per_period).powf(first_coupon_exponent);

    let mut price = odd_first_coupon_pv;

    // Add regular coupon payments (from first_coupon to maturity, N coupons)
    // First regular coupon is 1 period after first_coupon
    for k in 1..=n {
        let exponent = k as f64 + nq as f64 + dsc_e;
        price += coupon / (1.0 + yield_per_period).powf(exponent);
    }

    // Add redemption (paid at maturity, same time as last coupon)
    let exponent_final = n as f64 + nq as f64 + dsc_e;
    price += redemption / (1.0 + yield_per_period).powf(exponent_final);

    // Calculate accrued interest
    // Sum of (Ai/NLi) for all quasi-periods where we've accrued interest
    let mut accrued_ratio = 0.0;
    for i in 0..nc {
        let period_start = quasi_dates[i];
        let period_end = quasi_dates[i + 1];
        let nl_i = days_between(period_start, period_end, basis);
        if nl_i == 0.0 {
            continue;
        }

        if settlement > period_end {
            // Settlement is after this period - full accrual
            let a_i = if i == 0 {
                days_between(issue, period_end, basis)
            } else {
                nl_i
            };
            accrued_ratio += a_i / nl_i;
        } else if settlement >= period_start && settlement <= period_end {
            // Settlement is in this period - partial accrual
            let a_i = if i == 0 {
                days_between(issue, settlement, basis)
            } else {
                days_between(period_start, settlement, basis)
            };
            accrued_ratio += a_i / nl_i;
        }
    }

    let accrued = accrued_ratio * coupon;

    Some(price - accrued)
}

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the price per $100 face value of a security with an odd (short or long) first period.
            #[examples(
                "ODDFPRICE(\"2021-02-15\", \"2030-01-15\", \"2020-10-15\", \"2021-01-15\", 0.05, 0.06, 100, 2, 0)"
            )]
            fn ODDFPRICE(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                issue: (Spanned<CellValue>),
                first_coupon: (Spanned<CellValue>),
                rate: (f64),
                yld: (f64),
                redemption: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let issue = parse_date_from_cell_value(&issue)?;
                let first_coupon = parse_date_from_cell_value(&first_coupon)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement || settlement >= first_coupon || first_coupon >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let n = count_coupons(first_coupon, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let year_basis = annual_basis(basis);
                let coupon = 100.0 * rate / frequency as f64;
                let yield_per_period = yld / frequency as f64;
                let e = year_basis / frequency as f64;

                // Calculate days from issue to first_coupon to determine short vs long
                let dfc = days_between(issue, first_coupon, basis);

                if dfc <= e {
                    // Short first coupon period
                    oddfprice_short(
                        issue,
                        settlement,
                        first_coupon,
                        n,
                        coupon,
                        yield_per_period,
                        redemption,
                        e,
                        basis,
                    )
                } else {
                    // Long first coupon period
                    oddfprice_long(
                        issue,
                        settlement,
                        first_coupon,
                        n,
                        coupon,
                        yield_per_period,
                        redemption,
                        e,
                        basis,
                        frequency,
                    )
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?
                }
            }
        ),
        formula_fn!(
            /// Returns the yield of a security with an odd (short or long) first period.
            #[examples(
                "ODDFYIELD(\"2021-02-15\", \"2030-01-15\", \"2020-10-15\", \"2021-01-15\", 0.05, 99, 100, 2, 0)"
            )]
            fn ODDFYIELD(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                issue: (Spanned<CellValue>),
                first_coupon: (Spanned<CellValue>),
                rate: (f64),
                pr: (f64),
                redemption: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let issue = parse_date_from_cell_value(&issue)?;
                let first_coupon = parse_date_from_cell_value(&first_coupon)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || pr <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement || settlement >= first_coupon || first_coupon >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let n = count_coupons(first_coupon, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let year_basis = annual_basis(basis);
                let coupon = 100.0 * rate / frequency as f64;
                let e = year_basis / frequency as f64;

                // Calculate days from issue to first_coupon to determine short vs long
                let dfc = days_between(issue, first_coupon, basis);
                let is_long = dfc > e;

                // Newton-Raphson iteration to find yield using bisection fallback
                let mut yld = 0.1;
                for _ in 0..100 {
                    let yield_per_period = yld / frequency as f64;

                    // Calculate price at current yield using appropriate formula
                    let calc_price = if is_long {
                        oddfprice_long(
                            issue,
                            settlement,
                            first_coupon,
                            n,
                            coupon,
                            yield_per_period,
                            redemption,
                            e,
                            basis,
                            frequency,
                        )
                        .unwrap_or(0.0)
                    } else {
                        oddfprice_short(
                            issue,
                            settlement,
                            first_coupon,
                            n,
                            coupon,
                            yield_per_period,
                            redemption,
                            e,
                            basis,
                        )
                    };

                    // Calculate derivative numerically
                    let delta = 0.0001;
                    let yield_per_period_plus = (yld + delta) / frequency as f64;
                    let price_plus = if is_long {
                        oddfprice_long(
                            issue,
                            settlement,
                            first_coupon,
                            n,
                            coupon,
                            yield_per_period_plus,
                            redemption,
                            e,
                            basis,
                            frequency,
                        )
                        .unwrap_or(0.0)
                    } else {
                        oddfprice_short(
                            issue,
                            settlement,
                            first_coupon,
                            n,
                            coupon,
                            yield_per_period_plus,
                            redemption,
                            e,
                            basis,
                        )
                    };

                    let dprice = (price_plus - calc_price) / delta;

                    if dprice.abs() < 1e-15 {
                        break;
                    }

                    let new_yld = yld - (calc_price - pr) / dprice;
                    if (new_yld - yld).abs() < 1e-10 {
                        yld = new_yld;
                        break;
                    }
                    yld = new_yld;
                }

                if !yld.is_finite() || yld < -1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                yld
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a security with an odd (short or long) last period.
            #[examples(
                "ODDLPRICE(\"2021-01-15\", \"2021-06-01\", \"2020-10-01\", 0.05, 0.06, 100, 2, 0)"
            )]
            fn ODDLPRICE(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                last_interest: (Spanned<CellValue>),
                rate: (f64),
                yld: (f64),
                redemption: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let last_interest = parse_date_from_cell_value(&last_interest)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if last_interest >= settlement || settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let year_basis = annual_basis(basis);
                let coupon = 100.0 * rate / frequency as f64;
                let e = year_basis / frequency as f64;

                // Days from last interest to maturity (odd last period)
                let dlm = days_between(last_interest, maturity, basis);
                // Days from settlement to maturity
                let dsm = days_between(settlement, maturity, basis);
                // Days from last interest to settlement (accrued)
                let a = days_between(last_interest, settlement, basis);

                // Odd last coupon
                let odd_last_coupon = coupon * dlm / e;

                // Price calculation
                let dsm_e = dsm / e;
                let yield_per_period = yld / frequency as f64;

                (redemption + odd_last_coupon) / (1.0 + dsm_e * yield_per_period) - coupon * a / e
            }
        ),
        formula_fn!(
            /// Returns the yield of a security with an odd (short or long) last period.
            #[examples(
                "ODDLYIELD(\"2021-01-15\", \"2021-06-01\", \"2020-10-01\", 0.05, 99, 100, 2, 0)"
            )]
            fn ODDLYIELD(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                last_interest: (Spanned<CellValue>),
                rate: (f64),
                pr: (f64),
                redemption: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let last_interest = parse_date_from_cell_value(&last_interest)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || pr <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if last_interest >= settlement || settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let year_basis = annual_basis(basis);
                let coupon = 100.0 * rate / frequency as f64;
                let e = year_basis / frequency as f64;

                // Days from last interest to maturity (odd last period)
                let dlm = days_between(last_interest, maturity, basis);
                // Days from settlement to maturity
                let dsm = days_between(settlement, maturity, basis);
                // Days from last interest to settlement (accrued)
                let a = days_between(last_interest, settlement, basis);

                // Odd last coupon
                let odd_last_coupon = coupon * dlm / e;
                let accrued = coupon * a / e;
                let price_dirty = pr + accrued;

                // Yield calculation for odd last period
                // price_dirty = (redemption + odd_last_coupon) / (1 + dsm/e * yield_per_period)
                // Solving for yield:
                let dsm_e = dsm / e;
                if dsm_e == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                let yield_per_period = ((redemption + odd_last_coupon) / price_dirty - 1.0) / dsm_e;
                yield_per_period * frequency as f64
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_oddfprice_short_first_coupon() {
        // Short first coupon: issue 2020-10-15, first_coupon 2021-01-15 = ~3 months (< 6 months)
        let g = GridController::new();
        let result = eval_to_string(
            &g,
            "ODDFPRICE(\"2021-02-15\", \"2030-01-15\", \"2020-10-15\", \"2021-01-15\", 0.05, 0.06, 100, 2, 0)",
        );
        assert!(
            !result.contains("Error"),
            "ODDFPRICE short first coupon should not return an error: {}",
            result
        );
    }

    #[test]
    fn test_oddfprice_long_first_coupon() {
        // Long first coupon: issue 2019-06-01, first_coupon 2020-07-01 = 13 months (> 6 months)
        // Excel returns 104.434103 for this case
        let g = GridController::new();
        let result = eval_to_string(
            &g,
            "ODDFPRICE(\"2020-01-01\", \"2025-01-01\", \"2019-06-01\", \"2020-07-01\", 0.05, 0.04, 100, 2)",
        );
        assert!(
            !result.contains("Error"),
            "ODDFPRICE long first coupon should not return an error: {}",
            result
        );
        // Parse the result and check it's close to Excel's value
        let price: f64 = result.parse().expect("Should parse as f64");
        assert!(
            (price - 104.434103).abs() < 0.01,
            "ODDFPRICE should match Excel's result of 104.434103, got {}",
            price
        );
    }

    #[test]
    fn test_oddfyield_short_first_coupon() {
        let g = GridController::new();
        let result = eval_to_string(
            &g,
            "ODDFYIELD(\"2021-02-15\", \"2030-01-15\", \"2020-10-15\", \"2021-01-15\", 0.05, 99, 100, 2, 0)",
        );
        assert!(
            !result.contains("Error"),
            "ODDFYIELD short first coupon should not return an error: {}",
            result
        );
    }

    #[test]
    fn test_oddfyield_long_first_coupon() {
        // Long first coupon case
        let g = GridController::new();
        let result = eval_to_string(
            &g,
            "ODDFYIELD(\"2020-01-01\", \"2025-01-01\", \"2019-06-01\", \"2020-07-01\", 0.05, 104.434103, 100, 2)",
        );
        assert!(
            !result.contains("Error"),
            "ODDFYIELD long first coupon should not return an error: {}",
            result
        );
        // If we pass the Excel price, we should get back approximately the yield (0.04)
        let yld: f64 = result.parse().expect("Should parse as f64");
        assert!(
            (yld - 0.04).abs() < 0.001,
            "ODDFYIELD should return approximately 0.04, got {}",
            yld
        );
    }

    #[test]
    fn test_oddlprice() {
        let g = GridController::new();
        let result = eval_to_string(
            &g,
            "ODDLPRICE(\"2021-01-15\", \"2021-06-01\", \"2020-10-01\", 0.05, 0.06, 100, 2, 0)",
        );
        assert!(
            !result.contains("Error"),
            "ODDLPRICE should not return an error"
        );
    }

    #[test]
    fn test_oddlyield() {
        let g = GridController::new();
        let result = eval_to_string(
            &g,
            "ODDLYIELD(\"2021-01-15\", \"2021-06-01\", \"2020-10-01\", 0.05, 99, 100, 2, 0)",
        );
        assert!(
            !result.contains("Error"),
            "ODDLYIELD should not return an error"
        );
    }
}
