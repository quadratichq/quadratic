use std::collections::HashMap;

use anyhow::Result;

use crate::grid::file::v1_7_1;

use super::schema::{self as current};

fn upgrade_cells_accessed(
    cells_accessed: Vec<current::SheetRectSchema>,
) -> v1_7_1::CellsAccessedSchema {
    let mut new_cells_accessed: HashMap<v1_7_1::IdSchema, Vec<v1_7_1::CellRefRangeSchema>> =
        HashMap::new();

    for cell_access in cells_accessed {
        let vec = new_cells_accessed
            .entry(v1_7_1::IdSchema::from(cell_access.sheet_id.id))
            .or_default();
        vec.push(v1_7_1::CellRefRangeSchema {
            start: v1_7_1::CellRefRangeEndSchema {
                col: Some(v1_7_1::CellRefCoordSchema {
                    coord: cell_access.min.x as u64,
                    is_absolute: false,
                }),
                row: Some(v1_7_1::CellRefCoordSchema {
                    coord: cell_access.min.y as u64,
                    is_absolute: false,
                }),
            },
            end: Some(v1_7_1::CellRefRangeEndSchema {
                col: Some(v1_7_1::CellRefCoordSchema {
                    coord: cell_access.max.x as u64,
                    is_absolute: false,
                }),
                row: Some(v1_7_1::CellRefCoordSchema {
                    coord: cell_access.max.y as u64,
                    is_absolute: false,
                }),
            }),
        });
    }
    new_cells_accessed.into_iter().collect()
}

fn upgrade_code_run(code_run: current::CodeRunSchema) -> v1_7_1::CodeRunSchema {
    v1_7_1::CodeRunSchema {
        formatted_code_string: code_run.formatted_code_string,
        std_out: code_run.std_out,
        std_err: code_run.std_err,
        cells_accessed: upgrade_cells_accessed(code_run.cells_accessed),
        result: code_run.result,
        return_type: code_run.return_type,
        line_number: code_run.line_number,
        output_type: code_run.output_type,
        spill_error: code_run.spill_error,
        last_modified: code_run.last_modified,
    }
}

fn upgrade_code_runs(
    code_runs: Vec<(current::PosSchema, current::CodeRunSchema)>,
) -> Vec<(v1_7_1::PosSchema, v1_7_1::CodeRunSchema)> {
    code_runs
        .into_iter()
        .map(|(pos, code_run)| (pos, upgrade_code_run(code_run)))
        .collect()
}

// todo - translate validation selections by the grid shifting
fn upgrade_selection(selection: current::SelectionSchema) -> v1_7_1::A1SelectionSchema {
    let mut ranges = vec![];
    if selection.all {
        ranges.push(v1_7_1::CellRefRangeSchema {
            start: v1_7_1::CellRefRangeEndSchema {
                col: None,
                row: None,
            },
            end: Some(v1_7_1::CellRefRangeEndSchema {
                col: None,
                row: None,
            }),
        });
    } else {
        selection.rows.iter().for_each(|rows| {
            rows.iter().for_each(|row| {
                ranges.push(v1_7_1::CellRefRangeSchema {
                    start: v1_7_1::CellRefRangeEndSchema {
                        row: Some(v1_7_1::CellRefCoordSchema {
                            coord: *row as u64,
                            is_absolute: false,
                        }),
                        col: None,
                    },
                    end: None,
                });
            });
        });

        selection.columns.iter().for_each(|columns| {
            columns.iter().for_each(|column| {
                ranges.push(v1_7_1::CellRefRangeSchema {
                    start: v1_7_1::CellRefRangeEndSchema {
                        col: Some(v1_7_1::CellRefCoordSchema {
                            coord: *column as u64,
                            is_absolute: false,
                        }),
                        row: None,
                    },
                    end: None,
                });
            });
        });

        selection.rects.iter().for_each(|rects| {
            rects.iter().for_each(|rect| {
                ranges.push(v1_7_1::CellRefRangeSchema {
                    start: v1_7_1::CellRefRangeEndSchema {
                        col: Some(v1_7_1::CellRefCoordSchema {
                            coord: rect.min.x as u64,
                            is_absolute: false,
                        }),
                        row: Some(v1_7_1::CellRefCoordSchema {
                            coord: rect.min.y as u64,
                            is_absolute: false,
                        }),
                    },
                    end: (rect.max.x != rect.min.x || rect.max.y != rect.min.y).then_some(
                        v1_7_1::CellRefRangeEndSchema {
                            col: Some(v1_7_1::CellRefCoordSchema {
                                coord: rect.max.x as u64,
                                is_absolute: false,
                            }),
                            row: Some(v1_7_1::CellRefCoordSchema {
                                coord: rect.max.y as u64,
                                is_absolute: false,
                            }),
                        },
                    ),
                });
            });
        });
    }

    if ranges.is_empty() {
        ranges.push(v1_7_1::CellRefRangeSchema {
            start: v1_7_1::CellRefRangeEndSchema {
                col: Some(v1_7_1::CellRefCoordSchema {
                    coord: selection.x as u64,
                    is_absolute: false,
                }),
                row: Some(v1_7_1::CellRefCoordSchema {
                    coord: selection.y as u64,
                    is_absolute: false,
                }),
            },
            end: None,
        });
    }

    v1_7_1::A1SelectionSchema {
        sheet_id: v1_7_1::IdSchema::from(selection.sheet_id.to_string()),
        cursor: v1_7_1::PosSchema {
            x: selection.x,
            y: selection.y,
        },
        ranges,
    }
}

