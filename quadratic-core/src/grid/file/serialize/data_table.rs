use anyhow::{anyhow, Result};
use chrono::Utc;
use indexmap::IndexMap;
use itertools::Itertools;

use crate::{
    grid::{CodeRun, DataTable, DataTableKind},
    ArraySize, Axis, Pos, RunError, RunErrorMsg, Value,
};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
};

pub(crate) fn import_run_error_msg_builder(
    run_error_msg: current::RunErrorMsgSchema,
) -> Result<RunErrorMsg> {
    let run_error_msg = match run_error_msg {
        current::RunErrorMsgSchema::PythonError(msg) => RunErrorMsg::PythonError(msg),
        current::RunErrorMsgSchema::Unexpected(msg) => RunErrorMsg::Unexpected(msg),
        current::RunErrorMsgSchema::Spill => RunErrorMsg::Spill,
        current::RunErrorMsgSchema::Unimplemented(msg) => RunErrorMsg::Unimplemented(msg),
        current::RunErrorMsgSchema::UnknownError => RunErrorMsg::UnknownError,
        current::RunErrorMsgSchema::InternalError(msg) => RunErrorMsg::InternalError(msg),
        current::RunErrorMsgSchema::Unterminated(msg) => RunErrorMsg::Unterminated(msg),
        current::RunErrorMsgSchema::Expected { expected, got } => {
            RunErrorMsg::Expected { expected, got }
        }
        current::RunErrorMsgSchema::TooManyArguments {
            func_name,
            max_arg_count,
        } => RunErrorMsg::TooManyArguments {
            func_name,
            max_arg_count,
        },
        current::RunErrorMsgSchema::MissingRequiredArgument {
            func_name,
            arg_name,
        } => RunErrorMsg::MissingRequiredArgument {
            func_name,
            arg_name,
        },
        current::RunErrorMsgSchema::BadFunctionName => RunErrorMsg::BadFunctionName,
        current::RunErrorMsgSchema::BadCellReference => RunErrorMsg::BadCellReference,
        current::RunErrorMsgSchema::BadNumber => RunErrorMsg::BadNumber,
        current::RunErrorMsgSchema::BadOp {
            op,
            ty1,
            ty2,
            use_duration_instead,
        } => RunErrorMsg::BadOp {
            op,
            ty1,
            ty2,
            use_duration_instead,
        },
        current::RunErrorMsgSchema::NaN => RunErrorMsg::NaN,
        current::RunErrorMsgSchema::ExactArraySizeMismatch { expected, got } => {
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::try_from((expected.w, expected.h)).map_err(|e| anyhow!(e))?,
                got: ArraySize::try_from((got.w, got.h)).map_err(|e| anyhow!(e))?,
            }
        }
        current::RunErrorMsgSchema::ExactArrayAxisMismatch {
            axis,
            expected,
            got,
        } => RunErrorMsg::ExactArrayAxisMismatch {
            axis: Axis::from(<current::AxisSchema as Into<i8>>::into(axis)),
            expected,
            got,
        },
        current::RunErrorMsgSchema::ArrayAxisMismatch {
            axis,
            expected,
            got,
        } => RunErrorMsg::ArrayAxisMismatch {
            axis: Axis::from(<current::AxisSchema as Into<i8>>::into(axis)),
            expected,
            got,
        },
        current::RunErrorMsgSchema::EmptyArray => RunErrorMsg::EmptyArray,
        current::RunErrorMsgSchema::NonRectangularArray => RunErrorMsg::NonRectangularArray,
        current::RunErrorMsgSchema::NonLinearArray => RunErrorMsg::NonLinearArray,
        current::RunErrorMsgSchema::ArrayTooBig => RunErrorMsg::ArrayTooBig,
        current::RunErrorMsgSchema::CircularReference => RunErrorMsg::CircularReference,
        current::RunErrorMsgSchema::Overflow => RunErrorMsg::Overflow,
        current::RunErrorMsgSchema::DivideByZero => RunErrorMsg::DivideByZero,
        current::RunErrorMsgSchema::NegativeExponent => RunErrorMsg::NegativeExponent,
        current::RunErrorMsgSchema::NotANumber => RunErrorMsg::NotANumber,
        current::RunErrorMsgSchema::Infinity => RunErrorMsg::Infinity,
        current::RunErrorMsgSchema::IndexOutOfBounds => RunErrorMsg::IndexOutOfBounds,
        current::RunErrorMsgSchema::NoMatch => RunErrorMsg::NoMatch,
        current::RunErrorMsgSchema::InvalidArgument => RunErrorMsg::InvalidArgument,
    };

    Ok(run_error_msg)
}

