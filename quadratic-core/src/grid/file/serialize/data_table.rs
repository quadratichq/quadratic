use std::collections::HashMap;

use anyhow::{Result, anyhow};
use chrono::Utc;
use indexmap::IndexMap;
use itertools::Itertools;
use std::str::FromStr;

use crate::{
    ArraySize, Axis, CellValue, Pos, RunError, RunErrorMsg, Value,
    a1::{CellRefCoord, CellRefRange, CellRefRangeEnd, ColRange, RefRangeBounds, TableRef},
    grid::{
        CellsAccessed, CodeRun, ColumnData, DataTable, DataTableKind, SheetId,
        block::SameValue,
        data_table::{
            column_header::DataTableColumnHeader,
            sort::{DataTableSort, SortDirection},
        },
    },
};

use super::{
    borders::{export_borders, import_borders},
    cell_value::{
        export_cell_value, export_code_cell_language, import_cell_value, import_code_cell_language,
    },
    current,
    formats::{export_formats, import_formats},
};

fn import_cell_ref_coord(coord: current::CellRefCoordSchema) -> CellRefCoord {
    CellRefCoord {
        coord: coord.coord,
        is_absolute: coord.is_absolute,
    }
}

fn import_col_range(range: current::ColRangeSchema) -> ColRange {
    match range {
        current::ColRangeSchema::All => ColRange::All,
        current::ColRangeSchema::Col(col) => ColRange::Col(col),
        current::ColRangeSchema::ColRange(col1, col2) => ColRange::ColRange(col1, col2),
        current::ColRangeSchema::ColumnToEnd(col) => ColRange::ColToEnd(col),
    }
}

fn import_table_ref(table_ref: current::TableRefSchema) -> TableRef {
    TableRef {
        table_name: table_ref.table_name,
        data: table_ref.data,
        headers: table_ref.headers,
        totals: table_ref.totals,
        col_range: import_col_range(table_ref.col_range),
    }
}

pub(crate) fn import_cell_ref_range(range: current::CellRefRangeSchema) -> CellRefRange {
    match range {
        current::CellRefRangeSchema::Sheet(ref_range_bounds) => CellRefRange::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd {
                    col: import_cell_ref_coord(ref_range_bounds.start.col),
                    row: import_cell_ref_coord(ref_range_bounds.start.row),
                },
                end: CellRefRangeEnd {
                    col: import_cell_ref_coord(ref_range_bounds.end.col),
                    row: import_cell_ref_coord(ref_range_bounds.end.row),
                },
            },
        },
        current::CellRefRangeSchema::Table(table_ref) => CellRefRange::Table {
            range: import_table_ref(table_ref),
        },
    }
}

fn import_cells_accessed(
    cells_accessed: Vec<(current::IdSchema, Vec<current::CellRefRangeSchema>)>,
) -> Result<CellsAccessed> {
    let mut imported_cells = CellsAccessed::default();

    for (id, ranges) in cells_accessed {
        let sheet_id = SheetId::from_str(&id.to_string())?;
        imported_cells.cells.insert(
            sheet_id,
            ranges.into_iter().map(import_cell_ref_range).collect(),
        );
    }

    Ok(imported_cells)
}