fn upgrade_validation_rule(rule: current::ValidationRuleSchema) -> v1_7_1::ValidationRuleSchema {
    match rule {
        current::ValidationRuleSchema::None => v1_7_1::ValidationRuleSchema::None,
        current::ValidationRuleSchema::List(list) => match list.source {
            current::ValidationListSourceSchema::Selection(selection) => {
                v1_7_1::ValidationRuleSchema::List(v1_7_1::ValidationListSchema {
                    source: v1_7_1::ValidationListSourceSchema::Selection(upgrade_selection(
                        selection,
                    )),
                    ignore_blank: list.ignore_blank,
                    drop_down: list.drop_down,
                })
            }
            current::ValidationListSourceSchema::List(string_list) => {
                v1_7_1::ValidationRuleSchema::List(v1_7_1::ValidationListSchema {
                    source: v1_7_1::ValidationListSourceSchema::List(string_list),
                    ignore_blank: list.ignore_blank,
                    drop_down: list.drop_down,
                })
            }
        },
        current::ValidationRuleSchema::Logical(logical) => {
            v1_7_1::ValidationRuleSchema::Logical(logical)
        }
        current::ValidationRuleSchema::Text(text) => v1_7_1::ValidationRuleSchema::Text(text),
        current::ValidationRuleSchema::Number(number) => {
            v1_7_1::ValidationRuleSchema::Number(number)
        }
        current::ValidationRuleSchema::DateTime(date_time) => {
            v1_7_1::ValidationRuleSchema::DateTime(date_time)
        }
    }
}

fn upgrade_validation(validation: current::ValidationSchema) -> v1_7_1::ValidationSchema {
    v1_7_1::ValidationSchema {
        id: validation.id,
        selection: upgrade_selection(validation.selection),
        rule: upgrade_validation_rule(validation.rule),
        message: validation.message,
        error: validation.error,
    }
}

fn upgrade_validations(validations: current::ValidationsSchema) -> v1_7_1::ValidationsSchema {
    v1_7_1::ValidationsSchema {
        validations: validations
            .validations
            .into_iter()
            .map(upgrade_validation)
            .collect(),
        warnings: validations.warnings,
    }
}

pub fn upgrade_sheet(sheet: current::SheetSchema) -> v1_7_1::SheetSchema {
    v1_7_1::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        columns: sheet.columns,
        code_runs: upgrade_code_runs(sheet.code_runs),
        formats_all: sheet.formats_all,
        formats_columns: sheet.formats_columns,
        formats_rows: sheet.formats_rows,
        rows_resize: sheet.rows_resize,
        validations: upgrade_validations(sheet.validations),
        borders: sheet.borders,
    }
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_7_1::GridSchema> {
    let new_grid = v1_7_1::GridSchema {
        version: "1.7.1".to_string(),
        sheets: grid
            .sheets
            .into_iter()
            .map(upgrade_sheet)
            .collect::<Vec<_>>(),
    };
    Ok(new_grid)
}
