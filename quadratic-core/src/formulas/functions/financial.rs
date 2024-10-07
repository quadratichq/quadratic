use super::*;

// TODO: return values with currency formatting

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Financial functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// TODO: document this
            #[examples("NPV(A1, B1:B6)", "NPV(A1, B1, B2, B3, B4)")]
            fn NPV(span: Span, discount_rate: f64, net_cashflows: (Iter<f64>)) {
                npv(discount_rate, net_cashflows.try_collect()?)
            }
        ),
        formula_fn!(
            /// TODO: document this
            #[examples("XNPV(A1, B1:B6, C1:C6)")]
            fn XNPV(
                span: Span,
                discount_rate: f64,
                net_cashflows: (Spanned<Array>),
                dates: (Spanned<Array>),
            ) {
                dates.check_array_size_exact(net_cashflows.inner.size())?;

                xnpv(
                    discount_rate,
                    net_cashflows.iter_coerced().try_collect()?,
                    dates.iter_coerced().try_collect()?,
                )
            }
        ),
    ]
}

fn npv(rate: f64, cashflows: Vec<f64>) -> f64 {
    cashflows
        .into_iter()
        .enumerate()
        .map(|(i, value)| {
            let exponent = i as f64 + 1.0;
            value / (1.0 + rate).powf(exponent)})
        .sum()
}

fn xnpv(rate: f64, cashflows: Vec<f64>, dates: Vec<chrono::NaiveDate>) -> f64 {
    let Some(&init_date) = dates.iter().min() else {
         return 0.0
    };
    std::iter::zip(cashflows, dates).map(|(cashflow, date)| {
        let exponent = (date-init_date).num_days() as f64 / 365.0;
        cashflow / (1.0 + rate).powf(exponent)

    }).sum()
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::formulas::tests::*;

    // TODO: these tests should use `ROUND()` instead of selectively flooring & ceiling

    #[test]
    fn test_formula_npv() {
        let g = Grid::from_array(pos![A1], &array![-10_000.0; 3_000; 4_200; 6_800]);

        for formula_str in [
            "=FLOOR.MATH(NPV(0.1, A1:A4), 0.01)",
            "=FLOOR.MATH(NPV(0.1, A1, A2, A3, A4), 0.01)",
        ] {
            crate::util::assert_f64_approx_eq(1188.44, &eval_to_string(&g, formula_str));
        }
    }

    #[test]
    fn test_formula_xnpv() {
        let g = Grid::from_array(
            pos![A1],
            &array![
                -10_000.0, date("2008-01-01");
                2_750, date("2008-03-01");
                4_250, date("2008-10-30");
                3_250, date("2009-02-15");
                2_750, date("2009-04-01");
            ],
        );

        let formula_str = "=CEILING.MATH(XNPV(0.09, A1:A5, B1:B5), 0.01)";
        crate::util::assert_f64_approx_eq(2086.65, &eval_to_string(&g, formula_str));
    }
}