pub(crate) fn import_code_run_builder(code_run: current::CodeRunSchema) -> Result<CodeRun> {
    let cells_accessed = code_run
        .cells_accessed
        .into_iter()
        .map(crate::SheetRect::from)
        .collect();

    let error = if let Some(error) = code_run.error {
        Some(RunError {
            span: error.span.map(|span| crate::Span {
                start: span.start,
                end: span.end,
            }),
            msg: import_run_error_msg_builder(error.msg)?,
        })
    } else {
        None
    };
    let code_run = CodeRun {
        formatted_code_string: code_run.formatted_code_string,
        std_out: code_run.std_out,
        std_err: code_run.std_err,
        error,
        cells_accessed,
        return_type: code_run.return_type,
        line_number: code_run.line_number,
        output_type: code_run.output_type,
    };

    Ok(code_run)
}

pub(crate) fn import_data_table_builder(
    data_tables: Vec<(current::PosSchema, current::DataTableSchema)>,
) -> Result<IndexMap<Pos, DataTable>> {
    let mut new_data_tables = IndexMap::new();

    for (pos, data_table) in data_tables.into_iter() {
        let value = match data_table.value {
            current::OutputValueSchema::Single(value) => {
                Value::Single(import_cell_value(value.to_owned()))
            }
            current::OutputValueSchema::Array(current::OutputArraySchema { size, values }) => {
                Value::Array(crate::Array::from(
                    values
                        .into_iter()
                        .chunks(size.w as usize)
                        .into_iter()
                        .map(|row| row.into_iter().map(import_cell_value).collect::<Vec<_>>())
                        .collect::<Vec<Vec<_>>>(),
                ))
            }
        };

        let data_table = DataTable {
            kind: match data_table.kind {
                current::DataTableKindSchema::CodeRun(code_run) => {
                    DataTableKind::CodeRun(import_code_run_builder(code_run)?)
                }
            },
            last_modified: data_table.last_modified.unwrap_or(Utc::now()), // this is required but fall back to now if failed
            spill_error: data_table.spill_error,
            value,
        };

        new_data_tables.insert(Pos { x: pos.x, y: pos.y }, data_table);
    }

    Ok(new_data_tables)
}

