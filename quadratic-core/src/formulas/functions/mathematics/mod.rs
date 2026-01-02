//! Mathematics functions for formulas.

mod basic;
mod combinatorics;
mod rounding;

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Mathematics functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    [
        basic::get_functions(),
        rounding::get_functions(),
        combinatorics::get_functions(),
    ]
    .into_iter()
    .flatten()
    .collect()
}
