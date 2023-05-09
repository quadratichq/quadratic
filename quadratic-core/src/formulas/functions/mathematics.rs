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
            doc: "Adds all values.\nReturns `0` if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::sum(&args.inner)?))),
        },
        FormulaFunction {
            name: "PRODUCT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            doc: "Multiplies all values.\nReturns 1 if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::product(&args.inner)?))),
        },
    ]
}
