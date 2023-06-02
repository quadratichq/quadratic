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
                got: Some("\"abc\"".into()),
            },
            eval_to_err(g, "SUM(\"abc\")").msg,
        );
        assert_eq!("0", eval_to_string(g, "SUM()"));
        assert_eq!("12", eval_to_string(g, "SUM(12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, 12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, {\"\", \"abc\"}, 12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, {\"\"}, {\"abc\"}, 12)"));
        assert_eq!("0", eval_to_string(g, "SUM({\"\", \"abc\"})"));
        assert_eq!("12", eval_to_string(g, "SUM({\"\", \"abc\", 12})"));
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
    fn test_formula_abs() {
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
    fn test_formula_sqrt() {
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
    fn test_formula_pi() {
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
    fn test_formula_tau() {
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
