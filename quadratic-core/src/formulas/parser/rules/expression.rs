use super::pratt::parse_expression_iterative;
use super::*;

/// Matches an expression, nothing, or a tuple of expressions.
#[derive(Debug, Copy, Clone)]
pub struct TupleExpression;
impl_display!(for TupleExpression, "expression or nothing");
impl SyntaxRule for TupleExpression {
    type Output = ast::AstNode;

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        Expression.prefix_matches(p) // also matches start of tuple (left paren)
            || EmptyExpression.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let mut tmp_p = *p;
        if tmp_p.next() == Some(Token::LParen) {
            // (
            if tmp_p.parse(TupleExpression).is_ok() {
                // expression
                if tmp_p.next() == Some(Token::ArgSep) {
                    // ,
                    return p.parse(
                        List {
                            // In Excel, tuples can only contain cell ranges and tuples.
                            // We allow blanks and other kinds of expressions as well
                            // because that's just easier.
                            inner: TupleExpression,
                            sep: Token::ArgSep,
                            start: Token::LParen,
                            end: Token::RParen,
                            sep_name: "comma",
                            // If we allowed trailing comma then the tuple `(expr,)`
                            // would get parsed the same as `(expr)`
                            allow_trailing_sep: false,
                            allow_empty: false,
                        }
                        .map(|spanned| spanned.map(ast::AstNodeContents::Paren)),
                    );
                }
            }
        }

        parse_one_of!(p, [Expression, EmptyExpression])
    }
}

/// Matches an expression or nothing.
#[derive(Debug, Copy, Clone)]
pub struct OptionalExpression;
impl_display!(for OptionalExpression, "expression or nothing");
impl SyntaxRule for OptionalExpression {
    type Output = ast::AstNode;

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        Expression.prefix_matches(p) || EmptyExpression.prefix_matches(p)
    }
    #[inline]
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        parse_one_of!(p, [Expression, EmptyExpression])
    }
}

/// Matches an expression.
#[derive(Debug, Copy, Clone)]
pub struct Expression;
impl_display!(for Expression, "expression");
impl SyntaxRule for Expression {
    type Output = ast::AstNode;

    #[inline]
    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        // Check if the next token can start an expression
        if let Some(t) = p.next() {
            match t {
                Token::LParen => true,
                Token::LBracket => false,
                Token::LBrace => true,

                // These only match for expressions that can be empty.
                Token::RParen | Token::RBracket | Token::RBrace => false,
                Token::ArgSep | Token::RowSep => false,

                Token::Eql | Token::Neq | Token::Lt | Token::Gt | Token::Lte | Token::Gte => false,

                // Plus/Minus can be prefix operators
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
                | Token::CellOrTableRef
                | Token::InternalCellRef
                | Token::Error => true,

                Token::TableRefBracketsExpression => false,
                Token::Whitespace => false,
                Token::Unknown => false,
            }
        } else {
            false
        }
    }

    #[inline]
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        // Use fully iterative Pratt parsing
        parse_expression_iterative(p, 0)
    }
}

/// Matches a function call.
#[derive(Debug, Copy, Clone)]
pub struct FunctionCall;
impl_display!(for FunctionCall, "function call");
impl SyntaxRule for FunctionCall {
    type Output = ast::AstNode;

    #[inline]
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
            inner: TupleExpression,
            sep: Token::ArgSep,
            start: Token::FunctionCall,
            end: Token::RParen,
            sep_name: "comma",
            allow_trailing_sep: false,
            allow_empty: true,
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
impl_display!(for CellReferenceExpression, "cell reference such as 'A6' or '$ZB$3'");
impl SyntaxRule for CellReferenceExpression {
    type Output = AstNode;

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        CellReference.prefix_matches(p)
    }
    #[inline]
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        Ok(p.parse(CellReference)?.map(|result| match result {
            Ok((sheet_id, range)) => ast::AstNodeContents::CellRef(sheet_id, range),
            Err(e) => ast::AstNodeContents::Error(e.into()),
        }))
    }
}

/// Matches a table reference.
#[derive(Debug, Copy, Clone)]
pub struct TableReferenceExpression;
impl_display!(for TableReferenceExpression, "table reference such as 'MyTable' or 'MyTable[ColumnName]'");
impl SyntaxRule for TableReferenceExpression {
    type Output = AstNode;

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        SheetTableReference.prefix_matches(p)
    }
    #[inline]
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        Ok(p.parse(SheetTableReference)?
            .map(ast::AstNodeContents::RangeRef))
    }
}

/// Matches a pair of parentheses containing an expression.
#[derive(Debug, Copy, Clone)]
pub struct ParenExpression;
impl_display!(for ParenExpression, "{}", Surround::paren(Expression));
impl SyntaxRule for ParenExpression {
    type Output = ast::AstNode;

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        Surround::paren(Expression).prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        p.parse(Surround::paren(
            Expression.map(|expr| ast::AstNodeContents::Paren(vec![expr])),
        ))
    }
}

/// Matches an array literal.
#[derive(Debug, Copy, Clone)]
pub struct ArrayLiteral;
impl_display!(for ArrayLiteral, "array literal such as '{{1, 2; 3, 4}}'");
impl SyntaxRule for ArrayLiteral {
    type Output = AstNode;

    #[inline]
    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::LBrace)
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let start_span = p.peek_next_span();

        let mut rows = vec![vec![]];
        p.parse(Token::LBrace)?;
        loop {
            rows.last_mut().unwrap().push(p.parse(OptionalExpression)?);
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
                    )));
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

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        StringLiteral.prefix_matches(p)
    }
    #[inline]
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

    #[inline]
    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        match p.next() {
            None => true,
            Some(Token::ArgSep | Token::RowSep) => true,
            Some(Token::RBrace | Token::RBracket | Token::RParen) => true,
            _ => false,
        }
    }

    #[inline]
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        Ok(Spanned {
            span: Span::empty(p.cursor.unwrap_or(0) as u32),
            inner: ast::AstNodeContents::Empty,
        })
    }
}
