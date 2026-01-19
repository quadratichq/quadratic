use std::{iter::Peekable, str::Chars};

use itertools::PeekingNext;

use crate::{CodeResultExt, TableRef, a1::ColRange};

use super::*;

/// Returns `Some(true)` if this matches the start of a table reference,
/// `Some(false)` if this matches the start of a cell reference, or `None` if it
/// matches neither.
///
/// This includes the sheet prefix, if present.
pub(super) fn is_table_ref(mut p: Parser<'_>) -> Option<bool> {
    loop {
        match p.next()? {
            Token::CellOrTableRef => return Some(p.ctx.has_table(p.token_str())),
            Token::InternalCellRef => return Some(false),
            // Skip sheet prefix and continue checking
            Token::UnquotedSheetReference => continue,
            Token::StringLiteral if p.next()? == Token::SheetRefOp => continue,
            _ => return None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum TableRefToken {
    Column(String),
    Special(String),
    Comma,
    Colon,
}

fn parse_segment_contents(chars: &mut Peekable<Chars<'_>>) -> Result<TableRefToken, RunErrorMsg> {
    let mut ret = String::new();
    let is_special = chars.peek() == Some(&'#');
    while let Some(c) = chars.peeking_next(|c| !matches!(c, '[' | ']')) {
        if !is_special && c == '\'' {
            // escaped char
            ret.push(chars.next().ok_or(RunErrorMsg::BadCellReference)?);
        } else {
            // normal char
            ret.push(c);
        }
    }
    Ok(match is_special {
        true => TableRefToken::Special(ret),
        false => TableRefToken::Column(ret),
    })
}

fn parse_token(chars: &mut Peekable<Chars<'_>>) -> Option<Result<TableRefToken, RunErrorMsg>> {
    match chars.find(|c| !c.is_whitespace()) {
        None => None,
        Some(',') => Some(Ok(TableRefToken::Comma)),
        Some(':') => Some(Ok(TableRefToken::Colon)),
        Some('[') => {
            let ret = parse_segment_contents(chars);
            if chars.next() == Some(']') {
                Some(ret)
            } else {
                Some(Err(RunErrorMsg::BadCellReference))
            }
        }
        _ => Some(Err(RunErrorMsg::BadCellReference)),
    }
}

/// Matches a single table reference.
#[derive(Debug, Copy, Clone)]
pub struct TableReference;
impl_display!(for TableReference, "table reference such as 'MyTable[Column Name]'");
impl SyntaxRule for TableReference {
    type Output = Spanned<TableRef>;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        is_table_ref(p) == Some(true)
    }

    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let start_span = p.peek_next_span();

        // Sheet name is allowed but ignored for table references.
        // Table names are unique across the whole file.
        let _sheet_name = p.try_parse(SheetRefPrefix).transpose()?;

        p.next();

        let table_name = p.token_str();

        if !p.ctx.has_table(table_name) {
            return Err(RunErrorMsg::BadCellReference.with_span(p.span()));
        }

        let end_span;
        match p.try_parse(Token::TableRefBracketsExpression) {
            None => {
                end_span = p.span();
                Ok(TableRef::new(table_name))
            }
            Some(result) => {
                end_span = p.span();
                result?;
                let brackets_str = p.token_str();
                // IIFE to mimic try_block
                (|| {
                    let brackets_inner_str = brackets_str
                        .strip_prefix('[')
                        .ok_or(RunErrorMsg::BadCellReference)?
                        .strip_suffix(']')
                        .ok_or(RunErrorMsg::BadCellReference)?
                        .trim();

                    let mut data = false;
                    let mut headers = false;
                    let mut totals = false;
                    let mut col_range = None;

                    let mut chars = brackets_inner_str.chars().peekable();
                    let mut special_segments = vec![];
                    if brackets_inner_str.starts_with('[') {
                        let mut tokens = std::iter::from_fn(|| parse_token(&mut chars)).peekable();
                        while let Some(token) = tokens.next() {
                            match token? {
                                TableRefToken::Column(start_col) => {
                                    if col_range.is_some() {
                                        return Err(RunErrorMsg::BadCellReference);
                                    }
                                    if tokens.next_if_eq(&Ok(TableRefToken::Colon)).is_some() {
                                        match tokens
                                            .next_if(|t| matches!(t, Ok(TableRefToken::Column(_))))
                                        {
                                            Some(Ok(TableRefToken::Column(end_col))) => {
                                                col_range = Some(ColRange::ColRange(
                                                    start_col,
                                                    end_col.clone(),
                                                ));
                                            }
                                            _ => col_range = Some(ColRange::ColToEnd(start_col)),
                                        }
                                    } else {
                                        col_range = Some(ColRange::Col(start_col));
                                    }
                                }
                                TableRefToken::Special(s) => special_segments.push(s),
                                TableRefToken::Comma | TableRefToken::Colon => {
                                    return Err(RunErrorMsg::BadCellReference);
                                }
                            }
                            if tokens.next().is_some_and(|t| t != Ok(TableRefToken::Comma)) {
                                return Err(RunErrorMsg::BadCellReference);
                            }
                        }
                    } else {
                        // single segment
                        match parse_segment_contents(&mut chars)? {
                            TableRefToken::Column(c) => col_range = Some(ColRange::Col(c)),
                            TableRefToken::Special(s) => special_segments.push(s),
                            TableRefToken::Comma | TableRefToken::Colon => {
                                return Err(RunErrorMsg::BadCellReference);
                            }
                        }
                    }

                    for s in special_segments {
                        match s.to_ascii_lowercase().as_str() {
                            "#data" => data = true,
                            "#headers" => headers = true,
                            "#totals" => {
                                totals = true;
                            }
                            "#all" => {
                                data = true;
                                headers = true;
                            }
                            _ => return Err(RunErrorMsg::BadCellReference),
                        }
                    }

                    Ok(TableRef {
                        table_name: table_name.to_owned(),
                        data: data || (!headers && !totals),
                        headers,
                        totals,
                        col_range: col_range.unwrap_or(ColRange::All),
                    })
                })()
            }
        }
        .with_span(Span::merge(start_span, end_span))
    }
}

/// Matches a table reference and includes the sheet ID in the output.
#[derive(Debug, Copy, Clone)]
pub struct SheetTableReference;
impl_display!(for SheetTableReference, "table reference such as 'MyTable' or 'MyTable[ColumnName]'");
impl SyntaxRule for SheetTableReference {
    type Output = Spanned<SheetCellRefRange>;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        TableReference.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let spanned = p.parse(TableReference)?;
        spanned.try_map(|table_ref| {
            Ok(SheetCellRefRange {
                sheet_id: p
                    .ctx
                    .try_table(&table_ref.table_name)
                    .ok_or(RunErrorMsg::BadCellReference)?
                    .sheet_id,
                cells: CellRefRange::Table { range: table_ref },
                explicit_sheet_name: false,
            })
        })
    }
}
