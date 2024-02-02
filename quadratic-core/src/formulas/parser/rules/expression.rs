use super::*;

/// Operator precedence table.
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum OpPrecedence {
    Comparison,
    Concat,
    AddSub,
    MulDiv,
    Pow,
    Range,
    CellRange,
    Prefix,
    Suffix,
    Atom,
}
impl Default for OpPrecedence {
    fn default() -> Self {
        Self::lowest()
    }
}
impl OpPrecedence {
    /// Returns the lowest precedence level.
    pub const fn lowest() -> Self {
        Self::Comparison
    }
    /// Returns the next-highest precedence level. Panics if given
    /// `OpPrecedence::Atom`.
    pub fn next(self) -> Self {
        match self {
            Self::Comparison => Self::Concat,
            Self::Concat => Self::AddSub,
            Self::AddSub => Self::MulDiv,
            Self::MulDiv => Self::Pow,
            Self::Pow => Self::Range,
            Self::Range => Self::CellRange,
            Self::CellRange => Self::Prefix,
            Self::Prefix => Self::Suffix,
            Self::Suffix => Self::Atom,
            Self::Atom => panic!("tried to get operator precedence level beyond {:?}", self),
        }
    }

    /// Returns a list of binary operators at this precedence level.
    pub fn binary_ops(self) -> &'static [Token] {
        use Token::*;
        match self {
            Self::Comparison => &[Eql, Neq, Lt, Gt, Lte, Gte],
            Self::Concat => &[Concat],
            Self::AddSub => &[Plus, Minus],
            Self::MulDiv => &[Mult, Div],
            Self::Pow => &[Power],
            Self::Range => &[RangeOp],
            Self::CellRange => &[CellRangeOp],
            Self::Prefix => &[],
            Self::Suffix => &[],
            Self::Atom => &[],
        }
    }

    /// Returns a list of unary prefix operators at this precedence level.
    pub fn prefix_ops(self) -> &'static [Token] {
        use Token::*;
        match self {
            Self::Prefix => &[Plus, Minus],
            _ => &[],
        }
    }

    /// Returns a list of unary suffix operators at this precedence level.
    pub fn suffix_ops(self) -> &'static [Token] {
        use Token::*;
        match self {
            Self::Suffix => &[Percent],
            _ => &[],
        }
    }

    /// Returns whether the binary operators at this precedence level are
    /// right-associative.
    pub fn is_right_associative(self) -> bool {
        match self {
            OpPrecedence::Pow => true,
            _ => false,
        }
    }
}

/// Matches an expression.
#[derive(Debug, Copy, Clone)]
pub struct Expression;
impl_display!(for Expression, "expression");
impl SyntaxRule for Expression {
    type Output = ast::AstNode;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        ExpressionWithPrecedence::default().prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        p.parse(ExpressionWithPrecedence::default())
    }
}

/// Matches an expression with the given precedence level.
#[derive(Debug, Default, Copy, Clone)]
struct ExpressionWithPrecedence(pub OpPrecedence);
impl_display!(for ExpressionWithPrecedence, "expression");
impl SyntaxRule for ExpressionWithPrecedence {
    type Output = ast::AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        if let Some(t) = p.next() {
            // There are so many tokens that might match, it's more reliable to
            // just match all of them.
            match t {
                Token::LParen => true,
                Token::LBracket => false,
                Token::LBrace => true,

                //  These match because an expression in a list or array or
                //  functional call is allowed to be empty.
                Token::RParen | Token::RBracket | Token::RBrace => true,
                Token::ArgSep | Token::RowSep => true,

                Token::Eql | Token::Neq | Token::Lt | Token::Gt | Token::Lte | Token::Gte => false,

                Token::Plus | Token::Minus => true,

                Token::Mult
                | Token::Div
                | Token::Power
                | Token::Concat
                | Token::RangeOp
                | Token::Percent
                | Token::CellRangeOp
                | Token::SheetRefOp
                | Token::Ellipsis => false,

                Token::False | Token::True => true,

                Token::Comment | Token::UnterminatedBlockComment => false,

                Token::FunctionCall
                | Token::UnquotedSheetReference
                | Token::StringLiteral
                | Token::UnterminatedStringLiteral
                | Token::NumericLiteral
                | Token::CellRef => true,

                Token::Whitespace => false,
                Token::Unknown => false,
            }
        } else {
            false
        }
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        // Consume an expression at the given precedence level, which may
        // consist of expressions with higher precedence.
        match self.0 {
            OpPrecedence::Atom => parse_one_of!(
                p,
                [
                    FunctionCall.map(Some),
                    CellReferenceExpression.map(Some),
                    StringLiteralExpression.map(Some),
                    NumericLiteral.map(Some),
                    ArrayLiteral.map(Some),
                    BoolExpression.map(Some),
                    ParenExpression.map(Some),
                    EmptyExpression.map(Some),
                ],
            )
            .transpose()
            .unwrap_or_else(|| p.expected(self)),

            prec if !prec.binary_ops().is_empty() => parse_binary_ops_expr(p, prec),
            prec if !prec.prefix_ops().is_empty() => parse_prefix_ops(p, prec),
            prec if !prec.suffix_ops().is_empty() => parse_suffix_ops(p, prec),
            prec => internal_error!("don't know what to do for precedence {:?}", prec),
        }
    }
}

