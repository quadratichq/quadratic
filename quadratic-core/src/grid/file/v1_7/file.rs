use anyhow::Result;

use crate::grid::file::{
    v1_7::schema::{self as v1_7},
    v1_8::schema::{self as v1_8},
};

fn upgrade_code_runs(
    code_runs: Vec<(v1_7::PosSchema, v1_7::CodeRunSchema)>,
) -> Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>> {
    code_runs
        .into_iter()
        .enumerate()
        .map(|(i, (pos, code_run))| {
            let error = if let v1_7::CodeRunResultSchema::Err(error) = &code_run.result {
                Some(error.to_owned())
            } else {
                None
            };
            let new_code_run = v1_8::CodeRunSchema {
                formatted_code_string: code_run.formatted_code_string,
                std_out: code_run.std_out,
                std_err: code_run.std_err,
                cells_accessed: code_run.cells_accessed,
                error,
                return_type: code_run.return_type,
                line_number: code_run.line_number,
                output_type: code_run.output_type,
            };
            let value = if let v1_7::CodeRunResultSchema::Ok(value) = &code_run.result {
                match value.to_owned() {
                    v1_7::OutputValueSchema::Single(cell_value) => {
                        v1_8::OutputValueSchema::Single(cell_value)
                    }
                    v1_7::OutputValueSchema::Array(array) => {
                        v1_8::OutputValueSchema::Array(v1_8::OutputArraySchema {
                            size: v1_8::OutputSizeSchema {
                                w: array.size.w,
                                h: array.size.h,
                            },
                            values: array.values,
                        })
                    }
                }
            } else {
                v1_8::OutputValueSchema::Single(v1_8::CellValueSchema::Blank)
            };
            let new_data_table = v1_8::DataTableSchema {
                kind: v1_8::DataTableKindSchema::CodeRun(new_code_run),
                name: format!("Table {}", i),
                has_header: false,
                columns: None,
                sort: None,
                display_buffer: None,
                value,
                readonly: true,
                spill_error: code_run.spill_error,
                last_modified: code_run.last_modified,
            };
            Ok((v1_8::PosSchema::from(pos), new_data_table))
        })
        .collect::<Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>>>()
}

pub fn upgrade_sheet(sheet: v1_7::SheetSchema) -> Result<v1_8::SheetSchema> {
    Ok(v1_8::SheetSchema {
        id: sheet.id,
        name: sheet.name,
        color: sheet.color,
        order: sheet.order,
        offsets: sheet.offsets,
        columns: sheet.columns,
        data_tables: upgrade_code_runs(sheet.code_runs)?,
        formats_all: sheet.formats_all,
        formats_columns: sheet.formats_columns,
        formats_rows: sheet.formats_rows,
        rows_resize: sheet.rows_resize,
        validations: sheet.validations,
        borders: sheet.borders,
    })
}

pub fn upgrade(grid: v1_7::GridSchema) -> Result<v1_8::GridSchema> {
    let new_grid = v1_8::GridSchema {
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

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{
            file::{export, import},
            CellBorderLine,
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
