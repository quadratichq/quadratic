use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "AI Researcher",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![formula_fn!(
        /// Ask the AI Researcher to answer a question based on a reference cell.
        ///
        /// The AI Researcher will use the data from the reference cell to answer the question.
        #[examples(
            "AI(\"What is the population?\", \"A1\")",
            "AI(\"What is the last year's GDP?\", \"A1\")"
        )]
        fn AI(query: String, ref_cell: Array) {
            Value::Tuple(vec![CellValue::Text(query).into(), ref_cell])
        }
    )]
}
