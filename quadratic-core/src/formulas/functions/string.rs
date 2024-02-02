use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "String functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![formula_fn!(
        /// [Concatenates](https://en.wikipedia.org/wiki/Concatenation) all
        /// values as strings.
        #[examples("CONCAT(\"Hello, \", C0, \"!\")")]
        fn CONCAT(strings: (Iter<String>)) {
            strings.try_fold(String::new(), |a, b| Ok(a + &b?))
        }
    )]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_concat() {
        let g = Grid::new();
        assert_eq!(
            "Hello, 14000605 worlds!".to_string(),
            eval_to_string(&g, "'Hello, ' & 14000605 & ' worlds!'"),
        );
    }
}
