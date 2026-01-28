//! Fully iterative Pratt parser implementation.
//!
//! This module contains the main parsing loop that uses an explicit stack
//! instead of recursion to parse expressions. This guarantees O(1) Rust
//! stack usage regardless of formula complexity.

use super::binding_power::{
    LAMBDA_INVOKE_BP, infix_binding_power, postfix_binding_power, prefix_binding_power,
};
use super::stack_frame::{StackFrame, ValueSlot};
use crate::formulas::ast::{AstNode, AstNodeContents};
use crate::formulas::lexer::Token;
use crate::formulas::parser::Parser;
use crate::formulas::parser::rules::{
    ArrayLiteral, BoolExpression, CellReferenceExpression, ErrorExpression, FunctionCall, List,
    NumericLiteral, SheetTableReference, StringLiteral, SyntaxRule, TupleExpression,
};
use crate::{CodeResult, Span, Spanned};

/// Parse an expression using a fully iterative algorithm.
///
/// This function uses an explicit stack instead of recursion, making it
/// impossible to overflow the Rust call stack regardless of nesting depth.
///
/// # Arguments
///
/// * `p` - The parser state
/// * `min_bp` - The minimum binding power (0 for top-level expressions)
///
/// # Returns
///
/// The parsed AST node, or an error if parsing fails.
pub fn parse_expression_iterative(p: &mut Parser<'_>, min_bp: u8) -> CodeResult<AstNode> {
    let mut stack: Vec<StackFrame> = Vec::with_capacity(64);
    let mut value_slot = ValueSlot::new();

    // Start by pushing the initial expression frame
    stack.push(StackFrame::ParseExpr { min_bp });

    while let Some(frame) = stack.pop() {
        match frame {
            StackFrame::ParseExpr { min_bp } => {
                // Check for prefix operators first
                if let Some(tok) = p.peek_next() {
                    if let Some(right_bp) = prefix_binding_power(tok) {
                        // Consume the prefix operator
                        p.next();
                        let op = Spanned {
                            span: p.span(),
                            inner: p.token_str().to_string(),
                        };

                        // Push frame to handle after we get the operand
                        // outer_min_bp preserves context for checking operators after prefix
                        stack.push(StackFrame::AfterPrefix {
                            op,
                            outer_min_bp: min_bp,
                        });
                        // Push frame to parse the operand with prefix's binding power
                        stack.push(StackFrame::ParseExpr { min_bp: right_bp });
                        continue;
                    }

                    // Check for opening parenthesis - handle iteratively
                    if tok == Token::LParen {
                        p.next(); // consume '('
                        let start_span = p.span();

                        // Push frame to handle closing paren
                        // outer_min_bp preserves the context so operators after paren
                        // respect the precedence of the surrounding expression
                        stack.push(StackFrame::AfterParen {
                            start_span,
                            outer_min_bp: min_bp,
                        });
                        // Push frame to parse inner expression (min_bp=0 inside parens)
                        stack.push(StackFrame::ParseExpr { min_bp: 0 });
                        continue;
                    }
                }

                // No prefix operator or paren, parse an atom
                let atom = parse_atom(p)?;
                // Push frame to handle infix/postfix after atom
                stack.push(StackFrame::AfterLhs { lhs: atom, min_bp });
            }

            StackFrame::AfterPrefix { op, outer_min_bp } => {
                // We finished parsing the operand for a prefix operator
                let operand = value_slot.take()?;
                let result = AstNode {
                    span: Span::merge(op.span, operand.span),
                    inner: AstNodeContents::FunctionCall {
                        func: op,
                        args: vec![operand],
                    },
                };
                // Push AfterLhs to continue checking for operators after prefix expr
                // Use outer_min_bp to respect precedence of surrounding expression
                // This handles cases like `-1 < C6` where < should be consumed
                stack.push(StackFrame::AfterLhs {
                    lhs: result,
                    min_bp: outer_min_bp,
                });
            }

            StackFrame::AfterParen {
                start_span,
                outer_min_bp,
            } => {
                // We finished parsing the inner expression, now consume ')'
                let inner_expr = value_slot.take()?;
                p.parse(Token::RParen)?;
                let end_span = p.span();

                let result = AstNode {
                    span: Span::merge(start_span, end_span),
                    inner: AstNodeContents::Paren(vec![inner_expr]),
                };
                // Push AfterLhs to continue checking for operators after this paren
                // Use outer_min_bp to respect precedence of surrounding expression
                // This handles cases like `a * (b) + c` where + should NOT be consumed
                // if we're in the RHS of * which has higher precedence
                stack.push(StackFrame::AfterLhs {
                    lhs: result,
                    min_bp: outer_min_bp,
                });
            }

            StackFrame::AfterLhs { lhs, min_bp } => {
                // After parsing LHS, check for postfix and infix operators
                if let Some(tok) = p.peek_next() {
                    // Try postfix % operator first (highest precedence)
                    if let Some(left_bp) = postfix_binding_power(tok)
                        && left_bp >= min_bp
                    {
                        p.next();
                        let op = Spanned {
                            span: p.span(),
                            inner: p.token_str().to_string(),
                        };
                        let result = AstNode {
                            span: Span::merge(lhs.span, op.span),
                            inner: AstNodeContents::FunctionCall {
                                func: op,
                                args: vec![lhs],
                            },
                        };
                        // Continue checking for more operators
                        stack.push(StackFrame::AfterLhs {
                            lhs: result,
                            min_bp,
                        });
                        continue;
                    }

                    // Try lambda invoke: expression followed by (args)
                    if tok == Token::LParen && LAMBDA_INVOKE_BP >= min_bp {
                        let call_args = p.parse(List {
                            inner: TupleExpression,
                            sep: Token::ArgSep,
                            start: Token::LParen,
                            end: Token::RParen,
                            sep_name: "comma",
                            allow_trailing_sep: false,
                            allow_empty: true,
                        })?;

                        let mut args = vec![lhs];
                        args.extend(call_args.inner);

                        let result = AstNode {
                            span: Span::merge(args[0].span, call_args.span),
                            inner: AstNodeContents::FunctionCall {
                                func: Spanned {
                                    span: call_args.span,
                                    inner: "__LAMBDA_INVOKE__".to_string(),
                                },
                                args,
                            },
                        };
                        // Continue checking for more operators
                        stack.push(StackFrame::AfterLhs {
                            lhs: result,
                            min_bp,
                        });
                        continue;
                    }

                    // Try infix (binary) operators
                    if let Some((left_bp, right_bp)) = infix_binding_power(tok)
                        && left_bp >= min_bp
                    {
                        p.next();
                        let op = Spanned {
                            span: p.span(),
                            inner: p.token_str().to_string(),
                        };

                        // Push frame to build binary node after RHS is parsed
                        stack.push(StackFrame::AfterRhs { lhs, op, min_bp });
                        // Push frame to parse the RHS
                        stack.push(StackFrame::ParseExpr { min_bp: right_bp });
                        continue;
                    }
                }

                // No more operators at this level, we're done with this expression
                value_slot.set(lhs);
            }

            StackFrame::AfterRhs { lhs, op, min_bp } => {
                // Build the binary operator node
                let rhs = value_slot.take()?;
                let result = AstNode {
                    span: Span::merge(lhs.span, rhs.span),
                    inner: AstNodeContents::FunctionCall {
                        func: op,
                        args: vec![lhs, rhs],
                    },
                };
                // Continue checking for more operators at the same level
                stack.push(StackFrame::AfterLhs {
                    lhs: result,
                    min_bp,
                });
            }
        }
    }

    // The final value should be in the slot
    value_slot.take()
}

