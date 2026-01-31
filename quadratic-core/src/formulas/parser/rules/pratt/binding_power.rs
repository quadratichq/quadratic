//! Binding power (precedence) definitions for operators.
//!
//! Pratt parsing uses "binding power" to handle precedence. Each operator has
//! a left and right binding power. Higher values bind tighter.
//!
//! For left-associative operators: left_bp < right_bp
//! For right-associative operators: left_bp > right_bp

use crate::formulas::lexer::Token;

/// The binding power for lambda invocation (expr followed by parentheses).
/// This is a postfix operator with very high precedence.
pub const LAMBDA_INVOKE_BP: u8 = 90;

/// Returns the infix (binary) binding power for a token.
/// Returns `Some((left_bp, right_bp))` for binary operators, `None` otherwise.
#[inline]
pub fn infix_binding_power(token: Token) -> Option<(u8, u8)> {
    use Token::*;
    Some(match token {
        // Comparison operators (lowest precedence)
        Eql | Neq | Lt | Gt | Lte | Gte => (10, 11),

        // Concatenation
        Concat => (20, 21),

        // Addition and subtraction
        Plus | Minus => (30, 31),

        // Multiplication and division
        Mult | Div => (40, 41),

        // Exponentiation (right-associative: left > right)
        Power => (51, 50),

        // Numeric range (..)
        RangeOp => (60, 61),

        // Cell range (:)
        CellRangeOp => (70, 71),

        _ => return None,
    })
}

/// Returns the prefix (unary) binding power for a token.
/// Returns `Some(right_bp)` for prefix operators, `None` otherwise.
#[inline]
pub fn prefix_binding_power(token: Token) -> Option<u8> {
    use Token::*;
    Some(match token {
        // Unary plus and minus
        Plus | Minus => 80,
        _ => return None,
    })
}

/// Returns the postfix (suffix) binding power for a token.
/// Returns `Some(left_bp)` for postfix operators, `None` otherwise.
#[inline]
pub fn postfix_binding_power(token: Token) -> Option<u8> {
    use Token::*;
    Some(match token {
        // Percent operator
        Percent => 90,
        _ => return None,
    })
}
