use anyhow::Result;

use super::schema::{self as current};
use crate::{
    color::Rgba,
    grid::{
        file::{
            serialize::borders::export_borders,
            v1_7::schema::{self as v1_7},
        },
        sheet::borders::{BorderStyle, Borders, CellBorderLine},
    },
};

// index for old borders enum
// enum CellSide {
//     Left = 0,
//     Top = 1,
//     Right = 2,
//     Bottom = 3,
// }

fn upgrade_borders(borders: current::Borders) -> Result<v1_7::BordersSchema> {
    fn convert_border_style(border_style: current::CellBorder) -> Result<BorderStyle> {
        let mut color = Rgba::color_from_str(&border_style.color)?;

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

    let mut borders_new = Borders::default();
    for (col_id, sheet_borders) in borders {
        if sheet_borders.is_empty() {
            continue;
        }
        let col: i64 = col_id
            .parse::<i64>()
            .expect("Failed to parse col_id as i64");
        for (row, mut row_borders) in sheet_borders {
            if let Some(left_old) = row_borders[0].take() {
                if let Ok(style) = convert_border_style(left_old) {
                    borders_new.set(col, row, None, None, Some(style), None);
                }
            }
            if let Some(right_old) = row_borders[2].take() {
                if let Ok(style) = convert_border_style(right_old) {
                    borders_new.set(col, row, None, None, None, Some(style));
                }
            }
            if let Some(top_old) = row_borders[1].take() {
                if let Ok(style) = convert_border_style(top_old) {
                    borders_new.set(col, row, Some(style), None, None, None);
                }
            }
            if let Some(bottom_old) = row_borders[3].take() {
                if let Ok(style) = convert_border_style(bottom_old) {
                    borders_new.set(col, row, None, Some(style), None, None);
                }
            }
        }
    }

    let borders = export_borders(borders_new);
    Ok(borders)
}

fn upgrade_code_runs(
    sheet: current::Sheet,
) -> Result<Vec<(v1_7::PosSchema, v1_7::DataTableSchema)>> {
    sheet
        .code_runs
        .into_iter()
        .enumerate()
        .map(|(i, (pos, code_run))| {
            let error = if let current::CodeRunResult::Err(error) = &code_run.result {
                let new_error_msg = match error.msg.to_owned() {
                    current::RunErrorMsg::PythonError(msg) => {
                        v1_7::RunErrorMsgSchema::PythonError(msg)
                    }
                    current::RunErrorMsg::Unexpected(msg) => {
                        v1_7::RunErrorMsgSchema::Unexpected(msg)
                    }
                    current::RunErrorMsg::Spill => v1_7::RunErrorMsgSchema::Spill,
                    current::RunErrorMsg::Unimplemented(msg) => {
                        v1_7::RunErrorMsgSchema::Unimplemented(msg)
                    }
                    current::RunErrorMsg::UnknownError => v1_7::RunErrorMsgSchema::UnknownError,
                    current::RunErrorMsg::InternalError(msg) => {
                        v1_7::RunErrorMsgSchema::InternalError(msg)
                    }
                    current::RunErrorMsg::Unterminated(msg) => {
                        v1_7::RunErrorMsgSchema::Unterminated(msg)
                    }
                    current::RunErrorMsg::Expected { expected, got } => {
                        v1_7::RunErrorMsgSchema::Expected { expected, got }
                    }
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
                    current::RunErrorMsg::BadFunctionName => {
                        v1_7::RunErrorMsgSchema::BadFunctionName
                    }
                    current::RunErrorMsg::BadCellReference => {
                        v1_7::RunErrorMsgSchema::BadCellReference
                    }
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
                        v1_7::RunErrorMsgSchema::ExactArraySizeMismatch { expected, got }
                    }
                    current::RunErrorMsg::ExactArrayAxisMismatch {
                        axis,
                        expected,
                        got,
                    } => v1_7::RunErrorMsgSchema::ExactArrayAxisMismatch {
                        axis,
                        expected,
                        got,
                    },
                    current::RunErrorMsg::ArrayAxisMismatch {
                        axis,
                        expected,
                        got,
                    } => v1_7::RunErrorMsgSchema::ArrayAxisMismatch {
                        axis,
                        expected,
                        got,
                    },
                    current::RunErrorMsg::EmptyArray => v1_7::RunErrorMsgSchema::EmptyArray,
                    current::RunErrorMsg::NonRectangularArray => {
                        v1_7::RunErrorMsgSchema::NonRectangularArray
                    }
                    current::RunErrorMsg::NonLinearArray => v1_7::RunErrorMsgSchema::NonLinearArray,
                    current::RunErrorMsg::ArrayTooBig => v1_7::RunErrorMsgSchema::ArrayTooBig,
                    current::RunErrorMsg::CircularReference => {
                        v1_7::RunErrorMsgSchema::CircularReference
                    }
                    current::RunErrorMsg::Overflow => v1_7::RunErrorMsgSchema::Overflow,
                    current::RunErrorMsg::DivideByZero => v1_7::RunErrorMsgSchema::DivideByZero,
                    current::RunErrorMsg::NegativeExponent => {
                        v1_7::RunErrorMsgSchema::NegativeExponent
                    }
                    current::RunErrorMsg::NotANumber => v1_7::RunErrorMsgSchema::NotANumber,
                    current::RunErrorMsg::Infinity => v1_7::RunErrorMsgSchema::Infinity,
                    current::RunErrorMsg::IndexOutOfBounds => {
                        v1_7::RunErrorMsgSchema::IndexOutOfBounds
                    }
                    current::RunErrorMsg::NoMatch => v1_7::RunErrorMsgSchema::NoMatch,
                    current::RunErrorMsg::InvalidArgument => {
                        v1_7::RunErrorMsgSchema::InvalidArgument
                    }
                };
                let new_error = v1_7::RunErrorSchema {
                    span: None,
                    msg: new_error_msg,
                };
                Some(new_error)
            } else {
                None
            };
            let new_code_run = v1_7::CodeRunSchema {
                formatted_code_string: code_run.formatted_code_string,
                std_out: code_run.std_out,
                std_err: code_run.std_err,
                cells_accessed: code_run.cells_accessed,
                error,
                return_type: code_run.return_type,
                line_number: code_run.line_number,
                output_type: code_run.output_type,
            };
            let value = if let current::CodeRunResult::Ok(value) = &code_run.result {
                value.to_owned()
            } else {
                v1_7::OutputValueSchema::Single(v1_7::CellValueSchema::Blank)
            };
            let new_data_table = v1_7::DataTableSchema {
                kind: v1_7::DataTableKindSchema::CodeRun(new_code_run),
                name: format!("Table {}", i),
                columns: None,
                display_buffer: None,
                value,
                readonly: true,
                spill_error: code_run.spill_error,
                last_modified: code_run.last_modified,
            };
            Ok((v1_7::PosSchema::from(pos), new_data_table))
        })
        .collect::<Result<Vec<(v1_7::PosSchema, v1_7::DataTableSchema)>>>()
}

