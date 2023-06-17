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
        formula_fn!(
            /// Adds all values.
            /// Returns `0` if given no values.
            #[examples("SUM(B2:C6, 15, E1)")]
            fn SUM(numbers: (Iter<f64>)) {
                numbers.sum::<FormulaResult<f64>>()
            }
        ),
        formula_fn!(
            /// Evaluates each value based on some criteria, and then adds the
            /// ones that meet those criteria. If `range_to_sum` is given, then
            /// values in `range_to_sum` are added instead wherever the
            /// corresponding value in `range_to_evaluate` meets the criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "SUMIF(A1:A10, \"2\")",
                "SUMIF(A1:A10, \">0\")",
                "SUMIF(A1:A10, \"<>INVALID\", B1:B10)"
            )]
            #[pure_zip_map]
            fn SUMIF(
                eval_range: (Spanned<Array>),
                [criteria]: (Spanned<BasicValue>),
                numbers_range: (Option<Spanned<Array>>),
            ) {
                let criteria = Criterion::try_from(*criteria)?;
                let numbers =
                    criteria.iter_matching_coerced::<f64>(eval_range, numbers_range.as_ref())?;
                numbers.sum::<FormulaResult<f64>>()
            }
        ),
        formula_fn!(
            /// Multiplies all values.
            /// Returns `1` if given no values.
            #[examples("PRODUCT(B2:C6, 0.002, E1)")]
            fn PRODUCT(numbers: (Iter<f64>)) {
                numbers.product::<FormulaResult<f64>>()
            }
        ),
        formula_fn!(
            /// Returns the absolute value of a number.
            #[examples("ABS(-4)")]
            #[pure_zip_map]
            fn ABS([number]: f64) {
                number.abs()
            }
        ),
        formula_fn!(
            /// Returns the square root of a number.
            #[examples("SQRT(2)")]
            #[pure_zip_map]
            fn SQRT([number]: f64) {
                number.sqrt()
            }
        ),
        // Constants
        formula_fn!(
            /// Returns π, the circle constant.
            #[examples("PI()")]
            fn PI() {
                std::f64::consts::PI
            }
        ),
        formula_fn!(
            /// Returns τ, the circle constant equal to 2π.
            #[examples("TAU()")]
            fn TAU() {
                std::f64::consts::TAU
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_sum() {
        let g = &mut NoGrid;
        assert_eq!(
            FormulaErrorMsg::Expected {
                expected: "number".into(),
                got: Some("text".into()),
            },
            eval_to_err(g, "SUM(\"abc\")").msg,
        );
        assert_eq!(
            FormulaErrorMsg::DivideByZero,
            eval_to_err(g, "SUM(1/0)").msg
        );
        assert_eq!(
            FormulaErrorMsg::DivideByZero,
            eval_to_err(g, "SUM({1/0})").msg
        );
        assert_eq!("0", eval_to_string(g, "SUM()"));
        assert_eq!("12", eval_to_string(g, "SUM(12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, 12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, {\"\", \"abc\"}, 12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, {\"\"}, {\"abc\"}, 12)"));
        assert_eq!("0", eval_to_string(g, "SUM({\"\", \"abc\"})"));
        assert_eq!("12", eval_to_string(g, "SUM({\"\", \"abc\", 12})"));

        let g = &mut FnGrid(|_| Some("text".to_string()));
        // One bad cell reference on its own doesn't cause an error because it's
        // a 1x1 array.
        assert_eq!("12", eval_to_string(g, "SUM(12, A6)"));
        // But doing an operation on it converts it to a single value, which
        // does cause an error.
        assert_eq!(
            FormulaErrorMsg::Expected {
                expected: "number".into(),
                got: Some("text".into())
            },
            eval_to_err(g, "SUM(12, A6&A7)").msg,
        );
    }

    #[test]
    fn test_sumif() {
        let g = &mut BlankGrid;
        assert_eq!("15", eval_to_string(g, "SUMIF(0..10, \"<=5\")"));
        assert_eq!("63", eval_to_string(g, "SUMIF(0..10, \"<=5\", 2^0..10)"));
        // Test with an array of conditions.
        assert_eq!(
            "{63, 16; 1984, 1}",
            eval_to_string(g, "SUMIF(0..10, {\"<=5\", 4; \">5\", 0}, 2^0..10)"),
        );
    }

    #[test]
    fn test_product() {
        let g = &mut NoGrid;
        assert_eq!("1", eval_to_string(g, "PRODUCT()"));
        assert_eq!("12", eval_to_string(g, "PRODUCT(12)"));
        assert_eq!("1440", eval_to_string(g, "PRODUCT(1..5, 12)"));
        assert_eq!(
            "1440",
            eval_to_string(g, "PRODUCT(1..5, {\"_\", \"abc\"}, 12)"),
        );
        assert_eq!(
            "1440",
            eval_to_string(g, "PRODUCT(1..5, {\"_\"}, {\"abc\"}, 12)"),
        );
        assert_eq!("1", eval_to_string(g, "PRODUCT({\"_\", \"abc\"})"));
        assert_eq!("12", eval_to_string(g, "PRODUCT({\"_\", \"abc\", 12})"));
        assert_eq!(
            "1440",
            eval_to_string(g, "PRODUCT(1..5, {\"_\", \"abc\"}, 12)"),
        );
        assert_eq!(
            "0",
            eval_to_string(g, "PRODUCT(0..5, {\"_\", \"abc\"}, 12)"),
        );
    }

    #[test]
    fn test_abs() {
        let g = &mut NoGrid;
        assert_eq!("10", eval_to_string(g, "ABS(-10)"));
        assert_eq!("10", eval_to_string(g, "ABS(10)"));
        assert_eq!(
            FormulaErrorMsg::MissingRequiredArgument {
                func_name: "ABS",
                arg_name: "number"
            },
            parse_formula("ABS()", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
        assert_eq!(
            FormulaErrorMsg::TooManyArguments {
                func_name: "ABS",
                max_arg_count: 1
            },
            parse_formula("ABS(16, 17)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_sqrt() {
        let g = &mut NoGrid;
        crate::util::assert_f64_approx_eq(3.0_f64.sqrt(), &eval_to_string(g, "SQRT(3)"));
        assert_eq!("4", eval_to_string(g, "SQRT(16)"));
        assert_eq!(
            FormulaErrorMsg::MissingRequiredArgument {
                func_name: "SQRT",
                arg_name: "number"
            },
            parse_formula("SQRT()", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
        assert_eq!(
            FormulaErrorMsg::TooManyArguments {
                func_name: "SQRT",
                max_arg_count: 1
            },
            parse_formula("SQRT(16, 17)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_pi() {
        let g = &mut NoGrid;
        assert!(eval_to_string(g, "PI()").starts_with("3.14159"));
        assert_eq!(
            FormulaErrorMsg::TooManyArguments {
                func_name: "PI",
                max_arg_count: 0
            },
            parse_formula("PI(16)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_tau() {
        let g = &mut NoGrid;
        assert!(eval_to_string(g, "TAU()").starts_with("6.283"));
        assert_eq!(
            FormulaErrorMsg::TooManyArguments {
                func_name: "TAU",
                max_arg_count: 0
            },
            parse_formula("TAU(16)", Pos::ORIGIN)
                .unwrap()
                .eval_blocking(g, Pos::ORIGIN)
                .unwrap_err()
                .msg,
        );
    }
}
