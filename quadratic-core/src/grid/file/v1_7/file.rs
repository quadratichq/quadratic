use anyhow::Result;

use crate::grid::file::{
    v1_7::{self as v1_7},
    v1_7_1,
};

use super::upgrade_columns_formats;

fn render_size_to_chart_size(
    columns: &[(i64, v1_7::ColumnSchema)],
    pos: v1_7::PosSchema,
) -> Option<(f32, f32)> {
    columns
        .iter()
        .find(|(x, _)| *x == pos.x)
        .and_then(|(_, column)| {
            column.render_size.iter().find_map(|(y, render_size)| {
                if let Ok(y) = y.parse::<i64>() {
                    if pos.y >= y && pos.y < y + render_size.len as i64 {
                        if let (Ok(w), Ok(h)) = (
                            render_size.value.w.parse::<f32>(),
                            render_size.value.h.parse::<f32>(),
                        ) {
                            return Some((w, h));
                        }
                    }
                }
                None
            })
        })
}

fn upgrade_code_runs(
    code_runs: Vec<(v1_7::PosSchema, v1_7::CodeRunSchema)>,
) -> v1_7_1::CodeRunsSchema {
    code_runs
        .into_iter()
        .map(|(pos, code_run)| (pos, upgrade_code_run(code_run)))
        .collect()
}

fn upgrade_code_run(code_run: v1_7::CodeRunSchema) -> v1_7_1::CodeRunSchema {
    v1_7_1::CodeRunSchema {
        formatted_code_string: code_run.formatted_code_string,
        std_out: code_run.std_out,
        std_err: code_run.std_err,
        cells_accessed: v1_7::upgrade_cells_accessed(code_run.cells_accessed),
        result: code_run.result,
        spill_error: code_run.spill_error,
        last_modified: code_run.last_modified,
        return_type: code_run.return_type,
        line_number: code_run.line_number,
        output_type: code_run.output_type,
    }
}

pub fn upgrade_sheet(sheet: v1_7::SheetSchema) -> Result<v1_7_1::SheetSchema> {
    let formats_upgrade = v1_7::upgrade_formats_all_col_row(
        sheet.formats_all,
        sheet.formats_columns,
        sheet.formats_rows,
    );
    let (columns, formats) = upgrade_columns_formats(sheet.columns, formats_upgrade);

    Ok(v1_7_1::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        code_runs: upgrade_code_runs(sheet.code_runs),
        columns: sheet.columns,
        formats: formats_upgrade,
        rows_resize: sheet.rows_resize,
        validations: sheet.validations,
        borders: sheet.borders,
    })
}

pub fn upgrade(grid: v1_7::GridSchema) -> Result<v1_7_1::GridSchema> {
    let new_grid = v1_7_1::GridSchema {
        version: Some("1.7.1".to_string()),
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

    use crate::{
        color::Rgba,
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
