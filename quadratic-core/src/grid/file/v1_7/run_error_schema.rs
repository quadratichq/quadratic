//! Error for file schema. Needs to be kept updated with src/error.rs.

use super::schema::{OutputSizeSchema, SpanSchema};
use serde::{Deserialize, Serialize};
use std::{borrow::Cow, num::NonZeroU32};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct RunErrorSchema {
    pub span: Option<SpanSchema>,
    pub msg: RunErrorMsgSchema,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum AxisSchema {
    X = 0,
    Y = 1,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum RunErrorMsgSchema {
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

// todo: There's probably a better way to do the From/Into between the types.

impl RunErrorSchema {
    pub fn from_grid_run_error(error: crate::RunError) -> Self {
        Self {
            span: error.span.map(|span| SpanSchema {
                start: span.start,
                end: span.end,
            }),
            msg: match error.msg.clone() {
                crate::RunErrorMsg::CodeRunError(str) => RunErrorMsgSchema::CodeRunError(str),
                crate::RunErrorMsg::Spill => RunErrorMsgSchema::Spill,
                crate::RunErrorMsg::Unimplemented(str) => RunErrorMsgSchema::Unimplemented(str),
                crate::RunErrorMsg::UnknownError => RunErrorMsgSchema::UnknownError,
                crate::RunErrorMsg::InternalError(str) => RunErrorMsgSchema::InternalError(str),

                // Compile errors
                crate::RunErrorMsg::Unterminated(str) => RunErrorMsgSchema::Unterminated(str),
                crate::RunErrorMsg::Expected { expected, got } => {
                    RunErrorMsgSchema::Expected { expected, got }
                }
                crate::RunErrorMsg::Unexpected(str) => RunErrorMsgSchema::Unexpected(str),
                crate::RunErrorMsg::TooManyArguments {
                    func_name,
                    max_arg_count,
                } => RunErrorMsgSchema::TooManyArguments {
                    func_name,
                    max_arg_count,
                },
                crate::RunErrorMsg::MissingRequiredArgument {
                    func_name,
                    arg_name,
                } => RunErrorMsgSchema::MissingRequiredArgument {
                    func_name,
                    arg_name,
                },
                crate::RunErrorMsg::BadFunctionName => RunErrorMsgSchema::BadFunctionName,
                crate::RunErrorMsg::BadCellReference => RunErrorMsgSchema::BadCellReference,
                crate::RunErrorMsg::BadNumber => RunErrorMsgSchema::BadNumber,
                crate::RunErrorMsg::BadOp {
                    op,
                    ty1,
                    ty2,
                    use_duration_instead,
                } => RunErrorMsgSchema::BadOp {
                    op,
                    ty1,
                    ty2,
                    use_duration_instead,
                },
                crate::RunErrorMsg::NaN => RunErrorMsgSchema::NaN,

                // Array size errors
                crate::RunErrorMsg::ExactArraySizeMismatch { expected, got } => {
                    RunErrorMsgSchema::ExactArraySizeMismatch {
                        expected: OutputSizeSchema {
                            w: expected.w.get() as i64,
                            h: expected.h.get() as i64,
                        },
                        got: OutputSizeSchema {
                            w: got.w.get() as i64,
                            h: got.h.get() as i64,
                        },
                    }
                }
                crate::RunErrorMsg::ExactArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => RunErrorMsgSchema::ExactArrayAxisMismatch {
                    axis: match axis {
                        crate::Axis::X => AxisSchema::X,
                        crate::Axis::Y => AxisSchema::Y,
                    },
                    expected,
                    got,
                },
                crate::RunErrorMsg::ArrayAxisMismatch {
                    axis,
                    expected,
                    got,
                } => RunErrorMsgSchema::ArrayAxisMismatch {
                    axis: match axis {
                        crate::Axis::X => AxisSchema::X,
                        crate::Axis::Y => AxisSchema::Y,
                    },
                    expected,
                    got,
                },
                crate::RunErrorMsg::EmptyArray => RunErrorMsgSchema::EmptyArray,
                crate::RunErrorMsg::NonRectangularArray => RunErrorMsgSchema::NonRectangularArray,
                crate::RunErrorMsg::NonLinearArray => RunErrorMsgSchema::NonLinearArray,
                crate::RunErrorMsg::ArrayTooBig => RunErrorMsgSchema::ArrayTooBig,

                crate::RunErrorMsg::CircularReference => RunErrorMsgSchema::CircularReference,
                crate::RunErrorMsg::Overflow => RunErrorMsgSchema::Overflow,
                crate::RunErrorMsg::DivideByZero => RunErrorMsgSchema::DivideByZero,
                crate::RunErrorMsg::NegativeExponent => RunErrorMsgSchema::NegativeExponent,
                crate::RunErrorMsg::NotANumber => RunErrorMsgSchema::NotANumber,
                crate::RunErrorMsg::Infinity => RunErrorMsgSchema::Infinity,
                crate::RunErrorMsg::IndexOutOfBounds => RunErrorMsgSchema::IndexOutOfBounds,
                crate::RunErrorMsg::NoMatch => RunErrorMsgSchema::NoMatch,
                crate::RunErrorMsg::InvalidArgument => RunErrorMsgSchema::InvalidArgument,
            },
        }
    }
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
                RunErrorMsgSchema::NotANumber => crate::RunErrorMsg::NotANumber,
                RunErrorMsgSchema::Infinity => crate::RunErrorMsg::Infinity,
                RunErrorMsgSchema::IndexOutOfBounds => crate::RunErrorMsg::IndexOutOfBounds,
                RunErrorMsgSchema::NoMatch => crate::RunErrorMsg::NoMatch,
                RunErrorMsgSchema::InvalidArgument => crate::RunErrorMsg::InvalidArgument,
            },
        }
    }
}
