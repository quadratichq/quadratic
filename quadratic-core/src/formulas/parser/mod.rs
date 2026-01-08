//! Parser that turns a flat list of tokens directly into an AST.

use std::ops::Range;

use itertools::Itertools;

#[macro_use]
mod macros;
pub mod rules;

use lexer::Token;
use rules::SyntaxRule;

use super::*;
use crate::{
    CodeResult, CoerceInto, RefAdjust, RefError, RunError, RunErrorMsg, SheetPos, Span, Spanned,
    TableRef,
    a1::{A1Context, CellRefRange, RefRangeBounds, SheetCellRefRange},
    controller::GridController,
    grid::SheetId,
};

/// Parses a formula.
pub fn parse_formula(source: &str, ctx: &A1Context, pos: SheetPos) -> CodeResult<ast::Formula> {
    Ok(Formula {
        ast: parse_exactly_one(source, ctx, pos, rules::Expression)?,
    })
}

/// Calls `parse_formula()` with an empty context at position A1.
#[cfg(test)]
pub fn simple_parse_formula(source: &str) -> CodeResult<ast::Formula> {
    let grid_controller = GridController::new();
    let pos = grid_controller.grid().origin_in_first_sheet();
    parse_formula(source, grid_controller.a1_context(), pos)
}

fn parse_exactly_one<R: SyntaxRule>(
    source: &str,
    ctx: &A1Context,
    pos: SheetPos,
    rule: R,
) -> CodeResult<R::Output> {
    let tokens = lexer::tokenize(source).collect_vec();
    let mut p = Parser::new(source, &tokens, ctx, pos);
    p.parse(rule).and_then(|output| p.ok_if_not_eof(output))
}

pub fn find_cell_references(
    source: &str,
    ctx: &A1Context,
    pos: SheetPos,
) -> Vec<Spanned<Result<SheetCellRefRange, RefError>>> {
    let mut ret = vec![];

    let tokens = lexer::tokenize(source)
        .filter(|t| !t.inner.is_skip())
        .collect_vec();

    let mut p = Parser::new(source, &tokens, ctx, pos);

    while !p.is_done() {
        if let Some(Ok(sheet_cell_ref_range)) = p.try_parse(rules::CellRangeReference) {
            ret.push(sheet_cell_ref_range);
        } else if let Some(Ok(sheet_cell_ref_range)) = p.try_parse(rules::SheetTableReference) {
            ret.push(sheet_cell_ref_range.map(Ok));
        } else if rules::SheetRefPrefix.prefix_matches(p) {
            // If we didn't recognize the sheet name,
            // then skip the cell reference entirely.
            _ = rules::SheetRefPrefix.consume_match(&mut p);
            None.or_else(|| p.try_parse(rules::CellRangeReference).map(|_| ()))
                .or_else(|| p.try_parse(rules::SheetTableReference).map(|_| ()));
        } else {
            p.next();
        }
    }

    ret
}

/// Parses and checks whether the formula has the correct arguments, and returns
/// whether it does.
pub fn parse_and_check_formula(formula_string: &str, ctx: &A1Context, pos: SheetPos) -> bool {
    // We are not running any calculations, so an empty Grid is fine for
    // purposes of evaluating the formula for correctness. (Especially since we
    // do not have the actual Grid when running this formula in RustClient.)
    match parse_formula(formula_string, ctx, pos) {
        Ok(parsed) => {
            let grid_controller = GridController::new();
            let mut ctx = Ctx::new_for_syntax_check(&grid_controller);
            parsed.eval(&mut ctx).into_non_error_value().is_ok()
        }
        Err(_) => false,
    }
}

/// Calls `parse_and_check_formula()` with an empty context at position A1.
#[cfg(test)]
fn simple_parse_and_check_formula(formula_string: &str) -> bool {
    parse_and_check_formula(formula_string, &A1Context::test(&[], &[]), SheetPos::test())
}

