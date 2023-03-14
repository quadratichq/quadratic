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
        name: "CELL",
        arg_completion: "${1:x}, ${2:y}",
        usages: &["x, y"],
        doc: "todo!()",
        eval: Box::new(|ctx, args| ctx.array_mapped_get_cell(args).boxed_local()),
    }]
}
