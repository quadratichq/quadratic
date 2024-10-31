use std::collections::HashMap;

use anyhow::{anyhow, Result};
use chrono::Utc;
use indexmap::IndexMap;
use itertools::Itertools;

use crate::{
    grid::{
        block::SameValue,
        data_table::{
            column::DataTableColumn,
            sort::{DataTableSort, SortDirection},
        },
        formats::format::Format,
        table_formats::TableFormats,
        CodeRun, ColumnData, DataTable, DataTableKind,
    },
    ArraySize, Axis, Pos, RunError, RunErrorMsg, Value,
};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
    format::{export_format, import_format},
};

pub(crate) fn import_run_error_msg_builder(
    run_error_msg: current::RunErrorMsgSchema,
) -> Result<RunErrorMsg> {
    let run_error_msg = match run_error_msg {
        current::RunErrorMsgSchema::CodeRunError(msg) => RunErrorMsg::CodeRunError(msg),
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

pub(crate) fn import_formats(
    column: HashMap<i64, current::ColumnRepeatSchema<current::FormatSchema>>,
) -> ColumnData<SameValue<Format>> {
    let mut data = ColumnData::new();
    column.into_iter().for_each(|(start, schema)| {
        let value = import_format(schema.value);
        let len = schema.len as usize;
        data.insert_block(start, len, value);
    });
    data
}

fn import_data_table_formats(formats: current::TableFormatsSchema) -> TableFormats {
    let table = formats.table.map(|format| import_format(format));
    let columns = formats
        .columns
        .into_iter()
        .map(|format| import_format(format))
        .collect();
    let cells = formats
        .cells
        .into_iter()
        .map(|formats| import_formats(formats))
        .collect();
    TableFormats {
        table,
        columns,
        cells,
    }
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
                current::DataTableKindSchema::Import(import) => {
                    DataTableKind::Import(crate::cellvalue::Import {
                        file_name: import.file_name,
                    })
                }
            },
            name: data_table.name,
            header_is_first_row: data_table.header_is_first_row,
            show_header: data_table.show_header,
            readonly: data_table.readonly,
            last_modified: data_table.last_modified.unwrap_or(Utc::now()), // this is required but fall back to now if failed
            spill_error: data_table.spill_error,
            value,
            columns: data_table.columns.map(|columns| {
                columns
                    .into_iter()
                    .enumerate()
                    .map(|(index, column)| {
                        let column_name = match column.name {
                            current::CellValueSchema::Text(text) => text,
                            _ => format!("Column {}", index + 1),
                        };

                        DataTableColumn::new(column_name, column.display, column.value_index)
                    })
                    .collect()
            }),
            sort: data_table.sort.map(|sort| {
                sort.into_iter()
                    .map(|sort| DataTableSort {
                        column_index: sort.column_index,
                        direction: match sort.direction {
                            current::SortDirectionSchema::Ascending => SortDirection::Ascending,
                            current::SortDirectionSchema::Descending => SortDirection::Descending,
                            current::SortDirectionSchema::None => SortDirection::None,
                        },
                    })
                    .collect()
            }),
            display_buffer: data_table.display_buffer,
            alternating_colors: data_table.alternating_colors,
            formats: import_data_table_formats(data_table.formats),
        };

        new_data_tables.insert(Pos { x: pos.x, y: pos.y }, data_table);
    }

    Ok(new_data_tables)
}

pub(crate) fn export_run_error_msg(run_error_msg: RunErrorMsg) -> current::RunErrorMsgSchema {
    match run_error_msg {
        RunErrorMsg::CodeRunError(msg) => current::RunErrorMsgSchema::CodeRunError(msg),
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
                expected: current::OutputSizeSchema {
                    w: expected.w.get() as i64,
                    h: expected.h.get() as i64,
                },
                got: current::OutputSizeSchema {
                    w: got.w.get() as i64,
                    h: got.h.get() as i64,
                },
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

pub(crate) fn export_formats(
    formats: ColumnData<SameValue<Format>>,
) -> HashMap<i64, current::ColumnRepeatSchema<current::FormatSchema>> {
    formats
        .into_blocks()
        .filter_map(|block| {
            let len = block.len() as u32;
            if let Some(format) = export_format(block.content.value) {
                Some((block.y, current::ColumnRepeatSchema { value: format, len }))
            } else {
                None
            }
        })
        .collect()
}

pub(crate) fn export_data_table_formats(formats: TableFormats) -> current::TableFormatsSchema {
    current::TableFormatsSchema {
        table: formats.table.and_then(export_format),
        columns: formats
            .columns
            .into_iter()
            .filter_map(export_format)
            .collect(),
        cells: formats.cells.into_iter().map(export_formats).collect(),
    }
}

pub(crate) fn export_data_tables(
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

            let columns = data_table.columns.map(|columns| {
                columns
                    .into_iter()
                    .map(|column| current::DataTableColumnSchema {
                        name: current::CellValueSchema::Text(column.name.to_string()),
                        display: column.display,
                        value_index: column.value_index,
                    })
                    .collect()
            });

            let sort = data_table.sort.map(|sort| {
                sort.into_iter()
                    .map(|item| current::DataTableSortOrderSchema {
                        column_index: item.column_index,
                        direction: match item.direction {
                            SortDirection::Ascending => current::SortDirectionSchema::Ascending,
                            SortDirection::Descending => current::SortDirectionSchema::Descending,
                            SortDirection::None => current::SortDirectionSchema::None,
                        },
                    })
                    .collect()
            });

            let kind = match data_table.kind {
                DataTableKind::CodeRun(code_run) => {
                    let code_run = export_code_run(code_run);
                    current::DataTableKindSchema::CodeRun(code_run)
                }
                DataTableKind::Import(import) => {
                    current::DataTableKindSchema::Import(current::ImportSchema {
                        file_name: import.file_name,
                    })
                }
            };

            let data_table = current::DataTableSchema {
                kind,
                name: data_table.name,
                header_is_first_row: data_table.header_is_first_row,
                show_header: data_table.show_header,
                columns,
                sort,
                display_buffer: data_table.display_buffer,
                readonly: data_table.readonly,
                last_modified: Some(data_table.last_modified),
                spill_error: data_table.spill_error,
                value,
                alternating_colors: data_table.alternating_colors,
                formats: export_data_table_formats(data_table.formats),
            };

            (current::PosSchema::from(pos), data_table)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_empty_table_formats_serialized() {
        let formats = TableFormats {
            table: None,
            columns: vec![],
            cells: vec![],
        };
        let serialized = export_data_table_formats(formats.clone());
        let import = import_data_table_formats(serialized);
        assert_eq!(import, formats);
    }
}
