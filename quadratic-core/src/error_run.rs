//! RunError reporting functionality for code cell errors.
//!
//! Use CoreError for runtime errors outside of code (eg, Python, Formulas).

use std::borrow::Cow;
use std::fmt;
use ts_rs::TS;

use serde::{Deserialize, Serialize};

use crate::{ArraySize, Axis, Span, Spanned, Value, a1::A1Error};

/// Result of a [`crate::RunError`].
pub type CodeResult<T = Spanned<Value>> = Result<T, RunError>;

/// Error message and accompanying span.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct RunError {
    /// Location of the source code where the error occurred (if any).
    pub span: Option<Span>,
    /// Type of error.
    pub msg: RunErrorMsg,
}
impl fmt::Display for RunError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.span {
            Some(span) => write!(f, "column {} to {}: {}", span.start, span.end, self.msg),
            None => write!(f, "{}", self.msg),
        }
    }
}
impl std::error::Error for RunError {}
impl RunError {
    /// Attaches a span to this Error, if it does not already have one.
    pub fn with_span(mut self, span: impl Into<Span>) -> Self {
        if self.span.is_none() {
            self.span = Some(span.into());
        }
        self
    }
}

/// Information about the type of error that occurred.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS, Hash)]
pub enum RunErrorMsg {
    CodeRunError(Cow<'static, str>),

    Spill,

    // Miscellaneous errors
    Unimplemented(Cow<'static, str>),
    UnknownError,
    InternalError(Cow<'static, str>),

    // Compile errors
    Unterminated(Cow<'static, str>),
    Expected {
        expected: Cow<'static, str>,
        got: Option<Cow<'static, str>>,
    },
    Unexpected(Cow<'static, str>),
    TooManyArguments {
        func_name: Cow<'static, str>,
        max_arg_count: usize,
    },
    MissingRequiredArgument {
        func_name: Cow<'static, str>,
        arg_name: Cow<'static, str>,
    },
    BadFunctionName,
    BadCellReference,
    BadNumber,
    BadOp {
        op: Cow<'static, str>,
        ty1: Cow<'static, str>,
        ty2: Option<Cow<'static, str>>,
        use_duration_instead: bool,
    },

    // Array size errors
    ExactArraySizeMismatch {
        expected: ArraySize,
        got: ArraySize,
    },
    ExactArrayAxisMismatch {
        axis: Axis,
        expected: u32,
        got: u32,
    },
    ArrayAxisMismatch {
        axis: Axis,
        expected: u32,
        got: u32,
    },
    EmptyArray,
    NonRectangularArray,
    NonLinearArray,
    ArrayTooBig,

    // Excel errors not otherwise covered
    NotAvailable,
    Name,
    Null,
    Num,
    Value,

    // Runtime errors
    CircularReference,
    Overflow,
    DivideByZero,
    NegativeExponent,
    /// NaN or ±Infinity
    NaN,
    IndexOutOfBounds,
    NoMatch,
    InvalidArgument,

    NotANumber,
    Infinity,
}

impl fmt::Display for RunErrorMsg {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CodeRunError(s) => {
                write!(f, "{s}")
            }
            Self::Spill => {
                write!(f, "Spill error")
            }
            Self::Unimplemented(_) => {
                write!(f, "#UNSUPPORTED")
            }
            Self::UnknownError => {
                write!(f, "(unknown error)")
            }
            Self::InternalError(s) => {
                write!(
                    f,
                    "Internal error: {s}\nThis is a bug in Quadratic, not your formula. Please report this to us!"
                )
            }

            Self::Unterminated(s) => {
                write!(f, "This {s} never ends")
            }
            Self::Expected { expected, got } => match got {
                Some(got) => write!(f, "Expected {expected}, got {got}"),
                None => write!(f, "Expected {expected}"),
            },
            Self::Unexpected(got) => write!(f, "Unexpected {got}"),
            Self::TooManyArguments {
                func_name,
                max_arg_count,
            } => {
                write!(
                    f,
                    "Too many arguments (`{func_name}` \
                     expects at most {max_arg_count})",
                )
            }
            Self::MissingRequiredArgument {
                func_name,
                arg_name,
            } => {
                write!(
                    f,
                    "Function `{func_name}` is missing \
                     required argument `{arg_name}`",
                )
            }
            Self::BadFunctionName => {
                write!(f, "There is no function with this name")
            }
            Self::BadCellReference => {
                write!(f, "Bad cell reference")
            }
            Self::BadNumber => {
                write!(f, "Bad numeric literal")
            }
            Self::BadOp {
                op,
                ty1,
                ty2,
                use_duration_instead,
            } => {
                write!(f, "Cannot {op} {ty1}")?;
                if let Some(ty2) = ty2 {
                    write!(f, " and {ty2}")?;
                }
                if *use_duration_instead {
                    write!(f, "; use a duration such as '1y 5d 12h 30m' instead")?;
                }
                Ok(())
            }
            Self::NaN => {
                write!(f, "NaN")
            }

            Self::ExactArraySizeMismatch { expected, got } => {
                write!(
                    f,
                    "Array size mismatch: expected \
                     {expected} array, got {got} array",
                )
            }
            Self::ExactArrayAxisMismatch {
                axis,
                expected,
                got,
            } => {
                write!(
                    f,
                    "Array {} mismatch: expected value with {}, got {}",
                    axis.width_height_str(),
                    axis.rows_cols_str(*expected),
                    axis.rows_cols_str(*got),
                )
            }
            Self::ArrayAxisMismatch {
                axis,
                expected,
                got,
            } => {
                write!(
                    f,
                    "Array {} mismatch: expected value with {}{}, got {}",
                    axis.width_height_str(),
                    if *expected == 1 {
                        String::new()
                    } else {
                        axis.rows_cols_str(1) + " or "
                    },
                    axis.rows_cols_str(*expected),
                    axis.rows_cols_str(*got),
                )
            }
            Self::EmptyArray => {
                write!(f, "Array cannot be empty")
            }
            Self::NonRectangularArray => {
                write!(f, "Array must be rectangular")
            }
            Self::NonLinearArray => {
                write!(f, "Array must be a single row or column")
            }
            Self::ArrayTooBig => {
                write!(f, "Array is too big")
            }

            Self::NotAvailable => write!(f, "N/A"),
            Self::Name => write!(f, "NAME error"),
            Self::Null => write!(f, "NULL error"),
            Self::Num => write!(f, "NUM error"),
            Self::Value => write!(f, "VALUE error"),

            Self::CircularReference => write!(f, "Circular reference"),
            Self::Overflow => write!(f, "Numeric overflow"),
            Self::DivideByZero => write!(f, "Divide by zero"),
            Self::NegativeExponent => write!(f, "Negative exponent"),
            Self::IndexOutOfBounds => write!(f, "Index out of bounds"),
            Self::NoMatch => write!(f, "#N/A"),
            Self::InvalidArgument => write!(f, "Invalid argument"),
            Self::NotANumber => write!(f, "Not a number"),
            Self::Infinity => write!(f, "Unexpected Infinity"),
        }
    }
}
impl RunErrorMsg {
    /// Attaches a span to this error message, returning a Error.
    pub fn with_span(self, span: impl Into<Span>) -> RunError {
        RunError {
            span: Some(span.into()),
            msg: self,
        }
    }
    /// Returns a Error from this error message, without a span.
    pub const fn without_span(self) -> RunError {
        RunError {
            span: None,
            msg: self,
        }
    }
}

impl<T: Into<RunErrorMsg>> From<T> for RunError {
    fn from(msg: T) -> Self {
        msg.into().without_span()
    }
}

impl From<RunErrorMsg> for anyhow::Error {
    fn from(msg: RunErrorMsg) -> Self {
        RunError { span: None, msg }.into()
    }
}

/// Handles internal errors. Panics in debug mode for the stack trace, but
/// returns a nice error message in release mode or on web.
///
/// Prefer internal_error!(); be careful not to call this and then throw away
/// the error it returns, because in debug mode in Rust code it will still
/// panic. For example, use `.ok_or_else(|| internal_error_value!(...))` rather
/// than `.ok_or(internal_error_value!(...))`.
macro_rules! internal_error_value {
    // Don't allocate a new String for &'static str literals.
    ( $msg:expr ) => {{
        // Panic in a debug build (for stack trace).
        #[cfg(all(debug_assertions, not(target_arch = "wasm32")))]
        #[allow(unused)]
        let ret: $crate::RunError = panic!("{}", $msg);
        // Give nice error message for user in release build.
        #[cfg(not(all(debug_assertions, not(target_arch = "wasm32"))))]
        #[allow(unused)]
        let ret: $crate::RunError = $crate::RunErrorMsg::InternalError(
            std::borrow::Cow::Borrowed($msg),
        )
        .without_span();
        #[allow(unreachable_code)]
        ret
    }};
    // Automatically format!() arguments.
    ( $( $args:expr ),+ $(,)? ) => {{
        // Panic in a debug build (for stack trace).
        #[cfg(all(debug_assertions, not(target_arch = "wasm32")))]
        #[allow(unused)]
        let ret: $crate::RunError = panic!($( $args ),+);
        // Give nice error message for user in release build.
        #[cfg(not(all(debug_assertions, not(target_arch = "wasm32"))))]
        #[allow(unused)]
        let ret: $crate::RunError =
            $crate::RunErrorMsg::InternalError(format!($( $args ),+).into()).without_span();
        #[allow(unreachable_code)]
        ret
    }};
}

/// Emits an internal error. Panics in debug mode for the stack trace, but
/// returns a nice error message in release mode or on web.
///
/// Note that this macro actually returns the error from the caller; it does not
/// just provide the value.
macro_rules! internal_error {
    ( $( $args:expr ),+ $(,)? ) => {
        return Err(internal_error_value!($( $args ),+))
    };
}

/// Cell reference out-of-bounds error, similar to Excel.
#[derive(Serialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, TS)]
pub struct RefError;
impl From<RefError> for RunErrorMsg {
    fn from(RefError: RefError) -> Self {
        RunErrorMsg::BadCellReference
    }
}
impl From<RefError> for A1Error {
    fn from(value: RefError) -> Self {
        A1Error::OutOfBounds(value)
    }
}
impl fmt::Display for RefError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "#REF!")
    }
}
impl std::error::Error for RefError {}
