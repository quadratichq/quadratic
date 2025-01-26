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
            let query_value = if query.is_empty() {
                CellValue::Blank
            } else {
                CellValue::Text(query)
            };
            Value::Tuple(vec![query_value.into(), ref_cell])
        }
    )]
}
