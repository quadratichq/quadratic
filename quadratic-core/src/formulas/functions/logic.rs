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
            doc: "Returns `TRUE`.",
            eval: util::constant_fn(Value::Bool(true)),
        },
        FormulaFunction {
            name: "FALSE",
            arg_completion: "",
            usages: &[""],
            doc: "Returns `FALSE`.",
            eval: util::constant_fn(Value::Bool(false)),
        },
        FormulaFunction {
            name: "NOT",
            arg_completion: "${1:a}",
            usages: &["a"],
            doc: "Returns `TRUE` if `a` is falsey and \
                  `FALSE` if `a` is truthy.",
            eval: util::array_mapped(|[a]| Ok(Value::Bool(!a.to_bool()?))),
        },
        FormulaFunction {
            name: "AND",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            doc: "Returns `TRUE` if all values are truthy \
                  and `FALSE` if any values is falsey.\n\\
                  Returns `TRUE` if given no values.",
            eval: util::pure_fn(|args| {
                util::flat_iter_bools(&args.inner)
                    .try_fold(true, |ret, next| FormulaResult::Ok(ret & next?))
                    .map(Value::Bool)
            }),
        },
        FormulaFunction {
            name: "OR",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            doc: "Returns `TRUE` if any value is truthy \
                  and `FALSE` if any value is falsey.\n\
                  Returns `FALSE` if given no values.",
            eval: util::pure_fn(|args| {
                util::flat_iter_bools(&args.inner)
                    .try_fold(false, |ret, next| FormulaResult::Ok(ret | next?))
                    .map(Value::Bool)
            }),
        },
        FormulaFunction {
            name: "XOR",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            doc: "Returns `TRUE` if an odd number of values \
                  are truthy and `FALSE` if an even number \
                  of values are truthy.\n\
                  Returns `FALSE` if given no values.",
            eval: util::pure_fn(|args| {
                util::flat_iter_bools(&args.inner)
                    .try_fold(false, |ret, next| FormulaResult::Ok(ret ^ next?))
                    .map(Value::Bool)
            }),
        },
        FormulaFunction {
            name: "IF",
            arg_completion: "${1:cond}, ${2:t}, ${3:f}",
            usages: &["cond, t, f"],
            doc: "Returns `t` if `cond` is truthy and `f` if `cond` if falsey.",
            eval: util::array_mapped(|[cond, t, f]| {
                Ok(if cond.to_bool()? { t.inner } else { f.inner })
            }),
        },
    ]
}
