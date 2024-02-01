use std::fmt;

mod atoms;
mod combinators;
mod expression;

pub use atoms::*;
pub use combinators::*;
pub use expression::*;

use super::*;
use crate::{CodeResult, RunErrorMsg, Span, Spanned};

/// A grammar rule that produces an AST node from tokens.
pub trait SyntaxRule: fmt::Debug + fmt::Display {
    /// AST node type that this rule outputs.
    type Output;

    /// Returns whether if it appears that the user is trying to form this
    /// construct (generally returns true if the first token matches). If
    /// `consume_match()` returns `Ok`, this function MUST return true.
    fn prefix_matches(&self, p: Parser<'_>) -> bool;
    /// Consumes the tokens that are part of this syntax structure, returning
    /// the AST node produced. Does NOT restore the `Parser` if matching fails.
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output>;

    /// Applies a function to the output of this syntax rule.
    fn map<B, F: Fn(Self::Output) -> B>(self, f: F) -> TokenMapper<Self, F>
    where
        Self: Sized,
    {
        TokenMapper { inner: self, f }
    }
}

impl<O, T: SyntaxRule<Output = O> + ?Sized> SyntaxRule for Box<T> {
    type Output = O;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        self.as_ref().prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        self.as_ref().consume_match(p)
    }
}

// Any `Token` is a `SyntaxRule` that matches only itself.
impl SyntaxRule for Token {
    type Output = ();

    fn prefix_matches(&self, mut p: Parser<'_>) -> bool {
        p.next() == Some(*self)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        if p.next() == Some(*self) {
            Ok(())
        } else {
            p.expected(self)
        }
    }
}
impl<T: SyntaxRule> SyntaxRule for &T {
    type Output = T::Output;

    fn prefix_matches(&self, p: Parser<'_>) -> bool {
        (*self).prefix_matches(p)
    }
    fn consume_match(&self, p: &mut Parser<'_>) -> CodeResult<Self::Output> {
        (*self).consume_match(p)
    }
}
