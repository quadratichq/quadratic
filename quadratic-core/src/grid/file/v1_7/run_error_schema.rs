//! Error for file schema. Needs to be kept updated with src/error.rs.

use super::schema::{OutputSizeSchema, SpanSchema};
use serde::{Deserialize, Serialize};
use std::{borrow::Cow, num::NonZeroU32};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct RunErrorSchema {
    pub(crate) span: Option<SpanSchema>,
    pub(crate) msg: RunErrorMsgSchema,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum AxisSchema {
    X = 0,
    Y = 1,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum RunErrorMsgSchema {
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
    NaN,

    // Array size errors
    ExactArraySizeMismatch {
        expected: OutputSizeSchema,
        got: OutputSizeSchema,
    },
    ExactArrayAxisMismatch {
        axis: AxisSchema,
        expected: u32,
        got: u32,
    },
    ArrayAxisMismatch {
        axis: AxisSchema,
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

impl From<RunErrorSchema> for crate::RunError {
    fn from(error: RunErrorSchema) -> crate::RunError {
        crate::RunError {
            span: error.span.map(|span| crate::Span {
                start: span.start,
                end: span.end,
            }),
            msg: match error.msg {
                RunErrorMsgSchema::CodeRunError(str) => crate::RunErrorMsg::CodeRunError(str),
                RunErrorMsgSchema::Spill => crate::RunErrorMsg::Spill,
                RunErrorMsgSchema::Unimplemented(str) => crate::RunErrorMsg::Unimplemented(str),
                RunErrorMsgSchema::UnknownError => crate::RunErrorMsg::UnknownError,
                RunErrorMsgSchema::InternalError(str) => crate::RunErrorMsg::InternalError(str),

                // Compile errors
                RunErrorMsgSchema::Unterminated(str) => crate::RunErrorMsg::Unterminated(str),
                RunErrorMsgSchema::Expected { expected, got } => {
                    crate::RunErrorMsg::Expected { expected, got }
                }
                RunErrorMsgSchema::Unexpected(str) => crate::RunErrorMsg::Unexpected(str),
                RunErrorMsgSchema::TooManyArguments {
                    func_name,
                    max_arg_count,
                } => crate::RunErrorMsg::TooManyArguments {
                    func_name,
                    max_arg_count,
                },
                RunErrorMsgSchema::MissingRequiredArgument {
                    func_name,
                    arg_name,
                } => crate::RunErrorMsg::MissingRequiredArgument {
                    func_name,
                    arg_name,
                },
                RunErrorMsgSchema::BadFunctionName => crate::RunErrorMsg::BadFunctionName,
                RunErrorMsgSchema::BadCellReference => crate::RunErrorMsg::BadCellReference,
                RunErrorMsgSchema::BadNumber => crate::RunErrorMsg::BadNumber,
                RunErrorMsgSchema::BadOp {
                    op,
                    ty1,
                    ty2,
                    use_duration_instead,
                } => crate::RunErrorMsg::BadOp {
                    op,
                    ty1,
                    ty2,
                    use_duration_instead,
                },
                RunErrorMsgSchema::NaN => crate::RunErrorMsg::NaN,

                // Array size errors
                RunErrorMsgSchema::ExactArraySizeMismatch { expected, got } => {
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
                RunErrorMsgSchema::ExactArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => crate::RunErrorMsg::ExactArrayAxisMismatch {
                    axis: match axis {
                        AxisSchema::X => crate::Axis::X,
                        AxisSchema::Y => crate::Axis::Y,
                    },
                    expected,
                    got,
                },
                RunErrorMsgSchema::ArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => crate::RunErrorMsg::ArrayAxisMismatch {
                    axis: match axis {
                        AxisSchema::X => crate::Axis::X,
                        AxisSchema::Y => crate::Axis::Y,
                    },
                    expected,
                    got,
                },
                RunErrorMsgSchema::EmptyArray => crate::RunErrorMsg::EmptyArray,
                RunErrorMsgSchema::NonRectangularArray => crate::RunErrorMsg::NonRectangularArray,
                RunErrorMsgSchema::NonLinearArray => crate::RunErrorMsg::NonLinearArray,
                RunErrorMsgSchema::ArrayTooBig => crate::RunErrorMsg::ArrayTooBig,

                // Runtime errors
                RunErrorMsgSchema::CircularReference => crate::RunErrorMsg::CircularReference,
                RunErrorMsgSchema::Overflow => crate::RunErrorMsg::Overflow,
                RunErrorMsgSchema::DivideByZero => crate::RunErrorMsg::DivideByZero,
                RunErrorMsgSchema::NegativeExponent => crate::RunErrorMsg::NegativeExponent,
                RunErrorMsgSchema::NotANumber => crate::RunErrorMsg::NaN,
                RunErrorMsgSchema::Infinity => crate::RunErrorMsg::NaN,
                RunErrorMsgSchema::IndexOutOfBounds => crate::RunErrorMsg::IndexOutOfBounds,
                RunErrorMsgSchema::NoMatch => crate::RunErrorMsg::NoMatch,
                RunErrorMsgSchema::InvalidArgument => crate::RunErrorMsg::InvalidArgument,
            },
        }
    }
}
