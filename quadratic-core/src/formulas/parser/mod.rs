//! Parser that turns a flat list of tokens directly into an AST.

use std::ops::Range;

use itertools::Itertools;

#[macro_use]
mod macros;
pub mod rules;

use lexer::Token;
use rules::SyntaxRule;

use super::*;
use crate::{grid::Grid, CodeResult, Pos, RunError, RunErrorMsg, Span, Spanned};

pub fn parse_formula(source: &str, pos: Pos) -> CodeResult<ast::Formula> {
    Ok(Formula {
        ast: parse_exactly_one(source, pos, rules::Expression)?,
    })
}

fn parse_exactly_one<R: SyntaxRule>(source: &str, pos: Pos, rule: R) -> CodeResult<R::Output> {
    let tokens = lexer::tokenize(source).collect_vec();
    let mut p = Parser::new(source, &tokens, pos);
    p.parse(rule).and_then(|output| p.ok_if_not_eof(output))
}

pub fn find_cell_references(source: &str, pos: Pos) -> Vec<Spanned<RangeRef>> {
    let mut ret = vec![];

    let tokens = lexer::tokenize(source)
        .filter(|t| !t.inner.is_skip())
        .collect_vec();
    let mut p = Parser::new(source, &tokens, pos);

    while !p.is_done() {
        if let Some(Ok(cell_ref)) = p.try_parse(rules::CellRangeReference) {
            ret.push(cell_ref);
        } else {
            p.next();
        }
    }

    ret
}

/// Parses and checks whether the formula has the correct arguments (which has
/// to run eval with `only_parse = true`).
pub fn parse_and_check_formula(formula_string: &str, x: i64, y: i64) -> bool {
    // We are not running any calculations, so an empty Grid are fine for
    // purposes of evaluating the formula for correctness. (Especially since we
    // do not have the actual Grid when running this formula in RustClient.)
    let pos = (x, y).into();
    match parse_formula(formula_string, pos) {
        Ok(parsed) => {
            let grid = Grid::new();
            let sheet_id = grid.sheet_ids()[0];
            let mut ctx = Ctx::new(&grid, pos.to_sheet_pos(sheet_id));
            parsed.check_syntax(&mut ctx).is_ok()
        }
        Err(_) => false,
    }
}

/// Replace internal cell references in a formula with A1 notation.
///
/// # Example
/// ```rust
/// use quadratic_core::{formulas::replace_internal_cell_references, Pos};
///
/// let pos = Pos { x: 0, y: 0 };
/// let replaced = replace_internal_cell_references("SUM(R[0]C[-1])", pos);
/// assert_eq!(replaced, "SUM(nA0)");
/// ```
pub fn replace_internal_cell_references(source: &str, pos: Pos) -> String {
    let replace_fn = |cell_ref: RangeRef| cell_ref.a1_string(pos);
    replace_cell_references(source, pos, &replace_fn)
}

/// Replace A1 notation in a formula with internal cell references.
///
/// # Example
/// ```rust
/// use quadratic_core::{formulas::replace_a1_notation, Pos};
///
/// let pos = Pos { x: 0, y: 0 };
/// let replaced = replace_a1_notation("SUM(nA0)", pos);
/// assert_eq!(replaced, "SUM(R[0]C[-1])");
/// ```
pub fn replace_a1_notation(source: &str, pos: Pos) -> String {
    let replace_fn = |cell_ref: RangeRef| cell_ref.to_string();
    replace_cell_references(source, pos, &replace_fn)
}

fn replace_cell_references(
    source: &str,
    pos: Pos,
    replace_fn: &dyn Fn(RangeRef) -> String,
) -> String {
    let spans = find_cell_references(source, pos);
    let mut replaced = source.to_string();

    // replace in reverse order to preserve previous span references
    spans
        .into_iter()
        .rev()
        .for_each(|spanned: Spanned<RangeRef>| {
            let Spanned { span, inner } = spanned;
            let cell = replace_fn(inner);
            replaced.replace_range::<Range<usize>>(span.into(), &cell);
        });

    replaced
}

/// Token parser used to assemble an AST.
#[derive(Debug, Copy, Clone)]
pub struct Parser<'a> {
    /// Source string.
    source_str: &'a str,
    /// Tokens to feed.
    tokens: &'a [Spanned<Token>],
    /// Index of the "current" token (None = before start).
    pub cursor: Option<usize>,

    /// Coordinates of the cell where this formula was entered.
    pub pos: Pos,
}
impl<'a> Parser<'a> {
    /// Constructs a parser for a file.
    pub fn new(source_str: &'a str, tokens: &'a [Spanned<Token>], pos: Pos) -> Self {
        let mut ret = Self {
            source_str,
            tokens,
            cursor: None,

            pos,
        };

        // Skip leading `=`
        ret.next();
        if ret.token_str() != "=" {
            // Oops, no leading `=` so go back
            ret.cursor = None;
        }
        ret
    }

