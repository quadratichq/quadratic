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
