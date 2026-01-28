//! Stack frame types for the iterative Pratt parser.
//!
//! These types represent the different states the parser can be in during
//! iterative expression parsing. Instead of using function call recursion,
//! we push these frames onto an explicit stack.

use crate::formulas::ast::AstNode;
use crate::{CodeResult, RunErrorMsg, Span, Spanned};

/// A stack frame representing the current parsing state.
///
/// Each frame type corresponds to a specific point in the parsing process:
/// - We enter `ParseExpr` when we need to parse a new (sub-)expression
/// - We push `AfterLhs` after parsing the left-hand side of a binary operation
/// - We push `AfterRhs` after parsing the right-hand side
/// - We push `AfterPrefix` after parsing a prefix operator's operand
/// - We push `AfterParen` after parsing a parenthesized expression
#[derive(Debug)]
pub enum StackFrame {
    /// Start parsing an expression with minimum binding power.
    /// This is the "entry point" for any expression or sub-expression.
    ParseExpr {
        /// Minimum binding power required for operators
        min_bp: u8,
    },

    /// After parsing a prefix operator, waiting for the operand result.
    AfterPrefix {
        /// The operator token string and span
        op: Spanned<String>,
        /// The minimum binding power from the outer expression context.
        outer_min_bp: u8,
    },

    /// After parsing the LHS of a binary expression, check for infix operators.
    /// If we find one, we'll parse the RHS and then transition to AfterRhs.
    AfterLhs {
        /// The left-hand side expression we already parsed
        lhs: AstNode,
        /// Minimum binding power for this expression level
        min_bp: u8,
    },

    /// After parsing both LHS and RHS, build the binary operator node.
    AfterRhs {
        /// The left-hand side expression
        lhs: AstNode,
        /// The operator
        op: Spanned<String>,
        /// Minimum binding power (for the loop continuation)
        min_bp: u8,
    },

    /// After parsing the inner expression of a parenthesized expression.
    /// We need to consume the closing paren and wrap in Paren node.
    AfterParen {
        /// The span of the opening paren
        start_span: Span,
        /// The minimum binding power from the outer expression context.
        /// This is used when continuing to check for operators after the paren.
        outer_min_bp: u8,
    },
}

/// State for tracking the result value as we unwind the stack.
#[derive(Debug, Default)]
pub struct ValueSlot {
    value: Option<AstNode>,
}

impl ValueSlot {
    /// Creates a new empty value slot.
    pub fn new() -> Self {
        Self { value: None }
    }

    /// Stores a value in the slot.
    pub fn set(&mut self, value: AstNode) {
        debug_assert!(self.value.is_none(), "ValueSlot already contains a value");
        self.value = Some(value);
    }

    /// Takes the value from the slot, returning an error if empty.
    pub fn take(&mut self) -> CodeResult<AstNode> {
        self.value.take().ok_or_else(|| {
            RunErrorMsg::InternalError("Parser state error: ValueSlot was empty".into())
                .without_span()
        })
    }
}
