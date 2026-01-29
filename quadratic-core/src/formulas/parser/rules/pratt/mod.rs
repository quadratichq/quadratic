//! Fully iterative Pratt parser for expressions.
//!
//! This module implements a Pratt parser (top-down operator precedence parsing)
//! that uses an explicit stack instead of recursion. This completely eliminates
//! stack overflow risk regardless of formula complexity.
//!
//! ## Architecture
//!
//! - `binding_power`: Defines operator precedence via binding power values
//! - `stack_frame`: Defines the stack frame types for tracking parser state
//! - `iterative_parser`: The main iterative parsing algorithm
//!
//! ## How It Works
//!
//! Traditional Pratt parsers use recursion to handle sub-expressions. This
//! implementation replaces recursion with an explicit stack of "frames" that
//! track what the parser is currently doing:
//!
//! 1. **ParseExpr**: Start parsing an expression with a minimum binding power
//! 2. **AfterPrefix**: After parsing a prefix operator, waiting for the operand
//! 3. **AfterLhs**: After parsing the left-hand side, check for infix operators
//! 4. **AfterRhs**: After parsing both sides, build the binary operator node
//! 5. **AfterParen**: After parsing a parenthesized expression
//!
//! This approach guarantees O(1) Rust stack usage regardless of nesting depth.

mod binding_power;
mod iterative_parser;
mod stack_frame;

pub use iterative_parser::parse_expression_iterative;
