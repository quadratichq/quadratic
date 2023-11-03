#[cfg(test)]
#[macro_use]
mod tests;

mod ast;
mod cell_ref;
mod criteria;
mod ctx;
#[allow(clippy::vec_init_then_push)]
pub mod functions;
mod lexer;
pub mod lsp;
mod params;
mod parser;
mod wildcards;

use ast::AstNode;
pub use ast::Formula;
pub use cell_ref::*;
pub use criteria::Criterion;
pub use ctx::Ctx;
use functions::FormulaFnArgs;
use params::{Param, ParamKind};
pub use parser::{find_cell_references, parse_formula};
use wildcards::wildcard_pattern_to_regex;

/// Escapes a formula string.
pub fn escape_string(s: &str) -> String {
    // TODO: update with https://github.com/quadratichq/quadratic/issues/511
    format!("{s:?}")
}
/// Parses and unescapes a formula string, returning `None` if the string
/// literal is malformed.
pub fn parse_string_literal(s: &str) -> Option<String> {
    let mut string_contents = String::new();
    let mut chars = s.chars().peekable();
    let quote = chars.next()?;
    // Read characters.
    loop {
        match chars.next()? {
            '\\' => string_contents.push(chars.next()?),
            c if c == quote => break,
            c => string_contents.push(c),
        }
    }

    if chars.next().is_none() {
        // End of token, as expected.
        Some(string_contents)
    } else {
        // Why is there more after the closing quote?
        None
    }
}
