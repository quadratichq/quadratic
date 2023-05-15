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
            eval: util::pure_fn(|args| Ok(Value::Number(util::sum(&args.inner)?))),
        },
        FormulaFunction {
            name: "PRODUCT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["PRODUCT(B2:C6, 0.002, E1)"],
            doc: "Multiplies all values.\nReturns 1 if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::product(&args.inner)?))),
        },
        FormulaFunction {
            name: "ABS",
            arg_completion: "${1:number}",
            usages: &["number"],
            examples: &["ABS(-4)"],
            doc: "Returns the absolute value of a number.",
            eval: util::array_mapped(|[number]| Ok(Value::Number(number.to_number()?.abs()))),
        },
        FormulaFunction {
            name: "SQRT",
            arg_completion: "${1:number}",
            usages: &["number"],
            examples: &["SQRT(2)"],
            doc: "Returns the square root of a number.",
            eval: util::array_mapped(|[number]| Ok(Value::Number(number.to_number()?.sqrt()))),
        },
        // Constants
        FormulaFunction {
            name: "PI",
            arg_completion: "",
            usages: &[""],
            examples: &["PI()"],
            doc: "Returns π, the circle constant.",
            eval: util::constant_fn(Value::Number(std::f64::consts::PI)),
        },
        FormulaFunction {
            name: "TAU",
            arg_completion: "",
            usages: &[""],
            examples: &["TAU()"],
            doc: "Returns τ, the circle constant equal to 2π.",
            eval: util::constant_fn(Value::Number(std::f64::consts::TAU)),
        },
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_sum() {
        let g = &mut NoGrid;
        assert_eq!("0", eval_to_string(g, "SUM()"));
        assert_eq!("121", eval_to_string(g, "SUM(100, 0..6)"));
    }

    #[test]
    fn test_formula_product() {
        let g = &mut NoGrid;
        assert_eq!("1", eval_to_string(g, "PRODUCT()"));
        assert_eq!("72000", eval_to_string(g, "PRODUCT(100, 1..6)"));
    }

    #[test]
    fn test_formula_abs() {
        let g = &mut NoGrid;
        assert_eq!("10", eval_to_string(g, "ABS(-10)"));
        assert_eq!("10", eval_to_string(g, "ABS(10)"));
        assert_eq!(
            FormulaErrorMsg::BadArgumentCount,
            parse_formula("ABS()", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
        assert_eq!(
            FormulaErrorMsg::BadArgumentCount,
            parse_formula("ABS(16, 17)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_formula_sqrt() {
        let g = &mut NoGrid;
        assert_eq!("4", eval_to_string(g, "SQRT(16)"));
        assert_eq!(
            FormulaErrorMsg::BadArgumentCount,
            parse_formula("SQRT()", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
        assert_eq!(
            FormulaErrorMsg::BadArgumentCount,
            parse_formula("SQRT(16, 17)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_formula_pi() {
        let g = &mut NoGrid;
        assert!(eval_to_string(g, "PI()").starts_with("3.14159"));
        assert_eq!(
            FormulaErrorMsg::BadArgumentCount,
            parse_formula("PI(16)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_formula_tau() {
        let g = &mut NoGrid;
        assert!(eval_to_string(g, "TAU()").starts_with("6.283"));
        assert_eq!(
            FormulaErrorMsg::BadArgumentCount,
            parse_formula("TAU(16)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }
}