/// Parses an expression with any number of binary operators at a specific
/// precedence level.
fn parse_binary_ops_expr(p: &mut Parser<'_>, precedence: OpPrecedence) -> CodeResult<ast::AstNode> {
    let recursive_expression = ExpressionWithPrecedence(precedence.next());

    let allowed_ops = precedence.binary_ops();

    // First, just make a list of operators and expressions. `ops.len()` should
    // always be equal to `exprs.len() - 1`.
    let mut ops: Vec<Spanned<String>> = vec![];
    let mut exprs: Vec<ast::AstNode> = vec![p.parse(recursive_expression)?];
    while let Some(tok) = p.peek_next() {
        if allowed_ops.contains(&tok) {
            p.next();
            ops.push(Spanned {
                span: p.span(),
                inner: p.token_str().to_string(),
            });
            exprs.push(p.parse(recursive_expression)?);
            continue;
        } else {
            break;
        }
    }

    let mut ret: ast::AstNode;
    if precedence.is_right_associative() {
        // Take out the last/rightmost expression; that's the deepest AST node.
        ret = exprs.pop().unwrap();
        // Pair up the remaining operators and expressions, and make a new AST
        // node using the previous iteration as the right-hand side of the
        // expression.
        for (lhs, op) in exprs.into_iter().zip(ops).rev() {
            ret = AstNode {
                span: Span::merge(lhs.span, ret.span),
                inner: ast::AstNodeContents::FunctionCall {
                    func: op,
                    args: vec![lhs, ret],
                },
            };
        }
    } else {
        // Take out the first/leftmost expression; that's the deepest AST node.
        let mut exprs_iter = exprs.into_iter();
        ret = exprs_iter.next().unwrap();
        // Pair up the remaining operators and expressions, and make a new AST
        // node using the previous iteration as the left-hand side of the
        // expression.
        for (op, rhs) in ops.into_iter().zip(exprs_iter) {
            ret = AstNode {
                span: Span::merge(ret.span, rhs.span),
                inner: ast::AstNodeContents::FunctionCall {
                    func: op,
                    args: vec![ret, rhs],
                },
            };
        }
    }
    Ok(ret)
}

/// Parses an expression with any number of prefix operators.
fn parse_prefix_ops(p: &mut Parser<'_>, precedence: OpPrecedence) -> CodeResult<ast::AstNode> {
    let allowed_ops = precedence.prefix_ops();

    // Build a list of operators in the order that they appear in the source
    // code.
    let mut ops: Vec<Spanned<String>> = vec![];
    while let Some(tok) = p.peek_next() {
        if allowed_ops.contains(&tok) {
            p.next();
            ops.push(Spanned {
                span: p.span(),
                inner: p.token_str().to_string(),
            });
            continue;
        } else {
            break;
        }
    }
    let mut ret = p.parse(ExpressionWithPrecedence(precedence.next()))?;
    // Now pop the operators off the list from right to left.
    for op in ops {
        ret = AstNode {
            span: Span::merge(op.span, ret.span),
            inner: ast::AstNodeContents::FunctionCall {
                func: op,
                args: vec![ret],
            },
        };
    }
    Ok(ret)
}

/// Parses an expression with any number of suffix operators.
fn parse_suffix_ops(p: &mut Parser<'_>, precedence: OpPrecedence) -> CodeResult<ast::AstNode> {
    let allowed_ops = precedence.suffix_ops();

    // Parse the initial expression.
    let mut ret = p.parse(ExpressionWithPrecedence(precedence.next()))?;

    // Repeatedly try to consume a suffix.
    while let Some(tok) = p.peek_next() {
        if allowed_ops.contains(&tok) {
            p.next();
            let op = Spanned {
                span: p.span(),
                inner: p.token_str().to_string(),
            };
            ret = AstNode {
                span: Span::merge(ret.span, op.span),
                inner: ast::AstNodeContents::FunctionCall {
                    func: op,
                    args: vec![ret],
                },
            }
        } else {
            break;
        }
    }
    Ok(ret)
}

