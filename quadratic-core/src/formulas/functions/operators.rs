use smallvec::smallvec;

use super::*;

/// Maximum integer range allowed.
const INTEGER_RANGE_LIMIT: f64 = 100_000.0;

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
        FormulaFunction::operator("%", |[n]| Ok(Value::Number(n.to_number()? / 100.0))),
        FormulaFunction::operator("..", |[a, b]| {
            let span = Span::merge(&a, &b);
            let a = a.to_integer()?;
            let b = b.to_integer()?;
            if (a as f64 - b as f64).abs() > INTEGER_RANGE_LIMIT {
                return Err(FormulaErrorMsg::ArrayTooBig.with_span(span));
            }
            Ok(Value::Array(
                if a < b { a..=b } else { b..=a }
                    .map(|i| smallvec![Value::Number(i as f64)])
                    .collect(),
            ))
        }),
        // String operators
        FormulaFunction::operator("&", |[a, b]| {
            Ok(Value::String(a.to_string() + &b.to_string()))
        }),
    ]
}

fn values_eq(a: &Spanned<Value>, b: &Spanned<Value>) -> bool {
    a.to_string().eq_ignore_ascii_case(&b.to_string())
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_math_operators() {
        assert_eq!(
            (1 * -6 + -2 - 1 * (-3_i32).pow(2_u32.pow(3))).to_string(),
            eval_to_string(&mut NoGrid, "1 * -6 + -2 - 1 * -3 ^ 2 ^ 3"),
        );
    }
}
