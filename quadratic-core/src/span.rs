//! Structs for tracking locations and substrings within strings.

use std::borrow::{Borrow, BorrowMut};
use std::fmt;
use std::ops::Range;

use serde::{Deserialize, Serialize};

use crate::CodeResultExt;

/// A contiguous span of text from one byte index to another in a formula.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Span {
    /// The byte index of the first character.
    pub start: u32,
    /// The byte index after the last character.
    pub end: u32,
}
impl Span {
    /// Returns a 0-length span at the given index.
    pub fn empty(idx: u32) -> Self {
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
        let range: Range<usize> = self.into();
        &s[range]
    }
    /// Returns the line number of the start of the span
    pub fn line_number_of_str(self, s: &str) -> usize {
        let start = self.start as usize;
        // Use s.get() to safely handle out-of-bounds or non-UTF-8-boundary indices
        s.get(..start)
            .map(|slice| slice.matches('\n').count() + 1)
            .unwrap_or_else(|| {
                // Show a truncated preview of the string for debugging
                let preview: String = s.chars().take(100).collect();
                let suffix = if s.len() > 100 { "..." } else { "" };
                dbgjs!(format!(
                    "Invalid span start {} for string of length {}: {:?}{}",
                    start,
                    s.len(),
                    preview,
                    suffix
                ));
                1
            })
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
impl From<&Span> for Span {
    fn from(span: &Span) -> Self {
        *span
    }
}
impl From<[u32; 2]> for Span {
    fn from(span: [u32; 2]) -> Self {
        Self {
            start: span[0],
            end: span[1],
        }
    }
}
impl From<Span> for Range<usize> {
    fn from(val: Span) -> Self {
        let Span { start, end } = val;
        start as usize..end as usize
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
    pub fn new(start: u32, end: u32, inner: T) -> Self {
        Self {
            span: Span { start, end },
            inner,
        }
    }
    /// Applies a function to the inside of a `Spanned<T>`.
    pub fn map<U>(self, f: impl FnOnce(T) -> U) -> Spanned<U> {
        Spanned {
            span: self.span,
            inner: f(self.inner),
        }
    }
    /// Applies a function to the inside of a `Spanned<T>` and returns the error
    /// if it fails.
    pub fn try_map<U>(
        self,
        f: impl FnOnce(T) -> Result<U, crate::RunErrorMsg>,
    ) -> Result<Spanned<U>, crate::RunError> {
        let Spanned { span, inner } = self;
        f(inner).with_span(span)
    }
    /// Converts a `&Spanned<T>` to a `Spanned<&T>`.
    pub fn as_ref(&self) -> Spanned<&T> {
        Spanned {
            span: self.span,
            inner: &self.inner,
        }
    }

    /// Merges two spans using `Span::merge()` and merges the inner values using
    /// the provided function.
    pub fn merge<U, V>(a: Spanned<U>, b: Spanned<V>, merge: impl FnOnce(U, V) -> T) -> Spanned<T> {
        Spanned {
            span: Span::merge(a.span, b.span),
            inner: merge(a.inner, b.inner),
        }
    }
}
impl<T, E> Spanned<Result<T, E>> {
    /// Converts a `Spanned<Result<T, E>>` to a `Result<Spanned<T>, E>`, losing
    /// the span information in the error case.
    pub fn transpose(self) -> Result<Spanned<T>, E> {
        let span = self.span;
        match self.inner {
            Ok(inner) => Ok(Spanned { span, inner }),
            Err(e) => Err(e),
        }
    }
}
