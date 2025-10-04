use anyhow::Result;

use super::schema::{self as current};
use crate::{
    color::Rgba,
    grid::{
        file::{
            v1_6::borders_upgrade::export_borders,
            v1_7::schema::{self as v1_7},
        },
        sheet::borders::{BorderStyle, CellBorderLine, borders_old::OldBorders},
    },
};

fn convert_cell_value(cell_value: current::CellValue) -> v1_7::CellValueSchema {
    match cell_value {
        current::CellValue::Blank => v1_7::CellValueSchema::Blank,
        current::CellValue::Text(str) => v1_7::CellValueSchema::Text(str),
        current::CellValue::Number(str) => v1_7::CellValueSchema::Number(str),
        current::CellValue::Html(str) => v1_7::CellValueSchema::Html(str),
        current::CellValue::Code(code_cell) => v1_7::CellValueSchema::Code(code_cell),
        current::CellValue::Logical(bool) => v1_7::CellValueSchema::Logical(bool),
        current::CellValue::Instant(str) => v1_7::CellValueSchema::Instant(str),
        current::CellValue::Date(date) => v1_7::CellValueSchema::Date(date),
        current::CellValue::Time(time) => v1_7::CellValueSchema::Time(time),
        current::CellValue::DateTime(datetime) => v1_7::CellValueSchema::DateTime(datetime),
        current::CellValue::Duration(str) => v1_7::CellValueSchema::Duration(str),
        current::CellValue::Error(run_error) => {
            v1_7::CellValueSchema::Error(convert_run_error_msg(run_error))
        }
        current::CellValue::Image(str) => v1_7::CellValueSchema::Image(str),
    }
}

fn convert_run_error_msg(run_error: current::RunError) -> v1_7::RunErrorSchema {
    v1_7::RunErrorSchema {
        span: run_error.span,
        msg: match run_error.msg {
            current::RunErrorMsg::PythonError(str) => v1_7::RunErrorMsgSchema::CodeRunError(str),
            current::RunErrorMsg::Spill => v1_7::RunErrorMsgSchema::Spill,
            current::RunErrorMsg::Unimplemented(str) => v1_7::RunErrorMsgSchema::Unimplemented(str),
            current::RunErrorMsg::UnknownError => v1_7::RunErrorMsgSchema::UnknownError,
            current::RunErrorMsg::InternalError(str) => v1_7::RunErrorMsgSchema::InternalError(str),
            current::RunErrorMsg::Unterminated(str) => v1_7::RunErrorMsgSchema::Unterminated(str),
            current::RunErrorMsg::Expected { expected, got } => {
                v1_7::RunErrorMsgSchema::Expected { expected, got }
            }
            current::RunErrorMsg::Unexpected(str) => v1_7::RunErrorMsgSchema::Unexpected(str),
            current::RunErrorMsg::TooManyArguments {
                func_name,
                max_arg_count,
            } => v1_7::RunErrorMsgSchema::TooManyArguments {
                func_name,
                max_arg_count,
            },
            current::RunErrorMsg::MissingRequiredArgument {
                func_name,
                arg_name,
            } => v1_7::RunErrorMsgSchema::MissingRequiredArgument {
                func_name,
                arg_name,
            },
            current::RunErrorMsg::BadFunctionName => v1_7::RunErrorMsgSchema::BadFunctionName,
            current::RunErrorMsg::BadCellReference => v1_7::RunErrorMsgSchema::BadCellReference,
            current::RunErrorMsg::BadNumber => v1_7::RunErrorMsgSchema::BadNumber,
            current::RunErrorMsg::BadOp {
                op,
                ty1,
                ty2,
                use_duration_instead,
            } => v1_7::RunErrorMsgSchema::BadOp {
                op,
                ty1,
                ty2,
                use_duration_instead,
            },
            current::RunErrorMsg::NaN => v1_7::RunErrorMsgSchema::NaN,
            current::RunErrorMsg::ExactArraySizeMismatch { expected, got } => {
                v1_7::RunErrorMsgSchema::ExactArraySizeMismatch {
                    expected: v1_7::OutputSizeSchema {
                        w: expected.w,
                        h: expected.h,
                    },
                    got: v1_7::OutputSizeSchema { w: got.w, h: got.h },
                }
            }
            current::RunErrorMsg::ExactArrayAxisMismatch {
                axis,
                expected,
                got,
            } => v1_7::RunErrorMsgSchema::ExactArrayAxisMismatch {
                axis: match axis {
                    current::Axis::X => v1_7::AxisSchema::X,
                    current::Axis::Y => v1_7::AxisSchema::Y,
                },
                expected,
                got,
            },
            current::RunErrorMsg::ArrayAxisMismatch {
                axis,
                expected,
                got,
            } => v1_7::RunErrorMsgSchema::ArrayAxisMismatch {
                axis: match axis {
                    current::Axis::X => v1_7::AxisSchema::X,
                    current::Axis::Y => v1_7::AxisSchema::Y,
                },
                expected,
                got,
            },
            current::RunErrorMsg::EmptyArray => v1_7::RunErrorMsgSchema::EmptyArray,
            current::RunErrorMsg::NonRectangularArray => {
                v1_7::RunErrorMsgSchema::NonRectangularArray
            }
            current::RunErrorMsg::NonLinearArray => v1_7::RunErrorMsgSchema::NonLinearArray,
            current::RunErrorMsg::ArrayTooBig => v1_7::RunErrorMsgSchema::ArrayTooBig,
            current::RunErrorMsg::CircularReference => v1_7::RunErrorMsgSchema::CircularReference,
            current::RunErrorMsg::Overflow => v1_7::RunErrorMsgSchema::Overflow,
            current::RunErrorMsg::DivideByZero => v1_7::RunErrorMsgSchema::DivideByZero,
            current::RunErrorMsg::NegativeExponent => v1_7::RunErrorMsgSchema::NegativeExponent,
            current::RunErrorMsg::NotANumber => v1_7::RunErrorMsgSchema::NotANumber,
            current::RunErrorMsg::Infinity => v1_7::RunErrorMsgSchema::Infinity,
            current::RunErrorMsg::IndexOutOfBounds => v1_7::RunErrorMsgSchema::IndexOutOfBounds,
            current::RunErrorMsg::NoMatch => v1_7::RunErrorMsgSchema::NoMatch,
            current::RunErrorMsg::InvalidArgument => v1_7::RunErrorMsgSchema::InvalidArgument,
        },
    }
}

