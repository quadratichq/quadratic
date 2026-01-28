use crate::{
    RefError,
    a1::{A1Error, SheetCellRefRange},
};

use super::*;

/// Matches a string literal.
#[derive(Debug, Copy, Clone)]
pub struct StringLiteral;
impl_display!(for StringLiteral, "string literal");
impl SyntaxRule for StringLiteral {
    type Output = String;

    #[inline]
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
impl_display!(for NumericLiteral, "numeric literal such as '42' or '6.022e23'");
impl SyntaxRule for NumericLiteral {
    type Output = AstNode;

    #[inline]
    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(Token::NumericLiteral)
    }
    #[inline]
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

/// Matches a sheet reference prefix to a cell reference or cell range
/// reference.
#[derive(Debug, Copy, Clone)]
pub struct SheetRefPrefix;
impl_display!(for SheetRefPrefix, "sheet reference such as 'MySheet!' or '\"Sheet 2\"!'");
impl SyntaxRule for SheetRefPrefix {
    type Output = SheetId;

    #[inline]
    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        match p.next() {
            Some(Token::UnquotedSheetReference) => true,
            Some(Token::StringLiteral) => p.next() == Some(Token::SheetRefOp),
            _ => false,
        }
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let name: String;
        let span: Span;
        match p.peek_next() {
            Some(Token::StringLiteral) => {
                name = p.parse(StringLiteral)?;
                let name_span = p.span();
                p.parse(Token::SheetRefOp)?;
                let op_span = p.span();
                span = Span::merge(name_span, op_span);
            }
            Some(Token::UnquotedSheetReference) => {
                p.next();
                let name_without_bang = p.token_str().strip_suffix('!').ok_or_else(|| {
                    RunErrorMsg::InternalError("expected '!' in unquoted sheet reference".into())
                })?;
                name = name_without_bang.trim().to_string();
                span = p.span();
            }
            _ => return p.expected(self),
        }

        p.ctx
            .try_sheet_name(&name)
            .ok_or_else(|| RunErrorMsg::BadCellReference.with_span(span))
    }
}

/// Matches a single cell reference.
#[derive(Debug, Copy, Clone)]
pub struct CellReference;
impl_display!(for CellReference, "cell reference such as 'A6' or '$ZB$3'");
impl SyntaxRule for CellReference {
    type Output = Spanned<Result<(Option<SheetId>, RefRangeBounds), RefError>>;

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        is_table_ref(p) == Some(false)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let start_span = p.peek_next_span();
        let opt_sheet_id = p.try_parse(SheetRefPrefix).transpose()?;

        p.next();

        let span = Span::merge(start_span, p.span());

        let inner = match RefRangeBounds::from_str(p.token_str(), Some(p.pos.into())) {
            Ok(ref_range_bounds) => Ok((opt_sheet_id, ref_range_bounds)),
            Err(A1Error::OutOfBounds(ref_error)) => Err(ref_error),
            Err(_) => return Err(RunErrorMsg::BadCellReference.with_span(span)),
        };

        Ok(Spanned { span, inner })
    }
}

/// Matches a single cell reference or a cell range reference on its own, not as
/// part of an expression.
#[derive(Debug, Copy, Clone)]
pub struct CellRangeReference;
impl_display!(for CellRangeReference, "cell range reference such as 'A6:D10' or '$ZB$3'");
impl SyntaxRule for CellRangeReference {
    type Output = Spanned<Result<SheetCellRefRange, RefError>>;

    #[inline]
    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        CellReference.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let ref1 = p.parse(CellReference)?;
        let (sheet1, range1) = match ref1.inner {
            Ok(x) => x,
            Err(e) => {
                return Ok(Spanned {
                    span: ref1.span,
                    inner: Err(e),
                });
            }
        };
        let sheet_id = sheet1.unwrap_or(p.pos.sheet_id);

        // Check for a range reference.
        let span;
        let range;
        if p.try_parse(Token::CellRangeOp).is_some() {
            let ref2 = p.parse(CellReference)?;
            let (sheet2, range2) = match ref2.inner {
                Ok(x) => x,
                Err(e) => {
                    return Ok(Spanned {
                        span: ref2.span,
                        inner: Err(e),
                    });
                }
            };
            if sheet2.is_some() {
                return Err(RunErrorMsg::BadCellReference.with_span(ref2.span));
            }

            span = Span::merge(ref1.span, ref2.span);
            range = RefRangeBounds {
                start: range1.start,
                end: range2.end,
            };
        } else {
            span = ref1.span;
            range = range1;
        }

        Ok(Spanned {
            span,
            inner: Ok(SheetCellRefRange {
                sheet_id,
                cells: CellRefRange::Sheet { range },
                explicit_sheet_name: sheet1.is_some(),
            }),
        })
    }
}

#[derive(Debug, Copy, Clone)]
pub struct BoolExpression;
impl_display!(for BoolExpression, "boolean such as 'TRUE' or 'FALSE'");
impl SyntaxRule for BoolExpression {
    type Output = AstNode;

    #[inline]
    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        matches!(p.next(), Some(Token::False | Token::True))
    }

    #[inline]
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

#[derive(Debug, Copy, Clone)]
pub struct ErrorExpression;
impl_display!(for ErrorExpression, "error such as '#N/A' or '#REF!'");
impl SyntaxRule for ErrorExpression {
    type Output = AstNode;

    #[inline]
    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        matches!(p.next(), Some(Token::Error))
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let e = match p.next() {
            Some(Token::Error) => match p.token_str() {
                "#DIV/0!" => RunErrorMsg::DivideByZero,
                "#N/A" => RunErrorMsg::NotAvailable,
                "#NAME?" => RunErrorMsg::Name,
                "#NULL!" => RunErrorMsg::Null,
                "#NUM!" => RunErrorMsg::Num,
                "#REF!" => RunErrorMsg::BadCellReference,
                "#VALUE!" => RunErrorMsg::Value,
                other => RunErrorMsg::InternalError(format!("unknown error {other}").into()),
            },
            _ => p.expected(self)?,
        };
        Ok(AstNode {
            span: p.span(),
            inner: ast::AstNodeContents::Error(e),
        })
    }
}
