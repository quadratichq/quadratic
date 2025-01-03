use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Financial functions",
    docs: Some("Financial functions for calculating loan payments, interest rates, and other financial calculations."),
    get_functions,
};

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
            #[examples(
                "PMT(0.08/12, 12*5, 10000)",
                "PMT(0.06/12, 24, 5000, 0, 1)"
            )]
            fn PMT(

                rate: (f64),
                nper: (f64),
                pv: (f64),
                fv: (Option<f64>),
                payment_type: (Option<f64>),
            ) {


                let fv = fv.unwrap_or(0.0);
                let payment_type = if payment_type.unwrap_or(0.0) == 1.0 { 1.0 } else { 0.0 };

                let payment = if rate == 0.0 {
                    // For zero interest rate, it's just the principal divided by the number of payments
                    -(pv + fv) / nper
                } else {
                    // PMT = (rate * (PV + FV * (1 + rate)^-n)) / (1 - (1 + rate)^-n)
                    let pvif = (1.0 + rate).powf(nper);
                    let pmt = rate * (pv * pvif + fv) / (pvif - 1.0);
                    // Adjust for payments at the beginning of the period
                    -pmt / (1.0 + rate * payment_type)
                };

                Ok(CellValue::from(payment))
            }
        ),
    ]
}
#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;
    use serial_test::parallel;

    fn assert_close(expected: f64, actual: &str, msg: &str) {
        let actual = actual.parse::<f64>().unwrap();
        let percentage_diff = ((actual - expected).abs() / expected) * 100.0;
        assert!(
            percentage_diff <= 1.0,
            "{}: Expected {} but got {}, diff: {:.2}%",
            msg,
            expected,
            actual,
            percentage_diff
        );
    }

    #[test]
    #[parallel]
    fn test_pmt() {
        let g = Grid::new();
        
        // Test basic loan payment calculation
        // $10000 loan, 5 years, 8% annual interest, monthly payments
        assert_close(-202.76, &eval_to_string(&g, "PMT(0.08/12, 12*5, 10000)"), "Basic loan payment");
        
        // Test with future value
        assert_close(-260.92, &eval_to_string(&g, "PMT(0.06/12, 24, 5000, 1000)"), "Payment with future value");
        
        // Test with payment at beginning of period
        assert_close(-259.63, &eval_to_string(&g, "PMT(0.06/12, 24, 5000, 1000, 1)"), "Payment at beginning");
        
        // Test with zero interest rate
        assert_close(-100.0, &eval_to_string(&g, "PMT(0, 12, 1200)"), "Zero interest rate");
        
        // Test with negative number of periods
        assert_close(-136.10, &eval_to_string(&g, "PMT(0.08/12, -12*5, -10000)"), "Negative periods");
    }
}

