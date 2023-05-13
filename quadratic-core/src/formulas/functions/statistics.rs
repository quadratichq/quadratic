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
            doc: "Returns the arithmetic mean of all values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::sum(&args.inner)? / util::count(&args.inner) as f64,
                ))
            }),
        },
        FormulaFunction {
            name: "COUNT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            doc: "Returns the number of nonempty values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::count(&args.inner) as f64))),
        },
        FormulaFunction {
            name: "MIN",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            doc: "Returns the smallest value.\nReturns +∞ if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::flat_iter_numbers(&args.inner).try_fold(f64::INFINITY, |ret, next| {
                        FormulaResult::Ok(f64::min(ret, next?))
                    })?,
                ))
            }),
        },
        FormulaFunction {
            name: "MAX",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            doc: "Returns the largest value.\nReturns -∞ if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::flat_iter_numbers(&args.inner)
                        .try_fold(-f64::INFINITY, |ret, next| {
                            FormulaResult::Ok(f64::max(ret, next?))
                        })?,
                ))
            }),
        },
    ]
}
