use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: false,
    include_in_completions: false,
    name: "Operators",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        // Comparison operators
        FormulaFunction::operator("=", |[a, b]| Ok(Value::Bool(values_eq(&a, &b)))),
        FormulaFunction::operator("==", |[a, b]| Ok(Value::Bool(values_eq(&a, &b)))),
        FormulaFunction::operator("<>", |[a, b]| Ok(Value::Bool(!values_eq(&a, &b)))),
        FormulaFunction::operator("!=", |[a, b]| Ok(Value::Bool(!values_eq(&a, &b)))),
        FormulaFunction::operator("<", |[a, b]| {
            Ok(Value::Bool(a.to_number()? < b.to_number()?))
        }),
        FormulaFunction::operator(">", |[a, b]| {
            Ok(Value::Bool(a.to_number()? > b.to_number()?))
        }),
        FormulaFunction::operator("<=", |[a, b]| {
            Ok(Value::Bool(a.to_number()? <= b.to_number()?))
        }),
        FormulaFunction::operator(">=", |[a, b]| {
            Ok(Value::Bool(a.to_number()? >= b.to_number()?))
        }),
        // Mathematical operators
        FormulaFunction::variadic_operator(
            "+",
            Some(|_ctx, [a]| Ok(Value::Number(a.to_number()?))),
            Some(|_ctx, [a, b]| Ok(Value::Number(a.to_number()? + b.to_number()?))),
        ),
        FormulaFunction::variadic_operator(
            "-",
            Some(|_ctx, [a]| Ok(Value::Number(-a.to_number()?))),
            Some(|_ctx, [a, b]| Ok(Value::Number(a.to_number()? - b.to_number()?))),
        ),
        FormulaFunction::operator("*", |[a, b]| {
            Ok(Value::Number(a.to_number()? * b.to_number()?))
        }),
        FormulaFunction::operator("/", |[a, b]| {
            Ok(Value::Number(a.to_number()? / b.to_number()?))
        }),
        FormulaFunction::operator("^", |[a, b]| {
            Ok(Value::Number(a.to_number()?.powf(b.to_number()?)))
        }),
        FormulaFunction::operator("**", |[a, b]| {
            Ok(Value::Number(a.to_number()?.powf(b.to_number()?)))
        }),
        FormulaFunction::operator("%", |[n]| Ok(Value::Number(n.to_number()? / 100.0))),
        // String operators
        FormulaFunction::operator("&", |[a, b]| {
            Ok(Value::String(a.to_string() + &b.to_string()))
        }),
    ]
}

fn values_eq(a: &Spanned<Value>, b: &Spanned<Value>) -> bool {
    a.to_string().eq_ignore_ascii_case(&b.to_string())
}