/// Parse an atomic expression (the smallest unit of an expression).
///
/// This handles:
/// - Function calls: `SUM(...)`
/// - Cell references: `A1`, `$B$2`
/// - Table references: `Table1[Column]`
/// - String literals: `"hello"`
/// - Numeric literals: `123`, `3.14`
/// - Array literals: `{1, 2; 3, 4}`
/// - Boolean: `TRUE`, `FALSE`
/// - Error values: `#REF!`
///
/// Note: Parenthesized expressions are handled in the main loop, not here.
fn parse_atom(p: &mut Parser<'_>) -> CodeResult<AstNode> {
    // Try each atom type in order of likelihood/specificity

    // Function call: NAME(
    if FunctionCall.prefix_matches(*p) {
        return p.parse(FunctionCall);
    }

    // Cell reference
    if CellReferenceExpression.prefix_matches(*p) {
        return p.parse(CellReferenceExpression);
    }

    // Table reference
    if SheetTableReference.prefix_matches(*p) {
        let table_ref = p.parse(SheetTableReference)?;
        return Ok(table_ref.map(AstNodeContents::RangeRef));
    }

    // String literal
    if StringLiteral.prefix_matches(*p) {
        let inner = AstNodeContents::String(p.parse(StringLiteral)?);
        let span = p.span();
        return Ok(Spanned { span, inner });
    }

    // Numeric literal
    if NumericLiteral.prefix_matches(*p) {
        return p.parse(NumericLiteral);
    }

    // Array literal: { ... }
    if ArrayLiteral.prefix_matches(*p) {
        return p.parse(ArrayLiteral);
    }

    // Boolean
    if BoolExpression.prefix_matches(*p) {
        return p.parse(BoolExpression);
    }

    // Error value
    if ErrorExpression.prefix_matches(*p) {
        return p.parse(ErrorExpression);
    }

    // Nothing matched
    p.expected("expression")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::a1::A1Context;
    use crate::controller::GridController;
    use crate::formulas::lexer;
    use itertools::Itertools;

    fn test_parse(source: &str) -> CodeResult<AstNode> {
        let tokens = lexer::tokenize(source)
            .filter(|t| !t.inner.is_skip())
            .collect_vec();
        let ctx = A1Context::test(&[], &[]);
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let mut p = Parser::new(source, &tokens, &ctx, pos);
        parse_expression_iterative(&mut p, 0)
    }

    #[test]
    fn test_simple_number() {
        let result = test_parse("42");
        assert!(result.is_ok());
    }

    #[test]
    fn test_binary_op() {
        let result = test_parse("1 + 2");
        assert!(result.is_ok());
    }

    #[test]
    fn test_nested_parens() {
        let result = test_parse("((((1 + 2))))");
        assert!(result.is_ok());
    }

    #[test]
    fn test_prefix_minus() {
        let result = test_parse("-5");
        assert!(result.is_ok());
    }

    #[test]
    fn test_postfix_percent() {
        let result = test_parse("50%");
        assert!(result.is_ok());
    }

    #[test]
    fn test_complex_expression() {
        let result = test_parse("1 + 2 * 3 - 4 / 5");
        assert!(result.is_ok());
    }

    #[test]
    fn test_deep_nesting_no_stack_overflow() {
        // This would cause stack overflow with recursive parsing
        // but should work fine with iterative parsing
        let depth = 500;
        let formula = format!("{}1{}", "(".repeat(depth), ")".repeat(depth));
        let result = test_parse(&formula);
        assert!(
            result.is_ok(),
            "Deep nesting should not cause stack overflow"
        );
    }
}
