use std::collections::HashMap;

use anyhow::Result;

use crate::grid::file::v1_7_1;

use super::schema::{self as current};

fn upgrade_cells_accessed(
    cells_accessed: Vec<current::SheetRectSchema>,
) -> v1_7_1::CellsAccessedSchema {
    let mut new_cells_accessed: HashMap<v1_7_1::IdSchema, Vec<v1_7_1::A1RangeTypeSchema>> =
        HashMap::new();
    for cell_access in cells_accessed {
        let vec = new_cells_accessed
            .entry(v1_7_1::IdSchema::from(cell_access.sheet_id.id))
            .or_default();
        vec.push(v1_7_1::A1RangeTypeSchema::Rect(v1_7_1::RelRectSchema {
            min: v1_7_1::RelPosSchema {
                x: v1_7_1::RelColRowSchema {
                    index: cell_access.min.x as u64,
                    relative: true,
                },
                y: v1_7_1::RelColRowSchema {
                    index: cell_access.min.y as u64,
                    relative: true,
                },
            },
            max: v1_7_1::RelPosSchema {
                x: v1_7_1::RelColRowSchema {
                    index: cell_access.max.x as u64,
                    relative: true,
                },
                y: v1_7_1::RelColRowSchema {
                    index: cell_access.max.y as u64,
                    relative: true,
                },
            },
        }));
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
        validations: sheet.validations,
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
