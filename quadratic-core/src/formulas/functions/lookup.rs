use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Lookup functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![FormulaFunction {
        name: "INDIRECT",
        arg_completion: "${1:cellref_string}",
        usages: &["cellref_string"],
        examples: &["INDIRECT(\"Cn7\")", "INDIRECT(\"F\" & B0)"],
        doc: "Returns the value of the cell at a given location.",
        eval: Box::new(|ctx, args| ctx.array_mapped_indirect(args).boxed_local()),
    }]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_indirect() {
        let form = parse_formula("INDIRECT(\"D5\")", pos![B2]).unwrap();

        let mut g = FnGrid(|pos| Some((pos.x * 10 + pos.y).to_string()));

        assert_eq!(
            FormulaErrorMsg::CircularReference,
            form.eval_blocking(&mut g, pos![D5]).unwrap_err().msg,
        );

        assert_eq!(
            (3 * 10 + 5).to_string(),
            eval_to_string(&mut g, "INDIRECT(\"D5\")"),
        );
    }
}
