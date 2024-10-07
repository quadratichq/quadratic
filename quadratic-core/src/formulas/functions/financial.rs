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
    vec![formula_fn!(
        /// TODO: document this
        #[examples("NPV(A1, B1:B6)", "NPV(A1, B1, B2, B3, B4)")]
        fn NPV(span: Span, discount_rate: f64, net_cashflows: (Iter<f64>)) {
            let net_cashflows: Vec<f64> = net_cashflows.try_collect()?;
            npv(discount_rate, net_cashflows)
        }
    )]
}

fn npv(rate: f64, cashflows: impl IntoIterator<Item = f64>) -> f64 {
    cashflows
        .into_iter()
        .enumerate()
        .map(|(i, value)| value / (1.0 + rate).powf(i as f64 + 1.0))
        .sum()
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_npv() {
        let g = Grid::from_array(pos![A1], &array![0.1; -10_000.0; 3_000; 4_200;6_800]);

        for formula_str in [
            "=FLOOR.MATH(NPV(A1, A2:A5), 0.01)",
            "=FLOOR.MATH(NPV(A1, A2, A3, A4, A5), 0.01)",
        ] {
            crate::util::assert_f64_approx_eq(1188.44, &eval_to_string(&g, formula_str));
        }
    }
}
