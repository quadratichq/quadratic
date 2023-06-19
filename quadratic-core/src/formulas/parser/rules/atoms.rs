use super::*;

/// Matches a string literal.
#[derive(Debug, Copy, Clone)]
pub struct StringLiteral;
impl_display!(for StringLiteral, "string literal");
impl SyntaxRule for StringLiteral {
    type Output = ast::AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::StringLiteral)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> FormulaResult<Self::Output> {
        if p.next() != Some(Token::StringLiteral) {
            return p.expected(self);
        }
        // Use IIFE for error handling.
        || -> Option<Self::Output> {
            let mut string_contents = String::new();
            let mut chars = p.token_str().chars().peekable();
            let quote = chars.next()?;
            // Read characters.
            loop {
                match chars.next()? {
                    '\\' => string_contents.push(chars.next()?),
                    c if c == quote => break,
                    c => string_contents.push(c),
                }
            }

            if chars.next().is_none() {
                // End of token, as expected.
                Some(Spanned {
                    span: p.span(),
                    inner: ast::AstNodeContents::String(string_contents),
                })
            } else {
                // Why is there more after the closing quote?
                None
            }
        }()
        .ok_or_else(|| internal_error_value!("error in string literal parsing"))
    }
}

/// Matches an numeric literal.
#[derive(Debug, Copy, Clone)]
pub struct NumericLiteral;
impl_display!(for NumericLiteral, "numeric literal, such as '42' or '6.022e23'");
impl SyntaxRule for NumericLiteral {
    type Output = AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::NumericLiteral)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> FormulaResult<Self::Output> {
        match p.next() {
            Some(Token::NumericLiteral) => {
                let Ok(n) = p.token_str().parse::<f64>() else {
                    return Err(FormulaErrorMsg::BadNumber.with_span(p.span()));
                };
                Ok(AstNode {
                    span: p.span(),
                    inner: ast::AstNodeContents::Number(n),
                })
            }
            _ => p.expected(self),
        }
    }
}

/// Matches a cell reference.
#[derive(Debug, Copy, Clone)]
pub struct CellReference;
impl_display!(for CellReference, "cell reference, such as 'A6' or '$ZB$3'");
impl SyntaxRule for CellReference {
    type Output = AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::CellRef)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> FormulaResult<Self::Output> {
        p.next();
        let Some(cell_ref) = CellRef::parse_a1(p.token_str(), p.pos) else {
            return Err(FormulaErrorMsg::BadCellReference.with_span(p.span()));
        };
        Ok(AstNode {
            span: p.span(),
            inner: ast::AstNodeContents::CellRef(cell_ref),
        })
    }
}

/// Matches a cell range reference on its own, not as part of an expression.
#[derive(Debug, Copy, Clone)]
pub struct CellRangeReference;
impl_display!(for CellRangeReference, "cell range reference, such as 'A6:D10' or '$ZB$3'");
impl SyntaxRule for CellRangeReference {
    type Output = Spanned<RangeRef>;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::CellRef)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> FormulaResult<Self::Output> {
        p.next();
        let Some(cell_ref) = CellRef::parse_a1(p.token_str(), p.pos) else {
            return Err(FormulaErrorMsg::BadCellReference.with_span(p.span()));
        };
        let span = p.span();

        // Check for a range reference.
        if p.try_parse(Token::CellRangeOp).is_some() {
            p.next();
            if let Some(cell_ref2) = CellRef::parse_a1(p.token_str(), p.pos) {
                return Ok(Spanned {
                    span: Span::merge(span, p.span()),
                    inner: RangeRef::CellRange(cell_ref, cell_ref2),
                });
            }
            p.prev();
            p.prev();
        }

        Ok(Spanned {
            span,
            inner: RangeRef::Cell(cell_ref),
        })
    }
}

#[derive(Debug, Copy, Clone)]
pub struct BoolExpression;
impl_display!(for BoolExpression, "boolean, either 'TRUE' or 'FALSE'");
impl SyntaxRule for BoolExpression {
    type Output = AstNode;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        matches!(p.next(), Some(Token::False | Token::True))
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> FormulaResult<Self::Output> {
        let b = match p.next() {
            Some(Token::False) => false,
            Some(Token::True) => true,
            _ => p.expected(self)?,
        };
        return Ok(AstNode {
            span: p.span(),
            inner: ast::AstNodeContents::Bool(b),
        });
    }
}
