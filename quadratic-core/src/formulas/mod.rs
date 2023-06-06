use crate::Pos;
use ast::AstNode;

#[macro_use]
mod errors;
mod ast;
mod cell_ref;
mod ctx;
pub mod ext;
pub mod functions;
mod grid_proxy;
mod lexer;
pub mod lsp;
mod params;
mod parser;
mod span;
mod values;

pub use ast::Formula;
pub use cell_ref::*;
pub use ctx::Ctx;
pub use errors::{FormulaError, FormulaErrorMsg};
pub use ext::*;
use functions::FormulaFnArgs;
pub use grid_proxy::GridProxy;
use params::{Param, ParamKind};
pub use parser::{find_cell_references, parse_formula};
pub use span::{Span, Spanned};
pub use values::{Array, BasicValue, CoerceInto, Value};

/// Result of a `FormulaError`.
pub type FormulaResult<T = Spanned<Value>> = Result<T, FormulaError>;

#[cfg(test)]
mod tests;