fn upgrade_code_runs(
    code_runs: Vec<(current::Pos, current::CodeRun)>,
) -> Vec<(v1_7::PosSchema, v1_7::CodeRunSchema)> {
    code_runs
        .into_iter()
        .map(|(pos, code_run)| {
            (
                v1_7::PosSchema { x: pos.x, y: pos.y },
                v1_7::CodeRunSchema {
                    formatted_code_string: code_run.formatted_code_string,
                    std_out: code_run.std_out,
                    std_err: code_run.std_err,
                    cells_accessed: code_run.cells_accessed,
                    result: match code_run.result {
                        current::CodeRunResult::Ok(output_value) => {
                            v1_7::CodeRunResultSchema::Ok(match output_value {
                                current::OutputValue::Single(output_value_value) => {
                                    v1_7::OutputValueSchema::Single(convert_cell_value(
                                        output_value_value,
                                    ))
                                }
                                current::OutputValue::Array(output_value_value) => {
                                    v1_7::OutputValueSchema::Array(v1_7::OutputArraySchema {
                                        size: output_value_value.size,
                                        values: output_value_value
                                            .values
                                            .into_iter()
                                            .map(convert_cell_value)
                                            .collect(),
                                    })
                                }
                            })
                        }
                        current::CodeRunResult::Err(run_error) => {
                            v1_7::CodeRunResultSchema::Err(convert_run_error_msg(run_error))
                        }
                    },
                    return_type: code_run.return_type,
                    line_number: code_run.line_number,
                    output_type: code_run.output_type,
                    spill_error: code_run.spill_error,
                    last_modified: code_run.last_modified,
                },
            )
        })
        .collect()
}

fn upgrade_columns(column: Vec<(i64, current::Column)>) -> Vec<(i64, v1_7::ColumnSchema)> {
    column
        .into_iter()
        .map(|(x, column)| {
            (
                x,
                v1_7::ColumnSchema {
                    values: column
                        .values
                        .into_iter()
                        .map(|(y, cell_value)| (y, convert_cell_value(cell_value)))
                        .collect(),
                    align: column.align,
                    vertical_align: column.vertical_align,
                    wrap: column.wrap,
                    numeric_format: column.numeric_format,
                    numeric_decimals: column.numeric_decimals,
                    numeric_commas: column.numeric_commas,
                    bold: column.bold,
                    italic: column.italic,
                    underline: column.underline,
                    strike_through: column.strike_through,
                    text_color: column.text_color,
                    fill_color: column.fill_color,
                    render_size: column.render_size,
                    date_time: column.date_time,
                },
            )
        })
        .collect()
}