/// Replace internal cell references in a formula with A1 notation.
///
/// # Example
///
/// ```rust
/// use quadratic_core::{Pos, a1::A1Context, formulas::convert_rc_to_a1, controller::GridController, grid::SheetId};
///
/// let g = GridController::test();
/// let pos = Pos::ORIGIN.to_sheet_pos(g.sheet_ids()[0]);
/// let replaced = convert_rc_to_a1("SUM(R{3}C[1])", &g.a1_context(), pos);
/// assert_eq!(replaced, "SUM(B$3)");
/// ```
#[must_use = "this method returns a new value instead of modifying its input"]
pub fn convert_rc_to_a1(source: &str, ctx: &A1Context, pos: SheetPos) -> String {
    let replace_fn =
        |range_ref: SheetCellRefRange| Ok(range_ref.to_a1_string(Some(pos.sheet_id), ctx));
    replace_cell_range_references(source, ctx, pos, replace_fn)
}

/// Replace A1 notation in a formula with internal cell references (RC
/// notation).
///
/// # Example
///
/// ```rust
/// use quadratic_core::{Pos, a1::A1Context, formulas::convert_a1_to_rc, controller::GridController, grid::SheetId};
///
/// let g = GridController::test();
/// let pos = Pos::ORIGIN.to_sheet_pos(g.sheet_ids()[0]);
/// let replaced = convert_a1_to_rc("SUM(B$3)", g.a1_context(), pos);
/// assert_eq!(replaced, "SUM(R{3}C[1])");
/// ```
#[must_use = "this method returns a new value instead of modifying its input"]
pub fn convert_a1_to_rc(source: &str, ctx: &A1Context, pos: SheetPos) -> String {
    let replace_fn = |range_ref: SheetCellRefRange| {
        Ok(range_ref.to_rc_string(Some(pos.sheet_id), ctx, pos.into()))
    };
    replace_cell_range_references(source, ctx, pos, replace_fn)
}

/// Adjusts all cell references in a formula. If a references is out of bounds
/// after the adjustment, it is replaced with an error.
#[must_use = "this method returns a new value instead of modifying its input"]
pub fn adjust_references(
    source: &str,
    new_default_sheet_id: SheetId,
    ctx: &A1Context,
    pos: SheetPos,
    adjust: RefAdjust,
) -> String {
    replace_cell_range_references(source, ctx, pos, |range_ref| {
        Ok(range_ref
            .adjust(adjust)?
            .to_a1_string(Some(new_default_sheet_id), ctx))
    })
}

#[must_use = "this method returns a new value instead of modifying its input"]
pub fn replace_table_name(
    source: &str,
    ctx: &A1Context,
    pos: SheetPos,
    old_name: &str,
    new_name: &str,
) -> String {
    replace_table_references(source, ctx, pos, |mut table_ref| {
        if table_ref.table_name.eq_ignore_ascii_case(old_name) {
            table_ref.table_name = new_name.to_string();
        }
        Ok(table_ref)
    })
}

#[must_use = "this method returns a new value instead of modifying its input"]
pub fn replace_column_name(
    source: &str,
    ctx: &A1Context,
    pos: SheetPos,
    table_name: &str,
    old_name: &str,
    new_name: &str,
) -> String {
    replace_table_references(source, ctx, pos, |mut table_ref| {
        if table_ref.table_name.eq_ignore_ascii_case(table_name) {
            table_ref.col_range.replace_column_name(old_name, new_name);
        }
        Ok(table_ref)
    })
}

#[must_use = "this method returns a new value instead of modifying its input"]
fn replace_table_references(
    source: &str,
    ctx: &A1Context,
    pos: SheetPos,
    replace_fn: impl Fn(TableRef) -> Result<TableRef, RefError>,
) -> String {
    replace_cell_range_references(source, ctx, pos, |range_ref| {
        Ok(match range_ref.cells {
            CellRefRange::Table { range } => CellRefRange::Table {
                range: replace_fn(range)?,
            },
            other @ CellRefRange::Sheet { .. } => other,
        }
        .to_string())
    })
}

