use super::*;

/// Rule that matches the same tokens but applies some function to the
/// result.
#[derive(Copy, Clone)]
pub struct TokenMapper<R, F> {
    /// Inner syntax rule.
    pub inner: R,
    /// Function to apply to the result.
    pub f: F,
}
impl<R: fmt::Debug, F> fmt::Debug for TokenMapper<R, F> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TokenMapper")
            .field("inner", &self.inner)
            .finish()
    }
}
impl<R: fmt::Display, F> fmt::Display for TokenMapper<R, F> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}
impl<B, R: SyntaxRule, F: Fn(R::Output) -> B> SyntaxRule for TokenMapper<R, F> {
    type Output = B;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        self.inner.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        self.inner.consume_match(p).map(&self.f)
    }
}

/// Rule that matches tokens by certain symbols, such as
/// parentheses or brackets.
#[derive(Debug, Copy, Clone)]
pub struct Surround<R> {
    /// Inner syntax rule.
    inner: R,

    /// Symbol at start (e.g., left paren).
    start: Token,
    /// Symbol at end (e.g., right paren).
    end: Token,
}
impl<R> Surround<R> {
    /// Wraps the rule in parentheses.
    pub fn paren(inner: R) -> Self {
        Self {
            inner,

            start: Token::LParen,
            end: Token::RParen,
        }
    }
}
impl<R: fmt::Display> fmt::Display for Surround<R> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}, surrounded by {} and {}",
            self.inner, self.start, self.end,
        )
    }
}
impl<R: Copy + SyntaxRule> SyntaxRule for Surround<R> {
    type Output = Spanned<R::Output>;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        self.start.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let span1 = p.peek_next_span();

        p.parse(self.start)?;
        let ret = p.parse(self.inner)?;
        p.parse(self.end)?;

        let span2 = p.span();
        let span = Span::merge(span1, span2);
        Ok(Spanned { span, inner: ret })
    }
}

/// Rule that matches a list of things surrounded by a symbol pair,
/// such as a comma-separated list enclosed in parentheses.
#[derive(Debug, Copy, Clone)]
pub struct List<R> {
    /// Syntax rule for each element of the list.
    pub(super) inner: R,

    /// Separator (e.g., comma).
    pub(super) sep: Token,
    /// Symbol at start (e.g., left paren).
    pub(super) start: Token,
    /// Symbol at end (e.g., right paren).
    pub(super) end: Token,

    /// User-friendly name for separator.
    pub(super) sep_name: &'static str,
    /// Whether to allow a trailing separator.
    pub(super) allow_trailing_sep: bool,
}
impl<R: fmt::Display> fmt::Display for List<R> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}-separated list of {}, surrounded by {} and {}",
            self.sep_name, self.inner, self.start, self.end,
        )
    }
}
impl<R: Copy + SyntaxRule> SyntaxRule for List<R> {
    type Output = Spanned<Vec<R::Output>>;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        self.start.prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        let span1 = p.peek_next_span();

        let mut items = vec![];
        p.parse(self.start)?;
        loop {
            let result = if self.allow_trailing_sep || items.is_empty() {
                // End the list or consume an item.
                parse_one_of!(p, [self.end.map(|_| None), self.inner.map(Some)])?
            } else {
                // Consume an item.
                parse_one_of!(p, [self.inner.map(Some)])?
            };
            match result {
                Some(item) => items.push(item), // There is an item.
                None => break,                  // End of list; empty list, or trailing separator.
            }
            // End the list or consume a separator.
            match parse_one_of!(p, [self.end.map(|_| None), self.sep.map(Some)])? {
                Some(_) => continue, // There is a separator.
                None => break,       // End of list, no trailing separator.
            }
        }

        let span2 = p.span();
        let span = Span::merge(span1, span2);
        Ok(Spanned { span, inner: items })
    }
}

/// Rule that matches no tokens; always succeeds (useful as a fallback when
/// matching multiple possible rules).
#[derive(Debug, Copy, Clone)]
pub struct Epsilon;
impl_display!(for Epsilon, "nothing");
impl SyntaxRule for Epsilon {
    type Output = ();

    fn prefix_matches(&self, _p: Parser<'_>) -> bool {
        true
    }
    fn consume_match(&self, _p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        Ok(())
    }
}

/// Rule that matches end of file and consumes no tokens.
#[derive(Debug, Copy, Clone)]
pub struct EndOfFile;
impl_display!(for EndOfFile, "end of file");
impl SyntaxRule for EndOfFile {
    type Output = ();

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next().is_none()
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        match p.next() {
            Some(_) => Ok(()),
            None => p.expected(self),
        }
    }
}