fn import_run_error_msg_builder(run_error_msg: current::RunErrorMsgSchema) -> Result<RunErrorMsg> {
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
        current::RunErrorMsgSchema::NotAvailable => RunErrorMsg::NotAvailable,
        current::RunErrorMsgSchema::Name => RunErrorMsg::Name,
        current::RunErrorMsgSchema::Null => RunErrorMsg::Null,
        current::RunErrorMsgSchema::Num => RunErrorMsg::Num,
        current::RunErrorMsgSchema::Value => RunErrorMsg::Value,
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

fn export_cell_ref_coord(coord: CellRefCoord) -> current::CellRefCoordSchema {
    current::CellRefCoordSchema {
        coord: coord.coord,
        is_absolute: coord.is_absolute,
    }
}

fn export_col_range(range: ColRange) -> current::ColRangeSchema {
    match range {
        ColRange::All => current::ColRangeSchema::All,
        ColRange::Col(col) => current::ColRangeSchema::Col(col),
        ColRange::ColRange(col1, col2) => current::ColRangeSchema::ColRange(col1, col2),
        ColRange::ColToEnd(col) => current::ColRangeSchema::ColumnToEnd(col),
    }
}

pub(crate) fn export_cell_ref_range(range: CellRefRange) -> current::CellRefRangeSchema {
    match range {
        CellRefRange::Sheet { range } => {
            current::CellRefRangeSchema::Sheet(current::RefRangeBoundsSchema {
                start: current::CellRefRangeEndSchema {
                    col: export_cell_ref_coord(range.start.col),
                    row: export_cell_ref_coord(range.start.row),
                },
                end: current::CellRefRangeEndSchema {
                    col: export_cell_ref_coord(range.end.col),
                    row: export_cell_ref_coord(range.end.row),
                },
            })
        }
        CellRefRange::Table { range } => {
            current::CellRefRangeSchema::Table(current::TableRefSchema {
                table_name: range.table_name,
                data: range.data,
                headers: range.headers,
                totals: range.totals,
                col_range: export_col_range(range.col_range),
            })
        }
    }
}

fn export_cells_accessed(
    cells_accessed: CellsAccessed,
) -> Vec<(current::IdSchema, Vec<current::CellRefRangeSchema>)> {
    cells_accessed
        .cells
        .into_iter()
        .map(|(sheet_id, ranges)| {
            (
                current::IdSchema::from(sheet_id.to_string()),
                ranges.into_iter().map(export_cell_ref_range).collect(),
            )
        })
        .collect()
}

fn import_code_run_builder(code_run: current::CodeRunSchema) -> Result<CodeRun> {
    let cells_accessed = code_run.cells_accessed;

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
        language: import_code_cell_language(code_run.language),
        code: code_run.code,
        std_out: code_run.std_out,
        std_err: code_run.std_err,
        error,
        cells_accessed: import_cells_accessed(cells_accessed)?,
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
            current::OutputValueSchema::Single(value) => Value::Single(import_cell_value(value)),
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
            name: CellValue::Text(data_table.name),
            header_is_first_row: data_table.header_is_first_row,
            show_name: data_table.show_name,
            show_columns: data_table.show_columns,
            last_modified: data_table.last_modified.unwrap_or(Utc::now()), // this is required but fall back to now if failed
            spill_error: data_table.spill_error,
            value,
            column_headers: data_table.columns.map(|columns| {
                columns
                    .into_iter()
                    .enumerate()
                    .map(|(index, column)| {
                        let column_name = match column.name {
                            current::CellValueSchema::Text(text) => text,
                            _ => format!("Column {}", index + 1),
                        };

                        DataTableColumnHeader::new(column_name, column.display, column.value_index)
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
            sort_dirty: data_table.sort_dirty,
            display_buffer: data_table.display_buffer,
            alternating_colors: data_table.alternating_colors,
            formats: import_formats(data_table.formats),
            borders: import_borders(data_table.borders),
            chart_pixel_output: data_table.chart_pixel_output,
            chart_output: data_table.chart_output,
        };

        new_data_tables.insert(Pos { x: pos.x, y: pos.y }, data_table);
    }

    Ok(new_data_tables)
}

fn export_run_error_msg(run_error_msg: RunErrorMsg) -> current::RunErrorMsgSchema {
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
        RunErrorMsg::NotAvailable => current::RunErrorMsgSchema::NotAvailable,
        RunErrorMsg::Name => current::RunErrorMsgSchema::Name,
        RunErrorMsg::Null => current::RunErrorMsgSchema::Null,
        RunErrorMsg::Num => current::RunErrorMsgSchema::Num,
        RunErrorMsg::Value => current::RunErrorMsgSchema::Value,
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

fn export_code_run(code_run: CodeRun) -> current::CodeRunSchema {
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
        language: export_code_cell_language(code_run.language),
        code: code_run.code,
        std_out: code_run.std_out,
        std_err: code_run.std_err,
        error,
        cells_accessed: export_cells_accessed(code_run.cells_accessed),
        return_type: code_run.return_type,
        line_number: code_run.line_number,
        output_type: code_run.output_type,
    }
}

pub(crate) fn export_data_tables(
    data_tables: IndexMap<Pos, DataTable>,
) -> Vec<(current::PosSchema, current::DataTableSchema)> {
    data_tables
        .into_iter()
        .map(|(pos, data_table)| {
            let name = data_table.name().to_string();
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
                            .into_rows()
                            .into_iter()
                            .flat_map(|row| {
                                row.into_iter().map(export_cell_value).collect::<Vec<_>>()
                            })
                            .collect(),
                    })
                }
                Value::Tuple(_) => {
                    current::OutputValueSchema::Single(current::CellValueSchema::Blank)
                }
            };

            let columns = data_table.column_headers.map(|columns| {
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
                name,
                header_is_first_row: data_table.header_is_first_row,
                show_name: data_table.show_name,
                show_columns: data_table.show_columns,
                columns,
                sort,
                sort_dirty: data_table.sort_dirty,
                display_buffer: data_table.display_buffer,
                last_modified: Some(data_table.last_modified),
                spill_error: data_table.spill_error,
                value,
                alternating_colors: data_table.alternating_colors,
                formats: export_formats(data_table.formats),
                borders: export_borders(data_table.borders),
                chart_pixel_output: data_table.chart_pixel_output,
                chart_output: data_table.chart_output,
            };

            (current::PosSchema::from(pos), data_table)
        })
        .collect()
}