pub(crate) fn export_run_error_msg(run_error_msg: RunErrorMsg) -> current::RunErrorMsgSchema {
    match run_error_msg {
        RunErrorMsg::PythonError(msg) => current::RunErrorMsgSchema::PythonError(msg),
        RunErrorMsg::Unexpected(msg) => current::RunErrorMsgSchema::Unexpected(msg),
        RunErrorMsg::Spill => current::RunErrorMsgSchema::Spill,
        RunErrorMsg::Unimplemented(msg) => current::RunErrorMsgSchema::Unimplemented(msg),
        RunErrorMsg::UnknownError => current::RunErrorMsgSchema::UnknownError,
        RunErrorMsg::InternalError(msg) => current::RunErrorMsgSchema::InternalError(msg),
        RunErrorMsg::Unterminated(msg) => current::RunErrorMsgSchema::Unterminated(msg),
        RunErrorMsg::Expected { expected, got } => {
            current::RunErrorMsgSchema::Expected { expected, got }
        }
        RunErrorMsg::TooManyArguments {
            func_name,
            max_arg_count,
        } => current::RunErrorMsgSchema::TooManyArguments {
            func_name,
            max_arg_count,
        },
        RunErrorMsg::MissingRequiredArgument {
            func_name,
            arg_name,
        } => current::RunErrorMsgSchema::MissingRequiredArgument {
            func_name,
            arg_name,
        },
        RunErrorMsg::BadFunctionName => current::RunErrorMsgSchema::BadFunctionName,
        RunErrorMsg::BadCellReference => current::RunErrorMsgSchema::BadCellReference,
        RunErrorMsg::BadNumber => current::RunErrorMsgSchema::BadNumber,
        RunErrorMsg::BadOp {
            op,
            ty1,
            ty2,
            use_duration_instead,
        } => current::RunErrorMsgSchema::BadOp {
            op,
            ty1,
            ty2,
            use_duration_instead,
        },
        RunErrorMsg::NaN => current::RunErrorMsgSchema::NaN,
        RunErrorMsg::ExactArraySizeMismatch { expected, got } => {
            current::RunErrorMsgSchema::ExactArraySizeMismatch {
                expected: (expected.w, expected.h).into(),
                got: (got.w, got.h).into(),
            }
        }
        RunErrorMsg::ExactArrayAxisMismatch {
            axis,
            expected,
            got,
        } => current::RunErrorMsgSchema::ExactArrayAxisMismatch {
            axis: current::AxisSchema::from(<Axis as Into<i8>>::into(axis)),
            expected,
            got,
        },
        RunErrorMsg::ArrayAxisMismatch {
            axis,
            expected,
            got,
        } => current::RunErrorMsgSchema::ArrayAxisMismatch {
            axis: current::AxisSchema::from(<Axis as Into<i8>>::into(axis)),
            expected,
            got,
        },
        RunErrorMsg::EmptyArray => current::RunErrorMsgSchema::EmptyArray,
        RunErrorMsg::NonRectangularArray => current::RunErrorMsgSchema::NonRectangularArray,
        RunErrorMsg::NonLinearArray => current::RunErrorMsgSchema::NonLinearArray,
        RunErrorMsg::ArrayTooBig => current::RunErrorMsgSchema::ArrayTooBig,
        RunErrorMsg::CircularReference => current::RunErrorMsgSchema::CircularReference,
        RunErrorMsg::Overflow => current::RunErrorMsgSchema::Overflow,
        RunErrorMsg::DivideByZero => current::RunErrorMsgSchema::DivideByZero,
        RunErrorMsg::NegativeExponent => current::RunErrorMsgSchema::NegativeExponent,
        RunErrorMsg::NotANumber => current::RunErrorMsgSchema::NotANumber,
        RunErrorMsg::Infinity => current::RunErrorMsgSchema::Infinity,
        RunErrorMsg::IndexOutOfBounds => current::RunErrorMsgSchema::IndexOutOfBounds,
        RunErrorMsg::NoMatch => current::RunErrorMsgSchema::NoMatch,
        RunErrorMsg::InvalidArgument => current::RunErrorMsgSchema::InvalidArgument,
    }
}

pub(crate) fn export_code_run(code_run: CodeRun) -> current::CodeRunSchema {
    let error = if let Some(error) = code_run.error {
        Some(current::RunErrorSchema {
            span: error.span.map(|span| current::SpanSchema {
                start: span.start,
                end: span.end,
            }),
            msg: export_run_error_msg(error.msg),
        })
    } else {
        None
    };

    current::CodeRunSchema {
        formatted_code_string: code_run.formatted_code_string,
        std_out: code_run.std_out,
        std_err: code_run.std_err,
        error,
        cells_accessed: code_run
            .cells_accessed
            .into_iter()
            .map(current::SheetRectSchema::from)
            .collect(),
        return_type: code_run.return_type,
        line_number: code_run.line_number,
        output_type: code_run.output_type,
    }
}

pub(crate) fn export_data_table_runs(
    data_tables: IndexMap<Pos, DataTable>,
) -> Vec<(current::PosSchema, current::DataTableSchema)> {
    data_tables
        .into_iter()
        .map(|(pos, data_table)| {
            let value = match data_table.value {
                Value::Single(cell_value) => {
                    current::OutputValueSchema::Single(export_cell_value(cell_value))
                }
                Value::Array(array) => {
                    current::OutputValueSchema::Array(current::OutputArraySchema {
                        size: current::OutputSizeSchema {
                            w: array.width() as i64,
                            h: array.height() as i64,
                        },
                        values: array
                            .rows()
                            .flat_map(|row| {
                                row.iter().map(|value| export_cell_value(value.to_owned()))
                            })
                            .collect(),
                    })
                }
                Value::Tuple(_) => {
                    current::OutputValueSchema::Single(current::CellValueSchema::Blank)
                }
            };

            let data_table = match data_table.kind {
                DataTableKind::CodeRun(code_run) => {
                    let code_run = export_code_run(code_run);

                    current::DataTableSchema {
                        kind: current::DataTableKindSchema::CodeRun(code_run),
                        last_modified: Some(data_table.last_modified),
                        spill_error: data_table.spill_error,
                        value,
                    }
                }
            };

            (current::PosSchema::from(pos), data_table)
        })
        .collect()
}