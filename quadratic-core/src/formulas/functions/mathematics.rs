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
            name: "SUMIF",
            arg_completion: "${1:range_to_evaluate}, ${2:criteria}${3:, ${4:[range_to_sum]}}",
            usages: &["range_to_evaluate, criteria, [range_to_sum]"],
            examples: &[
                "SUMIF(A1:A10, \"2\")",
                "SUMIF(A1:A10, \">0\")",
                "SUMIF(A1:A10, \"<>INVALID\", B1:B10)",
            ],
            doc: concat!(
                "Evaluates each value based on some criteria, and then adds the \
                 ones that meet those criteria. If `range_to_sum` is given, then \
                 values in `range_to_sum` are added instead wherever the corresponding
                 value in `range_to_evaluate` meets the criteria.",
                see_docs_for_more_about_criteria!(),
            ),
            eval: util::pure_fn(|args| {
                let [eval_range, criteria, sum_range] = match args.inner.as_slice() {
                    [range, criteria] => [range, criteria, range],
                    [eval_range, criteria, sum_range] => [eval_range, criteria, sum_range],
                    _ => return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span)),
                };
                let values = util::iter_values_meeting_criteria(eval_range, criteria, sum_range)?
                    .collect::<FormulaResult<Vec<_>>>()?;
                Ok(Value::Number(util::sum(&values)))
            }),
        },
        FormulaFunction {
            name: "PRODUCT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["PRODUCT(B2:C6, 0.002, E1)"],
            doc: "Multiplies all values.\nReturns 1 if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::product(&args.inner)))),
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
    fn test_sum() {
        let g = &mut NoGrid;
        assert_eq!("0", eval_to_string(g, "SUM(\"\", \"abc\")"));
        assert_eq!("12", eval_to_string(g, "SUM(\"\", \"abc\", 12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, \"\", \"abc\", 12)"));
    }

    #[test]
    fn test_sumif() {
        let g = &mut NoGrid;
        assert_eq!("15", eval_to_string(g, "SUMIF(0..10, \"<=5\")"));
        assert_eq!("63", eval_to_string(g, "SUMIF(0..10, \"<=5\", 2^0..10)"));
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
        crate::util::assert_f64_approx_eq(3.0_f64.sqrt(), &eval_to_string(g, "SQRT(3)"));
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
