use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Mathematics functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        FormulaFunction {
            name: "SUM",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["SUM(B2:C6, 15, E1)"],
            doc: "Adds all values.\nReturns `0` if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::sum(&args.inner)))),
        },
        FormulaFunction {
            name: "PRODUCT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["PRODUCT(B2:C6, 0.002, E1)"],
            doc: "Multiplies all values.\nReturns 1 if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::product(&args.inner)))),
        },
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_sum() {
        let g = &mut NoGrid;
        assert_eq!("0", eval_to_string(g, "SUM(\"\", \"abc\")"));
        assert_eq!("12", eval_to_string(g, "SUM(\"\", \"abc\", 12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, \"\", \"abc\", 12)"));
    }

    #[test]
    fn test_product() {
        let g = &mut NoGrid;
        assert_eq!("1", eval_to_string(g, "PRODUCT(\"\", \"abc\")"));
        assert_eq!("12", eval_to_string(g, "PRODUCT(\"\", \"abc\", 12)"));
        assert_eq!(
            "1440",
            eval_to_string(g, "PRODUCT(1..5, \"\", \"abc\", 12)")
        );
        assert_eq!("0", eval_to_string(g, "PRODUCT(0..5, \"\", \"abc\", 12)"));
    }
}
