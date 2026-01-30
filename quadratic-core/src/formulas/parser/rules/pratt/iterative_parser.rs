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

    /// Returns the function name if the node is a FunctionCall, None otherwise.
    fn get_func_name(node: &AstNode) -> Option<&str> {
        match &node.inner {
            AstNodeContents::FunctionCall { func, .. } => Some(&func.inner),
            _ => None,
        }
    }

    /// Returns the args if the node is a FunctionCall, None otherwise.
    fn get_func_args(node: &AstNode) -> Option<&[AstNode]> {
        match &node.inner {
            AstNodeContents::FunctionCall { args, .. } => Some(args),
            _ => None,
        }
    }

    // =========================
    // Basic Parsing Tests
    // =========================

    #[test]
    fn test_simple_number() {
        let result = test_parse("42");
        assert!(result.is_ok());
    }

    #[test]
    fn test_simple_number_decimal() {
        let result = test_parse("3.14159");
        assert!(result.is_ok());
    }

    #[test]
    fn test_simple_number_scientific() {
        let result = test_parse("1.5e10");
        assert!(result.is_ok());
    }

    #[test]
    fn test_simple_string() {
        let result = test_parse("\"hello world\"");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert!(matches!(node.inner, AstNodeContents::String(_)));
    }

    #[test]
    fn test_boolean_true() {
        let result = test_parse("TRUE");
        assert!(result.is_ok());
    }

    #[test]
    fn test_boolean_false() {
        let result = test_parse("FALSE");
        assert!(result.is_ok());
    }

    // =========================
    // Binary Operator Tests
    // =========================

    #[test]
    fn test_binary_op() {
        let result = test_parse("1 + 2");
        assert!(result.is_ok());
    }

    #[test]
    fn test_binary_subtraction() {
        let result = test_parse("10 - 3");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("-"));
    }

    #[test]
    fn test_binary_multiplication() {
        let result = test_parse("4 * 5");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("*"));
    }

    #[test]
    fn test_binary_division() {
        let result = test_parse("20 / 4");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("/"));
    }

    #[test]
    fn test_binary_power() {
        let result = test_parse("2 ^ 3");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("^"));
    }

    #[test]
    fn test_binary_concatenation() {
        let result = test_parse("\"hello\" & \" world\"");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("&"));
    }

    // =========================
    // Comparison Operator Tests
    // =========================

    #[test]
    fn test_comparison_equal() {
        let result = test_parse("1 = 1");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("="));
    }

    #[test]
    fn test_comparison_not_equal() {
        let result = test_parse("1 <> 2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("<>"));
    }

    #[test]
    fn test_comparison_less_than() {
        let result = test_parse("1 < 2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("<"));
    }

    #[test]
    fn test_comparison_greater_than() {
        let result = test_parse("2 > 1");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some(">"));
    }

    #[test]
    fn test_comparison_less_than_or_equal() {
        let result = test_parse("1 <= 2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("<="));
    }

    #[test]
    fn test_comparison_greater_than_or_equal() {
        let result = test_parse("2 >= 1");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some(">="));
    }

    // =========================
    // Precedence Tests
    // =========================

    #[test]
    fn test_precedence_mult_over_add() {
        // 1 + 2 * 3 should parse as 1 + (2 * 3)
        let result = test_parse("1 + 2 * 3");
        assert!(result.is_ok());
        let node = result.unwrap();
        // Top level should be +
        assert_eq!(get_func_name(&node), Some("+"));
        // RHS of + should be *
        let args = get_func_args(&node).unwrap();
        assert_eq!(args.len(), 2);
        assert_eq!(get_func_name(&args[1]), Some("*"));
    }

    #[test]
    fn test_precedence_div_over_sub() {
        // 10 - 6 / 2 should parse as 10 - (6 / 2)
        let result = test_parse("10 - 6 / 2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("-"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[1]), Some("/"));
    }

    #[test]
    fn test_precedence_power_over_mult() {
        // 2 * 3 ^ 2 should parse as 2 * (3 ^ 2)
        let result = test_parse("2 * 3 ^ 2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("*"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[1]), Some("^"));
    }

    #[test]
    fn test_precedence_comparison_lowest() {
        // 1 + 2 < 3 + 4 should parse as (1 + 2) < (3 + 4)
        let result = test_parse("1 + 2 < 3 + 4");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("<"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("+"));
        assert_eq!(get_func_name(&args[1]), Some("+"));
    }

    #[test]
    fn test_precedence_concat_between_comparison_and_add() {
        // "a" & "b" = "ab" should parse as ("a" & "b") = "ab"
        let result = test_parse("\"a\" & \"b\" = \"ab\"");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("="));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("&"));
    }

    // =========================
    // Associativity Tests
    // =========================

    #[test]
    fn test_left_associativity_addition() {
        // 1 + 2 + 3 should parse as (1 + 2) + 3
        let result = test_parse("1 + 2 + 3");
        assert!(result.is_ok());
        let node = result.unwrap();
        // Top level should be +
        assert_eq!(get_func_name(&node), Some("+"));
        // LHS of top + should be another +
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("+"));
    }

    #[test]
    fn test_left_associativity_subtraction() {
        // 10 - 5 - 3 should parse as (10 - 5) - 3
        let result = test_parse("10 - 5 - 3");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("-"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("-"));
    }

    #[test]
    fn test_left_associativity_multiplication() {
        // 2 * 3 * 4 should parse as (2 * 3) * 4
        let result = test_parse("2 * 3 * 4");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("*"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("*"));
    }

    #[test]
    fn test_right_associativity_power() {
        // 2 ^ 3 ^ 4 should parse as 2 ^ (3 ^ 4)
        let result = test_parse("2 ^ 3 ^ 4");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("^"));
        let args = get_func_args(&node).unwrap();
        // RHS should be another ^
        assert_eq!(get_func_name(&args[1]), Some("^"));
    }

    // =========================
    // Prefix Operator Tests
    // =========================

    #[test]
    fn test_prefix_minus() {
        let result = test_parse("-5");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("-"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(args.len(), 1);
    }

    #[test]
    fn test_prefix_plus() {
        let result = test_parse("+5");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("+"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(args.len(), 1);
    }

    #[test]
    fn test_double_prefix_minus() {
        // --5 should parse as -(-5)
        let result = test_parse("--5");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("-"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("-"));
    }

    #[test]
    fn test_prefix_with_binary() {
        // -1 + 2 should parse as (-1) + 2
        let result = test_parse("-1 + 2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("+"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("-"));
    }

    #[test]
    fn test_prefix_in_comparison() {
        // -1 < C6 should parse as (-1) < C6
        let result = test_parse("-1 < 5");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("<"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("-"));
    }

    // =========================
    // Postfix Operator Tests
    // =========================

    #[test]
    fn test_postfix_percent() {
        let result = test_parse("50%");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("%"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(args.len(), 1);
    }

    #[test]
    fn test_postfix_percent_in_expression() {
        // 50% + 10 should parse as (50%) + 10
        let result = test_parse("50% + 10");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("+"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("%"));
    }

    #[test]
    fn test_double_percent() {
        // 50%% should parse as (50%)%
        let result = test_parse("50%%");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("%"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("%"));
    }

    // =========================
    // Combined Prefix/Postfix Tests
    // =========================

    #[test]
    fn test_prefix_minus_with_percent() {
        // -50% should parse as -(50%)
        let result = test_parse("-50%");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("-"));
        let args = get_func_args(&node).unwrap();
        assert_eq!(get_func_name(&args[0]), Some("%"));
    }

    // =========================
    // Parentheses Tests
    // =========================

    #[test]
    fn test_nested_parens() {
        let result = test_parse("((((1 + 2))))");
        assert!(result.is_ok());
    }

    #[test]
    fn test_parens_override_precedence() {
        // (1 + 2) * 3 should give * at top level
        let result = test_parse("(1 + 2) * 3");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("*"));
        let args = get_func_args(&node).unwrap();
        // LHS should be a Paren
        assert!(matches!(args[0].inner, AstNodeContents::Paren(_)));
    }

    #[test]
    fn test_parens_in_rhs() {
        // 3 * (1 + 2) should give * at top level with Paren as RHS
        let result = test_parse("3 * (1 + 2)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("*"));
        let args = get_func_args(&node).unwrap();
        assert!(matches!(args[1].inner, AstNodeContents::Paren(_)));
    }

    #[test]
    fn test_parens_in_complex_expression() {
        // a * (b + c) + d should parse as (a * (b + c)) + d
        let result = test_parse("1 * (2 + 3) + 4");
        assert!(result.is_ok());
        let node = result.unwrap();
        // Top level should be +
        assert_eq!(get_func_name(&node), Some("+"));
        let args = get_func_args(&node).unwrap();
        // LHS should be *
        assert_eq!(get_func_name(&args[0]), Some("*"));
    }

    // =========================
    // Cell Reference Tests
    // =========================

    #[test]
    fn test_cell_reference_simple() {
        let result = test_parse("A1");
        assert!(result.is_ok());
    }

    #[test]
    fn test_cell_reference_absolute() {
        let result = test_parse("$A$1");
        assert!(result.is_ok());
    }

    #[test]
    fn test_cell_reference_mixed() {
        let result = test_parse("$A1");
        assert!(result.is_ok());
    }

    #[test]
    fn test_cell_reference_in_expression() {
        let result = test_parse("A1 + B2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("+"));
    }

    #[test]
    fn test_cell_range() {
        let result = test_parse("A1:B2");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some(":"));
    }

    // =========================
    // Function Call Tests
    // =========================

    #[test]
    fn test_function_no_args() {
        let result = test_parse("NOW()");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("NOW"));
    }

    #[test]
    fn test_function_single_arg() {
        let result = test_parse("ABS(-5)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("ABS"));
    }

    #[test]
    fn test_function_multiple_args() {
        let result = test_parse("SUM(1, 2, 3)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("SUM"));
    }

    #[test]
    fn test_function_nested() {
        let result = test_parse("SUM(ABS(-1), MAX(2, 3))");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("SUM"));
    }

    #[test]
    fn test_function_with_expression_arg() {
        let result = test_parse("ABS(1 + 2 * 3)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("ABS"));
    }

    // =========================
    // Array Literal Tests
    // =========================

    #[test]
    fn test_array_literal_simple() {
        let result = test_parse("{1, 2, 3}");
        assert!(result.is_ok());
    }

    #[test]
    fn test_array_literal_2d() {
        let result = test_parse("{1, 2; 3, 4}");
        assert!(result.is_ok());
    }

    // =========================
    // Range Operator Tests
    // =========================

    #[test]
    fn test_numeric_range() {
        let result = test_parse("1..10");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some(".."));
    }

    // =========================
    // Complex Expression Tests
    // =========================

    #[test]
    fn test_complex_expression() {
        let result = test_parse("1 + 2 * 3 - 4 / 5");
        assert!(result.is_ok());
    }

    #[test]
    fn test_complex_with_functions() {
        let result = test_parse("SUM(A1:A10) + AVERAGE(B1:B10) * 2");
        assert!(result.is_ok());
        let node = result.unwrap();
        // Top level should be +
        assert_eq!(get_func_name(&node), Some("+"));
    }

    #[test]
    fn test_complex_nested_parens_and_ops() {
        let result = test_parse("((1 + 2) * (3 - 4)) / ((5 + 6) * 7)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("/"));
    }

    #[test]
    fn test_long_chain_of_operators() {
        let result = test_parse("1 + 2 - 3 + 4 - 5 + 6 - 7 + 8 - 9 + 10");
        assert!(result.is_ok());
    }

    // =========================
    // Deep Nesting Tests
    // =========================

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

    #[test]
    fn test_deeply_nested_function_calls() {
        // Test deeply nested function calls like ABS(ABS(ABS(...)))
        // Each function call adds Rust stack frames for FunctionCall parsing,
        // so this tests the practical limit of function nesting.
        let depth = 100;
        let formula = format!("{}1{}", "ABS(".repeat(depth), ")".repeat(depth));
        let result = test_parse(&formula);
        assert!(
            result.is_ok(),
            "Deeply nested function calls should parse successfully"
        );
    }

    #[test]
    fn test_deep_binary_chain() {
        // Test a long chain of binary operators
        let depth = 500;
        let formula = (0..depth).map(|i| i.to_string()).collect::<Vec<_>>().join(" + ");
        let result = test_parse(&formula);
        assert!(
            result.is_ok(),
            "Deep binary chain should not cause stack overflow"
        );
    }

    #[test]
    fn test_deep_prefix_chain() {
        // Test deeply nested prefix operators: ----...---5
        let depth = 200;
        let formula = format!("{}5", "-".repeat(depth));
        let result = test_parse(&formula);
        assert!(
            result.is_ok(),
            "Deep prefix chain should not cause stack overflow"
        );
    }

    #[test]
    fn test_deep_mixed_nesting() {
        // Test deep nesting with mixed parens and operators
        let depth = 100;
        let mut formula = String::new();
        for _ in 0..depth {
            formula.push_str("(1 + ");
        }
        formula.push('1');
        for _ in 0..depth {
            formula.push(')');
        }
        let result = test_parse(&formula);
        assert!(
            result.is_ok(),
            "Deep mixed nesting should not cause stack overflow"
        );
    }

    // =========================
    // Edge Case Tests
    // =========================

    #[test]
    fn test_single_paren_expression() {
        let result = test_parse("(42)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert!(matches!(node.inner, AstNodeContents::Paren(_)));
    }

    #[test]
    fn test_prefix_in_parens() {
        let result = test_parse("(-5)");
        assert!(result.is_ok());
    }

    #[test]
    fn test_postfix_in_parens() {
        let result = test_parse("(50%)");
        assert!(result.is_ok());
    }

    #[test]
    fn test_expression_after_paren() {
        // After a paren, operators should still be picked up
        let result = test_parse("(1) + (2)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("+"));
    }

    #[test]
    fn test_percent_after_paren() {
        // (1 + 2)% should work
        let result = test_parse("(1 + 2)%");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("%"));
    }

    #[test]
    fn test_whitespace_handling() {
        let result = test_parse("  1   +   2   ");
        assert!(result.is_ok());
    }

    #[test]
    fn test_empty_expression_fails() {
        let result = test_parse("");
        assert!(result.is_err());
    }

    #[test]
    fn test_missing_operand_fails() {
        let result = test_parse("1 +");
        assert!(result.is_err());
    }

    #[test]
    fn test_unmatched_paren_fails() {
        let result = test_parse("(1 + 2");
        assert!(result.is_err());
    }

    #[test]
    fn test_consecutive_binary_ops_fails() {
        let result = test_parse("1 + * 2");
        assert!(result.is_err());
    }

    // =========================
    // Lambda Invocation Tests
    // =========================

    #[test]
    fn test_expression_followed_by_parens() {
        // This tests lambda-style invocation: expr(args)
        // A parenthesized expression followed by args uses lambda invoke
        let result = test_parse("(A1)(1, 2)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("__LAMBDA_INVOKE__"));
    }

    #[test]
    fn test_lambda_invoke_with_cell_range() {
        // A cell range expression followed by args
        let result = test_parse("(A1:B2)(1)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("__LAMBDA_INVOKE__"));
    }

    // =========================
    // Real-World Formula Tests
    // =========================

    #[test]
    fn test_if_function() {
        let result = test_parse("IF(A1 > 10, \"big\", \"small\")");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("IF"));
    }

    #[test]
    fn test_vlookup_style() {
        let result = test_parse("VLOOKUP(A1, B1:D10, 3, FALSE)");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("VLOOKUP"));
    }

    #[test]
    fn test_nested_if() {
        let result = test_parse("IF(A1 > 10, IF(A1 > 20, \"huge\", \"big\"), \"small\")");
        assert!(result.is_ok());
        let node = result.unwrap();
        assert_eq!(get_func_name(&node), Some("IF"));
    }

    #[test]
    fn test_sumif_pattern() {
        let result = test_parse("SUMIF(A1:A10, \">0\")");
        assert!(result.is_ok());
    }

    #[test]
    fn test_complex_financial_formula() {
        // PMT-style calculation
        let result = test_parse("(A1 * B1 / 12) / (1 - (1 + B1 / 12) ^ -C1)");
        assert!(result.is_ok());
    }
}
