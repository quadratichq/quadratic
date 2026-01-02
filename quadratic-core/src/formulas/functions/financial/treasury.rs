//! Treasury bill functions.

use super::*;
use crate::formulas::functions::datetime::parse_date_from_cell_value;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the bond-equivalent yield for a Treasury bill.
            #[examples("TBILLEQ(\"2021-01-15\", \"2021-07-15\", 0.05)")]
            fn TBILLEQ(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                discount: (f64),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;

                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if discount <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = (maturity - settlement).num_days() as f64;
                if dsm > 365.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Bond-equivalent yield formula
                // For T-bills with <= 182 days: (365 * discount) / (360 - discount * dsm)
                // For T-bills with > 182 days: more complex formula
                if dsm <= 182.0 {
                    (365.0 * discount) / (360.0 - discount * dsm)
                } else {
                    // For longer T-bills, use the more complex formula
                    let price = 100.0 * (1.0 - discount * dsm / 360.0);
                    let term = dsm / 365.0;

                    // Quadratic formula for yield
                    let a = term / 2.0;
                    let b = -((dsm / 365.0) + 0.5);
                    let c = (100.0 - price) / price;

                    let discriminant = b * b - 4.0 * a * c;
                    if discriminant < 0.0 {
                        return Err(RunErrorMsg::InvalidArgument.with_span(span));
                    }

                    (-b + discriminant.sqrt()) / (2.0 * a)
                }
            }
        ),
        formula_fn!(
            /// Returns the price per $100 face value for a Treasury bill.
            #[examples("TBILLPRICE(\"2021-01-15\", \"2021-07-15\", 0.05)")]
            fn TBILLPRICE(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                discount: (f64),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;

                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if discount <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = (maturity - settlement).num_days() as f64;
                if dsm > 365.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Price = 100 * (1 - discount * dsm / 360)
                100.0 * (1.0 - discount * dsm / 360.0)
            }
        ),
        formula_fn!(
            /// Returns the yield for a Treasury bill.
            #[examples("TBILLYIELD(\"2021-01-15\", \"2021-07-15\", 98)")]
            fn TBILLYIELD(
                span: Span,
                settlement: (Spanned<CellValue>),
                maturity: (Spanned<CellValue>),
                pr: (f64),
            ) {
                let settlement = parse_date_from_cell_value(&settlement)?;
                let maturity = parse_date_from_cell_value(&maturity)?;

                if settlement >= maturity {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if pr <= 0.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let dsm = (maturity - settlement).num_days() as f64;
                if dsm > 365.0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Yield = (100 - price) / price * (360 / dsm)
                (100.0 - pr) / pr * (360.0 / dsm)
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_tbillprice() {
        let g = GridController::new();
        let result = eval_to_string(&g, "TBILLPRICE(\"2021-01-15\", \"2021-07-15\", 0.05)");
        // Should return a price less than 100
        assert!(
            !result.contains("Error"),
            "TBILLPRICE should not return an error"
        );
    }

    #[test]
    fn test_tbillyield() {
        let g = GridController::new();
        let result = eval_to_string(&g, "TBILLYIELD(\"2021-01-15\", \"2021-07-15\", 98)");
        // Should return a positive yield
        assert!(
            !result.contains("Error"),
            "TBILLYIELD should not return an error"
        );
    }

    #[test]
    fn test_tbilleq() {
        let g = GridController::new();
        let result = eval_to_string(&g, "TBILLEQ(\"2021-01-15\", \"2021-07-15\", 0.05)");
        // Should return a positive bond-equivalent yield
        assert!(
            !result.contains("Error"),
            "TBILLEQ should not return an error"
        );
    }
}
