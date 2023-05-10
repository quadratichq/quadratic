use crate::Pos;
use ast::AstNode;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

#[macro_use]
mod errors;
mod ast;
mod cell_ref;
mod ctx;
mod functions;
mod grid_proxy;
mod lexer;
mod parser;
mod span;
mod value;

pub use ast::Formula;
pub use cell_ref::*;
pub use ctx::Ctx;
pub use errors::{FormulaError, FormulaErrorMsg};
pub use grid_proxy::GridProxy;
pub use parser::{find_cell_references, parse_formula, parse_formula_a1};
pub use span::{Span, Spanned};
pub use value::Value;

/// Result of a `FormulaError`.
pub type FormulaResult<T = Value> = Result<T, FormulaError>;

/// Formula parser configuration.
#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub struct ParseConfig {
    pub pos: Pos,
    pub cell_ref_notation: CellRefNotation,
}
#[wasm_bindgen]
impl ParseConfig {
    #[wasm_bindgen(constructor)]
    pub fn new(pos: Pos, cell_ref_notation: CellRefNotation) -> Self {
        Self {
            pos,
            cell_ref_notation,
        }
    }
}
impl ParseConfig {
    fn is_a1(self) -> bool {
        self.cell_ref_notation == CellRefNotation::A1
    }
    fn is_rc(self) -> bool {
        self.cell_ref_notation == CellRefNotation::RC
    }
}

/// Cell reference notation mode.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[wasm_bindgen]
pub enum CellRefNotation {
    /// A1-style cell references. e.g., `$Bn6`
    #[default]
    A1,
    /// RC-style cell references. e.g., `R[-6]C2`
    RC,
}

/// Converts A1 cell references to RC notation, which can be copied to other
/// cells. Invalid references and syntax errors remain unchanged.
pub fn a1_to_rc(formula_string: &str, pos: Pos) -> String {
    let cfg = ParseConfig {
        pos,
        cell_ref_notation: CellRefNotation::A1,
    };
    let mut ret = String::new();

    for token in lexer::tokenize(formula_string, cfg) {
        let token_str = token.span.of_str(formula_string);
        if token.inner == lexer::Token::CellRefA1 {
            if let Some(cell_ref) = CellRef::parse_a1(token_str, pos) {
                ret.push_str(&cell_ref.rc_string());
                continue;
            }
        }
        ret.push_str(token_str);
    }

    ret
}

/// Converts RC cell references to A1 notation.
pub fn rc_to_a1(formula_string: &str, pos: Pos) -> String {
    let cfg = ParseConfig {
        pos,
        cell_ref_notation: CellRefNotation::RC,
    };
    let mut ret = String::new();

    for token in lexer::tokenize(formula_string, cfg) {
        let token_str = token.span.of_str(formula_string);
        if token.inner == lexer::Token::CellRefRC {
            if let Some(cell_ref) = CellRef::parse_rc(token_str) {
                ret.push_str(&cell_ref.a1_string(pos));
                continue;
            }
        }
        ret.push_str(token_str);
    }

    ret
}

#[cfg(test)]
mod tests;
