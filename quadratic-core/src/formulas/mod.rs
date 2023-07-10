use crate::Pos;

#[macro_use]
mod errors;

#[cfg(test)]
#[macro_use]
mod tests;

mod array_size;
mod ast;
mod cell_ref;
mod criteria;
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
mod wildcards;

pub use array_size::*;
use ast::AstNode;
pub use ast::Formula;
pub use cell_ref::*;
pub use criteria::Criterion;
pub use ctx::Ctx;
pub use errors::{FormulaError, FormulaErrorMsg};
pub use ext::*;
use functions::FormulaFnArgs;
pub use grid_proxy::GridProxy;
use params::{Param, ParamKind};
pub use parser::{find_cell_references, parse_formula};
pub use span::{Span, Spanned};
pub use values::{Array, BasicValue, CoerceInto, IsBlank, Value};
use wildcards::wildcard_pattern_to_regex;

/// Result of a `FormulaError`.
pub type FormulaResult<T = Spanned<Value>> = Result<T, FormulaError>;
