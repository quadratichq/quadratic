//! Structs for tracking locations and substrings within strings.

use serde::{Deserialize, Serialize};
use std::borrow::{Borrow, BorrowMut};
use std::fmt;

/// A contiguous span of text from one byte index to another in a &str.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq)]
pub struct Span {
    /// The byte index of the first character.
    pub start: usize,
    /// The byte index after the last character.
    pub end: usize,
}
impl Span {
    /// Returns a 0-length span at the given index.
    pub fn empty(idx: usize) -> Self {
        Self {
            start: idx,
            end: idx,
        }
    }
    /// Returns the smallest contiguous span encompassing the two given spans.
    pub fn merge<T: Into<Span>, U: Into<Span>>(span1: T, span2: U) -> Self {
        let span1: Span = span1.into();
        let span2: Span = span2.into();
        Self {
            start: std::cmp::min(span1.start, span2.start),
            end: std::cmp::max(span1.end, span2.end),
        }
    }
    /// Returns the substring with this span from a string.
    pub fn of_str(self, s: &str) -> &str {
        &s[self.start..self.end]
    }
}
impl<T> From<Spanned<T>> for Span {
    fn from(spanned: Spanned<T>) -> Self {
        spanned.span
    }
}
impl<T> From<&Spanned<T>> for Span {
    fn from(spanned: &Spanned<T>) -> Self {
        spanned.span
    }
}

/// Any data with an associated span.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq)]
pub struct Spanned<T> {
    /// The span.
    pub span: Span,
    /// The data.
    pub inner: T,
}
impl<T> Borrow<T> for Spanned<T> {
    fn borrow(&self) -> &T {
        &self.inner
    }
}
impl<T> BorrowMut<T> for Spanned<T> {
    fn borrow_mut(&mut self) -> &mut T {
        &mut self.inner
    }
}
impl<T: fmt::Display> fmt::Display for Spanned<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}
impl<T> Spanned<T> {
    /// Constructs a Spanned<T> spanning the given byte indices.
    pub fn new(start: usize, end: usize, inner: T) -> Self {
        Self {
            span: Span { start, end },
            inner,
        }
    }
    /// Apply a function to the inside of this Spanned<T>.
    pub fn map<U>(self, f: impl FnOnce(T) -> U) -> Spanned<U> {
        Spanned {
            span: self.span,
            inner: f(self.inner),
        }
    }
}