#[must_use = "this method returns a new value instead of modifying its input"]
pub fn replace_sheet_name(
    source: &str,
    pos: SheetPos,
    old_ctx: &A1Context,
    new_ctx: &A1Context,
) -> String {
    replace_cell_range_references(source, old_ctx, pos, |sheet_cell_ref_range| {
        Ok(sheet_cell_ref_range.to_a1_string(Some(pos.sheet_id), new_ctx))
    })
}

#[must_use = "this method returns a new value instead of modifying its input"]
fn replace_cell_range_references(
    source: &str,
    ctx: &A1Context,
    pos: SheetPos,
    replace_fn: impl Fn(SheetCellRefRange) -> Result<String, RefError>,
) -> String {
    let spans = find_cell_references(source, ctx, pos);
    let mut replaced = source.to_string();

    // replace in reverse order to preserve previous span indexes into string
    spans
        .into_iter()
        .rev()
        .for_each(|spanned: Spanned<Result<SheetCellRefRange, RefError>>| {
            let Spanned { span, inner } = spanned;
            let new_str = match inner.and_then(&replace_fn) {
                Ok(new_ref) => new_ref,
                Err(RefError) => RefError.to_string(),
            };
            replaced.replace_range::<Range<usize>>(span.into(), &new_str);
        });

    replaced
}

/// Maximum recursion depth for parsing expressions.
/// This prevents stack overflow on deeply nested formulas.
/// Note: WASM has limited stack size (~1MB in browsers), so this value
/// must be kept low enough to leave headroom for parsing operations.
const MAX_PARSE_DEPTH: u32 = 100;

/// Token parser used to assemble an AST.
#[derive(Debug, Copy, Clone)]
pub struct Parser<'a> {
    /// Source string.
    source_str: &'a str,
    /// Tokens to feed.
    tokens: &'a [Spanned<Token>],
    /// Index of the "current" token (None = before start).
    pub cursor: Option<usize>,

    /// Context about the contents of the sheet.
    pub ctx: &'a A1Context,
    /// Location where this formula was entered.
    pub pos: SheetPos,

    /// Current recursion depth for parsing.
    pub depth: u32,
}
impl<'a> Parser<'a> {
    /// Constructs a parser for a file.
    pub fn new(
        source_str: &'a str,
        tokens: &'a [Spanned<Token>],
        ctx: &'a A1Context,
        pos: SheetPos,
    ) -> Self {
        let mut ret = Self {
            source_str,
            tokens,
            cursor: None,

            ctx,
            pos,
            depth: 0,
        };

        // Skip leading `=`
        ret.next();
        if ret.token_str() != "=" {
            // Oops, no leading `=` so go back
            ret.cursor = None;
        }
        ret
    }

    /// Checks if the recursion depth limit has been exceeded and returns an
    /// error if so.
    pub fn check_depth(&self) -> CodeResult<()> {
        if self.depth >= MAX_PARSE_DEPTH {
            Err(RunErrorMsg::FormulaTooComplex.with_span(self.span()))
        } else {
            Ok(())
        }
    }

    /// Increments the recursion depth, returning an error if the limit is
    /// exceeded.
    pub fn enter_depth(&mut self) -> CodeResult<()> {
        self.depth += 1;
        self.check_depth()
    }

