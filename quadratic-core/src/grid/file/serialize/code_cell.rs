use anyhow::Result;
use chrono::Utc;
use indexmap::IndexMap;
use itertools::Itertools;

use crate::{
    grid::{CellsAccessed, CodeRun, CodeRunResult},
    Pos, Value,
};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
};

pub(crate) fn import_code_cell_builder(
    code_runs: Vec<(current::PosSchema, current::CodeRunSchema)>,
) -> Result<IndexMap<Pos, CodeRun>> {
    let mut new_code_runs = IndexMap::new();

    code_runs.into_iter().for_each(|(pos, code_run)| {
        let cells_accessed = code_run
            .cells_accessed
            .into_iter()
            .map(CellsAccessed::from)
            .collect();

        let result = match code_run.result {
            current::CodeRunResultSchema::Ok(output) => CodeRunResult::Ok(match output {
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
            }),
            current::CodeRunResultSchema::Err(error) => CodeRunResult::Err(error.to_owned().into()),
        };
        new_code_runs.insert(
            Pos { x: pos.x, y: pos.y },
            CodeRun {
                formatted_code_string: code_run.formatted_code_string,
                last_modified: code_run.last_modified.unwrap_or(Utc::now()), // this is required but fall back to now if failed
                std_out: code_run.std_out,
                std_err: code_run.std_err,
                spill_error: code_run.spill_error,
                cells_accessed,
                result,
                return_type: code_run.return_type,
                line_number: code_run.line_number,
                output_type: code_run.output_type,
            },
        );
    });
    Ok(new_code_runs)
}

pub(crate) fn export_rows_code_runs(
    code_runs: IndexMap<Pos, CodeRun>,
) -> Vec<(current::PosSchema, current::CodeRunSchema)> {
    code_runs
        .into_iter()
        .map(|(pos, code_run)| {
            let result = match code_run.result {
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
                                .flat_map(|row| {
                                    row.iter().map(|value| export_cell_value(value.to_owned()))
                                })
                                .collect(),
                        }),
                    ),
                    Value::Tuple(_) => current::CodeRunResultSchema::Err(current::RunErrorSchema {
                        span: None,
                        msg: current::RunErrorMsgSchema::Unexpected("tuple as cell output".into()),
                    }),
                },
                CodeRunResult::Err(error) => current::CodeRunResultSchema::Err(
                    current::RunErrorSchema::from_grid_run_error(error),
                ),
            };

            (
                current::PosSchema::from(pos),
                current::CodeRunSchema {
                    formatted_code_string: code_run.formatted_code_string,
                    last_modified: Some(code_run.last_modified),
                    std_out: code_run.std_out,
                    std_err: code_run.std_err,
                    spill_error: code_run.spill_error,
                    cells_accessed: code_run
                        .cells_accessed
                        .into_iter()
                        .map(current::SheetRectSchema::from)
                        .collect(),
                    result,
                    return_type: code_run.return_type,
                    line_number: code_run.line_number,
                    output_type: code_run.output_type,
                },
            )
        })
        .collect()
}
