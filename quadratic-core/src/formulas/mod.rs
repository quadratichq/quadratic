use crate::Pos;
use ast::AstNode;
use lexer::Token;

#[macro_use]
mod errors;
mod ast;
mod cell_ref;
mod functions;
mod grid_proxy;
mod lexer;
mod parser;
mod span;
mod value;

pub use ast::Formula;
pub use cell_ref::*;
pub use errors::{FormulaError, FormulaErrorMsg};
pub use grid_proxy::GridProxy;
pub use parser::parse_formula;
pub use span::{Span, Spanned};
pub use value::Value;

/// Result of a `FormulaError`.
pub type FormulaResult<T = Spanned<Value>> = Result<T, FormulaError>;

#[cfg(test)]
mod tests;
