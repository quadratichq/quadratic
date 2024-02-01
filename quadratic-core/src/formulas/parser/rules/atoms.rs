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
                    return Err(RunErrorMsg::BadNumber.with_span(p.span()));
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

/// Maches an optional sheet reference prefix to a cell reference or cell range
/// reference.
#[derive(Debug, Copy, Clone)]
pub struct SheetRefPrefix;
impl_display!(for SheetRefPrefix, "sheet reference, such as 'MySheet!' or '\"Sheet 2\"!'");
impl SyntaxRule for SheetRefPrefix {
    type Output = String;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        match p.next() {
            Some(Token::UnquotedSheetReference) => true,
            Some(Token::StringLiteral) => p.peek_next() == Some(Token::SheetRefOp),
            _ => false,
        }
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        match p.peek_next() {
            Some(Token::StringLiteral) => {
                let name = p.parse(StringLiteral)?;
                p.parse(Token::SheetRefOp)?;
                Ok(name)
            }
            Some(Token::UnquotedSheetReference) => {
                p.next();
                let name_without_bang = p.token_str().strip_suffix('!').ok_or_else(|| {
                    RunErrorMsg::InternalError("expected '!' in unquoted sheet reference".into())
                })?;
                Ok(name_without_bang.trim().to_string())
            }
            _ => p.expected(self),
        }
    }
}

/// Matches a single cell reference.
#[derive(Debug, Copy, Clone)]
pub struct CellReference;
impl_display!(for CellReference, "cell reference, such as 'A6' or '$ZB$3'");
impl SyntaxRule for CellReference {
    type Output = Spanned<CellRef>;

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        match p.next() {
            Some(Token::CellRef | Token::UnquotedSheetReference) => true,
            Some(Token::StringLiteral) => p.peek_next() == Some(Token::SheetRefOp),
            _ => false,
        }
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let start_span = p.peek_next_span();

        let sheet_name = p.try_parse(SheetRefPrefix).transpose()?;

        p.next();
        let Some(mut cell_ref) = CellRef::parse_a1(p.token_str(), p.pos) else {
            return Err(RunErrorMsg::BadCellReference.with_span(p.span()));
        };
        cell_ref.sheet = sheet_name;
        Ok(Spanned {
            span: Span::merge(start_span, p.span()),
            inner: cell_ref,
        })
    }
}

/// Matches a single cell reference or a cell range reference on its own, not as
/// part of an expression.
#[derive(Debug, Copy, Clone)]
pub struct CellRangeReference;
impl_display!(for CellRangeReference, "cell range reference, such as 'A6:D10' or '$ZB$3'");
impl SyntaxRule for CellRangeReference {
    type Output = Spanned<RangeRef>;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        CellReference.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let pos1 = p.parse(CellReference)?;

        // Check for a range reference.
        if p.try_parse(Token::CellRangeOp).is_some() {
            let pos2 = p.parse(CellReference)?;
            Ok(Spanned::merge(pos1, pos2, |start, end| {
                RangeRef::CellRange { start, end }
            }))
        } else {
            Ok(pos1.map(|pos| RangeRef::Cell { pos }))
        }
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
        Ok(AstNode {
            span: p.span(),
            inner: ast::AstNodeContents::Bool(b),
        })
    }
}
