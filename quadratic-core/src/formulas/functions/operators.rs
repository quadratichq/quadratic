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
        formula_fn!(#[operator] #[pure_zip_map] fn "="([a]: BasicValue, [b]: BasicValue) { a.eq(b)? }),
        formula_fn!(#[operator] #[pure_zip_map] fn "=="([a]: BasicValue, [b]: BasicValue) { a.eq(b)? }),
        formula_fn!(#[operator] #[pure_zip_map] fn "<>"([a]: BasicValue, [b]: BasicValue) { !a.eq(b)? }),
        formula_fn!(#[operator] #[pure_zip_map] fn "!="([a]: BasicValue, [b]: BasicValue) { !a.eq(b)? }),
        formula_fn!(#[operator] #[pure_zip_map] fn "<"([a]: BasicValue, [b]: BasicValue) { a.lt(b)? }),
        formula_fn!(#[operator] #[pure_zip_map] fn ">"([a]: BasicValue, [b]: BasicValue) { a.gt(b)? }),
        formula_fn!(#[operator] #[pure_zip_map] fn "<="([a]: BasicValue, [b]: BasicValue) { a.lte(b)? }),
        formula_fn!(#[operator] #[pure_zip_map] fn ">="([a]: BasicValue, [b]: BasicValue) { a.gte(b)? }),
        // Mathematical operators
        formula_fn!(
            #[operator]
            #[pure_zip_map]
            fn "+"([a]: f64, [b]: (Option<f64>)) {
                a + b.unwrap_or(0.0)
            }
        ),
        formula_fn!(
            #[operator]
            #[pure_zip_map]
            fn "-"([a]: f64, [b]: (Option<f64>)) {
                match b {
                    Some(b) => a - b,
                    None => -a
                }
            }
        ),
        formula_fn!(
            #[operator]
            #[pure_zip_map]
            fn "*"([a]: f64, [b]: f64) {
                a * b
            }
        ),
        formula_fn!(
            #[operator]
            #[pure_zip_map]
            fn "/"(span: Span, [dividend]: f64, [divisor]: f64) {
                util::checked_div(span, dividend, divisor)
            }
        ),
        formula_fn!(
            #[operator]
            #[pure_zip_map]
            fn "^"([base]: f64, [exponent]: f64) {
                base.powf(exponent)
            }
        ),
        formula_fn!(
            #[operator]
            #[pure_zip_map]
            fn "%"([percentage]: f64) {
                percentage / 100.0
            }
        ),
        formula_fn!(
            #[operator]
            fn ".."(start: (Spanned<i64>), end: (Spanned<i64>)) {
                let span = Span::merge(start.span, end.span);
                let a = start.inner;
                let b = end.inner;
                let len = (a-b).abs() as u32 + 1;
                if len as f64 > crate::limits::INTEGER_RANGE_LIMIT {
                    return Err(FormulaErrorMsg::ArrayTooBig.with_span(span));
                }
                let range = if a < b { a..=b } else { b..=a };
                let width = 1;
                let height = len;
                Array::new_row_major(width, height, range.map(BasicValue::from).collect())?
            }
        ),
        // String operators
        formula_fn!(
            #[operator]
            #[pure_zip_map]
            fn "&"([a]: String, [b]: String) {
                a + &b
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_math_operators() {
        let g = &mut NoGrid;

        assert_eq!(
            (1 * -6 + -2 - 1 * (-3_i32).pow(2_u32.pow(3))).to_string(),
            eval_to_string(g, "1 * -6 + -2 - 1 * -3 ^ 2 ^ 3"),
        );
        assert_eq!((1.0 / 2.0).to_string(), eval_to_string(g, "1/2"));
        assert_eq!(FormulaErrorMsg::DivideByZero, eval_to_err(g, "1 / 0").msg);
        assert_eq!(FormulaErrorMsg::DivideByZero, eval_to_err(g, "0/ 0").msg);
    }

    #[test]
    fn test_formula_math_operators_on_empty_string() {
        // Empty string should coerce to zero

        let g = &mut BlankGrid;

        // Test addition
        assert_eq!("2", eval_to_string(g, "C6 + 2"));
        assert_eq!("2", eval_to_string(g, "2 + C6"));

        // Test multiplication
        assert_eq!("0", eval_to_string(g, "2 * C6"));
        assert_eq!("0", eval_to_string(g, "C6 * 2"));

        // TODO: uncomment this once we have a type system that understands
        // blank cells

        // // Test comparisons (very cursed)
        // assert_eq!("FALSE", eval_to_string(g, "1 < C6"));
        // assert_eq!("FALSE", eval_to_string(g, "0 < C6"));
        // assert_eq!("TRUE", eval_to_string(g, "0 <= C6"));
        // assert_eq!("TRUE", eval_to_string(g, "-1 < C6"));
        // assert_eq!("TRUE", eval_to_string(g, "0 = C6"));
        // assert_eq!("FALSE", eval_to_string(g, "1 = C6"));

        // Test string concatenation
        assert_eq!("apple", eval_to_string(g, "C6 & \"apple\" & D6"));
    }
}
