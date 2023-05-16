use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "String functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![FormulaFunction {
        name: "CONCAT",
        arg_completion: "${1:a, b, ...}",
        usages: &["a, b, ..."],
        examples: &["CONCAT(\"Hello, \", C0, \"!\")"],
        doc: "[Concatenates](https://en.wikipedia.org/wiki/Concatenation) all values as strings.",
        eval: util::pure_fn(|args| {
            Ok(Value::String(
                util::flat_iter_strings(&args.inner)
                    .try_fold(String::new(), |ret, next| FormulaResult::Ok(ret + &next?))?,
            ))
        }),
    }]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_concat() {
        assert_eq!(
            "Hello, 14000605 worlds!".to_string(),
            eval_to_string(&mut NoGrid, "'Hello, ' & 14000605 & ' worlds!'"),
        );
    }
}
