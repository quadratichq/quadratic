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
