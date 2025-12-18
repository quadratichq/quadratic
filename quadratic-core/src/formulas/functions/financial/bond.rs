//! Bond, coupon, and securities functions.

use super::*;
use crate::formulas::functions::datetime::{date_to_excel_serial, parse_date_from_cell_value};

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the coupon date before the settlement date.
            #[examples("COUPPCD(\"2021-01-15\", \"2030-01-15\", 2, 0)")]
            fn COUPPCD(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                date_to_excel_serial(pcd) as f64
            }
        ),
        formula_fn!(
            /// Returns the next coupon date after the settlement date.
            #[examples("COUPNCD(\"2021-01-15\", \"2030-01-15\", 2, 0)")]
            fn COUPNCD(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let ncd = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                date_to_excel_serial(ncd) as f64
            }
        ),
        formula_fn!(
            /// Returns the number of coupons between settlement and maturity.
            #[examples("COUPNUM(\"2021-01-15\", \"2030-01-15\", 2, 0)")]
            fn COUPNUM(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let count = count_coupons(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                count as f64
            }
        ),
        formula_fn!(
            /// Returns days from beginning of coupon period to settlement.
            #[examples("COUPDAYBS(\"2021-01-15\", \"2030-01-15\", 2, 0)")]
            fn COUPDAYBS(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                coupon_days_from_start(pcd, settlement, basis)
            }
        ),
        formula_fn!(
            /// Returns the number of days in the coupon period.
            #[examples("COUPDAYS(\"2021-01-15\", \"2030-01-15\", 2, 0)")]
            fn COUPDAYS(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let ncd = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                coupon_days_in_period(pcd, ncd, frequency, basis)
            }
        ),
        formula_fn!(
            /// Returns days from settlement to next coupon date.
            #[examples("COUPDAYSNC(\"2021-01-15\", \"2030-01-15\", 2, 0)")]
            fn COUPDAYSNC(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let ncd = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let days_in_period = coupon_days_in_period(pcd, ncd, frequency, basis);
                let days_from_start = coupon_days_from_start(pcd, settlement, basis);
                days_in_period - days_from_start
            }
        ),
        formula_fn!(
            /// Calculates the price of a discounted security.
            #[examples("PRICEDISC(\"2021-01-15\", \"2021-06-15\", 0.05, 100, 0)")]
            fn PRICEDISC(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                discount: (f64),
                redemption: (f64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = days_between(settlement, maturity, basis);
                let year_basis = annual_basis(basis);
                redemption * (1.0 - discount * dsm / year_basis)
            }
        ),
        formula_fn!(
            /// Returns the discount rate for a security.
            #[examples("DISC(\"2021-01-15\", \"2021-06-15\", 99, 100, 0)")]
            fn DISC(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                pr: (f64),
                redemption: (f64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || settlement >= maturity || redemption == 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = days_between(settlement, maturity, basis);
                let year_basis = annual_basis(basis);
                (redemption - pr) / redemption * (year_basis / dsm)
            }
        ),
        formula_fn!(
            /// Returns the annual yield for a discounted security.
            #[examples("YIELDDISC(\"2021-01-15\", \"2021-06-15\", 99, 100, 0)")]
            fn YIELDDISC(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                pr: (f64),
                redemption: (f64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || settlement >= maturity || pr == 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = days_between(settlement, maturity, basis);
                let year_basis = annual_basis(basis);
                (redemption - pr) / pr * (year_basis / dsm)
            }
        ),
        formula_fn!(
            /// Returns the annual interest rate for a fully invested security.
            #[examples("INTRATE(\"2021-01-15\", \"2021-06-15\", 1000, 1050, 0)")]
            fn INTRATE(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                investment: (f64),
                redemption: (f64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || settlement >= maturity || investment == 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = days_between(settlement, maturity, basis);
                let year_basis = annual_basis(basis);
                (redemption - investment) / investment * (year_basis / dsm)
            }
        ),
        formula_fn!(
            /// Returns the amount received at maturity for a fully invested security.
            #[examples("RECEIVED(\"2021-01-15\", \"2021-06-15\", 1000, 0.05, 0)")]
            fn RECEIVED(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                investment: (f64),
                discount: (f64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = days_between(settlement, maturity, basis);
                let year_basis = annual_basis(basis);
                let denominator = 1.0 - discount * dsm / year_basis;
                if denominator == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                investment / denominator
            }
        ),
        formula_fn!(
            /// Returns the effective annual interest rate.
            #[examples("EFFECT(0.05, 12)")]
            #[zip_map]
            fn EFFECT(span: Span, [nominal_rate]: f64, [npery]: f64) {
                if npery < 1.0 || nominal_rate <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let n = npery.floor();
                (1.0 + nominal_rate / n).powf(n) - 1.0
            }
        ),
        formula_fn!(
            /// Returns the nominal annual interest rate.
            #[examples("NOMINAL(0.05, 12)")]
            #[zip_map]
            fn NOMINAL(span: Span, [effect_rate]: f64, [npery]: f64) {
                if npery < 1.0 || effect_rate <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let n = npery.floor();
                n * ((1.0 + effect_rate).powf(1.0 / n) - 1.0)
            }
        ),
        formula_fn!(
            /// Returns the equivalent interest rate for growth of an investment.
            #[examples("RRI(10, 100, 200)")]
            #[zip_map]
            fn RRI(span: Span, [nper]: f64, [pv]: f64, [fv]: f64) {
                if nper <= 0.0 || pv == 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                (fv / pv).powf(1.0 / nper) - 1.0
            }
        ),
        formula_fn!(
            /// Returns the number of periods required for an investment to reach a specified value.
            #[examples("PDURATION(0.05, 100, 200)")]
            #[zip_map]
            fn PDURATION(span: Span, [rate]: f64, [pv]: f64, [fv]: f64) {
                if rate <= 0.0 || pv <= 0.0 || fv <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                (fv / pv).ln() / (1.0 + rate).ln()
            }
        ),
        formula_fn!(
            /// Converts a dollar price expressed as a fraction to a decimal.
            #[examples("DOLLARDE(1.02, 16)")]
            #[zip_map]
            fn DOLLARDE(span: Span, [fractional_dollar]: f64, [fraction]: f64) {
                if fraction < 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let fraction = fraction.floor();
                let int_part = fractional_dollar.trunc();
                let frac_part = fractional_dollar.fract();
                int_part + frac_part / fraction * 10.0_f64.powf(fraction.log10().ceil())
            }
        ),
        formula_fn!(
            /// Converts a dollar price expressed as a decimal to a fraction.
            #[examples("DOLLARFR(1.125, 16)")]
            #[zip_map]
            fn DOLLARFR(span: Span, [decimal_dollar]: f64, [fraction]: f64) {
                if fraction < 1.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                let fraction = fraction.floor();
                let int_part = decimal_dollar.trunc();
                let dec_part = decimal_dollar.fract();
                int_part + dec_part * fraction / 10.0_f64.powf(fraction.log10().ceil())
            }
        ),
        formula_fn!(
            /// Returns the accrued interest for a security that pays periodic interest.
            #[examples("ACCRINT(\"2020-01-01\", \"2020-07-01\", \"2021-01-01\", 0.05, 1000, 2, 0)")]
            fn ACCRINT(
                span: Span,
                issue: (Spanned<CellValue>),
                first_interest: (Spanned<CellValue>),
                settlement: (Spanned<CellValue>),
                rate: (f64),
                par: (f64),
                frequency: (i64),
                basis: (Option<i64>),
                calc_method: (Option<bool>),
            ) {
                let issue = parse_date_from_cell_value(&issue)?;
                let first_interest = parse_date_from_cell_value(&first_interest)?;
                let settlement = parse_date_from_cell_value(&settlement)?;
                let basis = basis.unwrap_or(0);
                let calc_method = calc_method.unwrap_or(true);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate <= 0.0 || par <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let year_basis = annual_basis(basis);
                let coupon_rate = rate / frequency as f64;

                if calc_method {
                    // Calculate accrued interest from issue to settlement
                    let days = days_between(issue, settlement, basis);
                    par * coupon_rate * (days / (year_basis / frequency as f64))
                } else {
                    // Calculate based on first interest date
                    let _days_to_first = days_between(issue, first_interest, basis);
                    let days_to_settle = days_between(issue, settlement, basis);
                    let period_days = year_basis / frequency as f64;
                    let num_periods = (days_to_settle / period_days).floor();
                    let remaining_days = days_to_settle - num_periods * period_days;
                    par * rate * (num_periods / frequency as f64 + remaining_days / year_basis)
                }
            }
        ),
        formula_fn!(
            /// Returns the accrued interest for a security that pays interest at maturity.
            #[examples("ACCRINTM(\"2020-01-01\", \"2021-01-01\", 0.05, 1000, 0)")]
            fn ACCRINTM(
                span: Span,
                issue: (Spanned<CellValue>),
                settlement: (Spanned<CellValue>),
                rate: (f64),
                par: (f64),
                basis: (Option<i64>),
            ) {
                let issue = parse_date_from_cell_value(&issue)?;
                let settlement = parse_date_from_cell_value(&settlement)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate <= 0.0 || par <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let days = days_between(issue, settlement, basis);
                let year_basis = annual_basis(basis);
                par * rate * days / year_basis
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a security that pays periodic interest.
            #[examples("PRICE(\"2021-01-15\", \"2030-01-15\", 0.05, 0.06, 100, 2, 0)")]
            fn PRICE(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                rate: (f64),
                yld: (f64),
                redemption: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let n = count_coupons(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let ncd = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let e = coupon_days_in_period(pcd, ncd, frequency, basis);
                let a = coupon_days_from_start(pcd, settlement, basis);
                let dsc = e - a;

                let coupon = 100.0 * rate / frequency as f64;
                let yield_per_period = yld / frequency as f64;

                if n == 1 {
                    // One coupon remaining
                    let t = dsc / e;
                    (redemption + coupon) / (1.0 + t * yield_per_period) - a / e * coupon
                } else {
                    // Multiple coupons remaining
                    let dsc_e = dsc / e;
                    let mut price =
                        redemption / (1.0 + yield_per_period).powf(n as f64 - 1.0 + dsc_e);

                    for k in 1..=n {
                        price += coupon / (1.0 + yield_per_period).powf(k as f64 - 1.0 + dsc_e);
                    }

                    price - a / e * coupon
                }
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value of a security that pays interest at maturity.
            #[examples("PRICEMAT(\"2021-01-15\", \"2022-01-15\", \"2020-01-15\", 0.05, 0.06, 0)")]
            fn PRICEMAT(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                issue: (Spanned<CellValue>),
                rate: (f64),
                yld: (f64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let issue = parse_date_from_cell_value(&issue)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || yld < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity || issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let year_basis = annual_basis(basis);
                let dsm = days_between(settlement, maturity, basis);
                let dim = days_between(issue, maturity, basis);
                let a = days_between(issue, settlement, basis);

                let denominator = 1.0 + dsm / year_basis * yld;
                if denominator == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                100.0 * (1.0 + dim / year_basis * rate) / denominator
                    - 100.0 * a / year_basis * rate
            }
        ),
        formula_fn!(
            /// Returns the yield on a security that pays periodic interest.
            #[examples("YIELD(\"2021-01-15\", \"2030-01-15\", 0.05, 95, 100, 2, 0)")]
            fn YIELD(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                rate: (f64),
                pr: (f64),
                redemption: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || pr <= 0.0 || redemption <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let n = count_coupons(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let ncd = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let e = coupon_days_in_period(pcd, ncd, frequency, basis);
                let a = coupon_days_from_start(pcd, settlement, basis);
                let dsc = e - a;

                let coupon = 100.0 * rate / frequency as f64;

                if n == 1 {
                    // One coupon period: use simple formula
                    let t = dsc / e;
                    let total_redemption = redemption + coupon;
                    let accrued = a / e * coupon;
                    let price_clean = pr + accrued;
                    ((total_redemption - price_clean) / price_clean + 1.0).powf(1.0 / t) - 1.0
                } else {
                    // Multiple periods: use Newton-Raphson iteration
                    let mut yld = 0.1; // Initial guess
                    for _ in 0..100 {
                        let yield_per_period = yld / frequency as f64;
                        let dsc_e = dsc / e;

                        // Calculate price at current yield
                        let mut calc_price =
                            redemption / (1.0 + yield_per_period).powf(n as f64 - 1.0 + dsc_e);
                        for k in 1..=n {
                            calc_price +=
                                coupon / (1.0 + yield_per_period).powf(k as f64 - 1.0 + dsc_e);
                        }
                        calc_price -= a / e * coupon;

                        // Calculate derivative
                        let mut dprice = -(n as f64 - 1.0 + dsc_e) * redemption
                            / (1.0 + yield_per_period).powf(n as f64 + dsc_e)
                            / frequency as f64;
                        for k in 1..=n {
                            dprice -= (k as f64 - 1.0 + dsc_e) * coupon
                                / (1.0 + yield_per_period).powf(k as f64 + dsc_e)
                                / frequency as f64;
                        }

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
            }
        ),
        formula_fn!(
            /// Returns the annual yield of a security that pays interest at maturity.
            #[examples("YIELDMAT(\"2021-01-15\", \"2022-01-15\", \"2020-01-15\", 0.05, 99, 0)")]
            fn YIELDMAT(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                issue: (Spanned<CellValue>),
                rate: (f64),
                pr: (f64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let issue = parse_date_from_cell_value(&issue)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if rate < 0.0 || pr <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity || issue >= settlement {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let year_basis = annual_basis(basis);
                let dsm = days_between(settlement, maturity, basis);
                let dim = days_between(issue, maturity, basis);
                let a = days_between(issue, settlement, basis);

                let term = dsm / year_basis;
                if term == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                // YIELDMAT = (par + interest - price - accrued) / (price + accrued) / term
                let par = 100.0;
                let interest = par * rate * dim / year_basis;
                let accrued = par * rate * a / year_basis;
                let price_dirty = pr + accrued;

                (par + interest - price_dirty) / price_dirty / term
            }
        ),
        formula_fn!(
            /// Returns the Macaulay duration for a security with an assumed par value of $100.
            #[examples("DURATION(\"2021-01-15\", \"2030-01-15\", 0.05, 0.06, 2, 0)")]
            fn DURATION(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                coupon: (f64),
                yld: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if coupon < 0.0 || yld < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let n = count_coupons(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let ncd = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let e = coupon_days_in_period(pcd, ncd, frequency, basis);
                let dsc = e - coupon_days_from_start(pcd, settlement, basis);

                let coupon_payment = 100.0 * coupon / frequency as f64;
                let yield_per_period = yld / frequency as f64;
                let dsc_e = dsc / e;

                let mut pv_weighted_sum = 0.0;
                let mut pv_sum = 0.0;

                for k in 1..=n {
                    let t = (k as f64 - 1.0 + dsc_e) / frequency as f64;
                    let discount = (1.0 + yield_per_period).powf(k as f64 - 1.0 + dsc_e);
                    let pv = coupon_payment / discount;
                    pv_weighted_sum += t * pv;
                    pv_sum += pv;
                }

                // Add redemption
                let t_final = (n as f64 - 1.0 + dsc_e) / frequency as f64;
                let discount_final = (1.0 + yield_per_period).powf(n as f64 - 1.0 + dsc_e);
                let pv_redemption = 100.0 / discount_final;
                pv_weighted_sum += t_final * pv_redemption;
                pv_sum += pv_redemption;

                if pv_sum == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                pv_weighted_sum / pv_sum
            }
        ),
        formula_fn!(
            /// Returns the modified Macaulay duration for a security with an assumed par value of $100.
            #[examples("MDURATION(\"2021-01-15\", \"2030-01-15\", 0.05, 0.06, 2, 0)")]
            fn MDURATION(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                coupon: (f64),
                yld: (f64),
                frequency: (i64),
                basis: (Option<i64>),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;
                let basis = basis.unwrap_or(0);

                if !is_valid_basis(basis) || frequency_to_months(frequency).is_none() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if coupon < 0.0 || yld < 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let n = count_coupons(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let pcd = find_previous_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;
                let ncd = find_next_coupon_date(settlement, maturity, frequency)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let e = coupon_days_in_period(pcd, ncd, frequency, basis);
                let dsc = e - coupon_days_from_start(pcd, settlement, basis);

                let coupon_payment = 100.0 * coupon / frequency as f64;
                let yield_per_period = yld / frequency as f64;
                let dsc_e = dsc / e;

                let mut pv_weighted_sum = 0.0;
                let mut pv_sum = 0.0;

                for k in 1..=n {
                    let t = (k as f64 - 1.0 + dsc_e) / frequency as f64;
                    let discount = (1.0 + yield_per_period).powf(k as f64 - 1.0 + dsc_e);
                    let pv = coupon_payment / discount;
                    pv_weighted_sum += t * pv;
                    pv_sum += pv;
                }

                // Add redemption
                let t_final = (n as f64 - 1.0 + dsc_e) / frequency as f64;
                let discount_final = (1.0 + yield_per_period).powf(n as f64 - 1.0 + dsc_e);
                let pv_redemption = 100.0 / discount_final;
                pv_weighted_sum += t_final * pv_redemption;
                pv_sum += pv_redemption;

                if pv_sum == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                let macaulay_duration = pv_weighted_sum / pv_sum;
                macaulay_duration / (1.0 + yld / frequency as f64)
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_effect() {
        let g = GridController::new();
        let result = eval_to_string(&g, "EFFECT(0.05, 12)");
        assert!(result.contains("0.051"));
    }

    #[test]
    fn test_nominal() {
        let g = GridController::new();
        let result = eval_to_string(&g, "NOMINAL(0.05116, 12)");
        // NOMINAL should return a value without error
        assert!(
            !result.contains("Error"),
            "NOMINAL should not return an error"
        );
    }
}
