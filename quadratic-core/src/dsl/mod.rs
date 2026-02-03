//! Quadratic DSL Parser
//!
//! A simple text-based language for AI to generate Quadratic spreadsheets.
//! See `.cursor/planning/quadratic-dsl-spec.md` for the full specification.

mod ast;
mod compiler;
mod error;
mod lexer;
mod parser;

pub use ast::*;
pub use compiler::{compile, CompileResult, Compiler};
pub use error::{DslError, DslResult};
pub use parser::parse;

#[cfg(test)]
mod tests;
