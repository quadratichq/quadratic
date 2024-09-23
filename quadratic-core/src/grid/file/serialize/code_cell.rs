use anyhow::Result;
use chrono::Utc;
use indexmap::IndexMap;

use crate::{
    grid::{CodeRun, CodeRunResult, Sheet},
    Pos, Value,
};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
};

pub(crate) fn import_code_cell_builder(
    sheet: &current::SheetSchema,
) -> Result<IndexMap<Pos, CodeRun>> {
    let mut code_runs = IndexMap::new();

    sheet.code_runs.iter().for_each(|(pos, code_run)| {
        let cells_accessed = code_run
            .cells_accessed
            .iter()
            .map(|sheet_rect| crate::SheetRect::from(sheet_rect.clone()))
            .collect();

        let result = match &code_run.result {
            current::CodeRunResultSchema::Ok(output) => CodeRunResult::Ok(match output {
                current::OutputValueSchema::Single(value) => {
                    Value::Single(import_cell_value(value))
                }
                current::OutputValueSchema::Array(current::OutputArraySchema { size, values }) => {
                    Value::Array(crate::Array::from(
                        values
                            .chunks(size.w as usize)
                            .map(|row| row.iter().map(import_cell_value).collect::<Vec<_>>())
                            .collect::<Vec<Vec<_>>>(),
                    ))
                }
            }),
            current::CodeRunResultSchema::Err(error) => CodeRunResult::Err(error.clone().into()),
        };
        code_runs.insert(
            Pos { x: pos.x, y: pos.y },
            CodeRun {
                formatted_code_string: code_run.formatted_code_string.to_owned(),
                last_modified: code_run.last_modified.unwrap_or(Utc::now()), // this is required but fall back to now if failed
                std_out: code_run.std_out.to_owned(),
                std_err: code_run.std_err.to_owned(),
                spill_error: code_run.spill_error,
                cells_accessed,
                result,
                return_type: code_run.return_type.to_owned(),
                line_number: code_run.line_number.to_owned(),
                output_type: code_run.output_type.to_owned(),
            },
        );
    });
    Ok(code_runs)
}

pub(crate) fn export_rows_code_runs(
    sheet: &Sheet,
) -> Vec<(current::PosSchema, current::CodeRunSchema)> {
    sheet
        .code_runs
        .iter()
        .map(|(pos, code_run)| {
            let result = match &code_run.result {
                CodeRunResult::Ok(output) => match output {
                    Value::Single(cell_value) => current::CodeRunResultSchema::Ok(
                        current::OutputValueSchema::Single(export_cell_value(cell_value)),
                    ),
                    Value::Array(array) => current::CodeRunResultSchema::Ok(
                        current::OutputValueSchema::Array(current::OutputArraySchema {
                            size: current::OutputSizeSchema {
                                w: array.width() as i64,
                                h: array.height() as i64,
                            },
                            values: array
                                .rows()
                                .flat_map(|row| row.iter().map(export_cell_value))
                                .collect(),
                        }),
                    ),
                    Value::Tuple(_) => current::CodeRunResultSchema::Err(current::RunErrorSchema {
                        span: None,
                        msg: current::RunErrorMsgSchema::Unexpected("tuple as cell output".into()),
                    }),
                },
                CodeRunResult::Err(error) => current::CodeRunResultSchema::Err(
                    current::RunErrorSchema::from_grid_run_error(error.to_owned()),
                ),
            };

            (
                current::PosSchema::from(*pos),
                current::CodeRunSchema {
                    formatted_code_string: code_run.formatted_code_string.clone(),
                    last_modified: Some(code_run.last_modified),
                    std_out: code_run.std_out.clone(),
                    std_err: code_run.std_err.clone(),
                    spill_error: code_run.spill_error,
                    cells_accessed: code_run
                        .cells_accessed
                        .iter()
                        .map(|sheet_rect| current::SheetRectSchema::from(*sheet_rect))
                        .collect(),
                    result,
                    return_type: code_run.return_type.clone(),
                    line_number: code_run.line_number,
                    output_type: code_run.output_type.clone(),
                },
            )
        })
        .collect()
}
