use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Logic functions",
    docs: "These functions treat `FALSE` and `0` as \
           \"falsey\" and all other values are \"truthy.\"\
           \n\n\
           When used as a number, `TRUE` is equivalent \
           to `1` and `FALSE` is equivalent to `0`.\
           \n\n",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        FormulaFunction {
            name: "TRUE",
            arg_completion: "",
            usages: &[""],
            examples: &["TRUE()"],
            doc: "Returns `TRUE`.",
            eval: util::constant_fn(Value::Bool(true)),
        },
        FormulaFunction {
            name: "FALSE",
            arg_completion: "",
            usages: &[""],
            examples: &["FALSE()"],
            doc: "Returns `FALSE`.",
            eval: util::constant_fn(Value::Bool(false)),
        },
        FormulaFunction {
            name: "NOT",
            arg_completion: "${1:a}",
            usages: &["a"],
            examples: &["NOT(A113)"],
            doc: "Returns `TRUE` if `a` is falsey and \
                  `FALSE` if `a` is truthy.",
            eval: util::array_mapped(|[a]| Ok(Value::Bool(!a.to_bool()?))),
        },
        FormulaFunction {
            name: "AND",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["AND(A1:C1)", "AND(A1, B12)"],
            doc: "Returns `TRUE` if all values are truthy \
                  and `FALSE` if any values is falsey.\n\\
                  Returns `TRUE` if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Bool(
                    util::flat_iter_bools(&args.inner).fold(true, |a, b| a & b),
                ))
            }),
        },
        FormulaFunction {
            name: "OR",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["OR(A1:C1)", "OR(A1, B12)"],
            doc: "Returns `TRUE` if any value is truthy \
                  and `FALSE` if any value is falsey.\n\
                  Returns `FALSE` if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Bool(
                    util::flat_iter_bools(&args.inner).fold(true, |a, b| a | b),
                ))
            }),
        },
        FormulaFunction {
            name: "XOR",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["XOR(A1:C1)", "XOR(A1, B12)"],
            doc: "Returns `TRUE` if an odd number of values \
                  are truthy and `FALSE` if an even number \
                  of values are truthy.\n\
                  Returns `FALSE` if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Bool(
                    util::flat_iter_bools(&args.inner).fold(false, |a, b| a ^ b),
                ))
            }),
        },
        FormulaFunction {
            name: "IF",
            arg_completion: "${1:cond}, ${2:t}, ${3:f}",
            usages: &["cond, t, f"],
            examples: &[
                "IF(A2<0, \"A2 is negative\", \"A2 is nonnegative\")",
                "IF(A2<0, \"A2 is negative\", IF(A2>0, \"A2 is positive\", \"A2 is zero\"))",
            ],
            doc: "Returns `t` if `cond` is truthy and `f` if `cond` if falsey.",
            eval: util::array_mapped(|[cond, t, f]| {
                Ok(if cond.to_bool()? { t.inner } else { f.inner })
            }),
        },
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_if() {
        let form = parse_formula("IF(A1=2, 'yep', 'nope')", pos![A0]).unwrap();

        let mut g = FnGrid(|pos| {
            Some(match (pos.x, pos.y) {
                (0, 1) => "2".to_string(),
                (1, 1) => "16".to_string(),
                _ => panic!("cell {pos} shouldn't be accessed"),
            })
        });

        assert_eq!(
            "yep".to_string(),
            form.eval_blocking(&mut g, pos![A0]).unwrap().to_string(),
        );
        assert_eq!(
            "nope".to_string(),
            form.eval_blocking(&mut g, pos![B0]).unwrap().to_string(),
        );
    }
}