    /// Decrements the recursion depth.
    pub fn exit_depth(&mut self) {
        self.depth = self.depth.saturating_sub(1);
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
    #[allow(clippy::should_implement_trait)]
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
        // TODO: when #[feature(never_type)] stabilizes, use that here and
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
    fn test_convert_rc_to_a1() {
        let ctx = A1Context::test(&[], &[]);
        let pos = SheetPos::test();
        let src = "SUM(R[1]C[2])
        + SUM(R[2]C[4])";
        let expected = "SUM(C2)
        + SUM(E3)";

        let replaced = convert_rc_to_a1(src, &ctx, pos);
        assert_eq!(replaced, expected);
    }

    #[test]
    fn test_convert_a1_to_rc() {
        let ctx = A1Context::test(&[], &[]);
        let pos = SheetPos::test();
        let src = "SUM(A$1)
        + SUM($B3)";
        let expected = "SUM(R{1}C[0])
        + SUM(R[2]C{2})";

        let replaced = convert_a1_to_rc(src, &ctx, pos);
        assert_eq!(expected, replaced);
    }

    #[test]
    fn test_replace_xy_no_shift() {
        let ctx = A1Context::test(&[], &[]);
        let pos = pos![A1].to_sheet_pos(SheetId::new());
        let src: &str = "A1 + 1";
        let adj_base = RefAdjust {
            sheet_id: None,
            relative_only: true,
            dx: 0,
            dy: 0,
            x_start: 0,
            y_start: 0,
        };

        let mut adj = adj_base;
        adj.dy = 1;
        let replaced = adjust_references(src, pos.sheet_id, &ctx, pos, adj);
        let expected = "A2 + 1";
        assert_eq!(replaced, expected);

        let mut adj = adj_base;
        adj.dy = 2;
        let replaced = adjust_references(src, pos.sheet_id, &ctx, pos, adj);
        let expected = "A3 + 1";
        assert_eq!(replaced, expected);

        let mut adj = adj_base;
        adj.dx = 1;
        let replaced = adjust_references(src, pos.sheet_id, &ctx, pos, adj);
        let expected = "B1 + 1";
        assert_eq!(replaced, expected);

        let mut adj = adj_base;
        adj.dx = 1;
        adj.dy = 1;
        let replaced = adjust_references(src, pos.sheet_id, &ctx, pos, adj);
        let expected = "B2 + 1";
        assert_eq!(replaced, expected);
    }

    #[test]
    fn test_replace_xy_shift() {
        let ctx = A1Context::test(&[], &[]);
        let pos = pos![C6].to_sheet_pos(SheetId::new());

        let adj = RefAdjust {
            sheet_id: None,
            relative_only: true,
            dx: -1,
            dy: 3,
            x_start: 2,
            y_start: 0,
        };
        let src = "SUM(A4,B$6, C7)";
        let replaced = adjust_references(src, pos.sheet_id, &ctx, pos, adj);
        let expected = "SUM(A4,A$6, B10)";
        assert_eq!(replaced, expected);

        let adj = RefAdjust {
            sheet_id: None,
            relative_only: true,
            dx: -1,
            dy: 3,
            x_start: 0,
            y_start: 16,
        };
        let src = "SUM(A1, A15, A16, B16)";
        let replaced = adjust_references(src, pos.sheet_id, &ctx, pos, adj);
        let expected = "SUM(A1, A15, #REF!, A19)";
        assert_eq!(replaced, expected);
    }

    #[test]
    fn check_formula() {
        assert!(simple_parse_and_check_formula("SUM(10)"));
        assert!(!simple_parse_and_check_formula("SUM()"));
        assert!(!simple_parse_and_check_formula("SUM("));
        assert!(!simple_parse_and_check_formula("NOT_A_FUNCTION()"));
        assert!(simple_parse_and_check_formula("SUM(10, 20, 30)"));
        assert!(simple_parse_and_check_formula("SUM(A1, A2, A3, A4)"));
    }

    #[test]
    fn test_formula_empty_expressions() {
        assert!(simple_parse_and_check_formula("PI()")); // SUM doesn't like taking zero arguments

        // Empty expressions should work in formula arguments
        assert!(simple_parse_and_check_formula("SUM(,)"));
        assert!(simple_parse_and_check_formula("SUM(,,)"));
        assert!(simple_parse_and_check_formula("SUM(1,,)"));
        assert!(simple_parse_and_check_formula("SUM(,1,)"));
        assert!(simple_parse_and_check_formula("SUM(,,1)"));

        // ... But not in operator arguments
        assert!(!simple_parse_and_check_formula("1*"));
        assert!(!simple_parse_and_check_formula("*1"));
        assert!(!simple_parse_and_check_formula("(1*)*1"));
        assert!(!simple_parse_and_check_formula("(*1)*1"));
    }

    #[test]
    fn test_formula_depth_limit() {
        // A reasonably nested formula should parse fine
        let formula = "((((1 + 2) * 3) / 4) - 5)";
        assert!(simple_parse_formula(formula).is_ok());

        // A deeply nested formula should return FormulaTooComplex error
        // Each level of parentheses adds depth. We need to exceed MAX_PARSE_DEPTH (100)
        // Each paren adds about 10 depth levels (for each precedence level traversal)
        // So we need roughly 100 / 10 = ~10 levels of nesting to trigger the limit
        // Using 15 parens to ensure we exceed the limit
        let deeply_nested = format!("{}1{}", "(".repeat(15), ")".repeat(15));
        let result = simple_parse_formula(&deeply_nested);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.msg, RunErrorMsg::FormulaTooComplex);
    }

