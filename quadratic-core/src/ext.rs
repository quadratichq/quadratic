//! Extension traits

use super::{CodeResult, RunErrorMsg, Span, Spanned};

/// Extension trait for `Result<T, ErrorMsg>` that defines `with_span()`.
pub trait CodeResultExt<T> {
    fn with_span(self, span: impl Into<Span>) -> CodeResult<Spanned<T>>;
}
impl<T> CodeResultExt<T> for Result<T, RunErrorMsg> {
    fn with_span(self, span: impl Into<Span>) -> CodeResult<Spanned<T>> {
        match self {
            Ok(ok) => Ok(Spanned {
                inner: ok,
                span: span.into(),
            }),
            Err(e) => Err(e.with_span(span)),
        }
    }
}

/// Extension trait for all iterators that defines `with_all_same_span()`.
pub trait SpannableIterExt: Sized {
    fn with_all_same_span(self, span: Span) -> SpannedIter<Self>;
}
impl<I: Iterator> SpannableIterExt for I {
    fn with_all_same_span(self, span: Span) -> SpannedIter<I> {
        SpannedIter { iter: self, span }
    }
}
pub struct SpannedIter<I> {
    iter: I,
    span: Span,
}
impl<I: Iterator> Iterator for SpannedIter<I> {
    type Item = Spanned<I::Item>;

    fn next(&mut self) -> Option<Self::Item> {
        let span = self.span;
        self.iter.next().map(|v| Spanned { inner: v, span })
    }
}

/// Extension trait for iterators over `Spanned<T>` that defines
/// `without_spans()`.
pub trait SpannedIterExt: Sized {
    type In;
    type Out;

    #[allow(clippy::type_complexity)]
    fn without_spans(self) -> std::iter::Map<Self, fn(Self::In) -> Self::Out>;
}
impl<I, T> SpannedIterExt for I
where
    I: Iterator<Item = T>,
    T: Unspan,
{
    type In = T;
    type Out = T::Unspanned;

    fn without_spans(self) -> std::iter::Map<Self, fn(T) -> T::Unspanned> {
        self.map(Unspan::without_span)
    }
}

/// Utility trait for implementing `SpannedIterExt`.
pub trait Unspan {
    type Unspanned;

    fn without_span(self) -> Self::Unspanned;
}
impl<T> Unspan for Spanned<T> {
    type Unspanned = T;

    fn without_span(self) -> Self::Unspanned {
        self.inner
    }
}
impl<T, E> Unspan for Result<Spanned<T>, E> {
    type Unspanned = Result<T, E>;

    fn without_span(self) -> Self::Unspanned {
        self.map(|v| v.inner)
    }
}