/// Matches a function call.
#[derive(Debug, Copy, Clone)]
pub struct FunctionCall;
impl_display!(for FunctionCall, "function call");
impl SyntaxRule for FunctionCall {
    type Output = ast::AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::FunctionCall)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        p.parse(Token::FunctionCall)?;
        let Some(func_str) = p.token_str().strip_suffix('(') else {
            internal_error!("function call missing left paren");
        };
        let func = Spanned {
            span: p.span(),
            inner: func_str.to_string(),
        };
        p.prev();

        let spanned_args = p.parse(List {
            inner: Expression,
            sep: Token::ArgSep,
            start: Token::FunctionCall,
            end: Token::RParen,
            sep_name: "comma",
            allow_trailing_sep: false,
        })?;
        let args = spanned_args.inner;

        Ok(AstNode {
            span: Span::merge(func.span, spanned_args.span),
            inner: ast::AstNodeContents::FunctionCall { func, args },
        })
    }
}

/// Matches a single cell reference.
#[derive(Debug, Copy, Clone)]
pub struct CellReferenceExpression;
impl_display!(for CellReferenceExpression, "cell reference, such as 'A6' or '$ZB$3'");
impl SyntaxRule for CellReferenceExpression {
    type Output = AstNode;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        CellReference.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        Ok(p.parse(CellReference)?.map(ast::AstNodeContents::CellRef))
    }
}

/// Matches a pair of parentheses containing an expression.
#[derive(Debug, Copy, Clone)]
pub struct ParenExpression;
impl_display!(for ParenExpression, "{}", Surround::paren(Expression));
impl SyntaxRule for ParenExpression {
    type Output = ast::AstNode;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        Surround::paren(Expression).prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        p.parse(Surround::paren(
            Expression.map(|expr| ast::AstNodeContents::Paren(Box::new(expr))),
        ))
    }
}

/// Matches an array literal.
#[derive(Debug, Copy, Clone)]
pub struct ArrayLiteral;
impl_display!(for ArrayLiteral, "array literal, such as '{{1, 2; 3, 4}}'");
impl SyntaxRule for ArrayLiteral {
    type Output = AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::LBrace)
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let start_span = p.peek_next_span();

        let mut rows = vec![vec![]];
        p.parse(Token::LBrace)?;
        loop {
            rows.last_mut().unwrap().push(p.parse(Expression)?);
            match p.next() {
                Some(Token::ArgSep) => (),                // next cell within row
                Some(Token::RowSep) => rows.push(vec![]), // start a new row
                Some(Token::RBrace) => break,             // end of array
                _ => {
                    return Err(p.expected_err(crate::util::join_with_conjunction(
                        "or",
                        &[
                            Token::ArgSep.to_string(),
                            Token::RowSep.to_string(),
                            Token::RBrace.to_string(),
                        ],
                    )))
                }
            }
        }
        if rows.last().unwrap().is_empty() && rows.len() > 1 {
            rows.pop();
        }

        let end_span = p.span();

        if !rows.iter().map(|row| row.len()).all_equal() {
            return Err(RunErrorMsg::NonRectangularArray.with_span(end_span));
        }

        Ok(Spanned {
            span: Span::merge(start_span, end_span),
            inner: ast::AstNodeContents::Array(rows),
        })
    }
}

/// Matches a string literal and wraps it in an expression.
#[derive(Debug, Copy, Clone)]
pub struct StringLiteralExpression;
impl_display!(for StringLiteralExpression, "string literal");
impl SyntaxRule for StringLiteralExpression {
    type Output = ast::AstNode;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        StringLiteral.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let inner = ast::AstNodeContents::String(p.parse(StringLiteral)?);
        let span = p.span();
        Ok(Spanned { span, inner })
    }
}

/// Matches an empty expression that is followed by something that should
/// normally follow an expression (such as a comma or semicolon or right paren).
#[derive(Debug, Copy, Clone)]
pub struct EmptyExpression;
impl_display!(for EmptyExpression, "empty expression");
impl SyntaxRule for EmptyExpression {
    type Output = ast::AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        match p.next() {
            None => true,
            Some(Token::ArgSep | Token::RowSep) => true,
            Some(Token::RBrace | Token::RBracket | Token::RParen) => true,
            _ => false,
        }
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        Ok(Spanned {
            span: Span::empty(p.cursor.unwrap_or(0) as u32),
            inner: ast::AstNodeContents::Empty,
        })
    }
}