pub fn upgrade_sheet(sheet: current::Sheet) -> Result<v1_7::SheetSchema> {
    let data_tables = upgrade_code_runs(sheet.clone())?;
    let borders = upgrade_borders(sheet.borders.clone())?;

    Ok(v1_7::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        columns: sheet.columns,
        data_tables,
        formats_all: sheet.formats_all,
        formats_columns: sheet.formats_columns,
        formats_rows: sheet.formats_rows,
        rows_resize: sheet.rows_resize,
        validations: sheet.validations,
        borders,
    })
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_7::GridSchema> {
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
    use serial_test::parallel;

    use super::*;

    use crate::{
        controller::GridController,
        grid::file::{export, import},
    };

    const V1_5_FILE: &[u8] =
        include_bytes!("../../../../../quadratic-rust-shared/data/grid/v1_5_simple.grid");

    const V1_6_BORDERS_FILE: &[u8] = include_bytes!("../../../../test-files/borders_1_6.grid");

    #[test]
    #[parallel]
    fn import_and_export_a_v1_5_file() {
        let imported = import(V1_5_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    #[parallel]
    fn import_and_export_a_v1_6_borders_file() {
        let imported = import(V1_6_BORDERS_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);

        let gc = GridController::from_grid(imported, 0);
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);

        let border_0_0 = sheet.borders.get(0, 0);
        assert_eq!(border_0_0.top.unwrap().line, CellBorderLine::Line1);
        assert_eq!(border_0_0.top.unwrap().color, Rgba::new(0, 0, 0, 255));
        assert_eq!(border_0_0.left.unwrap().line, CellBorderLine::Line1);
        assert_eq!(border_0_0.left.unwrap().color, Rgba::new(0, 0, 0, 255));
        assert_eq!(border_0_0.bottom, None);
        assert_eq!(border_0_0.right, None);
    }
}