fn upgrade_borders(borders: current::Borders) -> Result<v1_7::BordersSchema> {
    fn convert_border_style(border_style: current::CellBorder) -> Result<BorderStyle> {
        let mut color = Rgba::try_from(border_style.color.as_str())?;

        // the alpha was set incorrectly to 1; should be 255
        color.alpha = 255;

        let line = match border_style.line.as_str() {
            "line1" => CellBorderLine::Line1,
            "line2" => CellBorderLine::Line2,
            "line3" => CellBorderLine::Line3,
            "dotted" => CellBorderLine::Dotted,
            "dashed" => CellBorderLine::Dashed,
            "double" => CellBorderLine::Double,
            _ => return Err(anyhow::anyhow!("Invalid border line style")),
        };
        Ok(BorderStyle { color, line })
    }

    let mut borders_new = OldBorders::default();
    for (col_id, sheet_borders) in borders {
        if sheet_borders.is_empty() {
            continue;
        }
        let col: i64 = col_id
            .parse::<i64>()
            .expect("Failed to parse col_id as i64");
        for (row, mut row_borders) in sheet_borders {
            if let Some(left_old) = row_borders[0].take()
                && let Ok(style) = convert_border_style(left_old)
            {
                borders_new.set(col, row, None, None, Some(style), None);
            }
            if let Some(right_old) = row_borders[2].take()
                && let Ok(style) = convert_border_style(right_old)
            {
                borders_new.set(col, row, None, None, None, Some(style));
            }
            if let Some(top_old) = row_borders[1].take()
                && let Ok(style) = convert_border_style(top_old)
            {
                borders_new.set(col, row, Some(style), None, None, None);
            }
            if let Some(bottom_old) = row_borders[3].take()
                && let Ok(style) = convert_border_style(bottom_old)
            {
                borders_new.set(col, row, None, Some(style), None, None);
            }
        }
    }

    let borders = export_borders(borders_new);
    Ok(borders)
}

pub(crate) fn upgrade_sheet(sheet: current::Sheet) -> Result<v1_7::SheetSchema> {
    Ok(v1_7::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        columns: upgrade_columns(sheet.columns),
        code_runs: upgrade_code_runs(sheet.code_runs),
        formats_all: sheet.formats_all,
        formats_columns: sheet.formats_columns,
        formats_rows: sheet.formats_rows,
        rows_resize: sheet.rows_resize,
        validations: sheet.validations,
        borders: upgrade_borders(sheet.borders)?,
    })
}

pub(crate) fn upgrade(grid: current::GridSchema) -> Result<v1_7::GridSchema> {
    let new_grid = v1_7::GridSchema {
        version: Some("1.7".to_string()),
        sheets: grid
            .sheets
            .into_iter()
            .map(upgrade_sheet)
            .collect::<Result<_, _>>()?,
    };
    Ok(new_grid)
}

#[cfg(test)]
mod tests {

    use super::*;

    use crate::{
        controller::GridController,
        grid::{
            file::{export, import},
            sheet::borders::CellBorderLine,
        },
    };

    const V1_5_FILE: &[u8] =
        include_bytes!("../../../../../quadratic-rust-shared/data/grid/v1_5_simple.grid");

    const V1_6_BORDERS_FILE: &[u8] = include_bytes!("../../../../test-files/borders_1_6.grid");

    #[test]
    fn import_and_export_a_v1_5_file() {
        let imported = import(V1_5_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    fn import_and_export_a_v1_6_borders_file() {
        let imported = import(V1_6_BORDERS_FILE.to_vec()).unwrap();

        // this won't work because of the offsets shift
        // let exported = export(imported.clone()).unwrap();
        // let imported_copy = import(exported).unwrap();
        // assert_eq!(imported_copy, imported);

        let gc = GridController::from_grid(imported, 0);
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);

        let border_5_10 = sheet.borders.get_style_cell(pos![E10]);
        assert_eq!(border_5_10.left, None);
        assert_eq!(border_5_10.top, None);
        assert_eq!(border_5_10.bottom.unwrap().line, CellBorderLine::Line1);
        assert_eq!(border_5_10.bottom.unwrap().color, Rgba::new(0, 0, 0, 255));
        assert_eq!(border_5_10.right.unwrap().line, CellBorderLine::Line1);
        assert_eq!(border_5_10.right.unwrap().color, Rgba::new(0, 0, 0, 255));
    }
}
