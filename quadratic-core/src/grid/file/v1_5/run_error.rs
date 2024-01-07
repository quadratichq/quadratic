//! Error for file schema. Needs to be kept updated with src/error.rs.

use super::schema::{OutputSize, Span};
use serde::{Deserialize, Serialize};
use std::{borrow::Cow, num::NonZeroU32};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct RunError {
    pub span: Option<Span>,
    pub msg: RunErrorMsg,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Axis {
    X = 0,
    Y = 1,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum RunErrorMsg {
    PythonError(Cow<'static, str>),

    Spill,

    // Miscellaneous errors
    Unimplemented,
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

    // Array size errors
    ExactArraySizeMismatch {
        expected: OutputSize,
        got: OutputSize,
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

    // Runtime errors
    CircularReference,
    Overflow,
    DivideByZero,
    NegativeExponent,
    NotANumber,
    Infinity,
    IndexOutOfBounds,
    NoMatch,
    InvalidArgument,
}

// todo: There's probably a better way to do the From/Into between the types.

impl RunError {
    pub fn from_grid_run_error(error: &crate::RunError) -> Self {
        Self {
            span: error.span.map(|span| Span {
                start: span.start,
                end: span.end,
            }),
            msg: match error.msg.clone() {
                crate::RunErrorMsg::PythonError(str) => RunErrorMsg::PythonError(str),
                crate::RunErrorMsg::Spill => RunErrorMsg::Spill,
                crate::RunErrorMsg::Unimplemented => RunErrorMsg::Unimplemented,
                crate::RunErrorMsg::UnknownError => RunErrorMsg::UnknownError,
                crate::RunErrorMsg::InternalError(str) => RunErrorMsg::InternalError(str),

                // Compile errors
                crate::RunErrorMsg::Unterminated(str) => RunErrorMsg::Unterminated(str),
                crate::RunErrorMsg::Expected { expected, got } => {
                    RunErrorMsg::Expected { expected, got }
                }
                crate::RunErrorMsg::Unexpected(str) => RunErrorMsg::Unexpected(str),
                crate::RunErrorMsg::TooManyArguments {
                    func_name,
                    max_arg_count,
                } => RunErrorMsg::TooManyArguments {
                    func_name,
                    max_arg_count,
                },
                crate::RunErrorMsg::MissingRequiredArgument {
                    func_name,
                    arg_name,
                } => RunErrorMsg::MissingRequiredArgument {
                    func_name,
                    arg_name,
                },
                crate::RunErrorMsg::BadFunctionName => RunErrorMsg::BadFunctionName,
                crate::RunErrorMsg::BadCellReference => RunErrorMsg::BadCellReference,
                crate::RunErrorMsg::BadNumber => RunErrorMsg::BadNumber,

                // Array size errors
                crate::RunErrorMsg::ExactArraySizeMismatch { expected, got } => {
                    RunErrorMsg::ExactArraySizeMismatch {
                        expected: OutputSize {
                            w: expected.w.get() as i64,
                            h: expected.h.get() as i64,
                        },
                        got: OutputSize {
                            w: got.w.get() as i64,
                            h: got.h.get() as i64,
                        },
                    }
                }
                crate::RunErrorMsg::ExactArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => RunErrorMsg::ExactArrayAxisMismatch {
                    axis: match axis {
                        crate::Axis::X => Axis::X,
                        crate::Axis::Y => Axis::Y,
                    },
                    expected,
                    got,
                },
                crate::RunErrorMsg::ArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => RunErrorMsg::ArrayAxisMismatch {
                    axis: match axis {
                        crate::Axis::X => Axis::X,
                        crate::Axis::Y => Axis::Y,
                    },
                    expected,
                    got,
                },
                crate::RunErrorMsg::EmptyArray => RunErrorMsg::EmptyArray,
                crate::RunErrorMsg::NonRectangularArray => RunErrorMsg::NonRectangularArray,
                crate::RunErrorMsg::NonLinearArray => RunErrorMsg::NonLinearArray,
                crate::RunErrorMsg::ArrayTooBig => RunErrorMsg::ArrayTooBig,

                crate::RunErrorMsg::CircularReference => RunErrorMsg::CircularReference,
                crate::RunErrorMsg::Overflow => RunErrorMsg::Overflow,
                crate::RunErrorMsg::DivideByZero => RunErrorMsg::DivideByZero,
                crate::RunErrorMsg::NegativeExponent => RunErrorMsg::NegativeExponent,
                crate::RunErrorMsg::NotANumber => RunErrorMsg::NotANumber,
                crate::RunErrorMsg::Infinity => RunErrorMsg::Infinity,
                crate::RunErrorMsg::IndexOutOfBounds => RunErrorMsg::IndexOutOfBounds,
                crate::RunErrorMsg::NoMatch => RunErrorMsg::NoMatch,
                crate::RunErrorMsg::InvalidArgument => RunErrorMsg::InvalidArgument,
            },
        }
    }
}

impl From<RunError> for crate::RunError {
    fn from(error: RunError) -> crate::RunError {
        crate::RunError {
            span: error.span.map(|span| crate::Span {
                start: span.start,
                end: span.end,
            }),
            msg: match error.msg {
                RunErrorMsg::PythonError(str) => crate::RunErrorMsg::PythonError(str),
                RunErrorMsg::Spill => crate::RunErrorMsg::Spill,
                RunErrorMsg::Unimplemented => crate::RunErrorMsg::Unimplemented,
                RunErrorMsg::UnknownError => crate::RunErrorMsg::UnknownError,
                RunErrorMsg::InternalError(str) => crate::RunErrorMsg::InternalError(str),

                // Compile errors
                RunErrorMsg::Unterminated(str) => crate::RunErrorMsg::Unterminated(str),
                RunErrorMsg::Expected { expected, got } => {
                    crate::RunErrorMsg::Expected { expected, got }
                }
                RunErrorMsg::Unexpected(str) => crate::RunErrorMsg::Unexpected(str),
                RunErrorMsg::TooManyArguments {
                    func_name,
                    max_arg_count,
                } => crate::RunErrorMsg::TooManyArguments {
                    func_name,
                    max_arg_count,
                },
                RunErrorMsg::MissingRequiredArgument {
                    func_name,
                    arg_name,
                } => crate::RunErrorMsg::MissingRequiredArgument {
                    func_name,
                    arg_name,
                },
                RunErrorMsg::BadFunctionName => crate::RunErrorMsg::BadFunctionName,
                RunErrorMsg::BadCellReference => crate::RunErrorMsg::BadCellReference,
                RunErrorMsg::BadNumber => crate::RunErrorMsg::BadNumber,

                // Array size errors
                RunErrorMsg::ExactArraySizeMismatch { expected, got } => {
                    crate::RunErrorMsg::ExactArraySizeMismatch {
                        expected: crate::ArraySize {
                            w: NonZeroU32::new(expected.w as u32)
                                .unwrap_or(NonZeroU32::new(1).unwrap()),
                            h: NonZeroU32::new(expected.h as u32)
                                .unwrap_or(NonZeroU32::new(1).unwrap()),
                        },
                        got: crate::ArraySize {
                            w: NonZeroU32::new(got.w as u32).unwrap_or(NonZeroU32::new(1).unwrap()),
                            h: NonZeroU32::new(got.h as u32).unwrap_or(NonZeroU32::new(1).unwrap()),
                        },
                    }
                }
                RunErrorMsg::ExactArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => crate::RunErrorMsg::ExactArrayAxisMismatch {
                    axis: match axis {
                        Axis::X => crate::Axis::X,
                        Axis::Y => crate::Axis::Y,
                    },
                    expected,
                    got,
                },
                RunErrorMsg::ArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => crate::RunErrorMsg::ArrayAxisMismatch {
                    axis: match axis {
                        Axis::X => crate::Axis::X,
                        Axis::Y => crate::Axis::Y,
                    },
                    expected,
                    got,
                },
                RunErrorMsg::EmptyArray => crate::RunErrorMsg::EmptyArray,
                RunErrorMsg::NonRectangularArray => crate::RunErrorMsg::NonRectangularArray,
                RunErrorMsg::NonLinearArray => crate::RunErrorMsg::NonLinearArray,
                RunErrorMsg::ArrayTooBig => crate::RunErrorMsg::ArrayTooBig,

                // Runtime errors
                RunErrorMsg::CircularReference => crate::RunErrorMsg::CircularReference,
                RunErrorMsg::Overflow => crate::RunErrorMsg::Overflow,
                RunErrorMsg::DivideByZero => crate::RunErrorMsg::DivideByZero,
                RunErrorMsg::NegativeExponent => crate::RunErrorMsg::NegativeExponent,
                RunErrorMsg::NotANumber => crate::RunErrorMsg::NotANumber,
                RunErrorMsg::Infinity => crate::RunErrorMsg::Infinity,
                RunErrorMsg::IndexOutOfBounds => crate::RunErrorMsg::IndexOutOfBounds,
                RunErrorMsg::NoMatch => crate::RunErrorMsg::NoMatch,
                RunErrorMsg::InvalidArgument => crate::RunErrorMsg::InvalidArgument,
            },
        }
    }
}
