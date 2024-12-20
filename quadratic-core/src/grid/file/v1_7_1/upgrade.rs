use anyhow::Result;

use crate::grid::file::v1_7_1 as current;
use crate::grid::file::v1_8;

fn upgrade_code_runs(
    code_runs: Vec<(current::PosSchema, current::CodeRunSchema)>,
    columns: &[(i64, current::ColumnSchema)],
) -> Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>> {
    code_runs
        .into_iter()
        .enumerate()
        .map(|(i, (pos, code_run))| {
            let error = if let current::CodeRunResultSchema::Err(error) = &code_run.result {
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

            // TODO(ddimaria): fix this
            let column = columns.get(i).unwrap();

            let data_table_name = column
                .1
                .iter()
                .filter_map(|(_, value)| {
                    if let current::CellValueSchema::Code(code_cell) = value {
                        let language = match code_cell.language {
                            current::CodeCellLanguageSchema::Formula => "Formula",
                            current::CodeCellLanguageSchema::Javascript => "JavaScript",
                            current::CodeCellLanguageSchema::Python => "Python",
                            _ => "Table1",
                        };
                        return Some(language);
                    }
                    None
                })
                .collect::<Vec<_>>()
                .first()
                .unwrap_or(&"Table");

            let data_table_name = format!("{}{}", data_table_name, i);

            let value = if let current::CodeRunResultSchema::Ok(value) = &code_run.result {
                match value.to_owned() {
                    current::OutputValueSchema::Single(cell_value) => {
                        v1_8::OutputValueSchema::Single(cell_value)
                    }
                    current::OutputValueSchema::Array(array) => {
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
                name: data_table_name,
                header_is_first_row: false,
                show_header: false,
                columns: None,
                sort: None,
                display_buffer: None,
                value,
                readonly: true,
                spill_error: code_run.spill_error,
                last_modified: code_run.last_modified,
                alternating_colors: true,
                formats: Default::default(),
                chart_pixel_output: code_run.chart_pixel_output,
                chart_output: None,
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

    v1_8::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        validations,
        borders,
        formats,
        data_tables: upgrade_code_runs(code_runs, &columns).unwrap_or_default(),
        columns,
    }
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_8::GridSchema> {
    let new_grid = v1_8::GridSchema {
        version: Some("1.8".to_string()),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}
