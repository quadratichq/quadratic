use super::*;

/// Matches a string literal.
#[derive(Debug, Copy, Clone)]
pub struct StringLiteral;
impl_display!(for StringLiteral, "string literal");
impl SyntaxRule for StringLiteral {
    type Output = String;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::StringLiteral)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        if p.next() != Some(Token::StringLiteral) {
            return p.expected(self);
        }
        crate::formulas::parse_string_literal(p.token_str())
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
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        match p.next() {
            Some(Token::NumericLiteral) => {
                let Ok(n) = p.token_str().parse::<f64>() else {
                    return Err(ErrorMsg::BadNumber.with_span(p.span()));
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
        matches!(
            p.next(),
            Some(Token::CellRef | Token::StringLiteral | Token::UnquotedSheetReference),
        )
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let start_span = p.peek_next_span();

        let sheet_name = match p.peek_next() {
            Some(Token::StringLiteral) => {
                let name = p.parse(StringLiteral)?;
                p.parse(Token::SheetRefOp)?;
                Some(name)
            }
            Some(Token::UnquotedSheetReference) => {
                p.next();
                p.token_str()
                    .strip_suffix('!')
                    .map(|s| s.trim().to_string())
            }
            _ => None,
        };

        p.next();
        let Some(mut cell_ref) = CellRef::parse_a1(p.token_str(), p.pos) else {
            return Err(ErrorMsg::BadCellReference.with_span(p.span()));
        };
        cell_ref.sheet = sheet_name;
        Ok(AstNode {
            span: Span::merge(start_span, p.span()),
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
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        p.next();
        let Some(pos) = CellRef::parse_a1(p.token_str(), p.pos) else {
            return Err(ErrorMsg::BadCellReference.with_span(p.span()));
        };
        let span = p.span();

        // Check for a range reference.
        if p.try_parse(Token::CellRangeOp).is_some() {
            let start = pos.clone();
            p.next();
            if let Some(end) = CellRef::parse_a1(p.token_str(), p.pos) {
                return Ok(Spanned {
                    span: Span::merge(span, p.span()),
                    inner: RangeRef::CellRange { start, end },
                });
            }
            p.prev();
            p.prev();
        }

        Ok(Spanned {
            span,
            inner: RangeRef::Cell { pos },
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

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
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
