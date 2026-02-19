use anyhow::Result;

use crate::grid::file::serialize::contiguous_2d::import_contiguous_2d;
use crate::grid::file::serialize::contiguous_2d::opt_fn;
use crate::grid::file::v1_7::schema::OffsetsSchema;
use crate::grid::file::v1_7_1 as current;
use crate::grid::file::v1_8;
use crate::grid::formatting::RenderSize;
use crate::{DEFAULT_HTML_HEIGHT, DEFAULT_HTML_WIDTH, Pos};

use super::sheet_offsets::Offsets;

fn import_render_size(render_size: current::RenderSizeSchema) -> RenderSize {
    RenderSize {
        w: render_size.w,
        h: render_size.h,
    }
}

fn upgrade_code_runs(
    code_runs: Vec<(current::PosSchema, current::CodeRunSchema)>,
    columns: &[(i64, current::ColumnSchema)],
    render_size: current::Contiguous2DSchema<Option<current::RenderSizeSchema>>,
    offsets: &OffsetsSchema,
) -> Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>> {
    let render_size = import_contiguous_2d(render_size, opt_fn(import_render_size));
    code_runs
        .into_iter()
        .enumerate()
        .map(|(i, (pos, code_run))| {
            let mut is_chart_or_html = false;

            let column = columns
                .iter()
                .find(|(x, _)| *x == pos.x)
                .ok_or_else(|| anyhow::anyhow!("Column {} not found", pos.x))?;

            let code = column
                .1
                .iter()
                .find_map(|(y, value)| if *y == pos.y { Some(value) } else { None });
            let mut column_headers = None;
            let is_connection = if let Some(current::CellValueSchema::Code(code_cell)) = code {
                matches!(
                    code_cell.language,
                    current::CodeCellLanguageSchema::Connection { .. }
                )
            } else {
                false
            };

            let (value, error) = match code_run.result {
                current::CodeRunResultSchema::Err(error) => (
                    v1_8::OutputValueSchema::Single(v1_8::CellValueSchema::Blank),
                    Some(error),
                ),
                current::CodeRunResultSchema::Ok(value) => {
                    let value = match value {
                        current::OutputValueSchema::Single(cell_value) => {
                            if matches!(
                                cell_value,
                                current::CellValueSchema::Html(_)
                                    | current::CellValueSchema::Image(_)
                            ) {
                                is_chart_or_html = true;
                            }
                            v1_8::OutputValueSchema::Single(cell_value.into())
                        }
                        current::OutputValueSchema::Array(array) => {
                            let values = array
                                .values
                                .into_iter()
                                .map(|v| v.into())
                                .collect::<Vec<v1_8::CellValueSchema>>();

                            // collect column headers for connections
                            if is_connection {
                                column_headers = Some(
                                    values
                                        .iter()
                                        .take(array.size.w as usize)
                                        .enumerate()
                                        .map(|(i, name)| v1_8::DataTableColumnSchema {
                                            name: name.clone(),
                                            display: true,
                                            value_index: i as u32,
                                        })
                                        .collect::<Vec<_>>(),
                                );
                            }

                            v1_8::OutputValueSchema::Array(v1_8::OutputArraySchema {
                                size: v1_8::OutputSizeSchema {
                                    w: array.size.w,
                                    h: array.size.h,
                                },
                                values,
                            })
                        }
                    };
                    (value, None)
                }
            };

            let new_code_run = v1_8::CodeRunSchema {
                std_out: code_run.std_out,
                std_err: code_run.std_err,
                cells_accessed: code_run.cells_accessed,
                error: error.map(|spanned| v1_8::RunErrorSchema {
                    span: spanned.span,
                    msg: upgrade_error_msg(spanned.msg),
                }),
                return_type: code_run.return_type,
                line_number: code_run.line_number,
                output_type: code_run.output_type,
            };

            let data_table_name = if let Some(current::CellValueSchema::Code(code_cell)) = code {
                match code_cell.language {
                    current::CodeCellLanguageSchema::Formula => Some("Formula"),
                    current::CodeCellLanguageSchema::Javascript => {
                        if is_chart_or_html {
                            Some("Chart")
                        } else {
                            Some("JavaScript")
                        }
                    }
                    current::CodeCellLanguageSchema::Python => {
                        if is_chart_or_html {
                            Some("Chart")
                        } else {
                            Some("Python")
                        }
                    }
                    _ => Some("Table"),
                }
            } else {
                Some("Table")
            };
            let data_table_name = format!("{}{}", data_table_name.unwrap_or("Table"), i + 1);

            let chart_pos = Pos { x: pos.x, y: pos.y };
            let chart_pixel_output = render_size.get(chart_pos).and_then(|render_size| {
                render_size
                    .w
                    .parse::<f32>()
                    .ok()
                    .and_then(|w| render_size.h.parse::<f32>().ok().map(|h| (w, h)))
            });
            let chart_output = if is_chart_or_html {
                let (pixel_width, pixel_height) =
                    chart_pixel_output.unwrap_or((DEFAULT_HTML_WIDTH, DEFAULT_HTML_HEIGHT));
                let column_widths = Offsets::import_columns(offsets.0.clone());
                let start_x = column_widths.position(pos.x);
                let end = column_widths.find_offset(start_x + pixel_width as f64).0;
                let w = end - pos.x + 1;

                let row_heights = Offsets::import_rows(offsets.1.clone());
                let start_y = row_heights.position(pos.y);
                let end = row_heights.find_offset(start_y + pixel_height as f64).0;
                let h = end - pos.y + 1;
                Some((w as u32, h as u32))
            } else {
                None
            };

            let header_is_first_row = is_connection;
            let new_data_table = v1_8::DataTableSchema {
                kind: v1_8::DataTableKindSchema::CodeRun(new_code_run),
                name: data_table_name,
                header_is_first_row, // true for connections, false for all else
                show_ui: true,
                show_name: chart_output.is_some(),
                show_columns: chart_output.is_some() || header_is_first_row, // true for connections and chart output, false for all else
                columns: column_headers, // the first row of the data table for connections, None for all else
                sort: None,
                sort_dirty: false,
                display_buffer: None,
                value,
                readonly: true,
                spill_error: code_run.spill_error,
                last_modified: code_run.last_modified,
                alternating_colors: false,
                formats: Default::default(),
                borders: Default::default(),
                chart_pixel_output,
                chart_output,
            };
            Ok((v1_8::PosSchema::from(pos), new_data_table))
        })
        .collect::<Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>>>()
}