    #[test]
    fn test_check_depth_within_limit() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let parser = Parser::new("", &tokens, &ctx, pos);

        // Initially depth is 0, should be well within limit
        assert!(parser.check_depth().is_ok());
    }

    #[test]
    fn test_check_depth_at_limit() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let mut parser = Parser::new("", &tokens, &ctx, pos);

        // Set depth to exactly MAX_PARSE_DEPTH
        parser.depth = MAX_PARSE_DEPTH;

        // Should fail at exactly the limit
        let result = parser.check_depth();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().msg, RunErrorMsg::FormulaTooComplex);
    }

    #[test]
    fn test_check_depth_just_below_limit() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let mut parser = Parser::new("", &tokens, &ctx, pos);

        // Set depth to just below MAX_PARSE_DEPTH
        parser.depth = MAX_PARSE_DEPTH - 1;

        // Should still be OK
        assert!(parser.check_depth().is_ok());
    }

    #[test]
    fn test_enter_depth_increments() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let mut parser = Parser::new("", &tokens, &ctx, pos);

        assert_eq!(parser.depth, 0);

        // Enter depth multiple times
        assert!(parser.enter_depth().is_ok());
        assert_eq!(parser.depth, 1);

        assert!(parser.enter_depth().is_ok());
        assert_eq!(parser.depth, 2);

        assert!(parser.enter_depth().is_ok());
        assert_eq!(parser.depth, 3);
    }

    #[test]
    fn test_enter_depth_fails_at_limit() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let mut parser = Parser::new("", &tokens, &ctx, pos);

        // Set depth just below limit
        parser.depth = MAX_PARSE_DEPTH - 1;

        // This should succeed and bring us to the limit
        let result = parser.enter_depth();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().msg, RunErrorMsg::FormulaTooComplex);
    }

    #[test]
    fn test_exit_depth_decrements() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let mut parser = Parser::new("", &tokens, &ctx, pos);

        parser.depth = 5;

        parser.exit_depth();
        assert_eq!(parser.depth, 4);

        parser.exit_depth();
        assert_eq!(parser.depth, 3);
    }

    #[test]
    fn test_exit_depth_saturates_at_zero() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let mut parser = Parser::new("", &tokens, &ctx, pos);

        assert_eq!(parser.depth, 0);

        // Should not go below zero (saturating_sub)
        parser.exit_depth();
        assert_eq!(parser.depth, 0);

        parser.exit_depth();
        assert_eq!(parser.depth, 0);
    }

    #[test]
    fn test_enter_exit_depth_roundtrip() {
        let g = GridController::new();
        let pos = g.grid().origin_in_first_sheet();
        let tokens = vec![];
        let ctx = A1Context::test(&[], &[]);
        let mut parser = Parser::new("", &tokens, &ctx, pos);

        // Simulate entering and exiting nested scopes
        assert!(parser.enter_depth().is_ok());
        assert!(parser.enter_depth().is_ok());
        assert!(parser.enter_depth().is_ok());
        assert_eq!(parser.depth, 3);

        parser.exit_depth();
        parser.exit_depth();
        assert_eq!(parser.depth, 1);

        parser.exit_depth();
        assert_eq!(parser.depth, 0);
    }
}
