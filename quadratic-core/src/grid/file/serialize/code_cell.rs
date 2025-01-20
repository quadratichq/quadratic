use std::str::FromStr;

use anyhow::Result;
use chrono::Utc;
use indexmap::IndexMap;
use itertools::Itertools;

use crate::{
    grid::{CellsAccessed, CodeRun, CodeRunResult, SheetId},
    CellRefCoord, CellRefRange, CellRefRangeEnd, Pos, RefRangeBounds, Value,
};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
};

fn import_cell_ref_coord(coord: current::CellRefCoordSchema) -> CellRefCoord {
    CellRefCoord {
        coord: coord.coord,
        is_absolute: coord.is_absolute,
    }
}

fn import_cell_ref_range(range: current::CellRefRangeSchema) -> CellRefRange {
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

pub(crate) fn import_code_cell_builder(
    code_runs: current::CodeRunsSchema,
) -> Result<IndexMap<Pos, CodeRun>> {
    let mut new_code_runs = IndexMap::new();

    for (pos, code_run) in code_runs.into_iter() {
        let cells_accessed = import_cells_accessed(code_run.cells_accessed)?;

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
    }
    Ok(new_code_runs)
}

fn export_cell_ref_coord(coord: CellRefCoord) -> current::CellRefCoordSchema {
    current::CellRefCoordSchema {
        coord: coord.coord,
        is_absolute: coord.is_absolute,
    }
}

fn export_cell_ref_range(range: CellRefRange) -> current::CellRefRangeSchema {
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

pub(crate) fn export_rows_code_runs(code_runs: IndexMap<Pos, CodeRun>) -> current::CodeRunsSchema {
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
                    last_modified: Some(code_run.last_modified),
                    std_out: code_run.std_out,
                    std_err: code_run.std_err,
                    spill_error: code_run.spill_error,
                    cells_accessed: export_cells_accessed(code_run.cells_accessed),
                    result,
                    return_type: code_run.return_type,
                    line_number: code_run.line_number,
                    output_type: code_run.output_type,
                },
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        grid::{CellsAccessed, CodeRun, CodeRunResult},
        CellValue, Pos, Value,
    };
    use chrono::Utc;
    use indexmap::IndexMap;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_export_cells_accessed() {
        let cells_accessed = CellsAccessed::default();
        let exported = export_cells_accessed(cells_accessed);
        assert_eq!(exported, vec![]);
    }

    #[test]
    #[parallel]
    fn test_import_code_cell_builder_empty() {
        let code_runs = vec![];
        let result = import_code_cell_builder(code_runs).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    #[parallel]
    fn test_import_code_cell_builder_single_cell() {
        let code_runs = vec![(
            current::PosSchema { x: 0, y: 0 },
            current::CodeRunSchema {
                last_modified: Some(Utc::now()),
                std_out: Some("Hello".to_string()),
                std_err: None,
                spill_error: false,
                cells_accessed: vec![],
                result: current::CodeRunResultSchema::Ok(current::OutputValueSchema::Single(
                    current::CellValueSchema::Text("Hello".to_string()),
                )),
                return_type: Some("string".to_string()),
                line_number: Some(1),
                output_type: Some("text".to_string()),
            },
        )];

        let result = import_code_cell_builder(code_runs).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result.contains_key(&Pos { x: 0, y: 0 }));
    }

    #[test]
    #[parallel]
    fn test_import_code_cell_builder_multiple_cells() {
        let code_runs = vec![
            (
                current::PosSchema { x: 0, y: 0 },
                current::CodeRunSchema {
                    last_modified: Some(Utc::now()),
                    std_out: None,
                    std_err: None,
                    spill_error: false,
                    cells_accessed: vec![],
                    result: current::CodeRunResultSchema::Ok(current::OutputValueSchema::Single(
                        current::CellValueSchema::Number("2".into()),
                    )),
                    return_type: Some("number".to_string()),
                    line_number: Some(1),
                    output_type: Some("number".to_string()),
                },
            ),
            (
                current::PosSchema { x: 1, y: 0 },
                current::CodeRunSchema {
                    last_modified: Some(Utc::now()),
                    std_out: None,
                    std_err: None,
                    spill_error: false,
                    cells_accessed: vec![],
                    result: current::CodeRunResultSchema::Ok(current::OutputValueSchema::Single(
                        current::CellValueSchema::Text("Hello World".to_string()),
                    )),
                    return_type: Some("string".to_string()),
                    line_number: Some(1),
                    output_type: Some("text".to_string()),
                },
            ),
        ];

        let result = import_code_cell_builder(code_runs).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.contains_key(&Pos { x: 0, y: 0 }));
        assert!(result.contains_key(&Pos { x: 1, y: 0 }));
    }

    #[test]
    #[parallel]
    fn test_export_rows_code_runs_empty() {
        let code_runs = IndexMap::new();
        let result = export_rows_code_runs(code_runs);
        assert!(result.is_empty());
    }

    #[test]
    #[parallel]
    fn test_export_rows_code_runs_single_cell() {
        let mut code_runs = IndexMap::new();
        code_runs.insert(
            Pos { x: 0, y: 0 },
            CodeRun {
                last_modified: Utc::now(),
                std_out: Some("Hello".to_string()),
                std_err: None,
                spill_error: false,
                cells_accessed: CellsAccessed::default(),
                result: CodeRunResult::Ok(Value::Single(CellValue::Text("Hello".to_string()))),
                return_type: Some("string".to_string()),
                line_number: Some(1),
                output_type: Some("text".to_string()),
            },
        );

        let result = export_rows_code_runs(code_runs);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].0.x, 0);
        assert_eq!(result[0].0.y, 0);
    }

    #[test]
    #[parallel]
    fn test_export_rows_code_runs_multiple_cells() {
        let mut code_runs = IndexMap::new();
        code_runs.insert(
            Pos { x: 0, y: 0 },
            CodeRun {
                last_modified: Utc::now(),
                std_out: None,
                std_err: None,
                spill_error: false,
                cells_accessed: CellsAccessed::default(),
                result: CodeRunResult::Ok(Value::Single(CellValue::Number(2.into()))),
                return_type: Some("number".to_string()),
                line_number: Some(1),
                output_type: Some("number".to_string()),
            },
        );
        code_runs.insert(
            Pos { x: 1, y: 0 },
            CodeRun {
                last_modified: Utc::now(),
                std_out: None,
                std_err: None,
                spill_error: false,
                cells_accessed: CellsAccessed::default(),
                result: CodeRunResult::Ok(Value::Single(CellValue::Text(
                    "Hello World".to_string(),
                ))),
                return_type: Some("string".to_string()),
                line_number: Some(1),
                output_type: Some("text".to_string()),
            },
        );

        let result = export_rows_code_runs(code_runs);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].0.x, 0);
        assert_eq!(result[0].0.y, 0);
        assert_eq!(result[1].0.x, 1);
        assert_eq!(result[1].0.y, 0);
    }

    #[test]
    #[parallel]
    fn test_import_export_roundtrip() {
        let original_code_runs = vec![(
            current::PosSchema { x: 0, y: 0 },
            current::CodeRunSchema {
                last_modified: Some(Utc::now()),
                std_out: None,
                std_err: None,
                spill_error: false,
                cells_accessed: vec![],
                result: current::CodeRunResultSchema::Ok(current::OutputValueSchema::Single(
                    current::CellValueSchema::Number("2".into()),
                )),
                return_type: Some("number".to_string()),
                line_number: Some(1),
                output_type: Some("number".to_string()),
            },
        )];

        let imported = import_code_cell_builder(original_code_runs.clone()).unwrap();
        let exported = export_rows_code_runs(imported);

        assert_eq!(original_code_runs.len(), exported.len());
        assert_eq!(original_code_runs[0].0.x, exported[0].0.x);
        assert_eq!(original_code_runs[0].0.y, exported[0].0.y);
        // Add more detailed comparisons here for other fields
    }
}
