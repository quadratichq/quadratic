use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Statistics functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        FormulaFunction {
            name: "AVERAGE",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["AVERAGE(A1:A6)", "AVERAGE(A1, A3, A5, B1:B6)"],
            doc: "Returns the arithmetic mean of all values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::sum(&args.inner) / util::count_numeric(&args.inner) as f64,
                ))
            }),
        },
        FormulaFunction {
            name: "COUNT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["COUNT(A1:C42, E17)", "SUM(A1:A10) / COUNT(A1:A10)"],
            doc: "Returns the number of numeric values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::count_numeric(&args.inner) as f64))),
        },
        FormulaFunction {
            name: "MIN",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["MIN(A1:A6)", "MIN(0, A1:A6)"],
            doc: "Returns the smallest value.\nReturns +∞ if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::flat_iter_numbers(&args.inner).fold(f64::INFINITY, f64::min),
                ))
            }),
        },
        FormulaFunction {
            name: "MAX",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["MAX(A1:A6)", "MAX(0, A1:A6)"],
            doc: "Returns the largest value.\nReturns -∞ if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::flat_iter_numbers(&args.inner).fold(-f64::INFINITY, f64::max),
                ))
            }),
        },
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_average() {
        let form = parse_formula("AVERAGE(3, B1:D3)", pos![nAn1]).unwrap();

        let mut g = FnGrid(|pos| {
            if (1..=3).contains(&pos.x) && (1..=3).contains(&pos.y) {
                Some((pos.x * 3 + pos.y).to_string()) // 4 .. 12
            } else {
                panic!("cell {pos} shouldn't be accessed")
            }
        });

        assert_eq!(
            "7.5".to_string(),
            form.eval_blocking(&mut g, pos![nAn1]).unwrap().to_string(),
        );

        assert_eq!(
            "17",
            eval_to_string(&mut g, "AVERAGE(\"\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("5.5", eval_to_string(&mut g, "AVERAGE(1..10)"));
        assert_eq!("5", eval_to_string(&mut g, "AVERAGE(0..10)"));
    }

    #[test]
    fn test_count() {
        let g = &mut NoGrid;
        assert_eq!("0", eval_to_string(g, "COUNT()"));
        assert_eq!("3", eval_to_string(g, "COUNT(\"\", \"a\", 12, -3.5, 42.5)"));
        assert_eq!("10", eval_to_string(g, "COUNT(1..10)"));
        assert_eq!("11", eval_to_string(g, "COUNT(0..10)"));
    }
}
