//! Odd period securities functions.

use super::*;
use crate::formulas::functions::datetime::parse_date_from_cell_value;

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

                // Calculate days in the odd first period
                let dfc = days_between(issue, first_coupon, basis);
                let e = year_basis / frequency as f64;
                let dsc = days_between(settlement, first_coupon, basis);

                // Odd first coupon calculation
                let odd_first_coupon = coupon * dfc / e;
                let dsc_e = dsc / e;

                // Price calculation for odd first period security
                let mut price = odd_first_coupon / (1.0 + yield_per_period).powf(dsc_e);

                // Add remaining coupon payments
                for k in 1..=n {
                    let discount = (1.0 + yield_per_period).powf(k as f64 - 1.0 + dsc_e);
                    price += coupon / discount;
                }

                // Add redemption
                let discount_final = (1.0 + yield_per_period).powf(n as f64 + dsc_e);
                price += redemption / discount_final;

                // Subtract accrued interest
                let a = days_between(issue, settlement, basis);
                let accrued = coupon * a / e;
                price - accrued
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

                // Calculate days in the odd first period
                let dfc = days_between(issue, first_coupon, basis);
                let e = year_basis / frequency as f64;
                let dsc = days_between(settlement, first_coupon, basis);
                let a = days_between(issue, settlement, basis);

                // Newton-Raphson iteration to find yield
                let mut yld = 0.1;
                for _ in 0..100 {
                    let yield_per_period = yld / frequency as f64;
                    let odd_first_coupon = coupon * dfc / e;
                    let dsc_e = dsc / e;

                    // Calculate price at current yield
                    let mut calc_price = odd_first_coupon / (1.0 + yield_per_period).powf(dsc_e);

                    for k in 1..=n {
                        let discount = (1.0 + yield_per_period).powf(k as f64 - 1.0 + dsc_e);
                        calc_price += coupon / discount;
                    }

                    let discount_final = (1.0 + yield_per_period).powf(n as f64 + dsc_e);
                    calc_price += redemption / discount_final;
                    calc_price -= coupon * a / e;

                    // Calculate derivative
                    let mut dprice = -dsc_e * odd_first_coupon
                        / (1.0 + yield_per_period).powf(dsc_e + 1.0)
                        / frequency as f64;

                    for k in 1..=n {
                        dprice -= (k as f64 - 1.0 + dsc_e) * coupon
                            / (1.0 + yield_per_period).powf(k as f64 + dsc_e)
                            / frequency as f64;
                    }

                    dprice -= (n as f64 + dsc_e) * redemption
                        / (1.0 + yield_per_period).powf(n as f64 + dsc_e + 1.0)
                        / frequency as f64;

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

                let price = (redemption + odd_last_coupon) / (1.0 + dsm_e * yield_per_period)
                    - coupon * a / e;

                price
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