    /// Returns the token at the cursor.
    pub fn current(self) -> Option<Token> {
        Some(self.tokens.get(self.cursor?)?.inner)
    }
    /// Returns the span of the current token. If there is no current token,
    /// returns an empty span at the beginning or end of the input appropriately.
    pub fn span(&self) -> Span {
        if let Some(idx) = self.cursor {
            if let Some(token) = self.tokens.get(idx) {
                // This is a token in the middle of the region.
                token.span
            } else {
                // This is the end of the region; return an empty span at the
                // end of the region.
                Span::empty(self.source_str.len() as u32)
            }
        } else {
            // This is the beginning of the region; return an empty span at the
            // beginning of the region.
            Span::empty(0)
        }
    }
    /// Returns the source string of the current token. If there is no current
    /// token, returns an empty string.
    pub fn token_str(&self) -> &'a str {
        let Span { start, end } = self.span();
        &self.source_str[start as usize..end as usize]
    }

    /// Moves the cursor forward without skipping whitespace/comments and then
    /// returns the token at the cursor.
    pub fn next_noskip(&mut self) -> Option<Token> {
        // Add 1 or set to zero.
        self.cursor = Some(self.cursor.map(|idx| idx + 1).unwrap_or(0));
        self.current()
    }
    /// Moves the cursor back without skipping whitespace/comments and then
    /// returns the token at the cursor.
    pub fn prev_noskip(&mut self) -> Option<Token> {
        // Subtract 1 if possible.
        self.cursor = self.cursor.and_then(|idx| idx.checked_sub(1));
        self.current()
    }
    /// Returns whether the current token would normally be skipped.
    pub fn is_skip(self) -> bool {
        if let Some(t) = self.current() {
            t.is_skip()
        } else {
            false
        }
    }
    /// Returns whether the end of the input has been reached.
    pub fn is_done(self) -> bool {
        self.cursor.is_some() && self.current().is_none()
    }

    /// Moves the cursor forward and then returns the token at the cursor.
    pub fn next(&mut self) -> Option<Token> {
        loop {
            self.next_noskip();
            if !self.is_skip() {
                return self.current();
            }
        }
    }
    /// Moves the cursor back and then returns the token at the cursor.
    pub fn prev(&mut self) -> Option<Token> {
        loop {
            self.prev_noskip();
            if !self.is_skip() {
                return self.current();
            }
        }
    }

    /// Returns the token after the one at the cursor, without mutably moving
    /// the cursor.
    pub fn peek_next(self) -> Option<Token> {
        let mut tmp = self;
        tmp.next()
    }

    /// Returns the span of the token after the one at the cursor, without
    /// mutably moving the cursor.
    pub fn peek_next_span(self) -> Span {
        let mut tmp = self;
        tmp.next();
        tmp.span()
    }

    /// Attempts to apply a syntax rule starting at the cursor, returning an
    /// error if it fails. This should only be used when this syntax rule
    /// represents the only valid parse; if there are other options,
    /// `try_parse()` is preferred.
    pub fn parse<R: SyntaxRule>(&mut self, rule: R) -> CodeResult<R::Output> {
        self.try_parse(&rule).unwrap_or_else(|| self.expected(rule))
    }
    /// Applies a syntax rule starting at the cursor, returning `None` if the
    /// syntax rule definitely doesn't match (i.e., its `might_match()`
    /// implementation returned false).
    pub fn try_parse<R: SyntaxRule>(&mut self, rule: R) -> Option<CodeResult<R::Output>> {
        rule.prefix_matches(*self).then(|| {
            let old_state = *self; // Save state.
            let ret = rule.consume_match(self);
            if ret.is_err() {
                // Restore prior state on failure.
                *self = old_state;
            }
            ret
        })
    }

    /// Returns an error describing that `expected` was expected.
    pub fn expected<T>(self, expected: impl ToString) -> CodeResult<T> {
        // TODO: when #[feature(never_type)] stabalizes, use that here and
        // return CodeResult<!>.
        Err(self.expected_err(expected))
    }
    /// Returns an error describing that EOF was expected.
    pub fn ok_if_not_eof<T>(mut self, or_else: T) -> CodeResult<T> {
        if let Some(tok) = self.next() {
            Err(RunErrorMsg::Unexpected(tok.to_string().into()).with_span(self.span()))
        } else {
            Ok(or_else)
        }
    }
    /// Returns an error describing that `expected` was expected.
    pub fn expected_err(mut self, expected: impl ToString) -> RunError {
        self.next();
        RunErrorMsg::Expected {
            expected: expected.to_string().into(),
            got: None,
        }
        .with_span(self.span())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replace_internal_cell_references() {
        let src = "SUM(R[0]C[-1])
        + SUM(R[-1]C[0])";
        let expected = "SUM(nA0)
        + SUM(An1)";

        let replaced = replace_internal_cell_references(src, (0, 0).into());
        assert_eq!(replaced, expected);
    }

    #[test]
    fn test_replace_a1_notation() {
        let src = "SUM(nA0)
        + SUM(An1)";
        let expected = "SUM(R[0]C[-1])
        + SUM(R[-1]C[0])";

        let replaced = replace_a1_notation(src, (0, 0).into());
        assert_eq!(replaced, expected);
    }

    #[test]
    fn check_formula() {
        assert!(parse_and_check_formula("SUM(10)", 0, 0));
        assert!(!parse_and_check_formula("SUM()", 0, 0));
        assert!(!parse_and_check_formula("SUM(", 0, 0));
        assert!(!parse_and_check_formula("NOT_A_FUNCTION()", 0, 0));
        assert!(parse_and_check_formula("SUM(10, 20, 30)", 0, 0));
        assert!(parse_and_check_formula("SUM(A1, A2, A3, A4)", 0, 0));
    }
}