pub fn upgrade_sheet(sheet: current::SheetSchema) -> v1_8::SheetSchema {
    let current::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        formats,
        validations,
        borders,
        code_runs,
        columns,
    } = sheet;

    let current::SheetFormattingSchema { render_size, .. } = formats;

    let upgraded_formats = v1_8::SheetFormattingSchema {
        align: formats.align,
        vertical_align: formats.vertical_align,
        wrap: formats.wrap,
        numeric_format: formats.numeric_format,
        numeric_decimals: formats.numeric_decimals,
        numeric_commas: formats.numeric_commas,
        bold: formats.bold,
        italic: formats.italic,
        text_color: formats.text_color,
        fill_color: formats.fill_color,
        date_time: formats.date_time,
        underline: formats.underline,
        strike_through: formats.strike_through,
    };

    let data_tables =
        upgrade_code_runs(code_runs, &columns, render_size, &offsets).unwrap_or_default();

    let upgraded_columns = columns.into_iter().map(|(i, column)| {
        let new_column = column.into_iter().map(|(j, value)| (j, value.into()));
        (i, new_column.collect())
    });

    v1_8::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        validations,
        borders,
        formats: upgraded_formats,
        data_tables,
        columns: upgraded_columns.collect(),
    }
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_8::GridSchema> {
    let new_grid = v1_8::GridSchema {
        version: Some("1.8".to_string()),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}

#[rustfmt::skip]
fn upgrade_error_msg(e: super::RunErrorMsgSchema) -> v1_8::RunErrorMsgSchema {
    match e {
        super::RunErrorMsgSchema::CodeRunError(cow) => v1_8::RunErrorMsgSchema::CodeRunError(cow),
        super::RunErrorMsgSchema::Spill => v1_8::RunErrorMsgSchema::Spill,
        super::RunErrorMsgSchema::Unimplemented(cow) => v1_8::RunErrorMsgSchema::Unimplemented(cow),
        super::RunErrorMsgSchema::UnknownError => v1_8::RunErrorMsgSchema::UnknownError,
        super::RunErrorMsgSchema::InternalError(cow) => v1_8::RunErrorMsgSchema::InternalError(cow),
        super::RunErrorMsgSchema::Unterminated(cow) => v1_8::RunErrorMsgSchema::Unterminated(cow),
        super::RunErrorMsgSchema::Expected { expected, got } => v1_8::RunErrorMsgSchema::Expected { expected, got },
        super::RunErrorMsgSchema::Unexpected(cow) => v1_8::RunErrorMsgSchema::Unexpected(cow),
        super::RunErrorMsgSchema::TooManyArguments { func_name, max_arg_count } => v1_8::RunErrorMsgSchema::TooManyArguments { func_name, max_arg_count },
        super::RunErrorMsgSchema::MissingRequiredArgument { func_name, arg_name } => v1_8::RunErrorMsgSchema::MissingRequiredArgument { func_name, arg_name },
        super::RunErrorMsgSchema::BadFunctionName => v1_8::RunErrorMsgSchema::BadFunctionName,
        super::RunErrorMsgSchema::BadCellReference => v1_8::RunErrorMsgSchema::BadCellReference,
        super::RunErrorMsgSchema::BadNumber => v1_8::RunErrorMsgSchema::BadNumber,
        super::RunErrorMsgSchema::BadOp { op, ty1, ty2, use_duration_instead } => v1_8::RunErrorMsgSchema::BadOp { op, ty1, ty2, use_duration_instead },
        super::RunErrorMsgSchema::NaN => v1_8::RunErrorMsgSchema::NaN,
        super::RunErrorMsgSchema::ExactArraySizeMismatch { expected, got } => v1_8::RunErrorMsgSchema::ExactArraySizeMismatch { expected, got },
        super::RunErrorMsgSchema::ExactArrayAxisMismatch { axis, expected, got } => v1_8::RunErrorMsgSchema::ExactArrayAxisMismatch { axis, expected, got },
        super::RunErrorMsgSchema::ArrayAxisMismatch { axis, expected, got } => v1_8::RunErrorMsgSchema::ArrayAxisMismatch { axis, expected, got },
        super::RunErrorMsgSchema::EmptyArray => v1_8::RunErrorMsgSchema::EmptyArray,
        super::RunErrorMsgSchema::NonRectangularArray => v1_8::RunErrorMsgSchema::NonRectangularArray,
        super::RunErrorMsgSchema::NonLinearArray => v1_8::RunErrorMsgSchema::NonLinearArray,
        super::RunErrorMsgSchema::ArrayTooBig => v1_8::RunErrorMsgSchema::ArrayTooBig,
        super::RunErrorMsgSchema::CircularReference => v1_8::RunErrorMsgSchema::CircularReference,
        super::RunErrorMsgSchema::Overflow => v1_8::RunErrorMsgSchema::Overflow,
        super::RunErrorMsgSchema::DivideByZero => v1_8::RunErrorMsgSchema::DivideByZero,
        super::RunErrorMsgSchema::NegativeExponent => v1_8::RunErrorMsgSchema::NegativeExponent,
        super::RunErrorMsgSchema::NotANumber => v1_8::RunErrorMsgSchema::NotANumber,
        super::RunErrorMsgSchema::Infinity => v1_8::RunErrorMsgSchema::Infinity,
        super::RunErrorMsgSchema::IndexOutOfBounds => v1_8::RunErrorMsgSchema::IndexOutOfBounds,
        super::RunErrorMsgSchema::NoMatch => v1_8::RunErrorMsgSchema::NoMatch,
        super::RunErrorMsgSchema::InvalidArgument => v1_8::RunErrorMsgSchema::InvalidArgument,
    }
}
