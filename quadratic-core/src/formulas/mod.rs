pub mod ast;
mod cell_ref;
mod criteria;
mod ctx;
#[allow(clippy::vec_init_then_push)]
pub mod functions;
mod lexer;
pub mod lsp;
mod params;
mod parser;
pub mod util;
mod wildcards;

#[cfg(test)]
pub mod tests;

use ast::AstNode;
pub use ast::Formula;
pub use cell_ref::*;
pub use criteria::Criterion;
pub use ctx::Ctx;
use functions::FormulaFnArgs;
use params::{Param, ParamKind};
pub use parser::{
    find_cell_references, parse_and_check_formula, parse_formula, replace_a1_notation,
    replace_cell_references_with, replace_internal_cell_references,
};
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

/// Parses a sheet name from a string, returning the sheet name and the rest of the string
pub fn parse_sheet_name(s: &str) -> (Option<String>, String) {
    let mut remaining = s;

    let sheet = s.rsplit_once('!').and_then(|(sheet_name, rest)| {
        // TODO: merge with `SheetCellRefRange` parsing code, and test with
        // sheet name containing `!` or other funny characters

        remaining = rest;

        if sheet_name.starts_with(['\'', '"']) {
            parse_string_literal(sheet_name.trim())
        } else {
            Some(sheet_name.trim().into())
        }
    });

    (sheet, remaining.into())
}
